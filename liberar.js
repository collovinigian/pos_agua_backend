const { SerialPort } = require('serialport');
const puerto = new SerialPort({ path: 'COM5', baudRate: 9600, dataBits: 8, parity: 'even', stopBits: 1 });

puerto.on('open', () => {
    console.log("Liberando impresora de la transacción atascada...");
    // El comando '7' es la orden universal fiscal para "Anular documento actual en curso"
    const cmdBuf = Buffer.from('7', 'ascii');
    const paquete = Buffer.concat([Buffer.from([0x02]), cmdBuf, Buffer.from([0x03, cmdBuf[0] ^ 0x03])]);
    
    puerto.write(paquete);
    setTimeout(() => {
        console.log("¡Impresora liberada! Ya puedes cerrar esta ventana.");
        puerto.close();
    }, 1500);
});