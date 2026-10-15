const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedor.controller');

router.post('/', proveedorController.crearProveedor);
router.get('/', proveedorController.obtenerProveedores);
router.put('/:id', proveedorController.actualizarProveedor);
router.delete('/:id', proveedorController.eliminarProveedor);

module.exports = router;
