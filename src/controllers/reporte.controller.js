const Factura = require('../models/Factura');
const Jornada = require('../models/Jornada');
const DetalleFactura = require('../models/DetalleFactura');

const obtenerReporteActual = async (req, res) => {
    try {
        // 1. Buscar la jornada que está abierta
        const jornada = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        if (!jornada) return res.status(404).json({ mensaje: "No hay una caja abierta actualmente." });

        // 2. Buscar todas las facturas de esa jornada
        const facturas = await Factura.findAll({ where: { jornada_id: jornada.id } });

        // 3. Variables para la matemática
        let totalPagadoUsd = 0;
        let totalPagadoBs = 0;
        let totalIvaUsd = 0;
        let totalPendienteUsd = 0;
        let totalAnuladoUsd = 0;
        
        // Objeto para agrupar ventas por método de pago (Efectivo, Zelle, Punto, etc.)
        let desglosePagos = {};

        // 4. Calcular totales
        facturas.forEach(f => {
            const totalUsd = parseFloat(f.total_usd);
            const totalBs = parseFloat(f.total_bs);
            const ivaUsd = parseFloat(f.iva_usd);

            if (f.estado === 'PAGADA') {
                totalPagadoUsd += totalUsd;
                totalPagadoBs += totalBs;
                totalIvaUsd += ivaUsd;
                
                // Sumar al método de pago específico
                desglosePagos[f.metodo_pago] = (desglosePagos[f.metodo_pago] || 0) + totalUsd;
            } else if (f.estado === 'PENDIENTE') {
                totalPendienteUsd += totalUsd;
            } else if (f.estado === 'ANULADA') {
                totalAnuladoUsd += totalUsd;
            }
        });

        res.status(200).json({
            jornada: jornada,
            resumen: {
                total_pagado_usd: totalPagadoUsd,
                total_pagado_bs: totalPagadoBs,
                total_iva_usd: totalIvaUsd,
                total_pendiente_usd: totalPendienteUsd,
                total_anulado_usd: totalAnuladoUsd,
                desglose_pagos: desglosePagos,
                cantidad_facturas: facturas.length
            }
        });

    } catch (error) {
        res.status(500).json({ mensaje: "Error al generar el reporte", error: error.message });
    }
};

// Cierre Z: Hace el reporte y Cierra la Jornada
const ejecutarCierreZ = async (req, res) => {
    try {
        const jornada = await Jornada.findOne({ where: { estado: 'ABIERTA' } });
        if (!jornada) return res.status(400).json({ mensaje: "No hay caja abierta para cerrar." });

        await jornada.update({ estado: 'CERRADA' });
        
        res.status(200).json({ mensaje: "Jornada cerrada con éxito (Cierre Z ejecutado)" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al ejecutar Cierre Z", error: error.message });
    }
};

module.exports = { obtenerReporteActual, ejecutarCierreZ };