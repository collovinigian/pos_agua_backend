const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

process.on('uncaughtException', (err) => {
    console.error('⚠️ UNCAUGHT EXCEPTION capturada:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ UNHANDLED REJECTION capturada:', reason);
});
const app = require('./src/app');
const sequelize = require('./src/config/db');

const PORT = process.env.PORT || 3000;

// Endpoint de Verificación de Estado
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Endpoint de Apagado Limpio
app.post('/api/sistema/apagar', async (req, res) => {
    console.log('🛑 Orden de apagado recibida desde la aplicación Flutter...');
    res.status(200).json({ mensaje: 'Apagando servidor...' });
    try {
        await sequelize.close();
    } catch (err) {
        console.error('Error cerrando BD:', err);
    }
    setTimeout(() => {
        process.exit(0);
    }, 200);
});

app.listen(PORT, () => {
    console.log(`Servidor de Facturación corriendo en el puerto ${PORT}`);
});