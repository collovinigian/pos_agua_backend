const { DataTypes } = require('sequelize');
const db = require('../config/db');

const NotaEntrega = db.define('NotaEntrega', {
    numero_nota: {
        type: DataTypes.STRING,
        allowNull: true, // Se puede autogenerar ej: N-0001
    },
    subtotal_usd: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    iva_usd: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    total_usd: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    saldo_pendiente: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // Para saber cuánto falta por pagar
    estado: {
        type: DataTypes.ENUM('PENDIENTE', 'PAGADA', 'FACTURADA', 'ANULADA'),
        defaultValue: 'PENDIENTE'
    }
}, {
    tableName: 'notas_entrega',
    timestamps: true
});

module.exports = NotaEntrega;