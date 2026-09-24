const { DataTypes } = require('sequelize');
const db = require('../config/db');

const Abono = db.define('Abono', {
    nota_id: { type: DataTypes.INTEGER, allowNull: false }, // <-- Este es el campo clave que faltaba
    monto_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    monto_bs: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    metodo_pago: { type: DataTypes.STRING, allowNull: false },
    fecha_pago: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'abonos',
    timestamps: true
});

module.exports = Abono;