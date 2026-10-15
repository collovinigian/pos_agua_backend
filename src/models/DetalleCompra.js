const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DetalleCompra = sequelize.define('DetalleCompra', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    compra_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    producto_id: { 
        type: DataTypes.INTEGER, 
        allowNull: true 
    },
    descripcion: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    cantidad: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 1 
    },
    costo_unitario_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false 
    },
    aplica_iva: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
    subtotal_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false 
    }
}, {
    tableName: 'detalles_compra',
    timestamps: true
});

module.exports = DetalleCompra;
