const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporte.controller');

router.get('/actual', reporteController.obtenerReporteActual);
router.post('/cierre-z', reporteController.ejecutarCierreZ);

module.exports = router;