const Compra = require('../models/Compra');
const DetalleCompra = require('../models/DetalleCompra');
const Producto = require('../models/Producto');
const Proveedor = require('../models/Proveedor');
const sequelize = require('../config/db');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');

// Datos Fiscales del Agente de Retención (Nuestra Empresa)
const AGENTE_RETENCION = {
    razon_social: 'AGUA GRAND, C.A.',
    rif: 'J-408854619',
    rif_seniat: 'J408854619',
    direccion: 'AV RAUL LEONI LOCAL NRO 3 ZONA INDUSTRIAL LOS MONTONES BARCELONA ANZOATEGUI ZONA POSTAL 6001'
};

const crearCompra = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            proveedor_id,
            tipo_documento_fiscal,
            numero_factura,
            numero_control,
            factura_afectada,
            fecha_emision,
            fecha_recepcion,
            tasa_bcv,
            monto_exento_usd,
            base_imponible_usd,
            iva_usd,
            total_usd,
            total_bs,
            dias_credito,
            metodo_pago,
            detalles,

            // Retenciones de IVA e ISLR
            aplica_retencion_iva,
            porcentaje_ret_iva,
            iva_retenido_usd,
            iva_retenido_bs,

            aplica_retencion_islr,
            codigo_concepto_islr,
            concepto_islr,
            porcentaje_ret_islr,
            sustraendo_islr_bs,
            islr_retenido_usd,
            islr_retenido_bs,

            neto_pagar_usd,
            neto_pagar_bs
        } = req.body;

        if (!proveedor_id || !numero_factura || !numero_control || !fecha_emision || !tasa_bcv) {
            await t.rollback();
            return res.status(400).json({ 
                mensaje: "Faltan campos obligatorios (proveedor, número de factura, número de control, fecha de emisión o tasa BCV)" 
            });
        }

        const proveedor = await Proveedor.findByPk(proveedor_id);
        if (!proveedor) {
            await t.rollback();
            return res.status(404).json({ mensaje: "El proveedor seleccionado no existe" });
        }

        const tipoDoc = (tipo_documento_fiscal || 'FACTURA').toUpperCase();

        if ((tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') && !factura_afectada) {
            await t.rollback();
            return res.status(400).json({ 
                mensaje: "Para Notas de Débito o Crédito es obligatorio indicar la 'Factura Afectada'" 
            });
        }

        if (!Array.isArray(detalles) || detalles.length === 0) {
            await t.rollback();
            return res.status(400).json({ mensaje: "Debe incluir al menos un renglón en la compra o nota" });
        }

        // LÓGICA DE STOCK SEGÚN TIPO DE DOCUMENTO FISCAL
        for (const item of detalles) {
            if (item.producto_id) {
                const productoDB = await Producto.findByPk(item.producto_id, { transaction: t });
                if (!productoDB) {
                    await t.rollback();
                    return res.status(404).json({ mensaje: `Producto con ID ${item.producto_id} no encontrado` });
                }

                const cant = parseInt(item.cantidad, 10) || 0;

                if (tipoDoc === 'FACTURA') {
                    // SUMAR al stock físico
                    const nuevoStock = productoDB.cantidad + cant;
                    const updateData = { cantidad: nuevoStock };
                    
                    // Si el usuario indicó actualizar precio de venta
                    if (item.nuevo_precio_usd && parseFloat(item.nuevo_precio_usd) > 0) {
                        updateData.precio_usd = parseFloat(item.nuevo_precio_usd);
                    }

                    await productoDB.update(updateData, { transaction: t });

                } else if (tipoDoc === 'NOTA_CREDITO') {
                    // RESTAR del stock (devolución sobre compra)
                    if (productoDB.cantidad < cant) {
                        await t.rollback();
                        return res.status(400).json({ 
                            mensaje: `Stock insuficiente para devolver "${productoDB.nombre}". Stock disponible: ${productoDB.cantidad}, cantidad a devolver: ${cant}` 
                        });
                    }
                    await productoDB.update({ 
                        cantidad: productoDB.cantidad - cant 
                    }, { transaction: t });

                } else if (tipoDoc === 'NOTA_DEBITO') {
                    // NO altera el stock físico (es ajuste de costo, flete o interés)
                }
            }
        }

        // Generación de Correlativos Oficiales de Retención SENIAT (AAAAMM + 8 dígitos)
        const fechaBase = new Date(fecha_emision ? `${fecha_emision}T00:00:00` : new Date());
        const anioMes = `${fechaBase.getFullYear()}${String(fechaBase.getMonth() + 1).padStart(2, '0')}`;

        let comprobante_ret_iva = null;
        if (aplica_retencion_iva && (parseFloat(iva_retenido_bs) > 0 || parseFloat(iva_retenido_usd) > 0)) {
            const ultimaRetIva = await Compra.findOne({
                where: { comprobante_ret_iva: { [Op.ne]: null } },
                order: [['id', 'DESC']],
                transaction: t
            });

            let sigIva = 1;
            if (ultimaRetIva && ultimaRetIva.comprobante_ret_iva) {
                const ultimos8 = ultimaRetIva.comprobante_ret_iva.slice(-8);
                const num = parseInt(ultimos8, 10);
                if (!isNaN(num)) sigIva = num + 1;
            }
            comprobante_ret_iva = `${anioMes}${String(sigIva).padStart(8, '0')}`;
        }

        let comprobante_ret_islr = null;
        if (aplica_retencion_islr && (parseFloat(islr_retenido_bs) > 0 || parseFloat(islr_retenido_usd) > 0)) {
            const ultimaRetIslr = await Compra.findOne({
                where: { comprobante_ret_islr: { [Op.ne]: null } },
                order: [['id', 'DESC']],
                transaction: t
            });

            let sigIslr = 1;
            if (ultimaRetIslr && ultimaRetIslr.comprobante_ret_islr) {
                const ultimos8 = ultimaRetIslr.comprobante_ret_islr.slice(-8);
                const num = parseInt(ultimos8, 10);
                if (!isNaN(num)) sigIslr = num + 1;
            }
            comprobante_ret_islr = `${anioMes}${String(sigIslr).padStart(8, '0')}`;
        }

        // Cálculo de Netos a pagar
        const ivaRetUsd = parseFloat(iva_retenido_usd) || 0;
        const ivaRetBs = parseFloat(iva_retenido_bs) || 0;
        const islrRetUsd = parseFloat(islr_retenido_usd) || 0;
        const islrRetBs = parseFloat(islr_retenido_bs) || 0;

        const totalUsdVal = parseFloat(total_usd) || 0;
        const totalBsVal = parseFloat(total_bs) || 0;

        const realNetoUsd = neto_pagar_usd !== undefined ? parseFloat(neto_pagar_usd) : Math.max(0, totalUsdVal - ivaRetUsd - islrRetUsd);
        const realNetoBs = neto_pagar_bs !== undefined ? parseFloat(neto_pagar_bs) : Math.max(0, totalBsVal - ivaRetBs - islrRetBs);

        // Determinar estado de la compra: si es crédito -> PENDIENTE, sino PAGADA
        const diasCred = parseInt(dias_credito, 10) || 0;
        const estadoCompra = (metodo_pago === 'Crédito' || diasCred > 0) ? 'PENDIENTE' : 'PAGADA';

        const nuevaCompra = await Compra.create({
            proveedor_id,
            tipo_documento_fiscal: tipoDoc,
            numero_factura: numero_factura.trim(),
            numero_control: numero_control.trim(),
            factura_afectada: factura_afectada ? factura_afectada.trim() : null,
            fecha_emision,
            fecha_recepcion: fecha_recepcion || new Date(),
            tasa_bcv: parseFloat(tasa_bcv),
            monto_exento_usd: parseFloat(monto_exento_usd) || 0,
            base_imponible_usd: parseFloat(base_imponible_usd) || 0,
            iva_usd: parseFloat(iva_usd) || 0,
            total_usd: totalUsdVal,
            total_bs: totalBsVal,
            dias_credito: diasCred,
            metodo_pago: metodo_pago || 'Efectivo',
            estado: estadoCompra,

            // Retenciones
            aplica_retencion_iva: !!aplica_retencion_iva,
            porcentaje_ret_iva: parseInt(porcentaje_ret_iva, 10) || 0,
            iva_retenido_usd: ivaRetUsd,
            iva_retenido_bs: ivaRetBs,
            comprobante_ret_iva,

            aplica_retencion_islr: !!aplica_retencion_islr,
            codigo_concepto_islr: codigo_concepto_islr || null,
            concepto_islr: concepto_islr || null,
            porcentaje_ret_islr: parseFloat(porcentaje_ret_islr) || 0,
            sustraendo_islr_bs: parseFloat(sustraendo_islr_bs) || 0,
            islr_retenido_usd: islrRetUsd,
            islr_retenido_bs: islrRetBs,
            comprobante_ret_islr,

            neto_pagar_usd: realNetoUsd,
            neto_pagar_bs: realNetoBs
        }, { transaction: t });

        // Guardar detalles
        for (const item of detalles) {
            await DetalleCompra.create({
                compra_id: nuevaCompra.id,
                producto_id: item.producto_id || null,
                descripcion: item.descripcion || (item.nombre || 'Item sin descripción'),
                cantidad: parseInt(item.cantidad, 10) || 1,
                costo_unitario_usd: parseFloat(item.costo_unitario_usd) || 0,
                aplica_iva: !!item.aplica_iva,
                subtotal_usd: parseFloat(item.subtotal_usd) || 0
            }, { transaction: t });
        }

        await t.commit();

        const compraCompleta = await Compra.findByPk(nuevaCompra.id, {
            include: [
                { model: Proveedor },
                { model: DetalleCompra, include: [{ model: Producto }] }
            ]
        });

        res.status(201).json({ 
            mensaje: "Documento fiscal de compra registrado exitosamente", 
            data: compraCompleta 
        });

    } catch (error) {
        await t.rollback();
        console.error("Error creando compra:", error);
        res.status(500).json({ mensaje: "Error al registrar la compra", error: error.message });
    }
};

const obtenerCompras = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        let whereClause = {};

        if (fecha_inicio && fecha_fin) {
            const inicioStr = fecha_inicio.split('T')[0];
            const finStr = fecha_fin.split('T')[0];
            whereClause.fecha_emision = {
                [Op.between]: [inicioStr, finStr]
            };
        }

        const compras = await Compra.findAll({
            where: whereClause,
            include: [
                { 
                    model: Proveedor,
                    attributes: ['id', 'nombre', 'tipo_documento', 'numero_documento', 'telefono', 'correo', 'direccion', 'porcentaje_retencion_iva', 'porcentaje_retencion_islr']
                },
                { 
                    model: DetalleCompra,
                    include: [{ model: Producto, attributes: ['id', 'codigo_producto', 'nombre', 'precio_usd'] }]
                }
            ],
            order: [
                ['fecha_emision', 'DESC'],
                ['createdAt', 'DESC']
            ]
        });

        res.status(200).json(compras);
    } catch (error) {
        console.error("Error al obtener compras:", error);
        res.status(500).json({ mensaje: "Error al obtener compras", error: error.message });
    }
};

const pagarCompraPendiente = async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo_pago } = req.body;

        const compra = await Compra.findByPk(id);
        if (!compra) {
            return res.status(404).json({ mensaje: "Compra no encontrada" });
        }

        if (compra.estado !== 'PENDIENTE') {
            return res.status(400).json({ mensaje: "La compra no se encuentra pendiente de pago" });
        }

        await compra.update({
            estado: 'PAGADA',
            metodo_pago: metodo_pago || compra.metodo_pago
        });

        res.status(200).json({ 
            mensaje: "Cuenta por pagar saldada con éxito", 
            data: compra 
        });
    } catch (error) {
        console.error("Error al pagar compra:", error);
        res.status(500).json({ mensaje: "Error al registrar el pago", error: error.message });
    }
};

const anularCompra = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const compra = await Compra.findByPk(id, {
            include: [{ model: DetalleCompra }]
        });

        if (!compra) {
            await t.rollback();
            return res.status(404).json({ mensaje: "Compra no encontrada" });
        }

        if (compra.estado === 'ANULADA') {
            await t.rollback();
            return res.status(400).json({ mensaje: "La compra ya se encuentra anulada" });
        }

        // REVERTIR IMPACTO EN INVENTARIO
        const tipoDoc = compra.tipo_documento_fiscal.toUpperCase();

        for (const detalle of compra.DetalleCompras) {
            if (detalle.producto_id) {
                const productoDB = await Producto.findByPk(detalle.producto_id, { transaction: t });
                if (productoDB) {
                    if (tipoDoc === 'FACTURA') {
                        const nuevoStock = Math.max(0, productoDB.cantidad - detalle.cantidad);
                        await productoDB.update({ cantidad: nuevoStock }, { transaction: t });
                    } else if (tipoDoc === 'NOTA_CREDITO') {
                        await productoDB.update({ cantidad: productoDB.cantidad + detalle.cantidad }, { transaction: t });
                    }
                }
            }
        }

        await compra.update({ estado: 'ANULADA' }, { transaction: t });

        await t.commit();
        res.status(200).json({ mensaje: "Compra anulada e inventario revertido correctamente" });

    } catch (error) {
        await t.rollback();
        console.error("Error al anular compra:", error);
        res.status(500).json({ mensaje: "Error al anular la compra", error: error.message });
    }
};

// =========================================================================
// EXPORTADOR EXCEL LIBRO DE COMPRAS FISCAL CON RETENCIONES SENIAT
// =========================================================================
const exportarLibroComprasExcel = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        let whereClause = {};

        if (fecha_inicio && fecha_fin) {
            const inicioStr = fecha_inicio.split('T')[0];
            const finStr = fecha_fin.split('T')[0];
            whereClause.fecha_emision = {
                [Op.between]: [inicioStr, finStr]
            };
        }

        const compras = await Compra.findAll({
            where: whereClause,
            include: [{ 
                model: Proveedor,
                attributes: ['nombre', 'tipo_documento', 'numero_documento']
            }],
            order: [
                ['fecha_emision', 'ASC'],
                ['id', 'ASC']
            ]
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = AGENTE_RETENCION.razon_social;
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Libro de Compras SENIAT');
        worksheet.views = [{ showGridLines: true }];

        // Fila 1: Título Principal SENIAT
        worksheet.mergeCells('A1:U1');
        const titleRow = worksheet.getCell('A1');
        titleRow.value = `LIBRO DE COMPRAS FISCAL (SENIAT) - ${AGENTE_RETENCION.razon_social} (RIF: ${AGENTE_RETENCION.rif})`;
        titleRow.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } };
        worksheet.getRow(1).height = 28;

        // Fila 2: Subtítulo con Período
        worksheet.mergeCells('A2:U2');
        const periodRow = worksheet.getCell('A2');
        const periodoTexto = (fecha_inicio && fecha_fin) 
            ? `Período: ${fecha_inicio.split('T')[0]} al ${fecha_fin.split('T')[0]} | Total Registros: ${compras.length}`
            : `Período Histórico Completo | Total Registros: ${compras.length}`;
        periodRow.value = periodoTexto;
        periodRow.font = { name: 'Arial', size: 10, italic: true };
        periodRow.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 20;

        // Fila 3: Espaciador
        worksheet.addRow([]);

        // Fila 4: Cabeceras Oficiales
        const headers = [
            'N° Operación',
            'Fecha Emisión',
            'RIF Proveedor',
            'Nombre o Razón Social',
            'Tipo Doc',
            'N° Factura',
            'N° Control',
            'N° Factura Afectada',
            'Condición',
            'Estado',
            'Total Compras (Bs)',
            'Compras Exentas (Bs)',
            'Base Imponible 16% (Bs)',
            'IVA 16% (Bs)',
            'IVA Retenido (Bs)',
            'N° Comprobante IVA',
            'ISLR Retenido (Bs)',
            'N° Comprobante ISLR',
            'Neto a Pagar (Bs)',
            'Total (USD)',
            'Neto a Pagar (USD)'
        ];

        const headerRow = worksheet.addRow(headers);
        headerRow.height = 28;
        headerRow.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1565C0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            };
        });

        // Column widths
        worksheet.columns = [
            { key: 'op', width: 12 },
            { key: 'fecha', width: 13 },
            { key: 'rif', width: 15 },
            { key: 'proveedor', width: 32 },
            { key: 'tipo', width: 9 },
            { key: 'factura', width: 15 },
            { key: 'control', width: 15 },
            { key: 'afectada', width: 16 },
            { key: 'condicion', width: 11 },
            { key: 'estado', width: 11 },
            { key: 'total_bs', width: 20 },
            { key: 'exento_bs', width: 16 },
            { key: 'base_bs', width: 18 },
            { key: 'iva_bs', width: 15 },
            { key: 'iva_ret_bs', width: 16 },
            { key: 'comp_iva', width: 18 },
            { key: 'islr_ret_bs', width: 16 },
            { key: 'comp_islr', width: 18 },
            { key: 'neto_bs', width: 20 },
            { key: 'total_usd', width: 15 },
            { key: 'neto_usd', width: 16 }
        ];

        let sumTotalBs = 0;
        let sumExentoBs = 0;
        let sumBaseBs = 0;
        let sumIvaBs = 0;
        let sumIvaRetBs = 0;
        let sumIslrRetBs = 0;
        let sumNetoBs = 0;
        let sumTotalUsd = 0;
        let sumNetoUsd = 0;

        compras.forEach((compra, index) => {
            const tasa = parseFloat(compra.tasa_bcv) || 1;
            const esNC = compra.tipo_documento_fiscal.toUpperCase() === 'NOTA_CREDITO';
            const esAnulada = compra.estado === 'ANULADA';
            const mult = esNC ? -1 : 1;

            let tipoAbrev = 'FAC';
            if (compra.tipo_documento_fiscal === 'NOTA_CREDITO') tipoAbrev = 'NC';
            if (compra.tipo_documento_fiscal === 'NOTA_DEBITO') tipoAbrev = 'ND';

            const rif = compra.Proveedor 
                ? `${compra.Proveedor.tipo_documento}-${compra.Proveedor.numero_documento}`
                : 'N/A';
            const nombreProveedor = compra.Proveedor ? compra.Proveedor.nombre : 'Proveedor Desconocido';

            let exentoBs = (parseFloat(compra.monto_exento_usd) || 0) * tasa;
            let baseBs = (parseFloat(compra.base_imponible_usd) || 0) * tasa;
            let ivaBs = (parseFloat(compra.iva_usd) || 0) * tasa;
            let totalBs = parseFloat(compra.total_bs) || (baseBs + exentoBs + ivaBs);
            let ivaRetBs = parseFloat(compra.iva_retenido_bs) || 0;
            let islrRetBs = parseFloat(compra.islr_retenido_bs) || 0;
            let netoBs = parseFloat(compra.neto_pagar_bs) || (totalBs - ivaRetBs - islrRetBs);

            let totalUsd = parseFloat(compra.total_usd) || 0;
            let netoUsd = parseFloat(compra.neto_pagar_usd) || (totalUsd - (parseFloat(compra.iva_retenido_usd) || 0) - (parseFloat(compra.islr_retenido_usd) || 0));

            if (esAnulada) {
                exentoBs = 0; baseBs = 0; ivaBs = 0; totalBs = 0;
                ivaRetBs = 0; islrRetBs = 0; netoBs = 0;
                totalUsd = 0; netoUsd = 0;
            } else {
                exentoBs *= mult; baseBs *= mult; ivaBs *= mult; totalBs *= mult;
                ivaRetBs *= mult; islrRetBs *= mult; netoBs *= mult;
                totalUsd *= mult; netoUsd *= mult;

                sumTotalBs += totalBs;
                sumExentoBs += exentoBs;
                sumBaseBs += baseBs;
                sumIvaBs += ivaBs;
                sumIvaRetBs += ivaRetBs;
                sumIslrRetBs += islrRetBs;
                sumNetoBs += netoBs;
                sumTotalUsd += totalUsd;
                sumNetoUsd += netoUsd;
            }

            const diasCred = parseInt(compra.dias_credito, 10) || 0;
            const condicion = diasCred > 0 ? 'Crédito' : 'Contado';

            const row = worksheet.addRow({
                op: index + 1,
                fecha: compra.fecha_emision,
                rif: rif,
                proveedor: nombreProveedor,
                tipo: tipoAbrev,
                factura: compra.numero_factura,
                control: compra.numero_control,
                afectada: compra.factura_afectada || 'N/A',
                condicion: condicion,
                estado: compra.estado,
                total_bs: Number(totalBs.toFixed(2)),
                exento_bs: Number(exentoBs.toFixed(2)),
                base_bs: Number(baseBs.toFixed(2)),
                iva_bs: Number(ivaBs.toFixed(2)),
                iva_ret_bs: Number(ivaRetBs.toFixed(2)),
                comp_iva: compra.comprobante_ret_iva || '-',
                islr_ret_bs: Number(islrRetBs.toFixed(2)),
                comp_islr: compra.comprobante_ret_islr || '-',
                neto_bs: Number(netoBs.toFixed(2)),
                total_usd: Number(totalUsd.toFixed(2)),
                neto_usd: Number(netoUsd.toFixed(2))
            });

            row.alignment = { vertical: 'middle' };
            [1, 2, 3, 5, 6, 7, 8, 9, 10, 16, 18].forEach(col => {
                row.getCell(col).alignment = { horizontal: 'center' };
            });

            [11, 12, 13, 14, 15, 17, 19, 20, 21].forEach(colIndex => {
                const cell = row.getCell(colIndex);
                cell.numFmt = '#,##0.00;[Red]-#,##0.00;"0.00"';
                cell.alignment = { horizontal: 'right' };
            });

            if (esAnulada) {
                row.font = { italic: true, color: { argb: 'FF9E9E9E' } };
            } else if (esNC) {
                row.font = { color: { argb: 'FFB71C1C' } };
            }
        });

        // Fila de Totales
        const totalRow = worksheet.addRow({
            op: '',
            fecha: '',
            rif: '',
            proveedor: 'TOTALES FISCALES:',
            tipo: '',
            factura: '',
            control: '',
            afectada: '',
            condicion: '',
            estado: '',
            total_bs: Number(sumTotalBs.toFixed(2)),
            exento_bs: Number(sumExentoBs.toFixed(2)),
            base_bs: Number(sumBaseBs.toFixed(2)),
            iva_bs: Number(sumIvaBs.toFixed(2)),
            iva_ret_bs: Number(sumIvaRetBs.toFixed(2)),
            comp_iva: '',
            islr_ret_bs: Number(sumIslrRetBs.toFixed(2)),
            comp_islr: '',
            neto_bs: Number(sumNetoBs.toFixed(2)),
            total_usd: Number(sumTotalUsd.toFixed(2)),
            neto_usd: Number(sumNetoUsd.toFixed(2))
        });

        totalRow.height = 25;
        totalRow.font = { name: 'Arial', size: 10, bold: true };
        totalRow.alignment = { vertical: 'middle' };
        totalRow.getCell(4).alignment = { horizontal: 'right' };

        [11, 12, 13, 14, 15, 17, 19, 20, 21].forEach(colIndex => {
            const cell = totalRow.getCell(colIndex);
            cell.numFmt = '#,##0.00;[Red]-#,##0.00;"0.00"';
            cell.alignment = { horizontal: 'right' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'double' }
            };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Libro_de_Compras_SENIAT.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error al generar Libro de Compras en Excel:", error);
        res.status(500).json({ mensaje: "Error al generar archivo Excel", error: error.message });
    }
};

// =========================================================================
// EXPORTADOR TXT OFICIAL SENIAT PARA RETENCIONES DE IVA (16 CAMPOS)
// =========================================================================
const exportarTxtIva = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        let whereClause = {
            aplica_retencion_iva: true,
            estado: { [Op.ne]: 'ANULADA' }
        };

        if (fecha_inicio && fecha_fin) {
            const inicioStr = fecha_inicio.split('T')[0];
            const finStr = fecha_fin.split('T')[0];
            whereClause.fecha_emision = {
                [Op.between]: [inicioStr, finStr]
            };
        }

        const compras = await Compra.findAll({
            where: whereClause,
            include: [{ 
                model: Proveedor,
                attributes: ['nombre', 'tipo_documento', 'numero_documento']
            }],
            order: [
                ['fecha_emision', 'ASC'],
                ['id', 'ASC']
            ]
        });

        const lineas = [];

        for (const c of compras) {
            const tasa = parseFloat(c.tasa_bcv) || 1;
            const esNC = c.tipo_documento_fiscal.toUpperCase() === 'NOTA_CREDITO';
            const mult = esNC ? -1 : 1;

            // 1. RIF Agente (sin guiones)
            const rifAgente = AGENTE_RETENCION.rif_seniat;

            // 2. Periodo AAAAMM
            const fechaDoc = new Date(c.fecha_emision ? `${c.fecha_emision}T00:00:00` : new Date());
            const periodo = `${fechaDoc.getFullYear()}${String(fechaDoc.getMonth() + 1).padStart(2, '0')}`;

            // 3. Fecha Factura (AAAA-MM-DD)
            const fechaFactura = c.fecha_emision;

            // 4. Tipo Operación: 'C' (Compras)
            const tipoOperacion = 'C';

            // 5. Tipo Documento: 01=Factura, 02=Nota Débito, 03=Nota Crédito
            let tipoDoc = '01';
            if (c.tipo_documento_fiscal === 'NOTA_DEBITO') tipoDoc = '02';
            if (c.tipo_documento_fiscal === 'NOTA_CREDITO') tipoDoc = '03';

            // 6. RIF Proveedor (sin guiones)
            let rifProveedor = '';
            if (c.Proveedor) {
                rifProveedor = `${c.Proveedor.tipo_documento}${c.Proveedor.numero_documento}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            }

            // 7. Número Factura
            const numeroFactura = (c.numero_factura || '').replace(/\t/g, ' ').trim();

            // 8. Número Control
            const numeroControl = (c.numero_control || '').replace(/\t/g, ' ').trim();

            // Montos en Bs
            const baseBs = ((parseFloat(c.base_imponible_usd) || 0) * tasa * mult).toFixed(2);
            const exentoBs = ((parseFloat(c.monto_exento_usd) || 0) * tasa * mult).toFixed(2);
            const totalBs = ((parseFloat(c.total_bs) || 0) * mult).toFixed(2);
            const ivaRetenidoBs = ((parseFloat(c.iva_retenido_bs) || 0) * mult).toFixed(2);

            // 12. Factura Afectada (0 si es factura)
            const facturaAfectada = (tipoDoc !== '01' && c.factura_afectada) ? c.factura_afectada.trim() : '0';

            // 13. Número de Comprobante (14 dígitos)
            const comprobante = c.comprobante_ret_iva || `${periodo}00000001`;

            // 15. Alícuota
            const alicuota = '16.00';

            // 16. Expediente
            const expediente = '0';

            // Armar línea de 16 campos separados por TAB (\t)
            const campos = [
                rifAgente,            // 1
                periodo,              // 2
                fechaFactura,         // 3
                tipoOperacion,        // 4
                tipoDoc,              // 5
                rifProveedor,         // 6
                numeroFactura,        // 7
                numeroControl,        // 8
                totalBs,              // 9
                baseBs,               // 10
                ivaRetenidoBs,        // 11
                facturaAfectada,      // 12
                comprobante,          // 13
                exentoBs,             // 14
                alicuota,             // 15
                expediente            // 16
            ];

            lineas.push(campos.join('\t'));
        }

        const contenidoTxt = lineas.join('\r\n');

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=Retenciones_IVA_SENIAT.txt');
        res.send(contenidoTxt);

    } catch (error) {
        console.error("Error al exportar TXT de IVA:", error);
        res.status(500).json({ mensaje: "Error al generar archivo TXT de IVA", error: error.message });
    }
};

// =========================================================================
// EXPORTADOR XML OFICIAL SENIAT PARA RETENCIONES DE ISLR
// =========================================================================
const exportarXmlIslr = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        let whereClause = {
            aplica_retencion_islr: true,
            estado: { [Op.ne]: 'ANULADA' }
        };

        if (fecha_inicio && fecha_fin) {
            const inicioStr = fecha_inicio.split('T')[0];
            const finStr = fecha_fin.split('T')[0];
            whereClause.fecha_emision = {
                [Op.between]: [inicioStr, finStr]
            };
        }

        const compras = await Compra.findAll({
            where: whereClause,
            include: [{ 
                model: Proveedor,
                attributes: ['nombre', 'tipo_documento', 'numero_documento']
            }],
            order: [
                ['fecha_emision', 'ASC'],
                ['id', 'ASC']
            ]
        });

        // Periodo base
        const now = new Date();
        let periodoStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (compras.length > 0 && compras[0].fecha_emision) {
            const f = new Date(`${compras[0].fecha_emision}T00:00:00`);
            periodoStr = `${f.getFullYear()}${String(f.getMonth() + 1).padStart(2, '0')}`;
        }

        let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\r\n`;
        xml += `<RelacionRetencionesISLR RifAgente="${AGENTE_RETENCION.rif_seniat}" Periodo="${periodoStr}">\r\n`;

        for (const c of compras) {
            const tasa = parseFloat(c.tasa_bcv) || 1;
            let rifRetenido = '';
            if (c.Proveedor) {
                rifRetenido = `${c.Proveedor.tipo_documento}${c.Proveedor.numero_documento}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            }

            const fechaParts = (c.fecha_emision || '').split('-');
            const fechaOperacion = fechaParts.length === 3 ? `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}` : '';

            const codigoConcepto = c.codigo_concepto_islr || '053';
            const baseBs = (parseFloat(c.base_imponible_usd) || 0) * tasa;
            const porcentaje = (parseFloat(c.porcentaje_ret_islr) || 0).toFixed(2);

            xml += `  <DetalleRetencion>\r\n`;
            xml += `    <RifRetenido>${rifRetenido}</RifRetenido>\r\n`;
            xml += `    <NumeroFactura>${c.numero_factura || ''}</NumeroFactura>\r\n`;
            xml += `    <NumeroControl>${c.numero_control || ''}</NumeroControl>\r\n`;
            xml += `    <FechaOperacion>${fechaOperacion}</FechaOperacion>\r\n`;
            xml += `    <CodigoConcepto>${codigoConcepto}</CodigoConcepto>\r\n`;
            xml += `    <MontoOperacion>${baseBs.toFixed(2)}</MontoOperacion>\r\n`;
            xml += `    <PorcentajeRetencion>${porcentaje}</PorcentajeRetencion>\r\n`;
            xml += `  </DetalleRetencion>\r\n`;
        }

        xml += `</RelacionRetencionesISLR>`;

        res.setHeader('Content-Type', 'application/xml; charset=ISO-8859-1');
        res.setHeader('Content-Disposition', 'attachment; filename=Retenciones_ISLR_SENIAT.xml');
        res.send(xml);

    } catch (error) {
        console.error("Error al exportar XML de ISLR:", error);
        res.status(500).json({ mensaje: "Error al generar archivo XML de ISLR", error: error.message });
    }
};

module.exports = {
    AGENTE_RETENCION,
    crearCompra,
    obtenerCompras,
    pagarCompraPendiente,
    anularCompra,
    exportarLibroComprasExcel,
    exportarTxtIva,
    exportarXmlIslr
};
