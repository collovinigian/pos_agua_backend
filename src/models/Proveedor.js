const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Proveedor = sequelize.define('Proveedor', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    tipo_documento: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        defaultValue: 'J' // 'J', 'G', 'V', 'E'
    },
    numero_documento: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        unique: true 
    },
    nombre: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    telefono: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    correo: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    direccion: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    dias_credito_habitual: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    porcentaje_retencion_iva: { 
        type: DataTypes.INTEGER, 
        defaultValue: 75 // 0, 75, 100
    },
    porcentaje_retencion_islr: { 
        type: DataTypes.DECIMAL(5, 2), 
        defaultValue: 0.00 
    },
    activo: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
    }
}, {
    tableName: 'proveedores',
    timestamps: true
});

module.exports = Proveedor;
