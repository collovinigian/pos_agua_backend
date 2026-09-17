const Producto = require('../models/Producto');

// Crear un nuevo producto
const crearProducto = async (req, res) => {
    try {
        const { codigo_producto, codigo_barras, nombre, detalles, cantidad, precio_usd, aplica_iva } = req.body;

        const nuevoProducto = await Producto.create({
            codigo_producto, codigo_barras, nombre, detalles, cantidad, precio_usd, aplica_iva
        });

        res.status(201).json({ mensaje: "Producto creado exitosamente", data: nuevoProducto });
    } catch (error) {
        console.error("Error creando producto:", error);
        res.status(500).json({ mensaje: "Error al crear", error: error.message });
    }
};

// Obtener todos los productos activos
const obtenerProductos = async (req, res) => {
    try {
        const productos = await Producto.findAll({ where: { activo: true } });
        res.status(200).json(productos);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener productos", error: error.message });
    }
};

// Actualizar un producto existente
const actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo_producto, codigo_barras, nombre, detalles, cantidad, precio_usd, aplica_iva } = req.body;
        
        const producto = await Producto.findByPk(id);
        if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });

        await producto.update({ codigo_producto, codigo_barras, nombre, detalles, cantidad, precio_usd, aplica_iva });
        res.status(200).json({ mensaje: "Producto actualizado", data: producto });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al actualizar", error: error.message });
    }
};

// Eliminar un producto (Borrado lógico y liberación de código)
const eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const producto = await Producto.findByPk(id);
        if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });

        const timestamp = Date.now();
        const codigoLiberado = `DEL-${timestamp}-${producto.codigo_producto}`;

        await producto.update({ activo: false, codigo_producto: codigoLiberado });
        res.status(200).json({ mensaje: "Producto eliminado y código liberado" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al eliminar", error: error.message });
    }
};

module.exports = { crearProducto, obtenerProductos, actualizarProducto, eliminarProducto };