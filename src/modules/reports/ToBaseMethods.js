

class ToBaseMethods {



    static getAttributeTemplaceToBase = async (id, { db }) => {
        try {
            const postModel = `SELECT   
* FROM templates WHERE incriment=@incriment`;
            const results = await db.request()
                .input('incriment', Number(id))
                .query(postModel)
            return results.recordset

        }
        catch (e) {
            console.log(e)
        }

    }

    static getSettingsToBase = async (idw, { db }) => {
        const sqls = `SELECT * FROM setReports WHERE idw=@idw`;
        try {
            const res = await db.request()
                .input('idw', String(idw))
                .query(sqls);
            return res.recordset
        }
        catch (error) {
            console.log(error);
            return error
        }
    };

    static sumIdwToBase = async (data, idw, { db }) => {

        if (data.length === 1) {
            try {
                const selectBase = "SELECT * FROM summary WHERE idw=@idw AND data=@data";
                const results = await db.request()
                    .input('idw', idw)
                    .input('data', data[0])
                    .query(selectBase)
                return results.recordset
            } catch (e) {
                console.log(e);

            }
        }
        else {
            try {
                const selectBase = "SELECT * FROM summary WHERE idw=@idw AND CAST(data AS DATE) >= @start AND CAST(data AS DATE) <= @end"
                const results = await db.request()
                    .input('idw', idw)
                    .input('start', data[0])
                    .input('end', data[1])
                    .query(selectBase)
                return results.recordset
            } catch (e) {
                console.log(e);
            }
        }
    };

}

module.exports = { ToBaseMethods }