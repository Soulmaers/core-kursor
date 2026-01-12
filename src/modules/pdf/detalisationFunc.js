


const { JSDOM } = require('jsdom');

class ChartCondition {

    constructor(data) {
        this.days = data[0].condition
        this.width = 1200;
        this.height = 50; // как просил — низкая полоса
        this.margin = { top: 0, right: 20, bottom: 16, left: 60 }; // слева место под дату
        this.innerH = this.height - this.margin.top - this.margin.bottom;

        this.colors = Object.assign(
            {
                'Движение': '#8fd14f',
                'Парковка': '#3399ff',
                'Повёрнут ключ зажигания': '#fef445',
                'Работа на холостом ходу': '#f24726',
            }
        );
    }



    async renderChartSVGs() {
        const d3 = await import('d3');
        const out = [];

        for (const day of this.days) {
            if (!day || !Number.isFinite(day.startUnix) || !Number.isFinite(day.endUnix)) continue;

            const dom = new JSDOM(`<body><div id="root"></div></body>`);
            const document = dom.window.document;
            const root = d3.select(document.querySelector('#root'));

            const svg = root.append('svg')
                .attr('width', this.width)
                .attr('height', this.height)
                .attr('xmlns', 'http://www.w3.org/2000/svg');

            const g = svg.append('g')
                .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

            // шкала времени на сутки
            const x = d3.scaleTime()
                .domain([new Date(day.startUnix * 1000), new Date(day.endUnix * 1000)])
                .range([0, this.width - this.margin.left - this.margin.right]);

            // ось X — каждый час, последний — 24:00
            const ticksSec = [];
            for (let i = 0; i <= 24; i++) ticksSec.push(day.startUnix + i * 3600);

            const gx = g.append('g')
                .attr('class', 'axis-x')
                .attr('transform', `translate(0,${this.innerH})`)
                .call(
                    d3.axisBottom(x)
                        .tickValues(ticksSec.map(t => new Date(t * 1000)))
                        .tickFormat(d3.timeFormat('%H:%M'))
                );

            gx.selectAll('.tick text').each(function (_d, i, nodes) {
                if (i === nodes.length - 1) {
                    d3.select(this).text('24:00').style('transform', 'translateX(-15px)');
                }
            });

            // прямоугольники состояний одной полосой (высота — вся внутренняя область)
            const bandH = this.innerH; // полоса занимает всю высоту (50 - 16 = 34px)
            const rects = Array.isArray(day.detalisation) ? day.detalisation : [];

            for (let i = 0; i < rects.length; i++) {
                const cur = rects[i];
                const next = rects[i + 1];

                const startMs = this._toMs(cur?.time, day.startUnix);
                const endMs = next ? this._toMs(next.time, day.endUnix) : day.endUnix * 1000;

                // защита
                if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

                g.append('rect')
                    .attr('class', 'rect-state')
                    .attr('x', x(startMs))
                    .attr('y', 0)
                    .attr('width', Math.max(0, x(endMs) - x(startMs)))
                    .attr('height', bandH)
                    .attr('fill', this.colors[cur?.condition] || '#ccc');
            }

            // подпись даты слева
            svg.append('text')
                .attr('x', 5)
                .attr('y', this.margin.top + 18)
                .text(this._shortDate(day.date))
                .attr('fill', '#111')
                .attr('font-size', 12);

            // результат
            const svgString = document.querySelector('svg').outerHTML;

            // month = 'MM.YYYY'
            const month = this._monthKey(day.date);

            out.push({ month, date: day.date, svg: svgString });
        }

        return out;
    }

    _toMs(v, fallbackUnixSec) {
        if (v == null) return (fallbackUnixSec ?? 0) * 1000;
        if (typeof v === 'number') {
            // может быть сек или мс: считаем, что числа < 10^12 — это секунды
            return v < 1e12 ? v * 1000 : v;
        }
        // строка — Date парс
        const t = new Date(v).getTime();
        return Number.isFinite(t) ? t : (fallbackUnixSec ?? 0) * 1000;
    }

    _shortDate(dateStr) {
        // поддержим оба формата
        if (!dateStr) return '';
        if (dateStr.includes('.')) {
            const [dd, mm, yyyy] = dateStr.split('.');
            return `${dd}.${mm}.${String(yyyy).slice(-2)}`;
        }
        // YYYY-MM-DD
        const dd = dateStr.slice(8, 10);
        const mm = dateStr.slice(5, 7);
        const yy = dateStr.slice(2, 4);
        return `${dd}.${mm}.${yy}`;
    }

    _monthKey(dateStr) {
        if (!dateStr) return '';
        if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            return `${parts[1]}.${parts[2]}`;
        }
        // YYYY-MM-DD
        return `${dateStr.slice(5, 7)}.${dateStr.slice(0, 4)}`;
    }
}


module.exports = ChartCondition