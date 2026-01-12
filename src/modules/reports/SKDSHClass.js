

class SCDSHClass {
    constructor(object) {
        this.object = object
        this.idObject = this.object.idObject
        this.objectName = this.object.objectName
        this.interval = this.object.data
    }

    async init() {
        await this.getDataGlobalStor()
        //  console.log(this.struktura)
        return {
            components: this.calcilator(),//, grafics: this.struktura, model: this.data[0].result
            // skdsh: this.struktura
        }
    }

    async getDataGlobalStor() {
        this.data = await databaseService.loadParamsViewList(this.objectName, this.idObject)
        this.destraction()
        this.pressure = await this.getPressure()
        this.struktura = this.strukturas()
    }



    async getPressure() {
        const arrayColumns = ['last_valid_time', 'lift', 'liftBoolean', 'speed', 'lat', 'lon', 'engineOn', 'pwr', 'oil', 'summatorOil', 'mileage', 'sats', 'engine']
        this.tyres.forEach(el => {
            arrayColumns.push(el.pressure, el.temp)
        })
        const result = await databaseService.getParamsToPressureAndOilToBase(String(this.interval[0]), String(this.interval[1]), this.idObject, arrayColumns, 0)
        result.sort((a, b) => {
            return new Date(b.last_valid_time) - new Date(a.last_valid_time);
        });
        return result
    }
    destraction() {
        this.tyres = this.data[1].result
        this.params = this.data[2].result
        this.osibar = this.data[3].result
    }

    calcilator() {
        const result = this.struktura.map(sensor => ({
            sensor: sensor.sens,
            intervals: this.processSensor(sensor, Number(sensor.bar.knd), Number(sensor.bar.kvd), Number(sensor.bar.dnn), Number(sensor.bar.dvn))
        }));
        const resultWithDurations = result.map(sensor => {
            // Инициализируем переменную для хранения суммарного времени и общего пробега всех интервалов
            let totalTimeAll = 0;
            let totalMileageAll = 0;
            // Для каждой категории интервала в каждом сенсоре рассчитываем общее время и пробег
            Object.keys(sensor.intervals.intervals).forEach(category => {
                const totalTime = sensor.intervals.intervals[category].reduce((acc, interval) => {
                    // Добавляем разницу между концом и началом интервала к аккумулятору времени
                    const intervalTime = interval.end - interval.start;
                    // Рассчитываем пробег для интервала
                    const intervalMileage = interval.mileage;
                    // Возвращаем объект с посчитанными значениями для каждого интервала
                    return { ...acc, totalTime: acc.totalTime + intervalTime, mileageInterval: acc.mileageInterval + intervalMileage };
                }, { totalTime: 0, mileageInterval: 0 }); // Начальные значения аккумулятора
                // Накапливаем суммарное время всех интервалов
                totalTimeAll += totalTime.totalTime;
                totalMileageAll += totalTime.mileageInterval;
                // Заменяем массив интервалов суммарным временем и пробегом для данной категории
                sensor.intervals.intervals[category] = {
                    totalTime: totalTime.totalTime !== 0 ? totalTime.totalTime : 0,//'-',
                    totalMileage: totalTime.mileageInterval !== 0 ? `${totalTime.mileageInterval} км` : 0//'-'
                };;
            });
            // Добавляем свойства all с суммарным временем и общим пробегом всех интервалов в текущем сенсоре
            sensor.intervals.all = { totalTime: totalTimeAll !== 0 ? totalTimeAll : '-', totalMileage: totalMileageAll !== 0 ? `${totalMileageAll} км` : 0 }// '-' };
            return sensor;
        });
        return resultWithDurations;
    }



    processSensor(sensorData, knd, kvd, dnn, dvn) {
        let intervals = {
            potery: [],
            belowKnd: [],
            betweenKndDnn: [],
            betweenDnnDvn: [],
            betweenDvnKvd: [],
            aboveKvd: []
        };

        let currentCategory = null;
        let intervalStart = null;
        let startMileage = null;

        sensorData.val.forEach((point, index) => {
            const time = new Date(point.dates).getTime() / 1000;
            const isMovingAndStopSignal = point.stop === 'ВКЛ' && point.speed > 6;
            let category = null;
            if (isMovingAndStopSignal) {
                if (point.value === -0.1) {
                    category = 'potery';
                } else if (point.value >= 0 && point.value <= knd) {
                    category = 'belowKnd';
                } else if (point.value > knd && point.value <= dnn) {
                    category = 'betweenKndDnn';
                } else if (point.value > dnn && point.value < dvn) {
                    category = 'betweenDnnDvn';
                } else if (point.value >= dvn && point.value < kvd) {
                    category = 'betweenDvnKvd';
                } else if (point.value >= kvd) {
                    category = 'aboveKvd';
                }

                if (category && (category !== currentCategory || intervalStart === null)) {
                    if (intervalStart !== null) {
                        intervals[currentCategory].push({
                            start: intervalStart,
                            end: time,
                            mileage: startMileage !== null ? point.mileage - startMileage : 0
                        });
                    }
                    intervalStart = time;
                    startMileage = point.mileage;
                    currentCategory = category;
                }
            } else if (intervalStart !== null) {
                intervals[currentCategory].push({
                    start: intervalStart,
                    end: time,
                    mileage: startMileage !== null ? point.mileage - startMileage : 0
                });
                intervalStart = null;
                startMileage = null;
                currentCategory = null;
            }

            if (index === sensorData.val.length - 1 && intervalStart !== null) {
                intervals[currentCategory].push({
                    start: intervalStart,
                    end: time,
                    mileage: startMileage !== null ? point.mileage - startMileage : 0
                });
            }
        });

        const maxPressure = sensorData.val.reduce((max, obj) => {
            if (obj.value !== -0.1 && obj.stop === 'ВКЛ' && obj.speed > 6) {
                return obj.value > max ? obj.value : max;
            }
            return max;
        }, 0);

        const minPressure = sensorData.val.reduce((min, obj) => {
            if (obj.value !== -0.1 && obj.stop === 'ВКЛ' && obj.speed > 6) {
                return obj.value < min ? obj.value : min;
            }
            return min;
        }, 0);

        const cel = sensorData.val.filter(e => e.value !== -0.1 && e.stop === 'ВКЛ' && e.speed > 6)
        const mediumPressure = parseFloat((cel.reduce((acc, obj) => {
            return acc + obj.value; // Суммируем значения
        }, 0) / cel.length).toFixed(2)) // Делим на количество элементов
        return { intervals: intervals, porogy: [minPressure, maxPressure, mediumPressure] };
    }
    strukturas() {
        // Преобразование массива osss в объект для быстрого доступа
        const osssMap = {};
        this.osibar.forEach(e => {
            osssMap[e.idOs] = e;
        });
        const paramnew = this.tyres.map(el => {
            if (osssMap[el.osNumber]) {
                const sens = this.params.find(it => Object.values(it).includes(el.pressure));
                if (!sens) return
                return {
                    sens: sens.sens,
                    position: Number(el.tyresdiv),
                    parametr: el.pressure,
                    bar: osssMap[el.osNumber],
                    val: this.pressure.map(elem => {
                        // console.log(elem[el.pressure])
                        return ({
                            dates: new Date(Number(elem.last_valid_time) * 1000),
                            geo: [Number(elem.lat), Number(elem.lon)],
                            speed: Number(elem.speed),
                            mileage: parseInt(elem.mileage),
                            pwr: parseFloat(elem.pwr),
                            sats: parseInt(elem.sats),
                            engine: Number(elem.engine),
                            stop: Number(elem.engineOn) === 1 ? 'ВКЛ' : 'ВЫКЛ',
                            value: elem[el.pressure] ? Number(elem[el.pressure]) : -0.1,
                            tvalue: elem[el.temp] ? (Number(elem[el.temp]) !== -128 && Number(elem[el.temp]) !== -50 && Number(elem[el.temp]) !== -51 ? Number(elem[el.temp]) : -0.1) : -0.1
                        })
                    })
                };
            }
        }).filter(el => el !== undefined)
        paramnew.sort((a, b) => a.position - b.position)
        paramnew.forEach(e => e.val.sort((a, b) => {
            if (a.dates > b.dates) {
                return 1;
            }
            if (a.dates < b.dates) {
                return -1;
            }
            return 0;
        }))
        return paramnew
    }


    convertTime(seconds) {
        // console.log(seconds)
        var days = Math.floor(seconds / (24 * 60 * 60));
        var hours = Math.floor(seconds / (60 * 60))// / (60 * 60));
        var minutes = Math.floor((seconds % (60 * 60)) / 60);
        var remainingSeconds = seconds % 60; // Рассчитываем оставшиеся секунды

        //  if (days > 0) {
        //  return `${days} д. ${hours} ч. ${minutes} м.`;
        if (hours > 0) {
            return `${hours} ч. ${minutes} м.`;
        } else if (minutes === 0) {
            // Включаем секунды в последнее условие
            return `${minutes} м. ${remainingSeconds} с.`;
        }
        else {
            return `${minutes} м.`
        }
    }

}
module.exports = { SCDSHClass }


