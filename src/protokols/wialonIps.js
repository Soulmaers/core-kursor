// protocols/wialonIps.js
const net = require('net');

class ListenPortIPS {
    constructor(port, { pipeline, objectRegistry, host = '0.0.0.0' }) {
        this.port = port;
        this.host = host;
        this.pipeline = pipeline;
        this.objectRegistry = objectRegistry;
        this.createServer();
    }

    createServer() {
        this.server = net.createServer((socket) => {
            new ParseBuffer(socket, this.port, {
                pipeline: this.pipeline,
                objectRegistry: this.objectRegistry
            });
        });

        this.server.on('error', (err) => {
            console.error('[IPS] server error', err);
        });

        this.server.listen(this.port, this.host, () => {
            console.log(`TCP протокол слушаем порт ${this.host}:${this.port}`);
        });
    }

    close() { this.server?.close(); }
}

class ParseBuffer {
    constructor(socket, port, { pipeline, objectRegistry }) {
        this.socket = socket;
        this.port = port;
        this.pipeline = pipeline;
        this.objectRegistry = objectRegistry;

        this.partial = '';
        this.imei = null;
        this.batch = [];
        this.flushTimer = setInterval(() => this.flush(), 1000);

        this.bind();
    }

    bind() {
        this.socket.setNoDelay(true);
        this.socket.setKeepAlive(true);
        this.socket.setTimeout(120000);
        this.socket.on('data', (buf) => this.onData(buf));
        this.socket.on('timeout', () => this.socket.destroy());
        this.socket.on('error', (e) => console.error('[IPS socket error]', e));
        this.socket.on('close', () => { clearInterval(this.flushTimer); this.flush(true); });
    }

    onData(buf) {
        //console.log(buf)
        this.partial += buf.toString('utf8');
        let idx;
        while ((idx = this.partial.indexOf('\r\n')) >= 0) {
            const frame = this.partial.slice(0, idx);
            this.partial = this.partial.slice(idx + 2);
            if (frame) this.handleFrame(frame);
        }
        if (this.partial.length > 2_000_000) {
            console.warn('[IPS] overflow, drop socket');
            this.socket.destroy();
        }
        //  console.log(this.batch.length, this.imei)
        if (this.batch.length >= 200) this.flush();
    }

    handleFrame(frame) {
        // #L#IMEI;PASS | #D#... | #B#... | #SD#...
        const m = /^#(L|D|P|SD|B|M|I)#(.*)$/.exec(frame);
        if (!m) return;

        const type = m[1];
        const body = m[2];
        //  console.log(`Кадр типа ${type}: ${body}`);
        switch (type) {
            case 'L': {
                const parts = body.split(';');

                // Ищем поле, соответствующее формату IMEI (15 цифр)
                const imeiCandidate = parts.find(part => /^\d{15}$/.test(part.trim()));

                if (!imeiCandidate) {
                    console.error('IMEI не найден в L‑кадре:', body);
                    return;
                }

                this.imei = imeiCandidate.trim();
                //   console.log('IMEI установлен:', this.imei);

                // Остальные поля (если нужны) можно обработать по остаточному принципу
                const otherFields = parts.filter(part => part !== this.imei);
                // console.log('Прочие поля:', otherFields);

                break;
            }
            case 'D':
            case 'B': {
                const parts = body.split(';').slice(0, 16); // Берём только первые 16
                const rec = {};
                //  console.log(parts)
                if (parts.length >= 10) this.createObjectDataShort(parts.slice(0, 10), rec);
                if (parts.length >= 16) this.createObjectDataLong(parts.slice(0, 16), rec);
                //   console.log(this.imei, Object.keys(rec).length)
                if (Object.keys(rec).length) this.batch.push(rec);
                //  console.log(rec.imei, this.batch.length)
                break;
            }
            case 'SD': {
                const parts = body.split(';');
                const rec = {};
                this.createObjectDataShort(parts, rec);
                if (Object.keys(rec).length) this.batch.push(rec);
                break;
            }
            default: return;
        }
    }

    async flush(final = false) {
        //  console.log(this.imei, this.batch.length)
        if (!this.batch.length) return;

        // один сокет — один IMEI по IPS
        const imei = this.imei ? String(this.imei) : '';
        if (!imei) {
            // нет авторизации — дропаем накопленное (или можно буферить, но смысла мало)
            this.batch = [];
            if (final) console.log('[IPS] final flush dropped: no IMEI (not logged in)');
            return;
        }

        const { id_object, adressserver } = await this.objectRegistry.getActiveSet(imei);
        console.log(id_object, imei, this.batch.length)
        if (!id_object) {
            this.batch = [];
            if (final) console.log(`[IPS] final flush dropped: unknown IMEI ${imei}`);
            return;
        }
        // готовим валидную пачку для пайплайна
        const out = this.batch.map(p => {
            // на всякий случай переустановим imei из сессии
            p.imei = imei;
            p.id_object = id_object
            p.proto = 'ips';
            p.port = this.port;
            return p;
        });
        this.batch = [];
        try {
            await this.pipeline.processBatch(out, { proto: 'ips', port: this.port, adresserver: adressserver });
            if (final) console.log(`[IPS] final flush: passed=${out.length}, dropped=0`);
        } catch (e) {
            console.error('[IPS] pipeline error', e);
        }
    }

    // ===== helpers =====

    reverseBinaryArray(n) {
        return Number(n).toString(2).split('').reverse().map(x => parseInt(x, 10));
    }

    // IPS: HHMMSS → unix(UTC) на "сегодня". Если у тебя есть дата (DDMMYY) — лучше склеивать дату+время!
    createUnixTime(hhmmss) {
        const now = new Date();
        const h = parseInt(hhmmss.slice(0, 2), 10);
        const m = parseInt(hhmmss.slice(2, 4), 10);
        const s = parseInt(hhmmss.slice(4, 6), 10);
        now.setUTCHours(h, m, s, 0); // UTC
        return Math.floor(now.getTime() / 1000);
    }

    applyHemisphere(valueDeg, hemi, isLat) {
        const val = Number(valueDeg);
        if (!Number.isFinite(val)) return null;
        if ((isLat && hemi === 'S') || (!isLat && hemi === 'W')) return -val;
        return val;
    }

    convertionLat(latStr) {
        const deg = parseInt(latStr.substring(0, 2), 10);
        const minutes = parseFloat(latStr.substring(2)) / 60;
        return deg + minutes;
    }
    convertionLon(lonStr) {
        const deg = parseInt(lonStr.substring(0, 3), 10);
        const minutes = parseFloat(lonStr.substring(3)) / 60;
        return deg + minutes;
    }

    // Собираем extras: adc[], ibutton, inputs/outputs, height и всё «неядро»
    buildExtrasFromRec(rec) {
        const CORE_KEYS = new Set([
            'imei', 'time', 'lat', 'lon', 'speed', 'course', 'sats', 'hdop',
            'msg_type', 'proto', 'time_reg', 'port', 'last_valid_time'
        ]);
        const extras = {};

        // высота, входы/выходы, ключ iButton — если есть
        if (typeof rec.height !== 'undefined') extras.height = rec.height;
        if (typeof rec.inputs !== 'undefined') extras.inputs = rec.inputs;
        if (typeof rec.outputs !== 'undefined') extras.outputs = rec.outputs;
        if (typeof rec.ibutton !== 'undefined') extras.ibutton = rec.ibutton;

        // adc1..adcN → adc[]
        const adc = [];
        for (let i = 1; i <= 32; i++) {
            const k = `adc${i}`;
            if (Object.prototype.hasOwnProperty.call(rec, k) && rec[k] != null) {
                adc.push(Number(rec[k]));
                delete rec[k]; // чтобы не дублировать
            }
        }
        if (adc.length) extras.adc = adc;

        // прочие неядровые параметры (например, из params)
        for (const [k, v] of Object.entries(rec)) {
            if (!CORE_KEYS.has(k) && !(k in extras)) extras[k] = v;
        }

        return Object.keys(extras).length ? extras : null;
    }

    // ===== парсеры кадров =====

    createObjectDataShort(p, rec) {
        //  console.log(p)
        // Wialon IPS D/SD (10 полей): date,time,lat,NS,lon,EW,speed,course,height,sats
        const nowSec = Math.floor(Date.now() / 1000);
        const lat = this.convertionLat(p[2]);
        const lon = this.convertionLon(p[4]);

        rec.time_reg = nowSec;                 // время приёма сервером (unix)
        rec.imei = this.imei;
        rec.port = this.port;
        rec.date = p[0];                       // строка даты из кадра (если надо)
        rec.time = this.createUnixTime(p[1]);  // unix(UTC) по HHMMSS
        rec.lat = this.applyHemisphere(lat, p[3], true);
        rec.lon = this.applyHemisphere(lon, p[5], false);
        rec.speed = Number(p[6]);
        rec.course = Number(p[7]);
        rec.height = Number(p[8]);
        rec.sats = Number(p[9]);

        // соберём extras (в short кадре это будет height, если нужно)
        rec.extras = this.buildExtrasFromRec(rec);
    }

    createObjectDataLong(p, rec) {
        // 16 полей: short + hdop, inputs, outputs, adc_list, ibutton, params
        this.createObjectDataShort(p, rec);
        rec.hdop = parseFloat(p[10]);
        rec.inputs = this.reverseBinaryArray(p[11])?.[0] ?? null;
        rec.outputs = this.reverseBinaryArray(p[12])?.[0] ?? null;

        const adc = p[13].split(',');
        for (let i = 0; i < adc.length; i++) {
            rec[`adc${i + 1}`] = adc[i] !== 'NA' ? parseFloat(adc[i]) : null;
        }
        rec.ibutton = p[14];

        // params: key:type:value[,key:type:value...]
        const params = p[15].split(',');
        for (const el of params) {
            const [key, typ, val] = el.split(':');
            if (!key) continue;
            switch (typ) {
                case '1': rec[key] = parseInt(val, 10); break;
                case '2': rec[key] = parseFloat(val); break;
                default: rec[key] = val; break;
            }
        }

        // собрать обновлённые extras (adc[], ibutton, inputs/outputs, params)
        rec.extras = this.buildExtrasFromRec(rec);
    }
}

module.exports = ListenPortIPS;
