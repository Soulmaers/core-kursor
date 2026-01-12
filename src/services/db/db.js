const sql = require('mssql');

function buildConfig(env = process.env) {
    return {
        server: env.DB_HOST,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASS,
        port: Number(env.DB_PORT || 1433),
        pool: { max: Number(env.DB_POOL_MAX || 20), min: 0, idleTimeoutMillis: 30000 },
        options: { trustServerCertificate: true, enableArithAbort: true },
        requestTimeout: 60000,
        connectionTimeout: 15000,
    };
}

async function createDbPool(cfg = buildConfig()) {
    const pool = new sql.ConnectionPool(cfg);
    const connected = await pool.connect();
    connected.on('error', err => console.error('[mssql pool error]', err));
    return connected;
}

module.exports = { sql, createDbPool };