// backend/modules/downFile/pressureFunc.js
const { JSDOM } = require('jsdom');

class ChartPressureNode {
    constructor(chartData, opts = {}) {
        this.data = Array.isArray(chartData) ? chartData : [];

        this.width = 1200;
        this.height = 600;

        this.margin = { top: 20, right: 20, bottom: 40, left: 55 };
        this.innerW = this.width - this.margin.left - this.margin.right;
        this.innerH = this.height - this.margin.top - this.margin.bottom;

        this.levelOrder = ['Ожидание', 'Низкое', 'Ниже нормы', 'Нормальное', 'Выше нормы', 'Высокое'];
    }

    async renderChartSVGs() {
        const d3 = await import('d3');

        const wheelsSer = this._seriesByName('Колесо');
        const wheels = Array.isArray(wheelsSer?.result) ? wheelsSer.result : [];
        if (!wheels.length) return '';

        const totalsSer = this._seriesByName('Всего');
        const levels = this.levelOrder.map(n => this._seriesByName(n)).filter(Boolean);
        if (!levels.length) return '';

        // итоги по каждому колесу
        const wheelTotals = wheels.map((_, i) => {
            const t = Number(totalsSer?.result?.[i]) || 0;
            return t > 0 ? t : levels.reduce((s, ser) => s + Math.max(0, Number(ser.result?.[i]) || 0), 0);
        });
        const axisMax = Math.max(1, ...wheelTotals);

        const dom = new JSDOM(`<body><div id="root"></div></body>`);
        const document = dom.window.document;
        const root = d3.select(document.querySelector('#root'));

        const svg = root.append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('xmlns', 'http://www.w3.org/2000/svg');

        const g = svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const x = d3.scaleBand()
            .domain(wheels)
            .range([0, this.innerW])
            .paddingInner(0.2)
            .paddingOuter(0.05);

        const desiredBarW = 56;
        const barW = Math.min(desiredBarW, x.bandwidth());

        const y = d3.scaleLinear()
            .domain([0, axisMax])
            .range([this.innerH, 0]);

        const yTicks = y.ticks(6);
        g.append('g')
            .attr('class', 'axis-y')
            .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(sec => this._fmtTime(sec)));

        g.append('text')
            .attr('x', -this.innerH / 2)
            .attr('y', -this.margin.left + 16)
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .text('Время');

        // ось X с двустрочными подписями
        const gx = g.append('g')
            .attr('class', 'axis-x')
            .attr('transform', `translate(0,${this.innerH})`)
            .call(d3.axisBottom(x).tickPadding(8));

        gx.selectAll('.tick text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.8em') // было 0.4em — опустили первую строку чуть ниже
            .text(null)
            .each((d, i, nodes) => {
                const sel = d3.select(nodes[i]);
                const [line1, line2] = this._splitLabel(String(d));
                sel.append('tspan')
                    .attr('x', 0)
                    .attr('dy', 0)
                    .text(line1);
                sel.append('tspan')
                    .attr('x', 0)
                    .attr('dy', '1.6em') // было 1.1em — опустили вторую ещё ниже
                    .text(line2);
            });

        // пороги для подписи процентов
        const pctThreshold = 0.20;   // ≥20% от «Всего» колеса
        const pxMinHeight = 12;     // и минимум 12px высоты сегмента

        // рисуем столбики
        for (let i = 0; i < wheels.length; i++) {
            const name = wheels[i];
            const x0 = (x(name) ?? 0) + (x.bandwidth() - barW) / 2;

            let cum = 0;
            for (const ser of levels) {
                const valSec = Math.max(0, Number(ser.result?.[i]) || 0);
                if (!valSec) continue;

                const y1 = y(cum);
                const y2 = y(Math.min(axisMax, cum + valSec));
                const h = Math.max(0, y1 - y2);

                g.append('rect')
                    .attr('x', x0)
                    .attr('y', y2)
                    .attr('width', barW)
                    .attr('height', h)
                    .attr('fill', ser.color || this._colorByName(ser.name))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);

                // проценты на самом сегменте
                const total = wheelTotals[i] || 0;
                if (total > 0) {
                    const frac = valSec / total;
                    if (frac >= pctThreshold && h >= pxMinHeight) {
                        const pct = Math.round(frac * 100);

                        // какие серии считаем «тёмным фоном»
                        const darkBgNames = new Set(['Низкое', 'Нормальное', 'Высокое']);
                        const isDarkBg = darkBgNames.has(ser.name);

                        // для тёмного фона — светлая заливка, чёрная обводка; иначе наоборот
                        const fillColor = isDarkBg ? '#f7f7f7' : '#000000';
                        const strokeColor = isDarkBg ? '#000000' : '#FFFFFF';

                        g.append('text')
                            .attr('x', x0 + barW / 2)
                            .attr('y', y2 + h / 2)
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'middle')
                            .attr('font-size', 11)
                            .attr('font-weight', 700)
                            .attr('fill', fillColor)
                            .attr('stroke', strokeColor)
                            .attr('stroke-width', 0.9)
                            .attr('paint-order', 'stroke')
                            .text(`${pct}%`);
                    }
                }

                cum += valSec;
            }
        }

        return svg.node().outerHTML;
    }

    _splitLabel(full) {
        const words = full.trim().split(/\s+/);
        if (words.length <= 1) return [full, ''];
        if (words.length === 2) return [words[0], words[1]];
        const totalLen = words.reduce((s, w) => s + w.length, 0);
        let acc = 0, splitIdx = 1;
        for (let i = 0; i < words.length; i++) {
            acc += words[i].length;
            if (acc >= totalLen / 2) { splitIdx = i + 1; break; }
        }
        return [words.slice(0, splitIdx).join(' '), words.slice(splitIdx).join(' ')];
    }

    _seriesByName(name) {
        const key = String(name).toLowerCase();
        return this.data.find(s => (s?.name || '').toLowerCase() === key);
    }

    _fmtTime(sec) {
        const s = Math.max(0, Number(sec) || 0);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    _colorByName(name) {
        const map = {
            'Ожидание': 'lightgray',
            'Низкое': '#e34040',
            'Ниже нормы': '#e8eb65',
            'Нормальное': 'darkgreen',
            'Выше нормы': '#9e9913',
            'Высокое': 'darkred',
        };
        return map[name] || '#777';
    }
}

module.exports = ChartPressureNode;
