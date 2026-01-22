
/*
запись конфига в бд
получение последнего конфига из бд

*/



const { pushConfig } = require('../services/edgeconnect/pushToEDgeMSG')


function addConfig({ db }) {
    return async (req, res) => {
        const timeUnix = Math.floor((new Date()).getTime() / 1000)
        const id_object = req.params.id_object
        const payload = JSON.stringify(req.body.payload)
        // console.log(payload)
        const sqls = `INSERT INTO configs(id_object, config_json,saved_at_unix) VALUES (@id_object, @config_json,@saved_at_unix)`;

        try {
            const result = await db.request()
                .input('id_object', id_object)
                .input('config_json', payload)
                .input('saved_at_unix', timeUnix)
                .query(sqls);

            await pushConfig(id_object, req.body.payload) //пушим на edge тчо конфиг изменен чтобы положить в буффери  обновить ws
            res.json('Настройки сохранены')
        }
        catch (error) {
            console.log(error);

            res.json('Ошибка при сохранении')
        }
    };


}


function getLastConfig({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const sqlSelectLast = `
            SELECT TOP 1 * FROM configs
            WHERE id_object = @id_object
            ORDER BY saved_at_unix DESC;
        `;
        try {
            const result = await db.request()
                .input('id_object', id_object)
                .query(sqlSelectLast);
            const cfg = result.recordset
            res.json(cfg.length === 0 ? null : cfg)
        }
        catch (error) {
            console.log(error);

            res.json(null)
        }
    };
}

module.exports = { addConfig, getLastConfig };
