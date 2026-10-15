const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compra.controller');

router.post('/', compraController.crearCompra);
router.get('/', compraController.obtenerCompras);
router.get('/exportar-excel', compraController.exportarLibroComprasExcel);
router.get('/exportar-txt-iva', compraController.exportarTxtIva);
router.get('/exportar-xml-islr', compraController.exportarXmlIslr);
router.put('/:id/pagar', compraController.pagarCompraPendiente);
router.put('/anular/:id', compraController.anularCompra);

module.exports = router;
