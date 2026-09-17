const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DetalleFactura = sequelize.define('DetalleFactura', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    precio_unitario_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // Precio congelado
    aplica_iva: { type: DataTypes.BOOLEAN, defaultValue: false }, // Si tenía IVA en ese momento
    subtotal_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, {
    tableName: 'detalles_factura',
    timestamps: true
});

module.exports = DetalleFactura;