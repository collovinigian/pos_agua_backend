const { SerialPort } = require('serialport');

const pad = (num, size) => String(num).padStart(size, '0');

const limpiarTexto = (texto) => {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ./,-]/g, '');
};

const armarPaquete = (comandoStr) => {
    const cmdBuf = Buffer.from(comandoStr, 'ascii'); 
    let lrc = 0;
    for (let i = 0; i < cmdBuf.length; i++) { lrc ^= cmdBuf[i]; }
    lrc ^= 0x03; 
    return Buffer.concat([Buffer.from([0x02]), cmdBuf, Buffer.from([0x03, lrc])]);
};

const procesarComandos = (comandos) => {
    return new Promise((resolve) => {
        const puerto = new SerialPort({ path: 'COM5', baudRate: 9600, dataBits: 8, parity: 'even', stopBits: 1 });

        puerto.on('open', () => {
            console.log("🖨️ Puerto COM5 abierto. Transmitiendo...");
            
            const procesarSiguiente = (index) => {
                if (index >= comandos.length) {
                    console.log("✅ ¡Impresión finalizada con éxito!");
                    puerto.close();
                    return resolve({ exito: true, mensaje: 'Impresión exitosa' });
                }

                const paquete = armarPaquete(comandos[index]);
                let respuestaRecibida = false;
                
                // ⏱️ ANTI-BLOQUEO: Si la impresora no responde en 3 seg, abortamos
                const timeout = setTimeout(() => {
                    if (!respuestaRecibida) {
                        respuestaRecibida = true;
                        console.error(`⏳ TIMEOUT: Impresora no respondió al comando: ${comandos[index]}`);
                        puerto.close();
                        resolve({ exito: false, mensaje: 'Timeout de impresora' });
                    }
                }, 3000);
                
                const onData = (data) => {
                    if (respuestaRecibida) return;

                    if (data.includes(0x06)) { // ACK: Aceptado
                        respuestaRecibida = true;
                        clearTimeout(timeout);
                        puerto.removeListener('data', onData);
                        setTimeout(() => procesarSiguiente(index + 1), 50); 
                        
                    } else if (data.includes(0x15)) { // NAK: Rechazado
                        respuestaRecibida = true;
                        clearTimeout(timeout);
                        puerto.removeListener('data', onData);
                        console.error(`❌ ERROR NAK en el comando: ${comandos[index]}`);
                        puerto.close();
                        resolve({ exito: false, mensaje: 'Comando rechazado' });
                    }
                };

                puerto.on('data', onData);
                puerto.write(paquete);
            };

            procesarSiguiente(0);
        });

        puerto.on('error', (err) => {
            resolve({ exito: false, mensaje: 'Error COM5' });
        });
    });
};

// ============================================================================
// FUNCIÓN 1: IMPRIMIR FACTURA FISCAL
// ==========================================================================

const imprimirFacturaFiscal = async (cliente, productos, tasaBcv, metodoPago) => {
    try {
        let comandos = [];
        comandos.push(`i01Nombre: ${limpiarTexto(cliente.nombre).substring(0, 38)}`);
        comandos.push(`i02CI/RIF: ${cliente.tipo_documento}-${cliente.numero_documento}`);
        
        // NUEVO: Agregamos la línea i03 para la dirección
        // Validamos por si el cliente no tiene dirección registrada en la BD
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

        comandos.push('3'); 
        let codigoPago = '101'; // Por defecto: EFECTIVO 1

        if (metodoPago === 'Punto de Venta' || metodoPago === 'Pago Móvil' || metodoPago === 'Transferencia') {
            codigoPago = '113'; // TARJETA 1
        } else if (metodoPago === 'Zelle' || metodoPago === 'Divisa') {
            codigoPago = '120'; // DIVISA 1
        } else if (metodoPago === 'Crédito') {
            codigoPago = '119'; // TICKET 1 (Que mandarás a renombrar como CREDITO)
        }
        
        comandos.push(codigoPago);
        return await procesarComandos(comandos);
    } catch (error) { 
        console.error("Error imprimiendo factura:", error);
        return { exito: false }; 
    }
};

// ============================================================================
// FUNCIÓN 2: IMPRIMIR NOTA DE CRÉDITO
// ==========================================================================

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
        comandos.push('101'); // Cierre de Nota de Crédito Protocolo V8.5.0

        return await procesarComandos(comandos);
    } catch (error) {
        console.error("Error estructurando Nota de Crédito:", error);
        return { exito: false };
    }
};

// ============================================================================
// FUNCIÓN 3: REPORTE X (Lectura de caja sin cerrar jornada)
// ============================================================================
const imprimirReporteX = async () => {
    try {
        // 🔥 COMANDO NATIVO CORREGIDO: 'I0X' (I mayúscula, cero, X mayúscula)
        return await procesarComandos(['I0X']);
    } catch (error) {
        console.error("Error imprimiendo Reporte X:", error);
        return { exito: false, mensaje: 'Error al procesar Reporte X' };
    }
};

// ============================================================================
// FUNCIÓN 4: REPORTE Z / CIERRE Z (Cierre definitivo de jornada)
// ============================================================================
const imprimirReporteZ = async () => {
    try {
        // 🔥 COMANDO NATIVO CORREGIDO: 'I0Z' (I mayúscula, cero, Z mayúscula)
        return await procesarComandos(['I0Z']);
    } catch (error) {
        console.error("Error imprimiendo Cierre Z:", error);
        return { exito: false, mensaje: 'Error al procesar Cierre Z' };
    }
};

module.exports = { imprimirFacturaFiscal, imprimirNotaCredito, imprimirReporteX, imprimirReporteZ };