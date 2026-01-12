// backend/modules/downFile/ChartOilNode.js
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');


function read(file) { return fs.readFileSync(file, 'utf8'); }

// SVG из bootstrap-icons (они с fill="currentColor" — будем красить через CSS color)
const fuelSvg = read(require.resolve('bootstrap-icons/icons/fuel-pump.svg'));
const drainSvg = read(require.resolve('bootstrap-icons/icons/droplet-fill.svg'));


class ChartOilNode {
    constructor(chartData) {
        this.chartData = chartData;
        this.refillIcon = fs.readFileSync(path.join(__dirname, 'assets/ref.png'), 'base64');
        this.drainIcon = fs.readFileSync(path.join(__dirname, 'assets/drain.png'), 'base64');
    }

    async renderChartSVG() {
        const d3 = await import('d3'); // ESM в CJS
        const dom = new JSDOM(`<body><div class="chart_oil"></div></body>`);
        const document = dom.window.document;
        const container = d3.select(document.querySelector('.chart_oil'));

        const width = 1100, height = 500;
        const margin = { top: 20, right: 20, bottom: 40, left: 55 };

        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('xmlns', 'http://www.w3.org/2000/svg');

        const getByName = (name, mapFn) => {
            const item = this.chartData.find(e => e?.name === name);
            if (!Array.isArray(item?.result)) return [];
            return mapFn ? item.result.map(mapFn) : item.result;
        };

        const time = getByName('Дата и время', d => +d * 1000);
        const origin = getByName('Обработанные значения', d => +d);
        const filtered = getByName('Исходные значения', d => +d);
        const traveling = getByName('Движение');
        const moto = getByName('Работа двигателя');
        const refills = getByName('Заправки'); // [{time,...}]
        const drains = getByName('Сливы');    // [{time,...}]

        const x = d3.scaleTime()
            .domain(d3.extent(time, d => new Date(d)))
            .range([margin.left, width - margin.right]);

        const yMax = d3.max([d3.max(origin), d3.max(filtered)].filter(Number.isFinite)) || 1;
        const y = d3.scaleLinear().domain([0, yMax]).nice()
            .range([height - margin.bottom, margin.top]);

        // фон «мото»
        if (moto.length) {
            svg.selectAll('.moto_rect').data(moto).enter().append('rect')
                .attr('x', d => x(new Date(d[0].time * 1000)))
                .attr('width', d => x(new Date(d[1].time * 1000)) - x(new Date(d[0].time * 1000)))
                .attr('y', margin.top)
                .attr('height', height - margin.top - margin.bottom)
                .attr('fill', 'rgb(255,209,215)');
        }
        // фон «движение»
        if (traveling.length) {
            svg.selectAll('.travel_rect').data(traveling).enter().append('rect')
                .attr('x', d => x(new Date(d[0].time * 1000)))
                .attr('width', d => x(new Date(d[1].time * 1000)) - x(new Date(d[0].time * 1000)))
                .attr('y', margin.top)
                .attr('height', height - margin.top - margin.bottom)
                .attr('fill', 'rgb(183,170,14)')
                .attr('opacity', 0.25);
        }

        const line = d3.line()
            .x((d, i) => x(new Date(time[i])))
            .y(d => y(d));

        if (filtered.length > 1) svg.append('path').datum(filtered)
            .attr('fill', 'none').attr('stroke', 'red').attr('stroke-width', 1.5).attr('d', line);

        if (origin.length > 1) svg.append('path').datum(origin)
            .attr('fill', 'none').attr('stroke', 'blue').attr('stroke-width', 1.2).attr('d', line);

        // оси
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat('%H:%M')));

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(6));

        svg.append('text')
            .attr('x', -height / 2).attr('y', 15).attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle').text('Объем, л');

        function addSvgIcons(dataArray, svgString, color = '#000', yOffset = -18, size = 16) {
            if (!Array.isArray(dataArray) || dataArray.length === 0) return;

            const layer = svg.append('g').attr('class', 'icons-layer');

            dataArray.forEach(d => {
                const xPos = x(new Date(+d.time * 1000)) - size / 2;
                const yPos = margin.top + yOffset;

                // создаём контейнер-g и вливаем внутрь исходный svg
                const g = layer.append('g').attr('transform', `translate(${xPos},${yPos})`);
                g.html(svgString);

                // находим вложенный <svg> (у bootstrap-icons он есть) и задаём размер/цвет
                const inner = g.select('svg');
                inner
                    .attr('width', size)
                    .attr('height', size)
                    .attr('color', color); // для fill="currentColor" внутри иконки

                // если у svg жёстко проставлены width/height/style — уже переопределили;
                // при желании можно ещё .attr('style', null) убрать инлайновые стили
            });
        }

        // вызовы:
        addSvgIcons(drains, drainSvg, '#c62828', -18, 16); // «Сливы» (красный)
        addSvgIcons(refills, fuelSvg, '#11823b', -18, 16); // «Заправки» (зелёный)

        return document.querySelector('svg').outerHTML; // SVG-строка
    }
}

module.exports = ChartOilNode;
