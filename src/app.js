const express = require('express');
const cors = require('cors');
const db = require('./config/db');

// Importar Modelos
const Tasa = require('./models/Tasa');
const Producto = require('./models/Producto'); // <-- NUEVO

// Importar Rutas
const tasaRoutes = require('./routes/tasa.routes');
const productoRoutes = require('./routes/producto.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Para que entienda los datos en formato JSON

// Sincronizar la base de datos (¡Aquí ocurre la magia!)
db.sync({ alter: true })
    .then(() => console.log('📦 Tablas sincronizadas correctamente'))
    .catch((error) => console.error('❌ Error sincronizando tablas:', error));

// Rutas
app.use('/api/tasas', tasaRoutes);
app.use('/api/productos', productoRoutes);

module.exports = app;