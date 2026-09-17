const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Jornada = sequelize.define('Jornada', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    fondo_caja_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 // Dinero base en dólares para dar vueltos
    },
    fondo_caja_bs: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 // Dinero base en bolívares para dar vueltos
    },
    estado: { 
        type: DataTypes.ENUM('ABIERTA', 'CERRADA'), 
        defaultValue: 'ABIERTA' 
    },
    fecha_cierre: { 
        type: DataTypes.DATE, 
        allowNull: true // Se llena solo cuando finalizas el día
    }
}, {
    tableName: 'jornadas',
    timestamps: true // Esto nos dará automáticamente la fecha_apertura (createdAt)
});

module.exports = Jornada;