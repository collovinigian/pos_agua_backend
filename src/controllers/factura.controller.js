const Factura = require('../models/Factura');
const DetalleFactura = require('../models/DetalleFactura');
const Producto = require('../models/Producto');
const Jornada = require('../models/Jornada');
const Cliente = require('../models/Cliente'); 
const sequelize = require('../config/db');
const { Op } = require('sequelize');
const impresoraService = require('../services/impresora.service');
const ExcelJS = require('exceljs');

const crearFactura = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { cliente_id, jornada_id, metodo_pago, dias_credito, subtotal_usd, iva_usd, total_usd, total_bs, tasa_bcv, productos } = req.body;

        const jornada = await Jornada.findByPk(jornada_id);
        if (!jornada || jornada.estado === 'CERRADA') {
            await t.rollback();
            return res.status(400).json({ mensaje: "La caja está cerrada. Debes abrir una jornada para facturar." });
        }

        // =================================================================
        // LÓGICA UNIVERSAL DE CORRELATIVOS
        // =================================================================
        const ultimaFactura = await Factura.findOne({
            order: [['createdAt', 'DESC']]
        });

        let siguienteNumero = 1;
        if (ultimaFactura && ultimaFactura.numero_factura) {
            // Lee el número de la última factura en la BD (Ej: de "F-000029" saca 29) y le suma 1
            const ultimoCorrelativo = parseInt(ultimaFactura.numero_factura.replace(/\D/g, ''), 10);
            siguienteNumero = ultimoCorrelativo + 1;
        }

        const correlativo = siguienteNumero.toString().padStart(6, '0');
        const numero_factura = `F-${correlativo}`;
        // =================================================================

        const estadoFactura = metodo_pago === 'Crédito' ? 'PENDIENTE' : 'PAGADA';

        const nuevaFactura = await Factura.create({
            numero_factura, subtotal_usd, iva_usd, total_usd, tasa_bcv, total_bs, 
            metodo_pago, dias_credito: dias_credito || 0, estado: estadoFactura, 
            cliente_id, jornada_id
        }, { transaction: t });

        for (let item of productos) {
            const productoDB = await Producto.findByPk(item.producto_id);
            if (!productoDB) throw new Error(`El producto no existe.`);
            if (productoDB.cantidad < item.cantidad) throw new Error(`Stock insuficiente para: ${productoDB.nombre}.`);

            item.nombre = productoDB.nombre;

            await DetalleFactura.create({
                factura_id: nuevaFactura.id, producto_id: item.producto_id, cantidad: item.cantidad,
                precio_unitario_usd: item.precio_unitario_usd, aplica_iva: item.aplica_iva, subtotal_usd: item.subtotal_usd
            }, { transaction: t });

            await productoDB.update({ cantidad: productoDB.cantidad - item.cantidad }, { transaction: t });
        }

        // 1. Buscamos los datos reales del cliente en la Base de Datos
        const clienteFactura = await Cliente.findByPk(cliente_id);

        // 2. Disparamos la impresión física pasando los datos dinámicos reales (INCLUYENDO DIRECCIÓN)
        await impresoraService.imprimirFacturaFiscal(
            { 
                nombre: clienteFactura ? clienteFactura.nombre : "Cliente Contado", 
                tipo_documento: clienteFactura ? clienteFactura.tipo_documento : "V", 
                numero_documento: clienteFactura ? clienteFactura.numero_documento : "00000000",
                direccion: clienteFactura ? clienteFactura.direccion : "N/A"
            },
            productos,
            tasa_bcv,
            metodo_pago
        );

        await t.commit();
        res.status(201).json({ mensaje: "Factura procesada con éxito", data: nuevaFactura });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al procesar la factura", error: error.message });
    }
};

const obtenerFacturas = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        let whereClause = {};

        if (fecha_inicio && fecha_fin) {
            const inicio = new Date(fecha_inicio);
            inicio.setHours(0, 0, 0, 0); 
            
            const fin = new Date(fecha_fin);
            fin.setHours(23, 59, 59, 999); 

            whereClause.createdAt = {
                [Op.between]: [inicio, fin]
            };
        }

        const facturas = await Factura.findAll({ 
            where: whereClause, 
            include: [
                { model: Cliente, attributes: ['nombre', 'tipo_documento', 'numero_documento'] },
                { model: DetalleFactura, include: [{ model: Producto, attributes: ['nombre'] }] } 
            ],
            order: [['createdAt', 'DESC']] 
        });
        res.status(200).json(facturas);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener facturas", error: error.message });
    }
};

const pagarFacturaPendiente = async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo_pago } = req.body;
        
        const factura = await Factura.findByPk(id);
        if (!factura) return res.status(404).json({ mensaje: "Factura no encontrada" });
        if (factura.estado !== 'PENDIENTE') return res.status(400).json({ mensaje: "La factura no está pendiente de pago" });

        await factura.update({ estado: 'PAGADA', metodo_pago: metodo_pago || factura.metodo_pago });
        
        res.status(200).json({ mensaje: "Factura cobrada exitosamente" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al cobrar", error: error.message });
    }
};

const anularFactura = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;
        
        const factura = await Factura.findByPk(id, {
            include: [
                { model: Cliente }, 
                { model: DetalleFactura, include: [{ model: Producto }] }
            ]
        });

        if (!factura) {
            await t.rollback();
            return res.status(404).json({ mensaje: "Factura no encontrada" });
        }

        if (factura.estado === 'ANULADA') {
            await t.rollback();
            return res.status(400).json({ mensaje: "La factura ya se encuentra anulada" });
        }

        await factura.update({ estado: 'ANULADA' }, { transaction: t });

        for (let detalle of factura.DetalleFacturas) {
            const productoDB = await Producto.findByPk(detalle.producto_id);
            if (productoDB) {
                await productoDB.update({
                    cantidad: productoDB.cantidad + detalle.cantidad 
                }, { transaction: t });
            }
        }

        await t.commit();
        res.status(200).json({ mensaje: "Factura anulada en sistema. Emitiendo Nota de Crédito física..." });

        const clienteDatos = factura.Cliente ? factura.Cliente : { nombre: "Cliente Contado", tipo_documento: "V", numero_documento: "00000000" };
        
        impresoraService.imprimirNotaCredito(
            clienteDatos,
            factura.DetalleFacturas,
            factura.tasa_bcv, 
            factura.numero_factura,
            factura.createdAt, 
            'ZZP0021256'       
        ).catch(err => console.error("Error en fondo imprimiendo NC:", err));

    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al anular la factura", error: error.message });
    }
};

const imprimirReporteXController = async (req, res) => {
    try {
        const resultado = await impresoraService.imprimirReporteX();
        if (resultado.exito) {
            return res.status(200).json({ mensaje: "Reporte X impreso con éxito" });
        } else {
            return res.status(500).json({ mensaje: resultado.mensaje || "Error al imprimir Reporte X" });
        }
    } catch (error) {
        return res.status(500).json({ mensaje: "Error de servidor", error: error.message });
    }
};

const imprimirReporteZController = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const jornadaActiva = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        
        if (jornadaActiva) {
            await jornadaActiva.update({ 
                estado: 'CERRADA', 
                fecha_fin: new Date() 
            }, { transaction: t });
        }

        const resultado = await impresoraService.imprimirReporteZ();
        
        if (resultado.exito) {
            await t.commit(); 
            return res.status(200).json({ mensaje: "Cierre Z ejecutado en BD e impreso con éxito" });
        } else {
            await t.rollback(); 
            return res.status(500).json({ mensaje: resultado.mensaje || "Error al ejecutar Cierre Z físico" });
        }
    } catch (error) {
        await t.rollback();
        return res.status(500).json({ mensaje: "Error de servidor al hacer Cierre Z", error: error.message });
    }
};

// NUEVO: Generador de Excel
const exportarExcel = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        let whereClause = {};

        if (fecha_inicio && fecha_fin) {
            const inicio = new Date(fecha_inicio);
            inicio.setHours(0, 0, 0, 0); 
            const fin = new Date(fecha_fin);
            fin.setHours(23, 59, 59, 999); 
            whereClause.createdAt = { [Op.between]: [inicio, fin] };
        }

        const facturas = await Factura.findAll({ 
            where: whereClause, 
            include: [{ model: Cliente, attributes: ['nombre', 'tipo_documento', 'numero_documento'] }],
            order: [['createdAt', 'DESC']] 
        });

        // Crear el documento Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Ventas');

        // Definir las columnas
        worksheet.columns = [
            { header: 'N° Factura', key: 'numero', width: 15 },
            { header: 'Fecha', key: 'fecha', width: 22 },
            { header: 'Cliente', key: 'cliente', width: 35 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Base Imponible (Bs)', key: 'base_bs', width: 20 },
            { header: 'IVA (Bs)', key: 'iva_bs', width: 15 },
            { header: 'Total (Bs)', key: 'total_bs', width: 15 },
            { header: 'Total (USD)', key: 'total_usd', width: 15 }
        ];

        // Dar estilo a la cabecera
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004E98' } };

        // Llenar los datos
        facturas.forEach(f => {
            const tasa = parseFloat(f.tasa_bcv);
            const subtotalBs = (parseFloat(f.subtotal_usd) * tasa).toFixed(2);
            const ivaBs = (parseFloat(f.iva_usd) * tasa).toFixed(2);
            
            // Formatear la fecha para Venezuela
            const fechaFormateada = f.createdAt.toLocaleString('es-VE', { timeZone: 'America/Caracas' });

            worksheet.addRow({
                numero: f.numero_factura,
                fecha: fechaFormateada,
                cliente: f.Cliente ? f.Cliente.nombre : 'Contado',
                estado: f.estado,
                base_bs: Number(subtotalBs),
                iva_bs: Number(ivaBs),
                total_bs: Number(f.total_bs),
                total_usd: Number(f.total_usd)
            });
        });

        // Configurar la respuesta HTTP para descargar un archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Ventas_Agua_Grand.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ mensaje: "Error al generar Excel", error: error.message });
    }
};

module.exports = { crearFactura, obtenerFacturas, pagarFacturaPendiente, anularFactura, imprimirReporteXController, imprimirReporteZController, exportarExcel };