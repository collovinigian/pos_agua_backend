const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/factura.controller');

router.post('/', facturaController.crearFactura);
router.get('/', facturaController.obtenerFacturas);
router.put('/cobrar/:id', facturaController.pagarFacturaPendiente);
router.put('/anular/:id', facturaController.anularFactura);

module.exports = router;