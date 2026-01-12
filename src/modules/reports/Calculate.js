const { OilCalculator } = require('./OilControllCalculater')
const Helpers = require('./Helpers')
class CalculateReports {

    static calculationMileage(data) {
        if (!data || data.length === 0) {
            return 'Н/Д'
        }
        const startMileage = Number(data[0].mileage ? data[0].mileage : 0)
        const finishMileage = Number(data[data.length - 1].mileage ? data[data.length - 1].mileage : 0)
        return finishMileage - startMileage
    }

    static startAndFinishOil(data) {
        if (!data || data.length === 0) {
            return ['Н/Д', 'Н/Д']
        }
        const startOil = data[0].oil ? Number(data[0].oil) : Number(data[0].summatorOil)
        const finishOil = data[data.length - 1].oil ? Number(data[data.length - 1].oil) : Number(data[data.length - 1].summatorOil)
        return [startOil, finishOil]
    }

    static startAndFinishGeo(data) {
        const startGeo = [Number(data[0].lat), Number(data[0].lon)]
        const finishGeo = [Number(data[data.length - 1].lat), Number(data[data.length - 1].lon)]
        return [startGeo, finishGeo]
    }
    static startAndFinishTime(data) {
        const startTime = Number(data[0].last_valid_time)
        const finishTime = Number(data[data.length - 1].last_valid_time)
        return [CalculateReports.converterTimes(startTime), CalculateReports.converterTimes(finishTime)]
    }

    static converterTimes(data) {
        if (!data) return '-'
        let date = new Date(data * 1000); // Преобразование в миллисекунды
        let year = date.getFullYear().toString().slice(-2);;
        let month = ("0" + (date.getMonth() + 1)).slice(-2); // Месяцы начинаются с 0
        let day = ("0" + date.getDate()).slice(-2);
        let hours = ("0" + date.getHours()).slice(-2);
        let minutes = ("0" + date.getMinutes()).slice(-2);
        let seconds = ("0" + date.getSeconds()).slice(-2);

        let formattedTime = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        return formattedTime
    }

    static convertFormatTime(times) {
        const date = times.map(el => {
            const date = new Date(el * 1000);
            const year = date.getFullYear();
            const month = ("0" + (date.getMonth() + 1)).slice(-2); // добавляем ведущий ноль, если месяц < 10
            const day = ("0" + date.getDate()).slice(-2); // добавляем ведущий ноль, если день < 10
            return `${year}-${month}-${day}`;
        })
        return date
    }

    static convertTime(seconds) {
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

    static formatTime(num) {
        var hours = Math.floor(num / 3600);
        var minutes = Math.floor((num % 3600) / 60);
        var seconds = num % 60;

        var formattedTime = hours.toString().padStart(2, '0') + ':' +
            minutes.toString().padStart(2, '0') + ':' +
            seconds.toString().padStart(2, '0');

        return formattedTime;

    }
    static mediumEngineRPM(data) {
        const res = data.reduce((acc, e) => {
            acc += Number(e.engineRPM)
            return acc
        }, 0)
        const mediumRPM = res / data.length
        return !isNaN(mediumRPM) ? mediumRPM : 'Н/Д'
    }

    static maxEngineRPM(data) {
        const maxEngineRPM = Math.max(...data.map(item => item.engineRPM))
        return !isNaN(maxEngineRPM) ? maxEngineRPM : 'Н/Д'
    }

    static async moto(data, settings, id) {

        const { minDuration } = settings['Моточасы']
        const minTime = CalculateReports.timeStringToUnix(minDuration)

        const res = data.reduce((acc, e) => {
            if (Number(e.engineOn) === 1) {
                if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0 && Number(acc[acc.length - 1][0].engineOn) === 1) {
                    acc[acc.length - 1].push(e);
                } else {
                    acc.push([e]);
                }
            } else if (Number(e.engineOn) === 0 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0) {
                acc.push([]);
            }
            return acc;
        }, [])

        const rest = res.filter(el => el.length > 0)
        const ress = await Promise.all(rest.map(async (el) => {
            const time = Number(el[el.length - 1].last_valid_time) - Number(el[0].last_valid_time)
            if (time > minTime) {
                const instance = new OilCalculator(el, settings, id);
                const result = await instance.init()
                const zapravka = result ? result[0] : 0
                const maxEngineRPM = el.reduce((max, current) => {
                    return Math.max(max, Number(current.engineRPM));
                }, 0);
                const totalRPM = el.reduce((sum, current) => {
                    return sum + Number(current.engineRPM);
                }, 0);

                const mediumEngineRPM = totalRPM / el.length;
                const rashodDUT = el[0].oil ? parseFloat(Number(el[0].oil) + zapravka - Number(el[el.length - 1].oil)).toFixed(2) : 'Н/Д'
                const distance = Number(el[el.length - 1].mileage) - Number(el[0].mileage)
                let rashodDUTKM;
                if (distance !== 0) {
                    rashodDUTKM = el[0].oil
                        ? parseFloat((Number(rashodDUT) / distance) * 100).toFixed(2)
                        : 'Н/Д';
                } else {
                    rashodDUTKM = 'Н/Д';
                }
                const diffMoto = time

                return [{ time: el[0].last_valid_time, oil: el[0].oil ? el[0].oil : 'Н/Д', geo: [el[0].lat, el[0].lon] },
                { time: el[el.length - 1].last_valid_time, oil: el[el.length - 1].oil ? el[el.length - 1].oil : 'Н/Д', geo: [el[el.length - 1].lat, el[el.length - 1].lon] }, {
                    mediumEngineRPM: !isNaN(mediumEngineRPM) ? mediumEngineRPM : 'Н/Д',
                    maxEngineRPM: !isNaN(maxEngineRPM) ? maxEngineRPM : 'Н/Д',
                    moto: diffMoto,
                    rashodDUT: rashodDUT < 0 ? 0 : rashodDUT,
                    rashodDUTKM: rashodDUTKM < 0 ? 0 : rashodDUTKM,
                    distance: parseFloat(distance.toFixed(2)),
                    time: Number(time)
                }]
            }

        }))
        //   console.log(ress)
        const filteredRess = ress.filter(item => item !== undefined);
        const motoAll = filteredRess.reduce((acc, e) => {
            acc += e[2].time
            return acc
        }, 0)

        // console.log(filteredRess, motoAll)
        return { moto: filteredRess, motoAll: motoAll }
    }


    static timeStringToUnix(timeString) {
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        const milliseconds = (hours * 3600 + minutes * 60 + seconds);
        return milliseconds
    }

    static getTimeCondition(minTime, maxTime) {

        if (minTime && maxTime) {
            return (time) => time > minTime && time < maxTime;  // Условие: значение времени больше minTime и меньше maxTime
        } else if (minTime) {
            return (time) => time > minTime;  // Условие: значение времени больше minTime
        } else if (maxTime) {
            return (time) => time < maxTime;  // Условие: значение времени меньше maxTime
        } else {
            return () => true;  // Если никаких ограничений нет, возвращаем истинное значение
        }
    }


    static geoTreks(data, traveling) {
        // console.log(traveling)
        if (traveling.length === 0) return []
        const geoTime = [traveling[0][0].time, traveling[traveling.length - 2][1].time]
        const arrayGeoZone = data.filter(el => el.last_valid_time >= geoTime[0] && el.last_valid_time <= geoTime[1])
            .map(e => [Number(e.lat), Number(e.lon), { time: Number(e.last_valid_time) }])
        return arrayGeoZone
    }


    static traveling(data, cfg, runs) {
        //   const { duration, mileage, speed } = settings['Поездки']
        console.log(cfg.events)
        const pwrP = cfg.events.engine.pwr
        const { speedP, satsP, engineP } = cfg.events.trips


        const resz = data.reduce((acc, e) => {
            const engine = Number(e.extras.pwr) >= pwrP ? 1 : 0
            if (Number(e.speed) >= speedP && Number(e.sats) >= satsP && engine === engineP) {
                if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0
                    && Number(acc[acc.length - 1][0].speed) > speedP && Number(acc[acc.length - 1][0].sats) >= satsP
                    && Number(acc[acc.length - 1][0].extras.pwr) >= engine) {
                    acc[acc.length - 1].push(e);
                } else {
                    acc.push([e]);
                }
            } else if (engine !== engineP && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.sats) < satsP && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.speed) <= speedP && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0) {
                acc.push([]);
            }
            return acc;
        }, [])

        const rest = resz.filter(el => el.length > 0)
        const res = rest.reduce((acc, el) => {
            const maxSpeed = el.reduce((max, current) => {
                return Math.max(max, Number(current.speed));
            }, 0);
            const totalSpeed = el.reduce((sum, current) => {
                return sum + Number(current.speed);
            }, 0);
            const objectMaxSpeed = el.find(e => Number(e.speed) === maxSpeed)

            const averageSpeed = totalSpeed / el.length;
            const distance = Number(el[el.length - 1].extras.mileage) - Number(el[0].extras.mileage)
            const time = Number(el[el.length - 1].time_terminal) - Number(el[0].time_terminal)

            const subs = CalculateReports.funcSubInterval(el, speedP)
            const timeExcessEnabled = speed?.flagTimeExcess // Явно проверяем на true
            const timeExcessCondition = timeExcessEnabled && subs.length !== 0;
            subs.some(el => Number(el.time) >= Number(speed?.flagTimeExcess));
            const maxSpeedCondition = speed?.flag && maxSpeed >= speed?.maxSpeed;

            const backColor = (timeExcessEnabled ? (maxSpeedCondition && timeExcessCondition)
                : maxSpeedCondition) ? '#F9966B' : '';

            const subCount = subs.length
            acc.push([{ time: el[0].last_valid_time, oil: el[0].oil, geo: [el[0].lat, el[0].lon] },
            { time: el[el.length - 1].last_valid_time, oil: el[el.length - 1].oil, geo: [el[el.length - 1].lat, el[el.length - 1].lon] }, {
                maxSpeed: maxSpeed, geoSpeed: [objectMaxSpeed.lat, objectMaxSpeed.lon], maxSpeedFieldColor: backColor, averageSpeed: parseFloat(averageSpeed.toFixed(0)), distance: parseFloat(distance.toFixed(2)), time: time,
                main: subCount
            }])
            if (!runs) {
                const subInterval = subs.map(e =>
                    e[2].distance === 0
                        ? [e[0], e[1], { ...e[2], distance: 0.1 }]
                        : e
                );
                if (subInterval.length !== 0) acc.push(...subInterval);
            }

            return acc
        }, [])
        //  console.log(res[0][0].time)
        return res
    }

    static funcSubInterval(el, settings) {
        if (settings && !settings.flagTimeExcess && settings.flag) {
            let speedThreshold = Number(settings.maxSpeed);
            let result = [];
            let currentInterval = [];

            el.forEach((item, index) => {
                if (Number(item.speed) >= speedThreshold) {
                    currentInterval.push(item);  // Добавляем объект в текущий интервал
                } else {
                    // Если текущий интервал не пустой, добавляем его в результат и сбрасываем
                    if (currentInterval.length > 0) {

                        const row = Helpers.processArrayRow(currentInterval)
                        if (row) result.push(row);
                        currentInterval = [];  // Сбрасываем текущий интервал
                    }
                }
            });
            // Если в конце есть непрерывный интервал, добавляем его в результат
            if (currentInterval.length > 0) {
                const row = Helpers.processArrayRow(currentInterval)
                if (row) result.push(row);
            }
            return result;  // Возвращаем массив подмассивов
        }
        if (settings && settings.flagTimeExcess) {
            let speedThreshold = Number(settings.maxSpeed);
            let timeExcess = Number(settings.timeExcess)
            let result = [];
            let currentInterval = [];

            el.forEach((item, index) => {
                if (Number(item.speed) >= speedThreshold) {
                    currentInterval.push(item);  // Добавляем объект в текущий интервал
                } else {
                    // Если текущий интервал не пустой, добавляем его в результат и сбрасываем
                    if (currentInterval.length > 0) {

                        const row = Helpers.processArrayRow(currentInterval, timeExcess)
                        if (row) result.push(row);
                        currentInterval = [];  // Сбрасываем текущий интервал
                    }
                }
            });
            // Если в конце есть непрерывный интервал, добавляем его в результат
            if (currentInterval.length > 0) {
                const row = Helpers.processArrayRow(currentInterval, timeExcess)
                if (row) result.push(row);
            }
            return result;  // Возвращаем массив подмассивов


        }
        return []; // Возвращаем пустой массив, если условия не выполнены
    }
    static parkings(data, settings) {
        const { minDuration } = settings['Стоянки']
        const minTime = CalculateReports.timeStringToUnix(minDuration)

        const resz = data.reduce((acc, e) => {
            if (Number(e.engineOn) === 0) {
                if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0 && Number(acc[acc.length - 1][0].engineOn) === 0) {
                    acc[acc.length - 1].push(e);
                } else {
                    acc.push([e]);
                }
            } else if (Number(e.engineOn) === 1 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0) {
                acc.push([]);
            }
            return acc;
        }, [])

        const rest = resz.filter(el => el.length > 0)
        const res = rest.reduce((acc, el) => {
            const time = Number(el[el.length - 1].last_valid_time) - Number(el[0].last_valid_time)
            if (time > minTime) {
                acc.push({ time: Number(el[0].last_valid_time), geo: [el[0].lat, el[0].lon], diff: time })
            }
            return acc
        }, [])

        return res
    }

    static stops(data, settings) {

        const { minDuration } = settings['Остановки']
        const minTime = CalculateReports.timeStringToUnix(minDuration)
        const resz = data.reduce((acc, e) => {
            if (Number(e.speed) <= 10 && Number(e.sats) >= 7 && Number(e.engineOn) === 1) {
                if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0 && Number(acc[acc.length - 1][0].speed) <= 10 && Number(acc[acc.length - 1][0].sats) >= 7 && Number(acc[acc.length - 1][0].engineOn) === 1) {
                    acc[acc.length - 1].push(e);
                } else {
                    acc.push([e]);
                }
            } else if (Number(e.engineOn) === 0 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.sats) < 7 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.speed) > 10 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0) {
                acc.push([]);
            }
            return acc;
        }, [])

        const rest = resz.filter(el => el.length > 0)
        const res = rest.reduce((acc, el) => {
            const time = Number(el[el.length - 1].last_valid_time) - Number(el[0].last_valid_time)
            if (time > minTime) {
                acc.push({ time: Number(el[0].last_valid_time), geo: [el[0].lat, el[0].lon], diff: time })
            }
            return acc
        }, [])

        return res
    }
}

module.exports = { CalculateReports }