
/*

контроллеры для возврата структуры данных для событий
*/

const { ProcessDB } = require('../modules/events/ProcessDB')
const { CalkuletaTrips } = require('../modules/events/HistoryCalkulate')
const { OilCalculator } = require('../modules/events/OilCalculate')
const { DrainCalculate } = require('../modules/events/DrainCalculate')
const ServisFunction = require('../modules/events/ServisFunctions')

const { Normalizer } = require('../services/normalize/Normalizer')

function get_events({ db }) {
    console.log('эвент')
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);

        // 1) I/O параллельно
        const instance = new ProcessDB({ db })
        const instanceNormalise = new Normalizer()
        const [data, cfg] = await Promise.all([
            instance.get_telemetry(id_object, time1, time2),
            instance.getLastConfig(id_object)
        ]);
        const config = JSON.parse(cfg[0].config_json)

        const promise = data.map(e => instanceNormalise.normalize(e, config))
        const telemetry = await Promise.all(promise)
        // console.log(telemetry)
        // console.log(cfg)
        if (data.length === 0) res.json([])
        else {
            const tripsSvc = new CalkuletaTrips(config);
            const refillCalc = new OilCalculator(data, config);
            const drainCalc = new DrainCalculate(data, config);

            const [result, refill, drain] = await Promise.all([
                tripsSvc.init(telemetry),   // { sortedItems, ... }
                refillCalc.init(),        // твой сырой формат заправок
                drainCalc.init(),
            ]);
            result.sortedItems = ServisFunction.mergeEvents(result.sortedItems || [], refill, 'refill');
            result.sortedItems = ServisFunction.mergeEvents(result.sortedItems || [], drain, 'drain');
            result.summary.refill = refill?.[0] || 0
            result.summary.drain = drain?.[0] || 0
            res.json(result)
        }
    }

};


module.exports = { get_events }


