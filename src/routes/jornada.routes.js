const express = require('express');
const router = express.Router();
const jornadaController = require('../controllers/jornada.controller');

// Ruta para abrir la caja al iniciar el día
router.post('/abrir', jornadaController.abrirJornada);

// Ruta para verificar si la caja está abierta (Flutter preguntará esto al iniciar)
router.get('/actual', jornadaController.obtenerJornadaActual);

// Ruta para cerrar la caja al terminar el día
router.put('/cerrar/:id', jornadaController.cerrarJornada);

module.exports = router;