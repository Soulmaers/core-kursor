


/*

запрос в бд полученние последнего конфига
*/
class ConfigService {

    constructor({ db }) {
        this.pool = db;
    }

    async getConfig(id_object) {
        const post = 'SELECT TOP (1) * FROM configs WHERE id_object=@id_object ORDER BY saved_at_unix DESC'
        const result = await this.pool.request().input('id_object', id_object).query(post)
        return result.recordset[0] || null;
    }
}





module.exports = { ConfigService }