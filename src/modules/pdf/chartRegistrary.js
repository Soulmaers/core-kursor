// chartRegistry.js
const TravelToDayNode = require('./travelFunc');
const ChartOilNode = require('./oilFunc');
const MotoRectsNode = require('./motoFunc');
const ChartCondition = require('./detalisationFunc');
const ChartPressureNode = require('./skdshFunc')
const { renderChartsLegend } = require('./renderChartsLegend');

function sectionKey(type, key = '') { return `${type}${key.trim()}`; }

// ====== утилиты ======
const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
};

const renderSvgs = (svgs, cls = 'chart_oil') =>
    svgs.map(svg => `<div class="${cls}">${svg}</div>`).join('');

// groups: [{ svgs: ['<svg>...</svg>', ...], legendType?: 'Учёт топлива' | 'Моточасы' | ... , className?: string }]
const makeChartPage = ({ styles, header, low_header, groups }) => {
    const bodyBlocks = groups.map(g => {
        const block = renderSvgs(g.svgs, g.className || 'chart_oil');
        const legend = g.legendType ? renderChartsLegend(g.legendType) : '';
        return `${block}${legend}`;
    }).join('\n');

    return `
<html>
<head><style>${styles}</style></head>
<body class="body_pdf oglav">
  ${header}${low_header}
  <div class="page_component">
    ${bodyBlocks}
  </div>
</body>
</html>`;
};

// ====== рендеры ======

// Поездки по дням — по 2 графика на страницу
const renderTravelByDays = async ({ key, data, styles, typeTitle, header, low_header }) => {
    const charts = await new TravelToDayNode(data).renderChartSVGs(); // [{month, svg}]
    return chunk(charts, 2).map(block => ({
        html: makeChartPage({
            styles, header, low_header,
            groups: [{ svgs: block.map(c => c.svg) }]
        }),
        landscape: true,
        sectionTitle: sectionKey(typeTitle, key)
    }));
};

// Учёт топлива — одна страница, один график + легенда
const renderFuelAccounting = async ({ key, data, styles, typeTitle, header, low_header }) => {
    const svg = await new ChartOilNode(data).renderChartSVG();
    if (!svg) return [];
    return [{
        html: makeChartPage({
            styles, header, low_header,
            groups: [{ svgs: [svg], legendType: key }]
        }),
        landscape: true,
        sectionTitle: sectionKey(typeTitle, key)
    }];
};

// Моточасы — слева столбики (по 2 на страницу), ниже — горизонтальные полосы «состояний» (всё одной простынёй)
const renderMoto = async ({ key, data, styles, typeTitle, header, low_header }) => {
    const motoBars = await new MotoRectsNode(data, { width: 1200, height: 46 }).renderChartSVGs(); // [{month,date,svg}]
    const stateStrips = await new ChartCondition(data, { width: 1200, height: 46 }).renderChartSVGs(); // [{month,date,svg}]

    // stateStrips рендерим целиком на каждой странице моточасов (как «полотно» без разбиения)
    const stateBlockHtmls = stateStrips.map(c => c.svg);

    return chunk(motoBars, 2).map(block => ({
        html: makeChartPage({
            styles, header, low_header,
            groups: [
                { svgs: block.map(c => c.svg), legendType: key },                 // верхний блок (по 2)
                { svgs: stateBlockHtmls, legendType: 'Время работы ТС', className: 'chart_oil condition_chart' } // низ — всё подряд
            ]
        }),
        landscape: true,
        sectionTitle: sectionKey(typeTitle, key)
    }));
};

//Учет СКДШ
const renderSKSH = async ({ key, data, styles, typeTitle, header, low_header }) => {
    const out = await new ChartPressureNode(data, { width: 1200, height: 400 }).renderChartSVGs();

    // normalize: поддержим и строку (новая версия), и массив объектов {svg}, и массив строк
    const svgs = Array.isArray(out)
        ? out.map(it => (typeof it === 'string' ? it : it?.svg)).filter(Boolean)
        : (out ? [out] : []);

    if (!svgs.length) return [];

    return [{
        html: makeChartPage({
            styles,
            header,
            low_header,
            groups: [{
                svgs,                // массив строк SVG
                legendType: key,
                className: 'chart_oil'
            }]
        }),
        landscape: true,
        sectionTitle: sectionKey(typeTitle, key),
    }];
};




// Заглушка
const renderDefault = async ({ key, styles, typeTitle, header, low_header }) => [{
    html: makeChartPage({
        styles, header, low_header,
        groups: [{ svgs: ['<div class="chart_oil"></div>'] }]
    }),
    landscape: true,
    sectionTitle: sectionKey(typeTitle, key),
}];

const chartRegistry = new Map([
    ['Поездки по дням', renderTravelByDays],
    ['Учёт топлива', renderFuelAccounting],
    ['Моточасы', renderMoto],
    ['СКДШ', renderSKSH]
]);

module.exports = { chartRegistry, renderDefault, sectionKey };
