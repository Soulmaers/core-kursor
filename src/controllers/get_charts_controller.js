const { ProcessDB } = require('../modules/events/ProcessDB')
const { CalkuletaTrips } = require('../modules/events/HistoryCalkulate')
const { OilCalculator } = require('../modules/events/OilCalculate')
const { DrainCalculate } = require('../modules/events/DrainCalculate')
const ServisFunction = require('../modules/events/ServisFunctions')

const { Normalizer } = require('../services/normalize/Normalizer')

function get_mileage_telemetry({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);

        // 1) I/O параллельно
        const instance = new ProcessDB({ db })
        const [mStart, mEnd] = await Promise.all([
            instance.getNearest(id_object, time1),
            instance.getNearest(id_object, time2)
        ]);
        const start_mileage = { mileage: JSON.parse(mStart.extras).mileage, time_terminal: mStart.time_terminal }
        const end_mileage = { mileage: JSON.parse(mEnd.extras).mileage, time_terminal: mEnd.time_terminal }
        res.json({ start_mileage, end_mileage })
    }
}

function get_fuel_telemetry({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);

        const instance = new ProcessDB({ db })
        const instanceNormalise = new Normalizer()
        const [data, cfg] = await Promise.all([
            instance.get_telemetry(id_object, time1, time2),
            instance.getLastConfig(id_object)
        ]);
        if (!data) return res.json(null)
        const config = JSON.parse(cfg[0].config_json)
        console.log(config)
        const promise = data.map(e => instanceNormalise.normalize(e, config))
        const telemetry = await Promise.all(promise)

        const refillCalc = new OilCalculator(data, config);
        const drainCalc = new DrainCalculate(data, config);


        const [refill, drain] = await Promise.all([
            refillCalc.init(),        // твой сырой формат заправок
            drainCalc.init(),
        ]);
        const filtered = await refillCalc.filtration()
        const promiseFiltr = filtered.map(e => instanceNormalise.normalize(e, config))
        const telemetryFilter = await Promise.all(promiseFiltr)
        const data_telemetry = refillCalc.prepareSeries(telemetry)

        res.json({ origin: data_telemetry, filtered: telemetryFilter, refill: refill[1], drain: drain[1] })
    }
}

function get_condition_telemetry({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);

        const instance = new ProcessDB({ db })
        const instanceNormalise = new Normalizer()
        const [data, cfg] = await Promise.all([
            instance.get_telemetry(id_object, time1, time2),
            instance.getLastConfig(id_object)
        ]);
        if (!data) return res.json(null)
        const config = JSON.parse(cfg[0].config_json)
        const promise = data.map(e => instanceNormalise.normalize(e, config))
        const telemetry = await Promise.all(promise)


        const tripsSvc = new CalkuletaTrips(config);
        const result = tripsSvc.init(telemetry)
        if (result.length === 0) return res.json(null)
        const trips = result.sortedItems.filter(e => e.kind === 'trip').flatMap(el => el.segments.map(item => ({
            kind: item.kind,
            start: item.start, end: item.end, time: item.time, startGeo: item.startGeo, endGeo: item.endGeo, startOil: item.startOil, endOil: item.endOil
        })))
        const parkings = result.sortedItems.filter(e => e.kind === 'parking').map(el => el)
        const condition = [...trips, ...parkings];
        condition.sort((a, b) => a.start - b.start)
        res.json(condition)
    }
}

function get_oil_info_telemetry({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);


        const instance = new ProcessDB({ db })
        const instanceNormalise = new Normalizer()
        const [data, cfg] = await Promise.all([
            instance.get_telemetry(id_object, time1, time2),
            instance.getLastConfig(id_object)
        ]);
        if (!data) return res.json(null)
        const config = JSON.parse(cfg[0].config_json)
        const promise = data.map(e => instanceNormalise.normalize(e, config))
        const telemetry = await Promise.all(promise)

        const refillCalc = new OilCalculator(data, config);
        const drainCalc = new DrainCalculate(data, config);

        const [refill, drain] = await Promise.all([
            refillCalc.init(),        // твой сырой формат заправок
            drainCalc.init(),
        ]);

        const expenditure = telemetry[0].extras.oil - telemetry[telemetry.length - 1].extras.oil + refill[0] - drain[0]
        res.json({ refill: refill[0], drain: drain[0], expenditure: parseInt(expenditure) })

    }
}

function get_skdsh_telemetry({ db }) {
    return async (req, res) => {
        const id_object = req.params.id_object
        const time1 = Number(req.query.time1);
        const time2 = Number(req.query.time2);



        const instance = new ProcessDB({ db })
        const instanceNormalise = new Normalizer()
        const [data, cfg] = await Promise.all([
            instance.get_telemetry(id_object, time1, time2),
            instance.getLastConfig(id_object)
        ]);

        if (!data) return res.json(null)
        const config = JSON.parse(cfg[0].config_json)
        const promise = data.map(e => instanceNormalise.normalize(e, config))
        const telemetry = await Promise.all(promise)

        telemetry.sort((a, b) => Number(a.time_terminal) - Number(b.time_terminal));


        const [tyres, ifbars] = await Promise.all([
            instance.getTyres(id_object),
            instance.getIfbar(id_object),
        ]);
        if (!tyres?.length) return res.json(null);

        const dynCols = new Set();
        tyres.forEach(t => { if (t.pressure) dynCols.add(t.pressure); if (t.temp) dynCols.add(t.temp); });

        // Простой даунсэмплинг: 1 точка на 5 секунд
        const bucketSec = 5;
        let filtered = [];
        let lastBucket = null;
        for (const r of telemetry) {
            const ts = Number(r.time_terminal);
            const bucket = Math.floor(ts / bucketSec);
            if (bucket !== lastBucket) { filtered.push(r); lastBucket = bucket; }
        }
        // Если всё равно много — прорежем каждый n-й
        const MAX_POINTS = 600;
        if (filtered.length > MAX_POINTS) {
            const n = Math.ceil(filtered.length / MAX_POINTS);
            filtered = filtered.filter((_, i) => i % n === 0);
        }

        // --- 3) Карта порогов по осям
        const osssMap = {};
        ifbars?.forEach(e => { osssMap[e.idOs] = e; });


        const BAD_TEMPS = new Set([-128, -51, -50]);

        // --- 5) Нормализация
        const series = tyres.map(el => {
            const bar = osssMap[el.osNumber] || null;

            const sens = config.sensors.custom_sensors.find(it => Object.values(it).includes(el.pressure))?.name
            el.sens || '—';

            const val = filtered.map(elem => {
                let value = elem.extras[el.pressure];
                value = value == null ? null : Number(value);
                if (value === -0.1) value = null;

                let tvalue = elem.extras[el.temp];
                tvalue = tvalue == null ? null : Number(tvalue);
                if (tvalue != null && BAD_TEMPS.has(tvalue)) tvalue = null;


                const engine = elem.extras.pwr ? (elem.extras.pwr >= config.events.engine.pwr) ? 1 : 0 : null
                return {
                    ts: Number(elem.time_terminal),
                    dates: new Date(Number(elem.time_terminal) * 1000), // если нужно как раньше
                    geo: [Number(elem.lat), Number(elem.lon)],
                    speed: elem.speed != null ? Number(elem.speed) : null,
                    engineOn: engine,
                    value,
                    tvalue,
                };
            });

            return {
                sens,
                position: Number(el.tyresdiv),
                pressure: el.pressure,
                temp: el.temp,
                bar,   // { knd, dvn, dnn, kvd } | null
                val,   // [{ ts, dates, geo, speed, engineOn, value, tvalue }]
            };
        });
        series.sort((a, b) => a.position - b.position)
        // сортировка по позиции
        // Можно вернуть «плоский» массив (как у тебя), но я бы сразу заворачивал в объект.
        return res.json(series);

    };
}



module.exports = { get_mileage_telemetry, get_fuel_telemetry, get_condition_telemetry, get_oil_info_telemetry, get_skdsh_telemetry }