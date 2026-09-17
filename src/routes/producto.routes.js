const express = require('express');
const router = express.Router();
const productoController = require('../controllers/producto.controller');

// Rutas
router.post('/', productoController.crearProducto);       // Crear
router.get('/', productoController.obtenerProductos);     // Leer todos
router.put('/:id', productoController.actualizarProducto); // Editar
router.delete('/:id', productoController.eliminarProducto); // Eliminar

module.exports = router;