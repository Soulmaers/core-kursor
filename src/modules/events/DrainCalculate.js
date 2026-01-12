

const ServisFunction = require('./ServisFunctions')

class DrainCalculate {
    constructor(data, config) {
        this.dataOrigin = data;
        this.config = config || {}
        this.timeDrain = Number(config.events.drain.time)
        this.volumeDrain = Number(config.events.drain.minV)
        this.increasingIntervals = [];
    }


    async init() {
        this.oilP = this.config.sensors.custom_sensors.find(e => e.param === 'oil')
        if (!this.oilP) { return null }

        await this.filtration()
        this.addDerivative(this.data)
        this.calculateIntervals(this.data);
        this.volume = this.filterIntervals();
        // console.log(this.volume)
        this.oil = this.volume.reduce((acc, seg) => {
            const firstL = this.calkut(Number(seg[0].dut));
            const lastL = this.calkut(Number(seg[seg.length - 1].dut));
            return acc + (firstL - lastL); // слив: начало больше конца
        }, 0);

        const count = this.volume.map(seg => {
            const start = this.findStartDrain(seg) || seg[0];
            const firstL = this.calkut(Number(seg[0].dut));
            const lastL = this.calkut(Number(seg[seg.length - 1].dut));
            const drained = firstL - lastL;

            return {
                time: start.last_valid_time,
                geo: [start.lat, start.lon],
                startOil: firstL,
                finishOil: lastL,
                value: drained,   // можно хранить в одном поле
                value2: drained,  // если нужно совместимостью
            };
        });
        return [this.oil, count];
    }

    findStartDrain(kortezh) {
        let delta = 0
        let startTime = null
        for (let i = 0; i < kortezh.length - 1; i++) {
            const raznost = Number(kortezh[i].dut) - Number(kortezh[i + 1].dut)
            if (raznost > delta) {
                delta = raznost
                startTime = kortezh[i]
            }
        }
        return startTime
    }
    calculateIntervals(data) {
        let segment = [];


        for (let i = 0; i < data.length; i++) {
            // Если сегмент еще не начался
            if (segment.length === 0) {
                segment.push(data[i]);
            } else {
                const currentDerivative = Number(data[i].derivative);
                // Если текущее значение больше последнего в сегменте, продлеваем сегмент
                if (currentDerivative < this.averageDerivative) {
                    segment.push(data[i]);
                }
                // Если текущее значение меньше последнего, мы завершаем сегмент
                else {
                    // Сохраним сегмент, если он больше 1
                    if (segment.length > 1) {
                        this.increasingIntervals.push(segment);
                    }
                    // Начать новый сегмент
                    segment = [data[i]];
                }
            }
        }

        // Добавление последнего сегмента, если он больше 1
        if (segment.length > 1) {
            this.increasingIntervals.push(segment);
        }
        //   console.log(this.increasingIntervals)
    }

    addDerivative(data) {
        // Проверяем, что массив не пуст и содержит хотя бы два элемента
        if (data.length < 2) {
            return data;
        }
        // Добавляем поле "derivative" в каждый элемент массива, начиная со второго
        for (let i = 1; i < data.length; i++) {
            const deltaDut = Number(data[i].dut) - Number(data[i - 1].dut); // Разница в объеме топлива
            //  console.log(Number(data[i].last_valid_time), Number((data[i - 1].last_valid_time)))
            const deltaTime = (Number(data[i].time_terminal) - Number((data[i - 1].time_terminal)))// Разница во времени
            // Если разница во времени не нулевая, вычисляем производную
            //   console.log(deltaDut, deltaTime, data[i].last_valid_time)
            data[i].derivative = deltaTime !== 0 ? Number((deltaDut / deltaTime).toFixed(2)) : 0;
        }
        // Добавляем поле "derivative" со значением null или 0 для первого элемента
        data[0].derivative = 0; // Или 0, в зависимости от ваших требований
        const averageDerivative = data.filter(e => e.derivative < 0).map(el => [el.derivative, el.time_terminal])
        //console.log(averageDerivative)
        const summ = averageDerivative.reduce((acc, el) => {
            acc += el[0]
            return acc
        }, 0)
        //   console.log(summ, averageDerivative.length)
        this.averageDerivative = Number((summ / averageDerivative.length).toFixed(2))
        //  console.log(this.averageDerivative)
    }

    async filtration() {
        //   this.data = HelpersDefault.filtersOil(this.dataOrigin, Number(this.config.dopValue))
        this.data = ServisFunction.medianFilters(this.dataOrigin, this.config)
    }
    filterIntervals() {

        return this.increasingIntervals.filter(interval => {
            const firstOil = interval[0].dut;
            const startTime = interval[0].time_terminal
            const lastOil = interval[interval.length - 1].dut;
            const finishTime = interval[interval.length - 1].time_terminal
            const diffenenceTime = Number(finishTime) - Number(startTime)
            const differenceOil = this.calkut(firstOil) - this.calkut(lastOil);

            return interval.length > 2 && differenceOil > this.volumeDrain
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

        const formattedExpression = this.oilP.f.replace(/,/g, '.');
        const transformedExpression = transformExpressionWithExponent(formattedExpression, dut);
        try {
            const result = eval(transformedExpression);
            return dut <= 7001 ? parseInt(result) : null   //  const val = dut <= 7001 ? Number(eval(expr)) : null 


        } catch (error) {
            console.error("Ошибка при вычислении:", error);
        }

    }
}


module.exports = { DrainCalculate }