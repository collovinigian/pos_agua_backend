const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Configuracion = sequelize.define('Configuracion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    impresion_fiscal_activa: { type: DataTypes.BOOLEAN, defaultValue: false },
    modelo_impresora: { type: DataTypes.STRING, defaultValue: 'HKA' }, // HKA, Bixolon, PNP...
    puerto_impresora: { type: DataTypes.STRING, defaultValue: 'COM1' },
    copias_adicionales: { type: DataTypes.INTEGER, defaultValue: 0 },
    razon_social: { type: DataTypes.STRING, defaultValue: 'MI EMPRESA, C.A.' },
    rif: { type: DataTypes.STRING, defaultValue: 'J-00000000-0' },
    direccion: { type: DataTypes.TEXT, defaultValue: 'DIRECCIÓN FISCAL DE LA EMPRESA' },
    telefono: { type: DataTypes.STRING, defaultValue: '' },
    logo_base64: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    tema_modo: { type: DataTypes.STRING, defaultValue: 'light' },
    color_tema: { type: DataTypes.STRING, defaultValue: 'blue' }
}, {
    tableName: 'configuracion',
    timestamps: false
});

module.exports = Configuracion;