// backend/modules/downFile/ConditionRectsNode.js
const { JSDOM } = require('jsdom');

class MotoRectsNode {
    constructor(chartData, opts = {}) {
        this.data = Array.isArray(chartData) ? chartData : [];

        // геометрия
        this.width = 1200;
        this.height = 300;
        this.barWidth = 30;
        this.barGap = 5;
        this.margin = { top: 30, right: 20, bottom: 60, left: 60 };
        this.innerH = this.height - this.margin.top - this.margin.bottom;

        // сутки
        this.DAY_SECS = 86400;

        // сколько столбцов влезает (для разбиения по страницам)
        const innerW = this.width - this.margin.left - this.margin.right;
        const computedCols = Math.max(1, Math.floor(innerW / (this.barWidth + this.barGap)));
        this.maxCols = opts.maxCols ?? computedCols;

        // порядок (важен для цвета и подписи)
        // важно: сначала "Техника в работе" (work), потом "Двигатель заведён" (engine_on)
        this.preferredOrder = Array.isArray(opts.preferredOrder)
            ? opts.preferredOrder
            : ['Техника в работе', 'Двигатель заведён'];
    }



    async renderChartSVGs() {
        const d3 = await import('d3');

        // 1) ось X (дни)
        const axis = this.data.find(s => s && s.chartType === 'osX');
        const days = Array.isArray(axis?.result) ? axis.result.slice() : [];
        if (!days.length) return [];

        // 2) серии — берём только rect
        const rectSeries = this.data
            .filter(s => s && s.chartType === 'rect' && Array.isArray(s.result))
            .map(s => ({ name: String(s.name || ''), color: s.color || '#777', result: s.result }));

        // найдём нужные серии по названиям
        // допускаем частичные совпадения на всякий случай
        const findByName = (key) =>
            rectSeries.find(s => s.name === key) ||
            rectSeries.find(s => s.name.toLowerCase().includes(key.toLowerCase()));

        const sWork = findByName('Техника в работе');   // подмножество
        const sEngine = findByName('Двигатель заведён');  // надмножествo

        // если нет ни одной — нечего рисовать
        if (!sWork && !sEngine) return [];

        // 3) сгруппируем дни по месяцам
        const byMonth = this._groupByMonth(days);
        const out = [];

        for (const [month, entries] of Object.entries(byMonth)) {
            for (let offset = 0, part = 1; offset < entries.length; offset += this.maxCols, part++) {
                const chunk = entries.slice(offset, offset + this.maxCols);

                // внутренняя ширина = n * (barWidth + barGap)
                const innerW = chunk.length * (this.barWidth + this.barGap);
                const svgW = innerW + this.margin.left + this.margin.right;

                // JSDOM
                const dom = new JSDOM(`<body><div id="root"></div></body>`);
                const document = dom.window.document;
                const root = d3.select(document.querySelector('#root'));

                const svg = root.append('svg')
                    .attr('width', svgW)
                    .attr('height', this.height)
                    .attr('xmlns', 'http://www.w3.org/2000/svg');

                const g = svg.append('g')
                    .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

                // шкалы
                // domain = даты, range = n * (barWidth + barGap)
                const x = d3.scaleBand()
                    .domain(chunk.map(e => e.date))      // YYYY-MM-DD
                    .range([0, innerW])
                    .paddingInner(0)
                    .paddingOuter(0);

                const y = d3.scaleLinear()
                    .domain([0, this.DAY_SECS])
                    .range([this.innerH, 0]);

                // ось X (DD.MM)
                const gx = g.append('g')
                    .attr('class', 'axis-x')
                    .attr('transform', `translate(0,${this.innerH})`)
                    .call(d3.axisBottom(x));

                gx.selectAll('text')
                    .style('font-weight', d => (+d.slice(8, 10) === 1 ? '900' : '400'))
                    .text(d => `${d.slice(8, 10)}.${d.slice(5, 7)}`);

                // ось Y (каждые 2 часа)
                const ticks = [];
                for (let t = 0; t <= this.DAY_SECS; t += 2 * 3600) ticks.push(t);
                g.append('g')
                    .attr('class', 'axis-y')
                    .call(d3.axisLeft(y).tickValues(ticks).tickFormat(sec => this._fmtTime(sec)));

                // подпись оси Y
                g.append('text')
                    .attr('x', -this.innerH / 2)
                    .attr('y', -this.margin.left + 15)
                    .attr('transform', 'rotate(-90)')
                    .attr('text-anchor', 'middle')
                    .text('Время');

                // столбцы по дням
                for (const { date, index } of chunk) {
                    const bandX = x(date);
                    if (bandX == null) continue;

                    const xStart = bandX + this.barGap / 2; // центрируем barWidth внутри band (barWidth+barGap)

                    // значения (секунды)
                    const workSec = Math.max(0, sWork ? Number(sWork.result[index]) || 0 : 0);
                    const engineSec = Math.max(0, sEngine ? Number(sEngine.result[index]) || 0 : 0);

                    // двигатель >= работа (если нет двигателя, считаем engine = work, чтобы не было «провала»)
                    const engineFinal = Math.max(engineSec, workSec);
                    const idleSec = Math.max(0, engineFinal - workSec); // холостые внутри «заведён»

                    // рисуем снизу: работа → холостые. Итого высота = engineFinal.
                    let cum = 0;
                    // работа
                    if (workSec > 0) {
                        const y1 = y(cum);
                        const y2 = y(Math.min(this.DAY_SECS, cum + workSec));
                        g.append('rect')
                            .attr('x', xStart)
                            .attr('y', y2)
                            .attr('width', this.barWidth)
                            .attr('height', Math.max(0, y1 - y2))
                            .attr('fill', sWork ? sWork.color : '#FF6633')
                            .attr('stroke', '#fff')
                            .attr('stroke-width', 1);
                        cum += workSec;
                    }
                    // холостые (заведён минус работа)
                    if (idleSec > 0) {
                        const y1 = y(cum);
                        const y2 = y(Math.min(this.DAY_SECS, cum + idleSec));
                        g.append('rect')
                            .attr('x', xStart)
                            .attr('y', y2)
                            .attr('width', this.barWidth)
                            .attr('height', Math.max(0, y1 - y2))
                            .attr('fill', sEngine ? sEngine.color : '#3333FF')
                            .attr('stroke', '#fff')
                            .attr('stroke-width', 1);
                        cum += idleSec;
                    }

                    const yTop = y(Math.min(cum, this.DAY_SECS)) - 4; // базовая верхняя точка

                    const text = g.append('text')
                        .attr('x', xStart + this.barWidth / 2)
                        .attr('y', yTop - 10)               // немного выше, чтобы влезли две строки
                        .attr('text-anchor', 'middle')
                        .attr('font-size', 10)
                        .attr('fill', '#111');

                    text.append('tspan')
                        .attr('x', xStart + this.barWidth / 2)
                        .attr('dy', 0)
                        .style('text-decoration', 'underline')                      // первая строка (engine)
                        .text(this._fmtTime(engineFinal));

                    text.append('tspan')
                        .attr('x', xStart + this.barWidth / 2)
                        .attr('dy', '1.2em')                // вторая строка (work) — ниже первой
                        .text(this._fmtTime(workSec));
                }

                out.push({ month, part, svg: document.querySelector('svg').outerHTML });
            }
        }

        return out;
    }

    _groupByMonth(days) {
        const map = {};
        days.forEach((d, i) => {
            const mm = d.slice(5, 7);
            const yy = d.slice(0, 4);
            const key = `${mm}.${yy}`;
            (map[key] ||= []).push({ date: d, index: i });
        });
        return map;
    }

    _fmtTime(sec) {
        const s = Math.max(0, Number(sec) || 0);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
}

module.exports = MotoRectsNode;
