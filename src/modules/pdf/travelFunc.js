// TravelToDayNode.js
const { JSDOM } = require('jsdom');

class TravelToDayNode {
    constructor(chartData) { this.chartData = chartData; }

    async renderChartSVGs() {
        const monthDataArray = this._groupByMonth();
        const d3 = await import('d3');
        const out = [];

        for (const { month, data } of monthDataArray) {
            const dom = new JSDOM(`<body><div id="root"></div></body>`);
            const document = dom.window.document;
            const root = d3.select(document.querySelector('#root'));

            const width = 1200, height = 300;
            const svg = root.append('svg').attr('width', width).attr('height', height);
            const g = svg.append('g').attr('transform', 'translate(60,30)');

            const axisMax = d3.max(data, d => +d.mileage) || 0;
            const xScale = d3.scaleBand().domain(data.map(d => d.date)).range([0, data.length * 36 + 5]);
            const yScale = d3.scaleLinear().domain([0, axisMax * 1.05]).range([height - 60, 0]);

            const gx = g.append('g').attr('transform', `translate(0,${height - 60})`).call(d3.axisBottom(xScale));
            gx.selectAll('text')
                .style('fill', d => {
                    const newDate = new Date(d.split('.').reverse().join('-')).getDay();
                    return (newDate === 6 || newDate === 0) ? 'red' : 'black';
                })
                .style('font-weight', d => (parseInt(d.substring(0, 2), 10) === 1 ? '900' : 'normal'))
                .text(d => d.slice(0, 5))
                .attr('transform', 'translate(4,0)');
            gx.selectAll('.tick line').attr('x1', 4).attr('x2', 4);

            const ticks = yScale.ticks(14); ticks[ticks.length - 1] = axisMax;
            g.append('g').call(d3.axisLeft(yScale).tickValues(ticks));

            g.append('text').attr('y', -25).attr('x', -7).attr('dy', '1em')
                .style('text-anchor', 'middle').text('км')
                .style('fill', 'rgba(6, 28, 71, 1)');

            const barWidth = 30;
            g.selectAll('rect').data(data).enter().append('rect')
                .attr('x', d => xScale(d.date) + 8)
                .attr('y', d => yScale(d.mileage))
                .attr('height', d => (height - 60) - yScale(d.mileage))
                .attr('width', barWidth)
                .attr('fill', '#336699')
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);

            data.forEach(d => {
                g.append('text')
                    .attr('x', xScale(d.date) + xScale.bandwidth() / 2 + 4)
                    .attr('y', yScale(d.mileage) - 10)
                    .text(d.mileage)
                    .attr('font-size', '10px')
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'rgba(6, 28, 71, 1)');
            });

            out.push({ month, svg: document.querySelector('svg').outerHTML });
        }
        return out;
    }

    _groupByMonth() {
        const date = (this.chartData.find(e => e.name === 'Начало')?.result) || [];
        const mileage = (this.chartData.find(e => e.name === 'Пробег')?.result) || [];
        const rows = date.map((d, i) => ({ date: d, mileage: mileage[i] }));
        const grouped = {};
        rows.forEach(it => {
            const [_, m, y] = it.date.split('.');
            const key = `${m}.${y}`;
            (grouped[key] ||= []).push(it);
        });
        return Object.entries(grouped).map(([month, data]) => ({ month, data }));
    }
}

module.exports = TravelToDayNode;
