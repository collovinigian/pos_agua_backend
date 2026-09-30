const { SerialPort } = require('serialport');

const armarPaquete = (comandoStr) => {
    const cmdBuf = Buffer.from(comandoStr, 'ascii'); 
    let lrc = 0;
    for (let i = 0; i < cmdBuf.length; i++) lrc ^= cmdBuf[i];
    lrc ^= 0x03; 
    return Buffer.concat([Buffer.from([0x02]), cmdBuf, Buffer.from([0x03, lrc])]);
};

// Basado estrictamente en el "Ejemplo para generar una Nota de Credito" (Manual de Protocolos V8.5.0)
const comandos = [
    // 1. ENCABEZADOS OBLIGATORIOS (Notar el uso del '*' en cada comando)
    "iF*00000000028",              // 11 dígitos obligatorios
    "iD*29/09/2026",               // Formato DD/MM/AAAA
    "iI*ZZP0021256",               // Serial de tu máquina
    "iR*V-27410773",               // RIF/C.I.
    "iS*GIANFRANCO COLLOVINI",     // Razón Social
    
    // 2. PRODUCTO A DEVOLVER
    // d1 = Tasa General (16%). Formato: [Precio(10)][Cantidad(8)][Nombre]
    "d1000004289400001000RECARGA", 
    
    // 3. SUBTOTAL Y CIERRE
    "3",    // Subtotal
    "199"   // Comando de cierre obligatorio
];

const puerto = new SerialPort({ path: 'COM5', baudRate: 9600, dataBits: 8, parity: 'even', stopBits: 1 });

puerto.on('open', () => {
    console.log("Iniciando inyección nativa de Nota de Crédito (Protocolo V8.5.0)...");
    let index = 0;
    
    const enviarSiguiente = () => {
        if (index >= comandos.length) {
            console.log("✅ ¡Impresión Finalizada!");
            return puerto.close();
        }
        console.log(`➤ Enviando: ${comandos[index]}`);
        puerto.write(armarPaquete(comandos[index]));
    };

    puerto.on('data', (data) => {
        if (data.includes(0x06)) {
            console.log(`✔️ Aceptado`);
            index++;
            setTimeout(enviarSiguiente, 150); 
        } else if (data.includes(0x15)) {
            console.log(`❌ ERROR (NAK) en la línea.`);
            puerto.close();
        }
    });
    
    enviarSiguiente();
});