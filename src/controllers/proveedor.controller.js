const Proveedor = require('../models/Proveedor');
const Compra = require('../models/Compra');

const crearProveedor = async (req, res) => {
    try {
        const { 
            tipo_documento, 
            numero_documento, 
            nombre, 
            telefono, 
            correo, 
            direccion, 
            dias_credito_habitual,
            porcentaje_retencion_iva,
            porcentaje_retencion_islr
        } = req.body;

        if (!numero_documento || !nombre) {
            return res.status(400).json({ mensaje: "El número de documento (RIF/Cédula) y el nombre son obligatorios" });
        }

        const docNormalizado = numero_documento.trim();

        // Verificar si ya existe
        const proveedorExistente = await Proveedor.findOne({
            where: { numero_documento: docNormalizado }
        });

        if (proveedorExistente) {
            if (!proveedorExistente.activo) {
                // Reactivarlo y actualizarlo
                await proveedorExistente.update({
                    tipo_documento: tipo_documento || proveedorExistente.tipo_documento,
                    nombre,
                    telefono,
                    correo,
                    direccion,
                    dias_credito_habitual: dias_credito_habitual !== undefined ? dias_credito_habitual : 0,
                    porcentaje_retencion_iva: porcentaje_retencion_iva !== undefined ? parseInt(porcentaje_retencion_iva, 10) : proveedorExistente.porcentaje_retencion_iva,
                    porcentaje_retencion_islr: porcentaje_retencion_islr !== undefined ? parseFloat(porcentaje_retencion_islr) : proveedorExistente.porcentaje_retencion_islr,
                    activo: true
                });
                return res.status(200).json({ mensaje: "Proveedor reactivado con éxito", data: proveedorExistente });
            }
            return res.status(400).json({ mensaje: "Ya existe un proveedor registrado con este número de documento" });
        }

        const nuevoProveedor = await Proveedor.create({
            tipo_documento: tipo_documento || 'J',
            numero_documento: docNormalizado,
            nombre,
            telefono,
            correo,
            direccion,
            dias_credito_habitual: dias_credito_habitual !== undefined ? parseInt(dias_credito_habitual, 10) : 0,
            porcentaje_retencion_iva: porcentaje_retencion_iva !== undefined ? parseInt(porcentaje_retencion_iva, 10) : 75,
            porcentaje_retencion_islr: porcentaje_retencion_islr !== undefined ? parseFloat(porcentaje_retencion_islr) : 0.00,
            activo: true
        });

        res.status(201).json({ mensaje: "Proveedor registrado con éxito", data: nuevoProveedor });
    } catch (error) {
        console.error("Error creando proveedor:", error);
        res.status(500).json({ mensaje: "Error al registrar proveedor", error: error.message });
    }
};

const obtenerProveedores = async (req, res) => {
    try {
        const proveedores = await Proveedor.findAll({
            where: { activo: true },
            order: [['nombre', 'ASC']]
        });

        // Obtener cuentas por pagar pendientes por cada proveedor
        const comprasPendientes = await Compra.findAll({
            where: { estado: 'PENDIENTE' },
            attributes: ['proveedor_id', 'total_usd', 'total_bs']
        });

        const deudaPorProveedor = {};
        for (const compra of comprasPendientes) {
            const pId = compra.proveedor_id;
            if (!deudaPorProveedor[pId]) {
                deudaPorProveedor[pId] = { usd: 0, bs: 0, count: 0 };
            }
            deudaPorProveedor[pId].usd += parseFloat(compra.total_usd) || 0;
            deudaPorProveedor[pId].bs += parseFloat(compra.total_bs) || 0;
            deudaPorProveedor[pId].count += 1;
        }

        const resultado = proveedores.map(p => {
            const deuda = deudaPorProveedor[p.id] || { usd: 0, bs: 0, count: 0 };
            return {
                ...p.toJSON(),
                total_pendiente_usd: Number(deuda.usd.toFixed(2)),
                total_pendiente_bs: Number(deuda.bs.toFixed(2)),
                compras_pendientes_count: deuda.count
            };
        });

        res.status(200).json(resultado);
    } catch (error) {
        console.error("Error obteniendo proveedores:", error);
        res.status(500).json({ mensaje: "Error al obtener proveedores", error: error.message });
    }
};

const actualizarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            tipo_documento, 
            numero_documento, 
            nombre, 
            telefono, 
            correo, 
            direccion, 
            dias_credito_habitual,
            porcentaje_retencion_iva,
            porcentaje_retencion_islr
        } = req.body;

        const proveedor = await Proveedor.findByPk(id);
        if (!proveedor) {
            return res.status(404).json({ mensaje: "Proveedor no encontrado" });
        }

        if (numero_documento && numero_documento.trim() !== proveedor.numero_documento) {
            const existeOtro = await Proveedor.findOne({
                where: { numero_documento: numero_documento.trim() }
            });
            if (existeOtro && existeOtro.id !== parseInt(id, 10)) {
                return res.status(400).json({ mensaje: "El número de documento ya está en uso por otro proveedor" });
            }
        }

        await proveedor.update({
            tipo_documento: tipo_documento || proveedor.tipo_documento,
            numero_documento: numero_documento ? numero_documento.trim() : proveedor.numero_documento,
            nombre: nombre || proveedor.nombre,
            telefono: telefono !== undefined ? telefono : proveedor.telefono,
            correo: correo !== undefined ? correo : proveedor.correo,
            direccion: direccion !== undefined ? direccion : proveedor.direccion,
            dias_credito_habitual: dias_credito_habitual !== undefined ? parseInt(dias_credito_habitual, 10) : proveedor.dias_credito_habitual,
            porcentaje_retencion_iva: porcentaje_retencion_iva !== undefined ? parseInt(porcentaje_retencion_iva, 10) : proveedor.porcentaje_retencion_iva,
            porcentaje_retencion_islr: porcentaje_retencion_islr !== undefined ? parseFloat(porcentaje_retencion_islr) : proveedor.porcentaje_retencion_islr
        });

        res.status(200).json({ mensaje: "Proveedor actualizado con éxito", data: proveedor });
    } catch (error) {
        console.error("Error actualizando proveedor:", error);
        res.status(500).json({ mensaje: "Error al actualizar proveedor", error: error.message });
    }
};

const eliminarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const proveedor = await Proveedor.findByPk(id);
        if (!proveedor) {
            return res.status(404).json({ mensaje: "Proveedor no encontrado" });
        }

        // Validar si tiene compras pendientes
        const comprasPendientes = await Compra.count({
            where: { proveedor_id: id, estado: 'PENDIENTE' }
        });

        if (comprasPendientes > 0) {
            return res.status(400).json({ 
                mensaje: `No se puede eliminar: el proveedor tiene ${comprasPendientes} cuenta(s) por pagar pendiente(s).` 
            });
        }

        const codigoLiberado = `DEL-${Date.now()}-${proveedor.numero_documento}`;
        await proveedor.update({ activo: false, numero_documento: codigoLiberado });

        res.status(200).json({ mensaje: "Proveedor eliminado con éxito" });
    } catch (error) {
        console.error("Error eliminando proveedor:", error);
        res.status(500).json({ mensaje: "Error al eliminar proveedor", error: error.message });
    }
};

module.exports = {
    crearProveedor,
    obtenerProveedores,
    actualizarProveedor,
    eliminarProveedor
};
