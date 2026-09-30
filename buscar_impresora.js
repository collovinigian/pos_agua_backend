const { SerialPort } = require('serialport');

async function listarPuertos() {
    console.log("Buscando puertos Seriales (COM) conectados...");
    try {
        const puertos = await SerialPort.list();
        if (puertos.length === 0) {
            console.log("No se encontró ningún dispositivo conectado.");
        } else {
            puertos.forEach((puerto, index) => {
                console.log(`\nDispositivo ${index + 1}:`);
                console.log(`- Puerto: ${puerto.path}`);
                console.log(`- Fabricante: ${puerto.manufacturer || 'Desconocido'}`);
                console.log(`- PnP ID: ${puerto.pnpId || 'Desconocido'}`);
            });
        }
    } catch (error) {
        console.error("Error buscando puertos:", error);
    }
}

listarPuertos();