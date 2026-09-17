const Factura = require('../models/Factura');
const DetalleFactura = require('../models/DetalleFactura');
const Producto = require('../models/Producto');
const Jornada = require('../models/Jornada');
const sequelize = require('../config/db');

const crearFactura = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        // Añadimos dias_credito a la desestructuración
        const { cliente_id, jornada_id, metodo_pago, dias_credito, subtotal_usd, iva_usd, total_usd, total_bs, tasa_bcv, productos } = req.body;

        const jornada = await Jornada.findByPk(jornada_id);
        if (!jornada || jornada.estado === 'CERRADA') {
            await t.rollback();
            return res.status(400).json({ mensaje: "La caja está cerrada. Debes abrir una jornada para facturar." });
        }

        const totalFacturas = await Factura.count();
        const correlativo = (totalFacturas + 1).toString().padStart(6, '0');
        const numero_factura = `F-${correlativo}`;

        // LÓGICA INTELIGENTE: Si es a crédito, nace PENDIENTE. Si no, nace PAGADA.
        const estadoFactura = metodo_pago === 'Crédito' ? 'PENDIENTE' : 'PAGADA';

        const nuevaFactura = await Factura.create({
            numero_factura, 
            subtotal_usd, 
            iva_usd, 
            total_usd, 
            tasa_bcv, 
            total_bs, 
            metodo_pago,
            dias_credito: dias_credito || 0, // <--- Guardamos los días
            estado: estadoFactura,           // <--- Guardamos el estado
            cliente_id, 
            jornada_id
        }, { transaction: t });

        for (let item of productos) {
            const productoDB = await Producto.findByPk(item.producto_id);
            
            if (!productoDB) {
                throw new Error(`El producto no existe en la base de datos.`);
            }
            if (productoDB.cantidad < item.cantidad) {
                throw new Error(`Stock insuficiente para: ${productoDB.nombre}. Quedan ${productoDB.cantidad}.`);
            }

            await DetalleFactura.create({
                factura_id: nuevaFactura.id,
                producto_id: item.producto_id,
                cantidad: item.cantidad,
                precio_unitario_usd: item.precio_unitario_usd,
                aplica_iva: item.aplica_iva,
                subtotal_usd: item.subtotal_usd
            }, { transaction: t });

            await productoDB.update({
                cantidad: productoDB.cantidad - item.cantidad
            }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ mensaje: "Factura procesada con éxito", data: nuevaFactura });

    } catch (error) {
        await t.rollback();
        console.error("Error al facturar:", error);
        res.status(500).json({ mensaje: "Error al procesar la factura", error: error.message });
    }
};

const obtenerFacturas = async (req, res) => {
    try {
        const facturas = await Factura.findAll({ order: [['createdAt', 'DESC']] });
        res.status(200).json(facturas);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener facturas", error: error.message });
    }
};

module.exports = { crearFactura, obtenerFacturas };