const express = require('express');
const router = express.Router();
const configuracionController = require('../controllers/configuracion.controller');

router.get('/', configuracionController.obtenerConfiguracion);
router.put('/', configuracionController.actualizarConfiguracion);

module.exports = router;