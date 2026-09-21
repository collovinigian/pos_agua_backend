const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Configuracion = sequelize.define('Configuracion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    impresion_fiscal_activa: { type: DataTypes.BOOLEAN, defaultValue: false },
    modelo_impresora: { type: DataTypes.STRING, defaultValue: 'HKA' }, // HKA, Bixolon, PNP...
    puerto_impresora: { type: DataTypes.STRING, defaultValue: 'COM1' },
    copias_adicionales: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'configuracion',
    timestamps: false
});

module.exports = Configuracion;