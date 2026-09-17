const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Cliente = sequelize.define('Cliente', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo_documento: { type: DataTypes.ENUM('V', 'E', 'J', 'G'), allowNull: false, defaultValue: 'V' },
    numero_documento: { type: DataTypes.STRING, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    correo: { type: DataTypes.STRING, allowNull: true }, // <--- NUEVO CAMPO
    telefono: { type: DataTypes.STRING, allowNull: true },
    direccion: { type: DataTypes.STRING, allowNull: true },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    tableName: 'clientes',
    timestamps: true 
});

module.exports = Cliente;