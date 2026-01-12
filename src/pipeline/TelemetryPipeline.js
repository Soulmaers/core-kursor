//цетральный конвеер
const { pushTelemetry } = require('../services/edgeconnect/pushToEDgeMSG')


class TelemetryPipeline {
    constructor({ rawWriter, configSvc, normalizer, normWriter, eventEngine, eventWriter, simulator, concurrency = 8 }) {
        this.rawWriter = rawWriter;
        this.configSvc = configSvc;
        this.normalizer = normalizer;
        this.normWriter = normWriter;
        this.eventEngine = eventEngine;
        this.eventWriter = eventWriter;
        this.concurrency = concurrency;
        this.simulator = simulator;
    }

    async processBatch(points, ctx = {}) {
        // сортируем по времени терминала (unix), при равенстве — по времени приёма
        const t = p => (p.time ?? 0);
        const r = p => (p.time_received ? +new Date(p.time_received) : 0);

        points.sort((a, b) => {
            const c1 = t(a) - t(b);
            if (c1) return c1;
            return r(a) - r(b);
        });
        const lastPoint = points[points.length - 1];

        await this._processSeries(points, ctx);
        if (ctx.adresserver === '1') {
            const cfgRow = await this.configSvc.getConfig(lastPoint.id_object);
            const cfg = cfgRow ? JSON.parse(cfgRow.config_json) : null;
            const result = await this.simulator.init(points, lastPoint.id_object, cfg)
            if (result) {
                for (let item of result) {
                    if (!item) continue
                    await this._processSeries(item.data, ctx);
                }
            }


        }

    }



    async _processSeries(points, ctx) {
        const lastPoint = points[points.length - 1];
        console.log(lastPoint.id_object)
        const cfgRow = await this.configSvc.getConfig(lastPoint.id_object);
        const cfg = cfgRow ? JSON.parse(cfgRow.config_json) : null;
        const norm = await this.normalizer.normalize(lastPoint, cfg);

        const queue = [...points];
        const workers = Array.from(
            { length: this.concurrency },
            () => this._drain(queue, ctx),
        );
        await Promise.all(workers);
        await this.rawWriter.insert_last_mess(norm);
        await pushTelemetry(norm, cfg);
    }

    async _drain(queue, ctx) {
        while (queue.length) {
            const p = queue.shift();
            await this.processOne(p, ctx);
        }
    }

    async processOne(p, { proto, port }) {
        // 0) обогащаем контекст протокола/порта
        p.proto = p.proto || proto || null;
        p.port = p.port || port || 0;
        await this.rawWriter.insert(p);  //-НЕ ЗАБЫТЬ ГЕОКОДИНГ
    }

    // 5) события
    /*  const evts = this.eventEngine.detect(norm);
      await this.eventWriter.bulkInsert(rawId, evts, p.imei);*/

    // 6) (опционально) пуш в WS тут же


    /* _crcFast(p) {
         // минимально: хеш от (imei|time|lat|lon|speed)
         // можно заменить на crypto.createHash('sha1').update(...).digest()
         const base = `${p.imei}|${p.time}|${p.lat}|${p.lon}|${p.speed || ''}`;
         // простой фолбэк; лучше используй crypto SHA1
         let h = 0; for (let i = 0; i < base.length; i++) h = ((h << 5) - h) + base.charCodeAt(i) | 0;
         return h; // в БД лучше хранить двоичный SHA1
     }*/
}

module.exports = { TelemetryPipeline };




