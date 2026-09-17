const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Tasa = sequelize.define('HistorialTasas', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tasa_bcv: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false
    },
    origen: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'MANUAL' // O AUTOMATICO_SCRAPER
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'historial_tasas',
    timestamps: false // Desactiva los campos createdAt y updatedAt automáticos
});

module.exports = Tasa;