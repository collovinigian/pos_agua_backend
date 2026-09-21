const Configuracion = require('../models/Configuracion');

// Obtiene la configuración (y la crea por defecto si no existe)
const obtenerConfiguracion = async (req, res) => {
    try {
        let config = await Configuracion.findOne();
        if (!config) config = await Configuracion.create({});
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener configuración", error: error.message });
    }
};

// Actualiza los valores
const actualizarConfiguracion = async (req, res) => {
    try {
        let config = await Configuracion.findOne();
        if (!config) config = await Configuracion.create({});
        
        await config.update(req.body);
        res.status(200).json({ mensaje: "Configuración guardada correctamente", data: config });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al guardar configuración", error: error.message });
    }
};

module.exports = { obtenerConfiguracion, actualizarConfiguracion };