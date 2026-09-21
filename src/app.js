const express = require('express');
const cors = require('cors');
const db = require('./config/db');

// 1. Importar Modelos
const Tasa = require('./models/Tasa');
const Producto = require('./models/Producto'); 
const Jornada = require('./models/Jornada');
const Cliente = require('./models/Cliente');
const Factura = require('./models/Factura'); 
const DetalleFactura = require('./models/DetalleFactura');
const Configuracion = require('./models/Configuracion');

// 2. Definir las Asociaciones (Relaciones entre tablas)
// Cliente <-> Facturas (Un cliente tiene muchas facturas)
Cliente.hasMany(Factura, { foreignKey: 'cliente_id' });
Factura.belongsTo(Cliente, { foreignKey: 'cliente_id' });

// Jornada <-> Facturas (Una jornada agrupa muchas facturas del día)
Jornada.hasMany(Factura, { foreignKey: 'jornada_id' });
Factura.belongsTo(Jornada, { foreignKey: 'jornada_id' });

// Factura <-> Detalles (Una factura tiene muchos productos adentro)
Factura.hasMany(DetalleFactura, { foreignKey: 'factura_id' });
DetalleFactura.belongsTo(Factura, { foreignKey: 'factura_id' });

// Producto <-> Detalles (Un detalle hace referencia a un producto del inventario)
Producto.hasMany(DetalleFactura, { foreignKey: 'producto_id' });
DetalleFactura.belongsTo(Producto, { foreignKey: 'producto_id' });

// 3. Importar Rutas
const tasaRoutes = require('./routes/tasa.routes');
const productoRoutes = require('./routes/producto.routes');
const jornadaRoutes = require('./routes/jornada.routes');
const clienteRoutes = require('./routes/cliente.routes');
const facturaRoutes = require('./routes/factura.routes');
const configuracionRoutes = require('./routes/configuracion.routes');
const reporteRoutes = require('./routes/reporte.routes');

const app = express();

app.use(cors());
app.use(express.json());

// 4. Sincronizar la base de datos
db.sync({ alter: true })
    .then(() => console.log('📦 Tablas y Relaciones sincronizadas correctamente'))
    .catch((error) => console.error('❌ Error sincronizando tablas:', error));

// 5. Rutas
app.use('/api/tasas', tasaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/jornadas', jornadaRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/facturas', facturaRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/reportes', reporteRoutes);

module.exports = app;