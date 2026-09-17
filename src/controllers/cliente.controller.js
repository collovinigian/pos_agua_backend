const Cliente = require('../models/Cliente');

const crearCliente = async (req, res) => {
    try {
        const { tipo_documento, numero_documento, nombre, correo, telefono, direccion } = req.body;
        const nuevoCliente = await Cliente.create({
            tipo_documento, numero_documento, nombre, correo, telefono, direccion
        });
        res.status(201).json({ mensaje: "Cliente registrado", data: nuevoCliente });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al registrar cliente", error: error.message });
    }
};

const obtenerClientes = async (req, res) => {
    try {
        const clientes = await Cliente.findAll({ where: { activo: true } });
        res.status(200).json(clientes);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener clientes", error: error.message });
    }
};

const actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo_documento, numero_documento, nombre, correo, telefono, direccion } = req.body;
        
        const cliente = await Cliente.findByPk(id);
        if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });

        await cliente.update({ tipo_documento, numero_documento, nombre, correo, telefono, direccion });
        res.status(200).json({ mensaje: "Cliente actualizado", data: cliente });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al actualizar", error: error.message });
    }
};

const eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const cliente = await Cliente.findByPk(id);
        if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });

        const codigoLiberado = `DEL-${Date.now()}-${cliente.numero_documento}`;
        await cliente.update({ activo: false, numero_documento: codigoLiberado });
        res.status(200).json({ mensaje: "Cliente eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al eliminar", error: error.message });
    }
};

module.exports = { crearCliente, obtenerClientes, actualizarCliente, eliminarCliente };