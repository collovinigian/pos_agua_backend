const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/factura.controller');

// Ruta para procesar una nueva venta
router.post('/', facturaController.crearFactura);

// Ruta para ver el historial de facturas
router.get('/', facturaController.obtenerFacturas);

module.exports = router;