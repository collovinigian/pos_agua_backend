const express = require('express');
const router = express.Router();
const cuadernoController = require('../controllers/cuaderno.controller');

router.post('/', cuadernoController.crearNota);
router.get('/', cuadernoController.obtenerCuaderno);
router.post('/abono-global', cuadernoController.registrarAbonoGlobal); // Nuevo endpoint global
router.post('/consolidar', cuadernoController.consolidarFacturas);     // Nuevo endpoint de facturación

module.exports = router;