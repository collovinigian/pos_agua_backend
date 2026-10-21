const { SerialPort } = require('serialport');
const Configuracion = require('../models/Configuracion');

const pad = (num, size) => String(num).padStart(size, '0');

const limpiarTexto = (texto) => {
    return String(texto || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ./,-]/g, '');
};

const armarPaquete = (comandoStr) => {
    const cmdBuf = Buffer.from(comandoStr, 'ascii'); 
    let lrc = 0;
    for (let i = 0; i < cmdBuf.length; i++) { lrc ^= cmdBuf[i]; }
    lrc ^= 0x03; 
    return Buffer.concat([Buffer.from([0x02]), cmdBuf, Buffer.from([0x03, lrc])]);
};

const cerrarPuertoSeguro = (puerto, callback) => {
    if (!puerto) {
        if (callback) callback();
        return;
    }
    try {
        puerto.removeAllListeners('data');
        puerto.removeAllListeners('error');
        puerto.on('error', () => {}); // Prevenir uncaughtException al cerrar
        if (puerto.isOpen) {
            puerto.close((err) => {
                if (err) console.log("Aviso al cerrar puerto:", err.message);
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    } catch (err) {
        console.error("Error en cierre seguro de puerto:", err.message);
        if (callback) callback();
    }
};

const procesarComandos = async (comandos) => {
    let puertoNombre = 'COM5';
    try {
        const config = await Configuracion.findOne();
        if (config && config.puerto_impresora) {
            puertoNombre = config.puerto_impresora;
        }
    } catch (_) {}

    return new Promise((resolve) => {
        let puerto;
        let terminado = false;

        const finalizar = (resultado) => {
            if (terminado) return;
            terminado = true;
            cerrarPuertoSeguro(puerto, () => {
                resolve(resultado);
            });
        };

        try {
            puerto = new SerialPort({ 
                path: puertoNombre, 
                baudRate: 9600, 
                dataBits: 8, 
                parity: 'even', 
                stopBits: 1,
                autoOpen: false 
            });
        } catch (err) {
            console.error(`Error inicializando SerialPort (${puertoNombre}):`, err.message);
            return resolve({ exito: false, mensaje: `No se pudo iniciar el puerto ${puertoNombre}: ` + err.message });
        }

        puerto.on('error', (err) => {
            console.error(`Error en puerto ${puertoNombre}:`, err.message);
            finalizar({ exito: false, mensaje: `Error en ${puertoNombre}: ` + err.message });
        });

        puerto.open((err) => {
            if (err) {
                console.error(`No se pudo abrir ${puertoNombre}:`, err.message);
                return finalizar({ exito: false, mensaje: `No se pudo abrir ${puertoNombre}: ` + err.message });
            }

            console.log(`🖨️ Puerto ${puertoNombre} abierto. Transmitiendo comandos...`);

            // Oído global para responder los estados de la impresora
            puerto.on('data', (data) => {
                if (data.includes(0x02) && puerto && puerto.isOpen) {
                    puerto.write(Buffer.from([0x06]), (writeErr) => {
                        if (writeErr) console.log("Aviso ACK:", writeErr.message);
                    }); 
                }
            });

            const procesarSiguiente = (index) => {
                if (terminado) return;

                if (index >= comandos.length) {
                    console.log("✅ Todos los comandos enviados. Esperando corte de papel...");
                    // Esperar 3.5 segundos para que la impresora física finalice el corte
                    setTimeout(() => {
                        console.log("🔌 Cerrando puerto de forma segura.");
                        finalizar({ exito: true, mensaje: 'Impresión exitosa' });
                    }, 3500); 
                    return;
                }

                const cmdActual = comandos[index];
                const paquete = armarPaquete(cmdActual);
                let respuestaRecibida = false;
                
                // Los comandos de pago/cierre y reportes físicos tardan más tiempo en imprimir
                const esComandoLargo = ['101', '102', '103', '104', '113', '119', '120', '199', '7', '810', 'I0X', 'I0Z'].includes(cmdActual);
                const tiempoEspera = esComandoLargo ? 40000 : 12000;

                const timeout = setTimeout(() => {
                    if (!respuestaRecibida && !terminado) {
                        respuestaRecibida = true;
                        console.error(`⏳ TIMEOUT en comando: ${cmdActual}`);
                        finalizar({ exito: false, mensaje: `Timeout en comando ${cmdActual}` });
                    }
                }, tiempoEspera); 
                
                const onResponse = (data) => {
                    if (respuestaRecibida || terminado) return;

                    if (data.includes(0x06)) { // ACK: Aceptado
                        respuestaRecibida = true;
                        clearTimeout(timeout);
                        if (puerto) puerto.removeListener('data', onResponse);
                        console.log(`✔️ Comando '${cmdActual}' Aceptado (ACK)`);
                        setTimeout(() => procesarSiguiente(index + 1), 70); 
                        
                    } else if (data.includes(0x15)) { // NAK: Rechazado
                        respuestaRecibida = true;
                        clearTimeout(timeout);
                        if (puerto) puerto.removeListener('data', onResponse);
                        console.log(`⚠️ Comando '${cmdActual}' respondió NAK`);

                        if (cmdActual === '199') {
                            // En algunas impresoras o si no hay flag 50, el cierre se fuerza con 7
                            console.log("ℹ️ Reintentando cierre con comando '7' (totalizador forzado)...");
                            comandos.splice(index + 1, 0, '7');
                            setTimeout(() => procesarSiguiente(index + 1), 70);
                        } else if (cmdActual === '7') {
                            // Según Manual HKA Pág. 23: cuando hay pago, 7 no anula sino que totaliza la información y corta.
                            // La máquina suele retornar NAK a la anulación pero procede a totalizar.
                            console.log("ℹ️ Comando 7 totalizador aceptado por protocolo (cierre en curso).");
                            setTimeout(() => procesarSiguiente(index + 1), 70);
                        } else {
                            console.error(`❌ ERROR NAK en comando: ${cmdActual}`);
                            finalizar({ exito: false, mensaje: `Comando rechazado por impresora: ${cmdActual}` });
                        }
                    }
                };

                puerto.on('data', onResponse);
                if (puerto && puerto.isOpen) {
                    puerto.write(paquete, (writeErr) => {
                        if (writeErr) {
                            console.error("Error escribiendo paquete:", writeErr.message);
                            finalizar({ exito: false, mensaje: 'Error al escribir: ' + writeErr.message });
                        }
                    });
                } else {
                    finalizar({ exito: false, mensaje: 'Puerto cerrado al enviar comando' });
                }
            };

            procesarSiguiente(0);
        });
    });
};

// ============================================================================
// FUNCIÓN 1: IMPRIMIR FACTURA FISCAL
// ============================================================================

const imprimirFacturaFiscal = async (cliente, productos, tasaBcv, metodoPago) => {
    try {
        let comandos = [];
        comandos.push(`i01Nombre: ${limpiarTexto(cliente.nombre).substring(0, 38)}`);
        comandos.push(`i02CI/RIF: ${cliente.tipo_documento}-${cliente.numero_documento}`);
        
        let direccion = cliente.direccion && cliente.direccion.trim() !== '' ? limpiarTexto(cliente.direccion) : 'NO REGISTRADA';
        comandos.push(`i03Dir: ${direccion.substring(0, 33)}`); // Max 40 caracteres en total

        productos.forEach(prod => {
            let precioBs = (parseFloat(prod.precio_unitario_usd) * tasaBcv).toFixed(2);
            let precioFormateado = pad(precioBs.replace('.', ''), 10);
            let cantidad = parseFloat(prod.cantidad).toFixed(3);
            let cantidadFormateada = pad(cantidad.replace('.', ''), 8);
            let tasa = prod.aplica_iva ? '!' : ' ';
            let nombreProd = prod.Producto ? prod.Producto.nombre : (prod.nombre || 'Producto');
            
            comandos.push(`${tasa}${precioFormateado}${cantidadFormateada}${limpiarTexto(nombreProd).substring(0, 20)}`);
        });

        // 1. Subtotal
        comandos.push('3'); 
        
        // 2. Medio de Pago (Pago Directo)
        let codigoPago = '101'; // Efectivo 1

        if (metodoPago === 'Punto de Venta' || metodoPago === 'Pago Móvil' || metodoPago === 'Transferencia') {
            codigoPago = '113'; // Tarjeta 1
        } else if (metodoPago === 'Zelle' || metodoPago === 'Divisa') {
            codigoPago = '120'; // Divisa 1
        } else if (metodoPago === 'Crédito') {
            codigoPago = '119'; // Ticket 1
        }
        comandos.push(codigoPago);

        // 3. 🔥 COMANDO OBLIGATORIO DE CIERRE (MANUAL TFHKA V8.5.0 PÁG 35, 45, 82)
        // Cierra la factura, imprime totales/IGTF y corta el papel.
        comandos.push('199');

        return await procesarComandos(comandos);
    } catch (error) { 
        console.error("Error imprimiendo factura:", error);
        return { exito: false, mensaje: error.message }; 
    }
};

// ============================================================================
// FUNCIÓN 2: IMPRIMIR NOTA DE CRÉDITO
// ============================================================================

const imprimirNotaCredito = async (cliente, productos, tasaBcv, numeroFacturaOriginal, fechaFacturaOriginal, serialImpresora = 'ZZP0021256') => {
    try {
        let comandos = [];
        
        // 1. Formatear número de factura a 11 dígitos obligatorios
        const soloNumero = numeroFacturaOriginal.toString().replace(/[^0-9]/g, '');
        const numFacturaFormateada = pad(soloNumero || '0', 11);

        // 2. Formatear fecha (DD/MM/AAAA)
        const d = new Date(fechaFacturaOriginal || new Date());
        const fechaStr = `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${d.getFullYear()}`;

        const cedula = `${cliente.tipo_documento}-${cliente.numero_documento}`;
        const nombre = limpiarTexto(cliente.nombre).substring(0, 38);

        // 3. Secuencia exacta del Protocolo V8.5.0
        comandos.push(`iF*${numFacturaFormateada}`);
        comandos.push(`iD*${fechaStr}`);
        comandos.push(`iI*${serialImpresora}`);
        comandos.push(`iR*${cedula}`);
        comandos.push(`iS*${nombre}`);

        // 4. Productos a devolver
        productos.forEach(prod => {
            let precioBs = (parseFloat(prod.precio_unitario_usd) * tasaBcv).toFixed(2);
            let precioFormateado = pad(precioBs.replace('.', ''), 10);
            
            let cantidad = parseFloat(prod.cantidad).toFixed(3);
            let cantidadFormateada = pad(cantidad.replace('.', ''), 8);
            
            let tasa = prod.aplica_iva ? 'd1' : 'd0'; // d1 para IVA general, d0 para exento
            let nombreProd = prod.Producto ? prod.Producto.nombre : (prod.nombre || 'Producto');
            let nombreLimpio = limpiarTexto(nombreProd).substring(0, 20);

            comandos.push(`${tasa}${precioFormateado}${cantidadFormateada}${nombreLimpio}`);
        });

        comandos.push('3');   // Subtotal
        comandos.push('101'); // Medio de pago
        comandos.push('199'); // Cierre obligatorio (Protocolo V8.5.0)

        return await procesarComandos(comandos);
    } catch (error) {
        console.error("Error estructurando Nota de Crédito:", error);
        return { exito: false, mensaje: error.message };
    }
};

// ============================================================================
// FUNCIÓN 3: REPORTE X (Lectura de caja sin cerrar jornada)
// ============================================================================
const imprimirReporteX = async () => {
    try {
        return await procesarComandos(['I0X']);
    } catch (error) {
        console.error("Error imprimiendo Reporte X:", error);
        return { exito: false, mensaje: 'Error al procesar Reporte X: ' + error.message };
    }
};

// ============================================================================
// FUNCIÓN 4: REPORTE Z / CIERRE Z (Cierre definitivo de jornada)
// ============================================================================
const imprimirReporteZ = async () => {
    try {
        return await procesarComandos(['I0Z']);
    } catch (error) {
        console.error("Error imprimiendo Cierre Z:", error);
        return { exito: false, mensaje: 'Error al procesar Cierre Z: ' + error.message };
    }
};

// ============================================================================
// FUNCIÓN 5: REIMPRESIÓN COPIA NO FISCAL (DNF)
// ============================================================================
const imprimirCopiaNoFiscal = async (factura, cliente, detalles) => {
    try {
        let comandos = [];
        const tasa = parseFloat(factura.tasa_bcv) || 1;

        comandos.push(`80!COPIA DE FACTURA (NO FISCAL)`);
        comandos.push(`800FACTURA ORIG: ${limpiarTexto(factura.numero_factura || '')}`);
        
        const d = new Date(factura.createdAt || new Date());
        const fechaStr = `${pad(d.getDate(), 2)}-${pad(d.getMonth() + 1, 2)}-${d.getFullYear()}`;
        comandos.push(`800FECHA ORIG: ${fechaStr}`);
        comandos.push(`800ESTADO: ${limpiarTexto(factura.estado || 'PAGADA')}`);
        comandos.push(`800Nombre: ${limpiarTexto(cliente.nombre || 'Contado').substring(0, 30)}`);
        comandos.push(`800CI/RIF: ${cliente.tipo_documento || 'V'}-${limpiarTexto(cliente.numero_documento || '00000000')}`);
        
        let direccion = cliente.direccion && cliente.direccion.trim() !== '' ? limpiarTexto(cliente.direccion) : 'N/A';
        comandos.push(`800Dir: ${direccion.substring(0, 33)}`);
        comandos.push(`800--------------------------------------`);

        (detalles || []).forEach(det => {
            const cant = parseFloat(det.cantidad) || 1;
            const precioUnitBs = ((parseFloat(det.precio_unitario_usd) || 0) * tasa).toFixed(2);
            const subtotalItemBs = ((parseFloat(det.subtotal_usd) || 0) * tasa).toFixed(2);
            const nombreProd = det.Producto ? det.Producto.nombre : (det.nombre || 'Producto');
            const alicuota = det.aplica_iva ? '(G)' : '(E)';

            comandos.push(`800${cant} x Bs ${precioUnitBs}`);
            comandos.push(`800${limpiarTexto(nombreProd).substring(0, 18)} ${alicuota} Bs ${subtotalItemBs}`);
        });

        const subtotalBs = ((parseFloat(factura.subtotal_usd) || 0) * tasa).toFixed(2);
        const ivaBs = ((parseFloat(factura.iva_usd) || 0) * tasa).toFixed(2);
        const totalBs = parseFloat(factura.total_bs || 0).toFixed(2);

        comandos.push(`800--------------------------------------`);
        comandos.push(`800SUBTTL: Bs ${subtotalBs}`);
        comandos.push(`800IVA (16%): Bs ${ivaBs}`);
        comandos.push(`80*TOTAL: Bs ${totalBs}`);
        comandos.push(`800PAGO: ${limpiarTexto(factura.metodo_pago || 'Efectivo')}`);
        
        // Cierre obligatorio del Documento No Fiscal con 810
        comandos.push(`810COPIA SIN DERECHO A CREDITO FISCAL`);

        return await procesarComandos(comandos);
    } catch (error) {
        console.error("Error imprimiendo Copia No Fiscal:", error);
        return { exito: false, mensaje: error.message };
    }
};

module.exports = { 
    imprimirFacturaFiscal, 
    imprimirNotaCredito, 
    imprimirReporteX, 
    imprimirReporteZ, 
    imprimirCopiaNoFiscal 
};
