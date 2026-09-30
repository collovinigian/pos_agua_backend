const { SerialPort } = require('serialport');

// Configuramos el puerto COM5 exactamente como lo exige The Factory HKA
const puerto = new SerialPort({
    path: 'COM5',
    baudRate: 9600, // Velocidad estándar fiscal
    dataBits: 8,
    parity: 'even', // Paridad Par (Exigencia fiscal)
    stopBits: 1
});

puerto.on('open', () => {
    console.log('✅ Puerto COM5 abierto con éxito. Hablando con la máquina...');

    // Vamos a enviar el comando "S1" (Pedir Estado de la Impresora)
    // El protocolo TFHKA exige la estructura: STX + Comando + ETX + LRC (Suma de verificación)
    
    const STX = 0x02; // Inicio de texto
    const ETX = 0x03; // Fin de texto
    
    // Comando 'S1' en código ASCII
    const charS = 'S'.charCodeAt(0); 
    const char1 = '1'.charCodeAt(0); 

    // Cálculo del LRC (XOR del comando y el ETX)
    const LRC = charS ^ char1 ^ ETX;

    // Armamos el paquete de bytes
    const paquete = Buffer.from([STX, charS, char1, ETX, LRC]);

    console.log('Enviando paquete fiscal...');
    puerto.write(paquete);
});

// Escuchamos la respuesta de la impresora
puerto.on('data', (data) => {
    console.log('====================================');
    console.log('¡LA IMPRESORA RESPONDIÓ!');
    console.log('Respuesta cruda (Buffer):', data);
    console.log('Respuesta en texto:', data.toString('utf8'));
    console.log('====================================');
    
    // Cerramos el puerto después de recibir la respuesta
    puerto.close();
});

puerto.on('error', (err) => {
    console.error('Error en el puerto:', err.message);
});