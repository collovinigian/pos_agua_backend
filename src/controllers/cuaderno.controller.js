const NotaEntrega = require('../models/NotaEntrega');
const DetalleNota = require('../models/DetalleNota');
const Abono = require('../models/Abono');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Factura = require('../models/Factura');
const DetalleFactura = require('../models/DetalleFactura');
const db = require('../config/db');
const { Op } = require('sequelize');

// 1. Crear Nota (Entra limpia, el IVA se agregará solo cuando se consolide/facture)
const crearNota = async (req, res) => {
    const t = await db.transaction();
    try {
        const { cliente_id, subtotal_usd, productos } = req.body;
        const totalNotas = await NotaEntrega.count();
        const numero_nota = `N-${String(totalNotas + 1).padStart(5, '0')}`;

        const nota = await NotaEntrega.create({
            numero_nota,
            cliente_id,
            subtotal_usd,
            iva_usd: 0, 
            total_usd: subtotal_usd,
            saldo_pendiente: subtotal_usd,
            estado: 'PENDIENTE'
        }, { transaction: t });

        for (let prod of productos) {
            await DetalleNota.create({
                nota_id: nota.id,
                producto_id: prod.producto_id,
                cantidad: prod.cantidad,
                precio_unitario_usd: prod.precio_unitario_usd,
                aplica_iva: false, // En el cuaderno no hay IVA, solo en la Factura Fiscal
                subtotal_usd: prod.subtotal_usd
            }, { transaction: t });

            const productoDB = await Producto.findByPk(prod.producto_id);
            if (productoDB) {
                await productoDB.update({ cantidad: productoDB.cantidad - prod.cantidad }, { transaction: t });
            }
        }
        await t.commit();
        res.status(201).json({ mensaje: "Anotado en el cuaderno con éxito", data: nota });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al anotar en cuaderno", error: error.message });
    }
};

// 2. Obtener Cuaderno Completo
const obtenerCuaderno = async (req, res) => {
    try {
        const notas = await NotaEntrega.findAll({
            include: [
                { model: Cliente, attributes: ['id', 'nombre', 'tipo_documento', 'numero_documento'] },
                { model: DetalleNota, include: [{ model: Producto, attributes: ['nombre'] }] },
                { model: Abono }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(notas);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al consultar cuaderno", error: error.message });
    }
};

// 3. ABONO GLOBAL: Paga la deuda total repartiendo el dinero a las notas más viejas primero (FIFO)
const registrarAbonoGlobal = async (req, res) => {
    const t = await db.transaction();
    try {
        const { cliente_id, monto_usd, metodo_pago } = req.body;
        let restanteUsd = parseFloat(monto_usd);

        const notasPendientes = await NotaEntrega.findAll({
            where: { cliente_id, estado: 'PENDIENTE' },
            order: [['createdAt', 'ASC']], // De la más vieja a la más nueva
            transaction: t
        });

        for (let nota of notasPendientes) {
            if (restanteUsd <= 0.01) break; // Si ya se acabó el dinero del abono, detenerse

            let deuda = parseFloat(nota.saldo_pendiente);
            let aDescontar = (restanteUsd >= deuda) ? deuda : restanteUsd;
            restanteUsd -= aDescontar;

            await Abono.create({
                nota_id: nota.id,
                monto_usd: aDescontar,
                metodo_pago
            }, { transaction: t });

            let nuevoSaldo = deuda - aDescontar;
            await nota.update({
                saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo,
                estado: nuevoSaldo <= 0.01 ? 'PAGADA' : 'PENDIENTE'
            }, { transaction: t });
        }

        await t.commit();
        res.status(200).json({ mensaje: "Abono global procesado correctamente" });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al aplicar abono global", error: error.message });
    }
};

// 4. CONSOLIDACIÓN: Convierte notas en una Factura Fiscal oficial
// 4. CONSOLIDACIÓN: Convierte notas en una Factura Fiscal oficial
const consolidarFacturas = async (req, res) => {
    const t = await db.transaction();
    try {
        const { cliente_id, jornada_id, notas_ids, metodo_pago, subtotal_usd, iva_usd, total_usd, total_bs, tasa_bcv, productos } = req.body;

        // ¡EL DETALLE QUE FALTABA! Generar el número de factura (Ej: F-000005)
        const totalFacturas = await Factura.count();
        const numero_factura = `F-${String(totalFacturas + 1).padStart(6, '0')}`;

        // Crear la factura real
        const factura = await Factura.create({
            numero_factura, // <--- AÑADIDO AQUÍ
            cliente_id, 
            jornada_id, 
            metodo_pago, 
            subtotal_usd, 
            iva_usd, 
            total_usd, 
            total_bs, 
            tasa_bcv
        }, { transaction: t });

        // Insertar los productos en la factura
        for (let prod of productos) {
            await DetalleFactura.create({
                factura_id: factura.id,
                producto_id: prod.producto_id,
                cantidad: prod.cantidad,
                precio_unitario_usd: prod.precio_unitario_usd,
                aplica_iva: prod.aplica_iva,
                subtotal_usd: prod.subtotal_usd
            }, { transaction: t });
        }

        // Bloquear y marcar las notas del cuaderno como ya facturadas y deuda en 0
        await NotaEntrega.update(
            { estado: 'FACTURADA', saldo_pendiente: 0 },
            { where: { id: { [Op.in]: notas_ids } }, transaction: t }
        );

        await t.commit();
        res.status(201).json({ mensaje: "Factura consolidada generada con éxito" });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al consolidar factura", error: error.message });
    }
};

module.exports = { crearNota, obtenerCuaderno, registrarAbonoGlobal, consolidarFacturas };