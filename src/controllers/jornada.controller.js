const Jornada = require('../models/Jornada');

// 1. Iniciar el día (Abrir Caja)
const abrirJornada = async (req, res) => {
    try {
        // AJUSTE: Recibimos "fondo_inicial_usd" que es lo que manda Flutter
        const { fondo_inicial_usd } = req.body; 

        // Verificamos si ya hay una jornada abierta para no abrir dos al mismo tiempo
        const jornadaAbierta = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        if (jornadaAbierta) {
            return res.status(400).json({ mensaje: "Ya tienes un día abierto. Ciérralo antes de iniciar uno nuevo." });
        }

        const nuevaJornada = await Jornada.create({
            // Lo guardamos en el campo que tu BD espera
            fondo_caja_usd: fondo_inicial_usd || 0, 
            fondo_caja_bs: 0,
            estado: 'ABIERTA',
            fecha_inicio: new Date()
        });

        res.status(201).json({ mensaje: "Jornada iniciada con éxito", data: nuevaJornada });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al abrir jornada", error: error.message });
    }
};

// 2. Obtener la jornada actual
const obtenerJornadaActual = async (req, res) => {
    try {
        const jornada = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        
        if (!jornada) {
            // Cambiamos a 404 para que Flutter entienda que no hay caja abierta
            return res.status(404).json({ abierta: false, mensaje: "No hay jornada abierta" }); 
        }
        
        // Mapeamos el campo para que Flutter lo lea como "fondo_inicial_usd" en el reporte
        const dataJornada = jornada.toJSON();
        dataJornada.fondo_inicial_usd = dataJornada.fondo_caja_usd; 

        res.status(200).json({ abierta: true, data: dataJornada });
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