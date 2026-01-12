const sql = require('mssql');

// services/object-registry.js


class ObjectRegistry {
    constructor({ db, refreshMs = 30_000, logger = console } = {}) {
        this.logger = logger;
        this.refreshMs = refreshMs;
        this.map = new Map(); // imei -> { id, is_active }
        this.timer = null;
        this.db = db
    }



    async getActiveSet(imei) {
        if (!imei) return null;

        const pool = await this.db;
        const req = pool.request();
        req.input('imei', sql.VarChar(32), String(imei));

        const res = await req.query(`
    SELECT TOP (1) idx AS object_id, addressserver
    FROM dbo.objects
    WHERE imeidevice = @imei
  `);
        // console.log(res.recordset[0])
        return { id_object: res.recordset[0].object_id || null, adressserver: res.recordset[0].addressserver || null }
    }




    async existsActive(imei) {
        const pool = await this.db;
        const r = await pool.request()
            .input('imei', sql.VarChar(32), String(imei))
            .query('SELECT 1 AS ok FROM objects WITH (NOLOCK) WHERE imeidevice=@imei');
        return r.recordset.length > 0; // <-- boolean
    }
}

module.exports = { ObjectRegistry };
