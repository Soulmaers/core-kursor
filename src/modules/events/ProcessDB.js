
/*
класс для работы с бд

*/


const axios = require('axios')
const sql = require('mssql');
const { normalizePoint } = require('../../services/utils/normalizePoint')

class ProcessDB {
    constructor({ db }) {
        this.db = db;
    }



    async get_telemetry(id_object, time1, time2) {
        console.log(id_object, time1, time2)
        const postModel = `
            SELECT *
            FROM telemetry_row
            WHERE id_object=@idw AND time_terminal >= @time1 AND time_terminal <= @time2 ORDER BY time_terminal
          `;
        try {
            const result = await this.db.request()
                .input('idw', id_object)
                .input('time2', time2)
                .input('time1', time1)
                .query(postModel);

            const object = result.recordset.map(el => normalizePoint(el))
            object.sort((a, b) => Number(a.time_terminal) - Number(b.time_terminal));
            return object.length === 0 ? null : object
        }
        catch (error) {
            console.log(error);
            return null
        }
    };


    async getConfigs(idw) {
        try {

            const selectBase = `SELECT * FROM config_params WHERE idw=@idw AND param=@param`
            const result = await this.db.request()
                .input('idw', idw)
                .input('param', 'oil')
                .query(selectBase);
            return result.recordset ? result.recordset[0] : null
        }
        catch (e) {
            console.log(e)
        }
    }
    async getLastConfig(id_object) {
        const sqlSelectLast = `
            SELECT TOP 1 * FROM configs
            WHERE id_object = @id_object
            ORDER BY saved_at_unix DESC;
        `;
        try {
            const result = await this.db.request()
                .input('id_object', id_object)
                .query(sqlSelectLast);
            const cfg = result.recordset
            return cfg.length === 0 ? null : cfg
        }
        catch (error) {
            console.log(error);
            return null
        }

    }


    async getNearest(idw, ts) {
        const nearestSql = `
    SELECT TOP (1) extras, time_terminal
    FROM telemetry_row
    WHERE id_object = @idw
          AND TRY_CONVERT(BIGINT, time_terminal) IS NOT NULL
    ORDER BY ABS(TRY_CONVERT(BIGINT, time_terminal) - @ts) ASC,
             TRY_CONVERT(BIGINT, time_terminal) DESC;
  `;

        try {
            const res = await this.db.request()
                .input('idw', sql.VarChar, String(idw))
                .input('ts', sql.BigInt, Number(ts)) // ВАЖНО: BIGINT, а не строка
                .query(nearestSql);

            res.timeout = 60000
            return res.recordset[0] ?? null;
        } catch (e) {
            console.error(e);
            return null
        }
    }

    async getModels(id) {
        const nearestSql = 'SELECT osi, trailer, tyres FROM model WHERE idw=@idw'

        try {
            const res = await this.db.request()
                .input('idw', sql.VarChar, id)
                .query(nearestSql);
            return res.recordset ?? null;
        } catch (e) {
            console.error(e);
            return null
        }
    }


    async getTyres(id) {
        const tyres = 'SELECT tyresdiv, pressure, temp, osNumber FROM tyres WHERE idw=@idw'
        try {
            const res = await this.db.request()
                .input('idw', id)
                .query(tyres);
            return res.recordset ?? null;
        } catch (e) {
            console.error(e);
            return null
        }

    }
    async getIfbar(id) {
        const ifbar = 'SELECT * FROM ifBar WHERE idw=@idw'
        try {
            const res = await this.db.request()
                .input('idw', id)
                .query(ifbar);
            return res.recordset ?? null;
        } catch (e) {
            console.error(e);
            return null
        }

    }

}

module.exports = {
    ProcessDB
}


