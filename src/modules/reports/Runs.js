

const { CalculateReports } = require('./Calculate')
const { OilCalculator } = require('./OilControllCalculater')
const Helpers = require('./Helpers')
class Runs {
    constructor(data, thisAray, setAttributes, idObject, traveling, parkings, stops, prostoy) {
        this.data = data
        this.report = thisAray
        this.setAttributes = setAttributes
        this.idObject = idObject
        this.traveling = traveling
        this.prostoy = prostoy
        this.parkings = parkings
        this.stops = stops
        //  this.init()
    }


    async init() {
        const promises = this.report.map(async (e) => {
            const celevoyInterval = this.data.filter(it => {
                const time = Number(it.last_valid_time);
                return time >= e.startUnix && time <= e.endUnix;
            });
            const [mileages, rashod, timeMove] = await Promise.all(
                [this.mileageFunc(celevoyInterval),
                this.rashodPoDUT(celevoyInterval),
                this.timeMoves(celevoyInterval)]); // Ждем оба

            const travelAndAlarm = this.countTraveling(e)
            e.countTraveling = travelAndAlarm[0]
            e.alarm = travelAndAlarm[1]
            e.countParkings = this.countEvents(e, this.parkings, 'flag')
            e.countStops = this.countEvents(e, this.stops, 'flag')
            e.prostoy = this.countEvents(e, this.prostoy)
            e.mileages = mileages ?? 'Н/Д';
            e.rashod = rashod ?? 'Н/Д';
            e.timeMove = timeMove[0]
            e.timeMoveUnix = timeMove[1]
            e.medium = this.calculateRashodDUTKM(rashod, mileages)
            return e;
        });
        this.report = await Promise.all(promises);

        const summary = this.summary()
        return { rows: this.report, summary: summary }
    }

    mileageFunc(data) {
        let meliage = data.length !== 0 ? parseInt(data[data.length - 1].mileage) - parseInt(data[0].mileage) : 0
        return meliage
    }


    countTraveling(e) {
        const startTime = e.startUnix
        const finishTime = e.endUnix
        const countTraveling = this.traveling.reduce((acc, el) => {
            const timeStart = Number(el[0].time)
            const travel = timeStart >= startTime && timeStart <= finishTime
            if (travel) {
                !el[2].sub ? acc[0]++ : acc[1]++
            }
            return acc
        }, [0, 0])
        return countTraveling

    }

    countEvents(e, events, flag) {
        const startTime = e.startUnix
        const finishTime = e.endUnix

        const intervalTravelingDay = this.traveling.filter(e => {
            const timeStart = Number(e[0].time)
            const travel = timeStart >= startTime && timeStart <= finishTime
            if (travel) return e
        })

        if (intervalTravelingDay.length === 0) return 0
        const finishTimeOneTraveling = Number(intervalTravelingDay[0][1].time)

        const countEvents = events.reduce((acc, el) => {
            const timeStart = flag ? el.time : Number(el[0].time)
            const travel = timeStart >= startTime && timeStart <= finishTime

            if (travel && finishTimeOneTraveling <= timeStart) {
                acc++
            }
            return acc
        }, 0)
        return countEvents

    }

    async rashodPoDUT(data) {
        if (data.length === 0) return 0
        const startOil = data[0].dut ? (CalculateReports.startAndFinishOil(data))[0] : 'Н/Д'
        const finishOil = data[0].dut ? (CalculateReports.startAndFinishOil(data))[1] : 'Н/Д'
        const instanceRefill = new OilCalculator(data, this.setAttributes, this.idObject)
        const refill = await instanceRefill.init()

        // console.log(data, this.setAttributes, this.idObject)
        const rashodDUT = data[0].dut ? Math.max(0, parseFloat((startOil + refill[0] - finishOil).toFixed(1))) : 'Н/Д'
        if (startOil === 'Н/Д' || finishOil === 'Н/Д' || !refill || refill.length === 0 || isNaN(startOil) || isNaN(finishOil) || isNaN(refill[0])) {
            return null;
        }

        return rashodDUT
    }

    timeMoves(data) {
        const arrayRuns = CalculateReports.traveling(data, this.setAttributes, 'runs')
        const traveling = arrayRuns.reduce((acc, e) => {
            acc += e[2].time
            return acc
        }, 0)
        return [Helpers.formatHMS(traveling), traveling]
    }

    summary() {
        const countDay = this.report.length
        const mileages = this.report.reduce((acc, e) => {
            const mileage = Number(e.mileages); // Преобразуем в число
            if (!isNaN(mileage) && mileage > 0) { // Проверяем, что это число и больше 0
                return acc + mileage;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);

        const countTraveling = this.report.reduce((acc, e) => {
            const value = Number(e.countTraveling); // Преобразуем в число
            if (!isNaN(value)) { // Проверяем, что это число и больше 0
                return acc + value;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);
        const countParkings = this.report.reduce((acc, e) => {
            const value = Number(e.countParkings); // Преобразуем в число
            if (!isNaN(value)) { // Проверяем, что это число и больше 0
                return acc + value;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);
        const countStops = this.report.reduce((acc, e) => {
            const value = Number(e.countStops); // Преобразуем в число
            if (!isNaN(value)) { // Проверяем, что это число и больше 0
                return acc + value;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);
        const prostoy = this.report.reduce((acc, e) => {
            const value = Number(e.prostoy); // Преобразуем в число
            if (!isNaN(value)) { // Проверяем, что это число и больше 0
                return acc + value;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);

        const rashod = this.report.reduce((acc, e) => {
            const rashodValue = Number(e.rashod); // Преобразуем в число
            if (!isNaN(rashodValue) && rashodValue > 0) { // Проверяем, что это число и больше 0
                return acc + rashodValue;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);
        const alarms = this.report.reduce((acc, e) => {
            const value = Number(e.alarm); // Преобразуем в число
            if (!isNaN(value)) { // Проверяем, что это число и больше 0
                return acc + value;  // Добавляем, если условие выполняется
            }
            return acc; // Не добавляем, если не выполняется
        }, 0);
        const { sum, count } = this.report.reduce((acc, e) => {
            let currentMedium = e.medium;
            if (currentMedium === 'Н/Д') {
                return acc; // Пропускаем 'Н/Д'
            }
            const numericMedium = Number(currentMedium);
            if (!isNaN(numericMedium) && numericMedium > 0) {
                acc.sum += numericMedium; // Добавляем к сумме
                acc.count++;              // Увеличиваем счетчик
            }

            return acc;
        }, { sum: 0, count: 0 }); // Начальные значения: сумма = 0, количество = 0

        const medium = count > 0 ? parseFloat((sum / count).toFixed(1)) : 'Н/Д';
        const timeMove = Helpers.formatHMS(this.report.reduce((acc, e) => acc + e.timeMoveUnix, 0))

        return {
            'Дата': `${countDay} дней`, 'Километраж': `${mileages} км`, 'Потрачено по ДУТ': `${parseFloat(rashod.toFixed(1))} л.`, 'Время в движении': `${timeMove} (Ч:М:С)`, 'Средний расход л/100км': `${medium} л/100км`,
            'Поездки (количество)': `${countTraveling}`, 'Стоянки (количество)': `${countParkings}`, 'Остановки (количество)': `${countStops}`, 'Простои на ХХ (количество)': `${prostoy}`, 'Кол-во нарушений (количество)': `${alarms}`
        }

    }

    calculateRashodDUTKM(rashod, mileages) {
        let rashodDUTKM;

        if (mileages == null || rashod == null) {
            rashodDUTKM = 'Н/Д';
        } else if (mileages === 0 && rashod === 0) {
            rashodDUTKM = 0;
        } else if (mileages === 0) {
            rashodDUTKM = 0;
        } else {
            rashodDUTKM = parseFloat(((rashod / mileages) * 100).toFixed(1));
        }

        return rashodDUTKM;
    }
}

module.exports = Runs

