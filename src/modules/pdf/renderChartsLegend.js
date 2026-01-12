const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(f, 'utf8');

// SVG из bootstrap-icons (fill="currentColor" → красим через style="color:...")
const fuelSvg = read(require.resolve('bootstrap-icons/icons/fuel-pump.svg'));
const drainSvg = read(require.resolve('bootstrap-icons/icons/droplet-fill.svg'));
const levelSvg = read(require.resolve('bootstrap-icons/icons/activity.svg'));

// Общие маленькие помощники
const rect = (label, color, rel = label) =>
    ({ html: `<div class="rect_legend" rel="${rel}" style="background-color:${color}"></div>`, label });

const icon = (label, svg, color, rel = label) =>
    ({ html: `<div class="wrap_icon" rel="${rel}"><span class="ico" style="color:${color}">${svg}</span></div>`, label });

// Конфиг «что показывать» по типу легенды
const LEGEND_REGISTRY = {
    'Учёт топлива': {
        title: 'Легенда',
        items: [
            icon('Заправки:', fuelSvg, 'green', 'Заправка'),
            icon('Сливы:', drainSvg, 'red', 'Слив'),
            icon('Уровень топлива:', levelSvg, 'blue', 'Уровень топлива'),
            rect('Поездки:', 'rgb(183,170,14)', 'Движение'),
            rect('Моточасы:', 'rgb(255,209,215)', 'Работа двигателя'),
        ],
    },

    'Моточасы': {
        title: 'Легенда',
        items: [
            rect('Двигатель заведен:', '#3333FF', 'Двигатель заведен'),
            rect('Техника в работе:', '#FF6633', 'Техника в работе'),
        ],
    },

    'Время работы ТС': {
        title: 'Легенда',
        items: [
            rect('Движение:', '#8fd14f', 'Движение'),
            rect('Парковка:', '#3399ff', 'Парковка'),
            rect('Повёрнут ключ зажигания:', '#fef445', 'Повёрнут ключ зажигания'),
            rect('Работа на холостом ходу:', '#f24726', 'Работа на холостом ходу'),
        ],
    },

    'СКДШ': {

        title: 'Легенда',
        items: [
            rect('Низкое:', '#e34040', 'Низкое'),
            rect('Ниже нормы:', '#e8eb65', 'Ниже нормы'),
            rect('Нормальное:', '#darkgreen', 'Нормальное'),
            rect('Выше нормы', '#9e9913', 'Выше нормы'),
            rect('Высокое', 'darkred', 'Высокое'),
        ]
    },
};

// Единый рендерер
function renderChartsLegend(type) {
    const cfg = LEGEND_REGISTRY[type];
    if (!cfg) return ''; // неизвестный тип — без легенды (или верни заглушку)

    const body = cfg.items.map(item => {
        // если есть подпись
        if (item.label) {
            return `<div class="uniqum_legend">
        <div class="title_legend">${item.label}</div>${item.html}
      </div>`;
        }
        // кастомный html без подписи (СКДШ)
        return `<div class="uniqum_legend">${item.html}</div>`;
    }).join('');

    // для СКДШ заголовок пустой
    return `<div class="legend_container">
    <div class="title_legend">${cfg.title}</div>
    <div class="body_legend">${body}</div>
  </div>`;
}

module.exports = { renderChartsLegend };
