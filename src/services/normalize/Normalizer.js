

const sql = require('mssql');


const CORE_KEYS = new Set([
    'imei', 'time', 'lat', 'lon', 'speed', 'course', 'sats', 'hdop',
    'msg_type', 'proto', 'time_reg', 'port', 'last_valid_time', 'extras'
]);


class Normalizer {

    constructor(db) {

    }



    async normalize(point, cfg) {
        const { sensors } = cfg
        const newPoint = { ...point };
        newPoint.extras = {};
        if (sensors.custom_sensors.length === 0) {
            return newPoint
        }
        const extras = point.extras
        const promises = sensors.custom_sensors.map(async e => {
            if (extras.hasOwnProperty(e.from)) {
                newPoint.extras[e.param] = await this.convertionEval(e, extras[e.from]);
            }
        });
        await Promise.all(promises);
        return newPoint
    }



    async convertionEval(cfg, value) {
        if (!cfg.f) return value
        if (cfg.param === 'engine' || cfg.param === 'pwr') return value
        let newValue = Number(value);
        const formatted = cfg.f.replace(/x/g, value);
        switch (cfg.param) {
            case 'oil':
                const formattedFormula = this.transformExpressionWithExponent(cfg.f, value);
                newValue = value <= 7001 ? parseInt(eval(formattedFormula)) : null
                break
            default: newValue = eval(formatted);

        }
        return newValue
    }

    transformExpressionWithExponent(str, x) {
        // Убираем пробелы вокруг x и степеней
        str = str.replace(/\s+/g, '');
        // Добавляем знак умножения перед 'x', если его нет
        str = str.replace(/(\d)(x)/g, '$1*$2');
        // Заменяем выражения вида x2 на Math.pow(x, 2)
        str = str.replace(/x(\d+)/g, 'Math.pow(x, $1)');
        // Заменяем все оставшиеся 'x' на значение переменной x
        str = str.replace(/x/g, x);
        return str;
    }
}





module.exports = { Normalizer }