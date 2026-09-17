const Tasa = require('../models/Tasa');

// 1. Función para guardar una tasa nueva
const registrarTasaManual = async (req, res) => {
    try {
        const { tasa_bcv } = req.body;

        if (!tasa_bcv) {
            return res.status(400).json({ mensaje: "El monto de la tasa es obligatorio" });
        }

        const nuevaTasa = await Tasa.create({
            tasa_bcv: tasa_bcv,
            origen: 'MANUAL'
        });

        res.status(201).json({
            mensaje: "Tasa guardada exitosamente",
            data: nuevaTasa
        });

    } catch (error) {
        console.error("Error guardando la tasa:", error);
        res.status(500).json({ mensaje: "Error interno del servidor", error: error.message });
    }
};

// 2. NUEVA FUNCIÓN: Para obtener la tasa actual y enviarla a Flutter
const obtenerTasaActual = async (req, res) => {
    try {
        // CORRECCIÓN: Busca la última tasa guardada usando la columna 'fecha'
        const tasa = await Tasa.findOne({ order: [['fecha', 'DESC']] });
        
        if (!tasa) {
            return res.status(404).json({ mensaje: "No hay tasas registradas" });
        }
        
        res.status(200).json(tasa);
    } catch (error) {
        console.error("Error obteniendo tasa:", error);
        res.status(500).json({ mensaje: "Error interno", error: error.message });
    }
};

// Asegúrate de exportar AMBAS funciones aquí al final
module.exports = {
    registrarTasaManual,
    obtenerTasaActual
};