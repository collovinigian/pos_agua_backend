const express = require('express');
const router = express.Router();
const tasaController = require('../controllers/tasa.controller');

// Ruta para guardar una tasa nueva (POST)
router.post('/manual', tasaController.registrarTasaManual);

// NUEVA RUTA: Para pedir la tasa actual (GET)
router.get('/actual', tasaController.obtenerTasaActual);

module.exports = router;