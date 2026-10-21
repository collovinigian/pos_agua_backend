const { SerialPort } = require('serialport');

const armarPaquete = (comandoStr) => {
    const cmdBuf = Buffer.from(comandoStr, 'ascii'); 
    let lrc = 0;
    for (let i = 0; i < cmdBuf.length; i++) lrc ^= cmdBuf[i];
    lrc ^= 0x03; 
    return Buffer.concat([Buffer.from([0x02]), cmdBuf, Buffer.from([0x03, lrc])]);
};

console.log("Conectando con la impresora en COM5 para cerrar la factura atascada...");
const puerto = new SerialPort({ path: 'COM5', baudRate: 9600, dataBits: 8, parity: 'even', stopBits: 1, autoOpen: false });

puerto.open((err) => {
    if (err) {
        console.error("❌ No se pudo abrir COM5. Asegúrate de que la impresora esté encendida y conectada:", err.message);
        process.exit(1);
    }

    console.log("🖨️ Puerto COM5 abierto. Enviando comando de cierre 199...");
    puerto.write(armarPaquete('199'));

    const timeout = setTimeout(() => {
        console.log("⏳ Tiempo de espera agotado. Cerrando puerto...");
        puerto.close();
        process.exit(0);
    }, 15000);

    puerto.on('data', (data) => {
        if (data.includes(0x06)) {
            clearTimeout(timeout);
            console.log("✅ ¡Comando de cierre ACEPTADO (ACK)! La factura física se totalizó y cortó correctamente.");
            setTimeout(() => {
                puerto.close();
                process.exit(0);
            }, 3000);
        } else if (data.includes(0x15)) {
            console.log("⚠️ Comando 199 respondió NAK. Enviando comando 7 (totalizador forzado)...");
            puerto.write(armarPaquete('7'));
        }
    });

    puerto.on('error', (e) => {
        console.error("Error en COM5:", e.message);
    });
});
