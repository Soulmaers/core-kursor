const sql = require('mssql');
const { normalizePoint } = require('../services/utils/normalizePoint')

function get_telemetry({ db }) {
    console.log('тута')
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);
        const postModel = `
      SELECT *
      FROM telemetry_row
      WHERE id_object=@idw AND time_terminal >= @time1 AND time_terminal <= @time2 ORDER BY time_terminal
    `;
        try {
            const result = await db.request()
                .input('idw', id_object)
                .input('time2', sql.BigInt, time2)
                .input('time1', sql.BigInt, time1)
                .query(postModel);

            const object = result.recordset.map(el => normalizePoint(el))
            object.sort((a, b) => Number(a.time_terminal) - Number(b.time_terminal));
            res.json(object.length === 0 ? null : object)
        }
        catch (error) {
            console.log(error);
            res.json(null)
        }
    };


}





module.exports = { get_telemetry };