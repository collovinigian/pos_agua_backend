const Factura = require('../models/Factura');
const DetalleFactura = require('../models/DetalleFactura');
const Producto = require('../models/Producto');
const Jornada = require('../models/Jornada');
const Cliente = require('../models/Cliente'); // Importante para la vista
const sequelize = require('../config/db');

const crearFactura = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { cliente_id, jornada_id, metodo_pago, dias_credito, subtotal_usd, iva_usd, total_usd, total_bs, tasa_bcv, productos } = req.body;

        const jornada = await Jornada.findByPk(jornada_id);
        if (!jornada || jornada.estado === 'CERRADA') {
            await t.rollback();
            return res.status(400).json({ mensaje: "La caja está cerrada. Debes abrir una jornada para facturar." });
        }

        const totalFacturas = await Factura.count();
        const correlativo = (totalFacturas + 1).toString().padStart(6, '0');
        const numero_factura = `F-${correlativo}`;

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

            await DetalleFactura.create({
                factura_id: nuevaFactura.id, producto_id: item.producto_id, cantidad: item.cantidad,
                precio_unitario_usd: item.precio_unitario_usd, aplica_iva: item.aplica_iva, subtotal_usd: item.subtotal_usd
            }, { transaction: t });

            await productoDB.update({ cantidad: productoDB.cantidad - item.cantidad }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ mensaje: "Factura procesada con éxito", data: nuevaFactura });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al procesar la factura", error: error.message });
    }
};

// MEJORA: Traer las facturas con los datos del Cliente incluidos
const obtenerFacturas = async (req, res) => {
    try {
        const facturas = await Factura.findAll({ 
            include: [{ model: Cliente }], // <--- Magia de Sequelize
            order: [['createdAt', 'DESC']] 
        });
        res.status(200).json(facturas);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener facturas", error: error.message });
    }
};

// NUEVO: Función para cobrar una factura a crédito
const pagarFacturaPendiente = async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo_pago } = req.body;
        
        const factura = await Factura.findByPk(id);
        if (!factura) return res.status(404).json({ mensaje: "Factura no encontrada" });
        if (factura.estado !== 'PENDIENTE') return res.status(400).json({ mensaje: "La factura no está pendiente de pago" });

        // Actualizamos el estado a PAGADA y registramos cómo la pagaron
        await factura.update({ estado: 'PAGADA', metodo_pago: metodo_pago || factura.metodo_pago });
        
        res.status(200).json({ mensaje: "Factura cobrada exitosamente" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al cobrar", error: error.message });
    }
};

// NUEVO: Función para Anular Factura (Nota de Crédito)
const anularFactura = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;
        
        // 1. Buscamos la factura con sus detalles
        const factura = await Factura.findByPk(id, {
            include: [{ model: DetalleFactura }]
        });

        if (!factura) {
            await t.rollback();
            return res.status(404).json({ mensaje: "Factura no encontrada" });
        }

        if (factura.estado === 'ANULADA') {
            await t.rollback();
            return res.status(400).json({ mensaje: "La factura ya se encuentra anulada" });
        }

        // 2. Cambiamos el estado a ANULADA
        await factura.update({ estado: 'ANULADA' }, { transaction: t });

        // 3. Devolvemos los productos al inventario
        for (let detalle of factura.DetalleFacturas) {
            const productoDB = await Producto.findByPk(detalle.producto_id);
            if (productoDB) {
                await productoDB.update({
                    cantidad: productoDB.cantidad + detalle.cantidad // Sumamos el stock de vuelta
                }, { transaction: t });
            }
        }

        // 4. Confirmamos la transacción
        await t.commit();
        res.status(200).json({ mensaje: "Factura anulada y stock restaurado correctamente" });

    } catch (error) {
        await t.rollback();
        res.status(500).json({ mensaje: "Error al anular la factura", error: error.message });
    }
};

module.exports = { crearFactura, obtenerFacturas, pagarFacturaPendiente, anularFactura };