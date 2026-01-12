const ServisFunction = require('./ServisFunctions')


class OilCalculator {
    constructor(data, config) {
        this.dataOrigin = data || [];
        this.config = config || {};
        this.timeRefill = Number(config.events.refill.time)
        this.volumeRefill = Number(config.events.refill.minV)
        this.increasing = [];
        this.data = [];
        this.volume = [];
        this.oil = 0;
        console.log(this.config)
    }

    async init() {
        this.oilP = this.config.sensors.custom_sensors.find(e => e.param === 'oil')
        if (!this.oilP) return null;

        await this.filtration();          // -> this.data (сглажено + oil не трогаем здесь)
        this.calculateIntervals(this.data);
        this.volume = this.filterIntervals();

        // суммарно заправлено (литры)
        this.oil = this.volume.reduce((acc, seg) => {
            const firstL = this.liters(seg[0]);
            const lastL = this.liters(seg[seg.length - 1]);
            return acc + (lastL - firstL);
        }, 0);

        // список событий (time/geo берём из точки максимального «скачка» внутри сегмента)
        const count = this.volume.map(seg => {
            const startPoint = this.findStartRefill(seg) || seg[0];
            const firstL = this.liters(seg[0]);
            const lastL = this.liters(seg[seg.length - 1]);
            return {
                time: Number(startPoint.last_valid_time),
                geo: [Number(startPoint.lat), Number(startPoint.lon)],
                startOil: firstL,
                finishOil: lastL,
                value: Number((lastL - firstL).toFixed(2)),
                value2: 0
            };
        });

        return [Number(this.oil.toFixed(2)), count];
    }

    // перевод DUT -> литры через формулу; без parseInt, чтобы не терять дроби
    calkut(dut) {
        function transformExpressionWithExponent(str, x) {
            return String(str)
                .replace(/\s+/g, '')
                .replace(/(\d)(x)/g, '$1*$2')
                .replace(/x\^(\d+)/g, 'Math.pow(x,$1)')
                .replace(/x/g, x);
        }
        const formula = String(this.oilP.f || '').replace(/,/g, '.');
        const expr = transformExpressionWithExponent(formula, Number(dut));
        try {
            const val = dut <= 7001 ? Number(eval(expr)) : null // как у тебя   newValue = value <= 7001 ? parseInt(eval(formattedFormula)) : null
            return Number.isFinite(val) ? val : null;
        } catch (e) {
            console.error('calkut eval error:', e);
            return 0;
        }
    }

    liters(point) {
        return this.calkut(Number(point.dut));
    }

    prepareSeries(data) {
        // сортируем по времени
        const sorted = [...data].sort(
            (a, b) => Number(a.time_terminal) - Number(b.time_terminal)
        );

        // группируем по time и берём точку с максимальными литрами
        const byTime = new Map();
        for (const p of sorted) {
            const t = Number(p.time_terminal);
            const curr = byTime.get(t);
            const liters = this.calkut(Number(p.dut));
            if (!curr || liters > this.calkut(Number(curr.dut))) {
                byTime.set(t, p);
            }
        }
        return Array.from(byTime.values()).sort(
            (a, b) => Number(a.time_terminal) - Number(b.time_terminal)
        );
    }

    async filtration() {

        const smoothed = ServisFunction.medianFilters(this.dataOrigin, this.config);
        //  console.log(smoothed)
        //  const test = smoothed.map(e => ({ oil: e.oil, time: e.last_valid_time, dut: e.dut }))
        //  console.log(test)
        const collapsed = this.prepareSeries(smoothed);
        this.data = collapsed;
        return collapsed;

    }

    // детект «ростовых» сегментов с допуском по шуму и плато-таймаутом
    calculateIntervals(data) {
        const EPS_L = 0.5  // чувствительность шага, л
        const TIMEOUT_S = this.timeRefill                                   // плато дольше — разрыв
        const MAX_RISE_LPS = 1.2      // макс. допустимая скорость роста, л/с
        const MAX_STEP_L = 60    // макс. допустимый шаг за один интервал, л
        const MIN_STEP_SEC = 2        // минимум dt, чтобы считать шаг валидным, с

        this.increasing = [];
        if (!Array.isArray(data) || data.length < 2) return;

        let seg = [];
        let lastInSegTime = null;

        const liters = (pt) => this.calkut(Number(pt.dut));

        for (let i = 1; i < data.length; i++) {
            const prev = data[i - 1];
            const curr = data[i];

            const t1 = Number(prev.last_valid_time);
            const t2 = Number(curr.last_valid_time);
            if (t2 < t1) continue;               // назад по времени — мусор, пропускаем
            const dtRaw = t2 - t1;
            const dt = dtRaw === 0 ? 1 : dtRaw;

            const dL = liters(curr) - liters(prev);    // >0 — рост

            // ------ АНТИ-СПАЙК ГАРДЫ ------
            const rate = dL / dt;                      // л/с
            const tooFast =
                (dt < MIN_STEP_SEC && dL > EPS_L) ||                 // большой шаг в совсем маленькое время
                (rate > MAX_RISE_LPS && dt < 5) ||                   // нереальная скорость, но только на коротком окне
                (dL > MAX_STEP_L && dt < 5);                         // очень большой скачок за считанные секунды

            if (tooFast) {
                continue;
            }
            // --------------------------------

            if (seg.length === 0) {
                if (dL > EPS_L) {
                    seg.push(prev, curr);
                    lastInSegTime = t2;
                }
                continue;
            }

            if (dL > EPS_L) {
                seg.push(curr);
                lastInSegTime = t2;
            } else if (Math.abs(dL) <= EPS_L) {
                // плато/шум — держим сегмент пока пауза не превысила TIMEOUT_S
                if (t2 - lastInSegTime <= TIMEOUT_S) {
                    seg.push(curr);
                } else {
                    if (seg.length > 1) this.increasing.push(seg);
                    seg = [];
                    lastInSegTime = null;
                }
            } else { // dL < -EPS_L — падение; завершает заправку
                if (seg.length > 1) this.increasing.push(seg);
                seg = [];
                lastInSegTime = null;
            }
        }

        if (seg.length > 1) this.increasing.push(seg);
    }

    // точка старта — где внутри сегмента максимальный положительный «скачок»
    findStartRefill(seg) {
        let best = null;
        let maxJump = -Infinity;
        for (let i = 1; i < seg.length; i++) {
            const inc = this.liters(seg[i]) - this.liters(seg[i - 1]);
            if (inc > maxJump) {
                maxJump = inc;
                best = seg[i - 1];
            }
        }
        return best;
    }

    filterIntervals() {

        return this.increasing.filter(seg => {
            const first = seg[0];
            const last = seg[seg.length - 1];
            const dLit = this.calkut(Number(last.dut)) - this.calkut(Number(first.dut));
            return dLit >= this.volumeRefill
        });
    }

    timeStringToSec(hms) {
        const [h = 0, m = 0, s = 0] = String(hms || '0:0:0').split(':').map(Number);
        return h * 3600 + m * 60 + s;
    }
}


module.exports = { OilCalculator }