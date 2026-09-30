const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/factura.controller');

router.post('/', facturaController.crearFactura);
router.get('/', facturaController.obtenerFacturas);
router.put('/cobrar/:id', facturaController.pagarFacturaPendiente);
router.put('/anular/:id', facturaController.anularFactura);
router.post('/reporte-x', facturaController.imprimirReporteXController);
router.post('/reporte-z', facturaController.imprimirReporteZController);
router.get('/exportar-excel', facturaController.exportarExcel);

module.exports = router;