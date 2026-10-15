const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Compra = sequelize.define('Compra', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    proveedor_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    tipo_documento_fiscal: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: 'FACTURA' // 'FACTURA', 'NOTA_DEBITO', 'NOTA_CREDITO'
    },
    numero_factura: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    numero_control: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    factura_afectada: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    fecha_emision: { 
        type: DataTypes.DATEONLY, 
        allowNull: false 
    },
    fecha_recepcion: { 
        type: DataTypes.DATE, 
        allowNull: false,
        defaultValue: DataTypes.NOW 
    },
    tasa_bcv: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false 
    },
    monto_exento_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 
    },
    base_imponible_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 
    },
    iva_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 
    },
    total_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false 
    },
    total_bs: { 
        type: DataTypes.DECIMAL(12, 2), 
        allowNull: false 
    },
    dias_credito: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    metodo_pago: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    estado: { 
        type: DataTypes.STRING, 
        defaultValue: 'PAGADA' // 'PAGADA', 'PENDIENTE', 'ANULADA'
    },

    // --- RETENCIÓN DE IVA ---
    aplica_retencion_iva: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
    porcentaje_ret_iva: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    iva_retenido_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 
    },
    iva_retenido_bs: { 
        type: DataTypes.DECIMAL(12, 2), 
        defaultValue: 0 
    },
    comprobante_ret_iva: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },

    // --- RETENCIÓN DE ISLR ---
    aplica_retencion_islr: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
    codigo_concepto_islr: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    concepto_islr: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    porcentaje_ret_islr: { 
        type: DataTypes.DECIMAL(5, 2), 
        defaultValue: 0 
    },
    sustraendo_islr_bs: { 
        type: DataTypes.DECIMAL(12, 2), 
        defaultValue: 0 
    },
    islr_retenido_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 
    },
    islr_retenido_bs: { 
        type: DataTypes.DECIMAL(12, 2), 
        defaultValue: 0 
    },
    comprobante_ret_islr: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },

    // --- NETO REAL A PAGAR AL PROVEEDOR ---
    neto_pagar_usd: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0 
    },
    neto_pagar_bs: { 
        type: DataTypes.DECIMAL(12, 2), 
        defaultValue: 0 
    }
}, {
    tableName: 'compras',
    timestamps: true
});

module.exports = Compra;
