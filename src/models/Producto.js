const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Producto = sequelize.define('Producto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo_producto: { type: DataTypes.STRING, allowNull: false, unique: true },
    codigo_barras: { type: DataTypes.STRING, allowNull: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    detalles: { type: DataTypes.STRING, allowNull: true }, // NUEVO: Descripción extra
    cantidad: { type: DataTypes.INTEGER, defaultValue: 0 }, // NUEVO: Stock/Inventario
    precio_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    aplica_iva: { type: DataTypes.BOOLEAN, defaultValue: true }, // NUEVO: ¿Lleva 16% de IVA?
    activo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    tableName: 'productos',
    timestamps: true 
});

module.exports = Producto;