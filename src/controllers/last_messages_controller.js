
const { normalizePoint } = require('../services/utils/normalizePoint')



function getLatMessages({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const sqls = `SELECT * FROM last_messages_row WHERE id_object=@id_object`;
        try {
            const result = await db.request()
                .input('id_object', id_object)
                .query(sqls);


            const object = result.recordset.map(el => normalizePoint(el))
            res.json(object.length === 0 ? null : object[0])
        }
        catch (error) {
            console.log(error);
            res.json(null)
        }
    };
}

module.exports = { getLatMessages };
