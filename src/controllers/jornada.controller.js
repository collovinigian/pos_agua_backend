const Jornada = require('../models/Jornada');

// 1. Iniciar el día (Abrir Caja)
const abrirJornada = async (req, res) => {
    try {
        const { fondo_caja_usd, fondo_caja_bs } = req.body;

        // Verificamos si ya hay una jornada abierta para no abrir dos al mismo tiempo
        const jornadaAbierta = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        if (jornadaAbierta) {
            return res.status(400).json({ mensaje: "Ya tienes un día abierto. Ciérralo antes de iniciar uno nuevo." });
        }

        const nuevaJornada = await Jornada.create({
            fondo_caja_usd: fondo_caja_usd || 0,
            fondo_caja_bs: fondo_caja_bs || 0
        });

        res.status(201).json({ mensaje: "Jornada iniciada con éxito", data: nuevaJornada });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al abrir jornada", error: error.message });
    }
};

// 2. Obtener la jornada actual (para saber si la pantalla debe mostrar facturación o pedir que abras caja)
const obtenerJornadaActual = async (req, res) => {
    try {
        const jornada = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        
        if (!jornada) {
            return res.status(200).json({ abierta: false });
        }
        
        res.status(200).json({ abierta: true, data: jornada });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al consultar jornada", error: error.message });
    }
};

// 3. Finalizar el día (Cerrar Caja)
const cerrarJornada = async (req, res) => {
    try {
        const { id } = req.params;
        const jornada = await Jornada.findByPk(id);

        if (!jornada || jornada.estado === 'CERRADA') {
            return res.status(400).json({ mensaje: "La jornada no existe o ya está cerrada" });
        }

        await jornada.update({ 
            estado: 'CERRADA',
            fecha_cierre: new Date()
        });

        res.status(200).json({ mensaje: "Jornada cerrada exitosamente. ¡Buen trabajo!" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al cerrar jornada", error: error.message });
    }
};

module.exports = { abrirJornada, obtenerJornadaActual, cerrarJornada };