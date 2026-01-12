
//const { HelpersDefault } = require('../../../services/HelpersDefault')
const { ToBaseMethods } = require('./ToBaseMethods')

class OilCalculator {
    constructor(data, settings, id) {
        this.dataOrigin = data.filter(e => e.oil);
        this.settings = settings;
        this.id = id
        this.increasingIntervals = [];
    }


    async init() {
        this.config = await ToBaseMethods.getConfigs(this.id)
        if (!this.config) { return null }
        await this.filtration()
        this.calculateIntervals(this.data);

        this.volume = this.filterIntervals();
        this.oil = this.volume.reduce((acc, el) => {
            const diff = this.calkut(Number(el[el.length - 1].dut) - Number(el[0].dut))
            return acc + diff;
        }, 0);

        const count = this.volume.map(el => {
            const start = this.findStartRefill(el)
            const diff = Number(el[el.length - 1].dut) - Number(el[0].dut)
            return {
                time: start.last_valid_time,
                geo: [start.lat, start.lon],
                startOil: this.calkut(Number(el[0].dut)),
                finishOil: this.calkut(Number(el[el.length - 1].dut)),
                value: this.calkut(Number(el[el.length - 1].dut)) - this.calkut(Number(el[0].dut)),
                value2: 0  // Устанавливаем в value2 если не refill
            };
        });
        //    console.log(this.oil, count)
        return [this.oil, count];
    }

    findStartRefill(kortezh) {
        let delta = 0
        let startTime = null
        for (let i = 0; i < kortezh.length - 1; i++) {
            const raznost = Number(kortezh[i + 1].dut) - Number(kortezh[i].dut)
            if (raznost > delta) {
                delta = raznost
                startTime = kortezh[i]
            }
        }
        return startTime
    }
    overlay() {
        const volume = this.volume.map(e => {
            const startTime = Number(e[0].last_valid_time)
            const finishTime = Number(e[e.length - 1].last_valid_time)
            const tuple = this.dataOrigin.filter(it => Number(it.last_valid_time) >= startTime && Number(it.last_valid_time) <= finishTime).map(t => t)
            this.calculateIntervals(tuple);
            const volume = this.filterIntervals();
            this.increasingIntervals = []
            return volume[0]

        })
        this.volume = volume.filter(e => e !== undefined);
    }
    async filtration() {
        // this.data = HelpersDefault.filtersOil(this.dataOrigin, Number(this.config.dopValue))
        const data = HelpersDefault.medianFilters(this.dataOrigin, Number(this.config.dopValue))
        this.data = data.map(e => {
            const oil = this.calkut(e.dut)
            return {
                ...e,
                oil: oil
            }
        })
    }

    fuelConsumption() {
        if (!this.config || this.data.length === 0) { return 0 }
        const fuelCons = this.calkut(this.data[0].dut) + this.oil - this.calkut(this.data[this.data.length - 1].dut)
        return fuelCons > 0 ? fuelCons : 0
    }
    calculateIntervals(data) {
        const { volume, duration } = this.settings['Топливо'];
        const minTime = this.timeStringToUnix(duration.timeRefill);
        const currentTimeoutPeriod = minTime; // Указываем таймаут для разделения заправок
        let segment = [];
        let segmentStarted = false; // Флаг, указывающий, что сегмент уже начался
        let lastTimestamp = null; // Время последнего сообщения для проверки таймаута

        for (let i = 0; i < data.length; i++) {
            const currentData = data[i];
            const currentFuel = Number(currentData.dut); // Объем топлива в текущем сообщении
            const currentTime = Number(currentData.last_valid_time); // Конвертируем время в объект Date
            // Если сегмент еще не начался
            if (!segmentStarted) {
                // Поскольку это первый элемент, просто добавим его в сегмент
                segment.push(currentData);
                segmentStarted = true; // Начинаем сегмент
                lastTimestamp = currentTime; // Запоминаем время последнего сообщения
            } else {
                const lastSegmentFuel = Number(segment[segment.length - 1].dut); // Объем топлива последнего сообщения
                const d = currentFuel - lastSegmentFuel; // Разница

                // Если d положительное, мы продолжаем заправку
                if (d > 0) {
                    segment.push(currentData);
                    lastTimestamp = currentTime; // Обновляем время последнего сообщения
                }
                // Если d отрицательное, завершение заправки
                else if (d < 0) {
                    // Добавим текущий элемент в сегмент и завершим его
                    //   segment.push(currentData);
                    if (segment.length > 1) {
                        this.increasingIntervals.push(segment);
                    }
                    // Начинаем новый сегмент
                    segment = [];
                    segmentStarted = false; // Сброс флага
                }
                // Если d равно нулю, проверка на таймаут
                else if (d === 0) {
                    // Проверяем, прошел ли таймаут
                    const timeDiff = (currentTime - lastTimestamp) // Разница времени в секундах
                    if (timeDiff >= currentTimeoutPeriod) {
                        // Таймаут истек, завершаем сегмент
                        if (segment.length > 1) {
                            this.increasingIntervals.push(segment);
                        }
                        // Начинаем новый сегмент
                        segment = [];
                        segmentStarted = false; // Сброс флага
                    } else {
                        // Если таймаут не истек, просто добавляем текущее сообщение
                        segment.push(currentData);
                        lastTimestamp = currentTime; // Обновляем время последнего сообщения
                    }
                }
            }
        }

        // Проверка, чтобы добавить последний сегмент, если он больше 1
        if (segment.length > 1) {
            this.increasingIntervals.push(segment);
        }
    }

    filterIntervals() {
        const { volume, duration } = this.settings['Топливо'];
        const volumeValue = Number(volume.volumeRefill);

        // Шаг 2: Фильтруем по D.U.T.
        return this.increasingIntervals.filter(interval => {
            const firstOil = interval[0].dut;
            const lastOil = interval[interval.length - 1].dut;
            const differenceOil = this.calkut(lastOil) - this.calkut(firstOil);

            return differenceOil > volumeValue;
        });
    }
    timeStringToUnix(timeString) {
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        const milliseconds = (hours * 3600 + minutes * 60 + seconds);
        return milliseconds
    }

    calkut(dut) {
        function transformExpressionWithExponent(str, x) {
            // Убираем пробелы вокруг x и степеней
            str = str.replace(/\s+/g, '');
            // Добавляем знак умножения перед 'x', если его нет
            str = str.replace(/(\d)(x)/g, '$1*$2');
            // Заменяем выражения вида x2 на Math.pow(x, 2)
            str = str.replace(/x\^(\d+)/g, 'Math.pow(x, $1)');  //str.replace(/x(\d+)/g, 'Math.pow(x, $1)');
            // Заменяем все оставшиеся 'x' на значение переменной x
            str = str.replace(/x/g, x);

            return str;
        }

        const formattedExpression = this.config.formula.replace(/,/g, '.');
        const transformedExpression = transformExpressionWithExponent(formattedExpression, dut);
        try {
            const result = eval(transformedExpression);
            return parseInt(result)


        } catch (error) {
            console.error("Ошибка при вычислении:", error);
        }

    }
}


module.exports = { OilCalculator }