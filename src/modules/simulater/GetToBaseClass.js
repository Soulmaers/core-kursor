const { normalizePoint } = require('../../services/utils/normalizePoint')


class GetToBaseClass {



    static async getModel(id) {
        const post = `SELECT nameCar, osi, trailer, tyres FROM model WHERE idw=@id`
        try {
            const pool = await connection
            const result = await pool.request()
                .input('id', id)
                .query(post)
            return result.recordset.length === 0 ? null : result.recordset
        }
        catch (e) {
            console.log(e)
            return null
        }
    }

    static async updateTemplateVariables(id, stateCube, prevStateCube,
        stateTravel, timeParking, lastParkingTime, flagMutation, timeMsg, lastTimeMsg, flagLowpressure, flagstartReys, db) {
        const post = `UPDATE   templates_simulation   SET stateCube=@stateCube,prevStateCube=@prevStateCube,stateTravel=@stateTravel,
        timeParking=@timeParking,lastParkingTime=@lastParkingTime,flagMutation=@flagMutation,timeMsg=@timeMsg,lastTimeMsg=@lastTimeMsg,
        flagLowpressure=@flagLowpressure,flagstartReys=@flagstartReys WHERE id=@id`
        try {
            const result = await db.request()
                .input('id', id)
                .input('stateCube', stateCube)
                .input('prevStateCube', prevStateCube)
                .input('stateTravel', stateTravel)
                .input('timeParking', timeParking)
                .input('lastParkingTime', lastParkingTime)
                .input('flagMutation', String(flagMutation))
                .input('timeMsg', timeMsg)
                .input('lastTimeMsg', lastTimeMsg)
                .input('flagLowpressure', String(flagLowpressure))
                .input('flagstartReys', String(flagstartReys))
                .query(post)
            console.log('update')
            return 'update'
        }
        catch (e) {
            console.log(e)
            return null
        }

    }
    static async getSettingSimulation(id, db) {
        const post = `SELECT * FROM templates_simulation WHERE id_donor=@id`
        try {
            const result = await db.request()
                .input('id', id)
                .query(post)
            //  console.log(result.recordset)
            return result.recordset.length === 0 ? null : result.recordset
        }
        catch (e) {
            console.log(e)
            return null
        }
    }

    static async getLatMessages(id, db) {

        const sqls = `SELECT * FROM last_messages_row WHERE id_object=@id_object`;
        try {
            const result = await db.request()
                .input('id_object', id)
                .query(sqls);


            const object = result.recordset.map(el => normalizePoint(el))
            return (object.length === 0 ? null : object[0])
        }
        catch (error) {
            console.log(error);
            return null
        }

    }



    static async getTyres(id, db) {
        console.log(`id+${id}`)
        const post = `SELECT tyresDiv,pressure, temp, osNumber FROM tyres WHERE idw=@id`
        try {
            const result = await db.request()
                .input('id', id)
                .query(post)
            return result.recordset.length === 0 ? null : result.recordset
        }
        catch (e) {
            console.log(e)
            return null
        }
    }

    static async getParametrs(id) {
        const post = `SELECT * FROM sens_stor_meta WHERE idw=@id`
        try {
            const pool = await connection
            const result = await pool.request()
                .input('id', id)
                .query(post)
            return result.recordset.length === 0 ? null : result.recordset
        }
        catch (e) {
            console.log(e)
            return null
        }
    }

    static async getPorog(id, param) {
        const post = `SELECT value FROM coef WHERE idw=@id AND params=@param`
        try {
            const pool = await connection
            const result = await pool.request()
                .input('id', id)
                .input('param', param)
                .query(post)
            return result.recordset.length === 0 ? null : result.recordset
        }
        catch (e) {
            console.log(e)
            return null
        }
    }

    static async getParams(id, time, params) {
        //  console.log(time)
        const value = params.filter(e => e !== null)
        const selectedTColumnsTest = value.join(", ")
        const post = `
            SELECT ${selectedTColumnsTest}
            FROM globalStor
            WHERE idw=@idw AND last_valid_time >= @time1 AND last_valid_time <= @time2
        `;
        try {
            const pool = await connection;
            const result = await pool.request()
                .input('idw', String(id))
                .input('time2', String(time[1]))
                .input('time1', String(time[0]))
                .query(post);
            return result.recordset.length === 0 ? null : result.recordset
        }


        catch (e) {
            console.error(e);
            return [];
        }
    }
}

module.exports = GetToBaseClass