const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Factura = sequelize.define('Factura', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numero_factura: { type: DataTypes.STRING, allowNull: false, unique: true }, 
    subtotal_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    iva_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    total_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    tasa_bcv: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, 
    total_bs: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, 
    metodo_pago: { type: DataTypes.STRING, allowNull: false }, 
    
    // --- NUEVO: CONTROL DE CRÉDITO ---
    dias_credito: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    
    // Cambiamos a STRING para evitar conflictos de Sequelize al actualizar ENUMs en PostgreSQL
    estado: { type: DataTypes.STRING, defaultValue: 'PAGADA' } // Puede ser: PAGADA, PENDIENTE o ANULADA
}, {
    tableName: 'facturas',
    timestamps: true 
});

module.exports = Factura;