const { DataTypes } = require('sequelize');
const db = require('../config/db');

const DetalleNota = db.define('DetalleNota', {
    nota_id: { type: DataTypes.INTEGER, allowNull: false },
    producto_id: { type: DataTypes.INTEGER, allowNull: false },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    precio_unitario_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    aplica_iva: { type: DataTypes.BOOLEAN, defaultValue: false },
    subtotal_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, {
    tableName: 'detalles_nota',
    timestamps: false
});

module.exports = DetalleNota;