
/*
класс сервисных утилит

*/

class ServisFunction {


    static medianFilters(array, cfg) {
        const oilP = cfg.sensors.custom_sensors.find(el => el.param === 'oil')

        const src = (array || [])
            .filter(e => e && Number(e.extras[oilP.from]) != null && Number(e.time_terminal) != null && Number(e.extras[oilP.from]) > 4097)
            .sort((a, b) => Number(a.time_terminal) - Number(b.time_terminal));

        const n = src.length;
        if (n === 0) return [];

        let w = Number(oilP.k) || 3;
        if (w < 3) w = 3;
        if (w % 2 === 0) w += 1; // делаем нечётным
        const half = Math.floor(w / 2);

        const out = new Array(n);
        const buf = []; // временный буфер под dut

        for (let i = 0; i < n; i++) {
            buf.length = 0;
            const start = Math.max(0, i - half);
            const end = Math.min(n - 1, i + half);
            for (let j = start; j <= end; j++) buf.push(Number(src[j].extras[oilP.from]));
            buf.sort((a, b) => a - b);
            const med = buf[Math.floor(buf.length / 2)];
            out[i] = { ...src[i], dut: med };
        }
        return out;
    }

    // 1) из твоего формата делаем события refill
    static toRefillEvents(raw, title) {
        const items = Array.isArray(raw) && Array.isArray(raw[1]) ? raw[1] : [];
        return items.map((e) => ({
            kind: title,
            start: Number(e.time),
            end: Number(e.time),
            startGeo: e.geo,
            endGeo: e.geo,
            startOil: Number(e.startOil),
            endOil: Number(e.finishOil),
            value: e.value != null ? Number(e.value) : Number(e.finishOil) - Number(e.startOil),
        })).filter(ev => Number.isFinite(ev.start));
    }

    // 2) вставляем в общий список и сортируем по времени
    static mergeEvents(sortedItems, refillRaw, title) {
        const oils = ServisFunction.toRefillEvents(refillRaw, title);
        return [...(sortedItems || []), ...oils]
            .sort((a, b) => (a.start - b.start) || (a.end - b.end));
    }


    static getDateIntervals(startUnix, endUnix) {
        const intervals = [];

        const startDate = new Date(startUnix * 1000);
        const endDate = new Date(endUnix * 1000);

        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endOfDay = new Date(startDay.getTime() + (24 * 60 * 60 * 1000) - 1);

        const endOfDayUnix = Math.floor(endOfDay.getTime() / 1000);

        if (startDay.getTime() <= endDate.getTime()) {

            const day = startDate.getDate().toString().padStart(2, '0'); // Добавляем ведущий ноль, если нужно
            const month = (startDate.getMonth() + 1).toString().padStart(2, '0'); // Месяцы начинаются с 0
            const year = startDate.getFullYear();

            intervals.push({
                date: `${day}.${month}.${year}`, // Формат 01.02.2025
                startUnix: startUnix,
                endUnix: Math.min(endUnix, endOfDayUnix)
            });

            if (endDate.getTime() > endOfDay.getTime()) {
                const nextDayStart = endOfDayUnix + 1;
                intervals.push(...Helpers.getDateIntervals(nextDayStart, endUnix));
            }
        }

        return intervals;
    }
}

module.exports = ServisFunction