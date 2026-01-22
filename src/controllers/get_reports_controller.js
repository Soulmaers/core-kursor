

/*

контроллеры для возврата структуры данных для отчетов
*/

const { ReportsControllClass } = require('../modules/reports/ReportsControllClass')



function get_report_pdf({ db }) {
    console.log('эвент')
    return async (req, res) => {
        const arrayObjects = JSON.parse(req.query.objects)
        console.log(arrayObjects)
        const instance = new ReportsControllClass(arrayObjects)
        const globalData = await instance.init({ db })

        const data = globalData.map(e => [e.statistic, e.component, e.graphic])
        const titleName = object[0].nameTemplates
        const nameObjects = object.map(e => e.objectName)

    }

};





module.exports = { get_report_pdf }