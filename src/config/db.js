const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false // Para que no llene la consola de comandos SQL
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a PostgreSQL establecida con éxito.');
    } catch (error) {
        console.error('❌ No se pudo conectar a la base de datos:', error.message);
    }
};

testConnection();

module.exports = sequelize;