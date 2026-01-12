
const { CalculateReports } = require('./Calculate')
const { OilCalculator } = require('./OilControllCalculater')
class ProstoyControll {
    constructor(data, index, filters, id) {
        this.index = index
        this.data = data
        this.filters = filters
        this.id = id
    }

    init() {
        return this.controll()
    }


    controll() {
        let rest;
        if (!this.index) return []
        switch (this.index) {
            case 30: rest = this.index30(this.data)
                break;
            case 20: rest = this.index20(this.data)
                break;
            case 10: rest = this.index10(this.data)
                break;
            case 11: rest = this.index11(this.data)
                break;
            default: rest = this.index30(this.data)
        }
        return rest
    }
    struktura(rest) {
        const { minDuration } = this.filters['Простои на холостом ходу']
        const minTime = CalculateReports.timeStringToUnix(minDuration)
        const ress = rest.reduce((acc, el) => {
            const time = Number(el[el.length - 1].last_valid_time) - Number(el[0].last_valid_time)
            if (time > minTime) {
                const instance = new OilCalculator(el, this.filters, this.id)
                    ;
                const zapravka = (instance.init())[0]
                const rashodDUT = el[0].oil ? parseFloat(Number(el[0].oil) + zapravka - Number(el[el.length - 1].oil)).toFixed(2) : 'Н/Д'
                const rashodDUTMCH = parseFloat(((rashodDUT / time) * 3600).toFixed(2))
                const diffMoto = time
                acc.push([{ time: el[0].last_valid_time, oil: el[0].oil ? el[0].oil : 'Н/Д', geo: [el[0].lat, el[0].lon] },
                { time: el[el.length - 1].last_valid_time, oil: el[el.length - 1].oil ? el[el.length - 1].oil : 'Н/Д', geo: [el[el.length - 1].lat, el[el.length - 1].lon] }, {
                    moto: diffMoto,
                    rashodDUT: rashodDUT,
                    rashodDUTMCH: rashodDUTMCH,
                    time: time
                }])
            }

            return acc
        }, [])
        return ress
    }
    index30(data) {
        const res = data.reduce((acc, e) => {
            if (Number(e.engineOn) === 1 && Number(e.speed) < 6 && Number(e.sats) >= 7) {
                if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0 && Number(acc[acc.length - 1][0].engineOn) === 1
                    && Number(acc[acc.length - 1][0].speed) < 6 && Number(acc[acc.length - 1][0].sats) >= 7) {
                    acc[acc.length - 1].push(e);
                } else {
                    acc.push([e]);
                }
            } else if (Number(e.engineOn) === 0 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.speed) >= 6 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.sats) < 7 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0
            ) {
                acc.push([]);
            }
            return acc;
        }, [])

        const rest = res.filter(el => el.length > 0)
        const result = this.struktura(rest)
        return result
    }


    index20(data) {
        const { angleSensorSettings } = this.filters['Простои на холостом ходу']
        const res = data.reduce((acc, e) => {
            if (Number(e.engineOn) === 1 && Number(e.speed) < 6 && Number(e.sats) >= 7 && Number(e.lift) <= Number(angleSensorSettings.minValue)) {
                if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0 && Number(acc[acc.length - 1][0].engineOn) === 1
                    && Number(acc[acc.length - 1][0].speed) < 6 && Number(acc[acc.length - 1][0].sats) >= 7) {
                    acc[acc.length - 1].push(e);
                } else {
                    acc.push([e]);
                }
            } else if (Number(e.engineOn) === 0 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.sats) < 7 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.speed) >= 6 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0 ||
                Number(e.lift) > Number(angleSensorSettings.minValue) && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0
            ) {
                acc.push([]);
            }
            return acc;
        }, [])

        const rest = res.filter(el => el.length > 0)
        const result = this.struktura(rest)
        return result

    }

    index11(data) {
        const res = data.reduce((acc, e, index) => {
            // Получаем последний элемент из последней группы
            const lastGroup = acc[acc.length - 1];
            const isEngineOn = Number(e.engineOn) === 1;
            const isSpeedLow = Number(e.speed) < 6;
            const isSatsSufficient = Number(e.sats) >= 7;
            const liftBoolean = Number(e.liftBoolean) < 0.5
            if (isEngineOn && isSpeedLow && isSatsSufficient && liftBoolean) {
                if (!lastGroup) {
                    acc.push([e]); // Создаем новую группу, если lastGroup пустой
                } else {
                    lastGroup.push(e); // Добавляем текущий элемент в существующую группу
                }
            } else if (
                Number(e.engineOn) === 0 && lastGroup?.length !== 0 ||
                Number(e.sats) < 7 && lastGroup?.length !== 0 ||
                Number(e.speed) >= 6 && lastGroup?.length !== 0 ||
                Number(e.liftBoolean) >= 0.5 && lastGroup?.length !== 0) {
                acc.push([]);
            }

            return acc;
        }, []);

        const rest = res.filter(el => el.length > 1)
        const result = this.struktura(rest)
        return result

    }

    index10(data) {
        const { angleSensor } = this.filters['Простои на холостом ходу']

        if (!angleSensor) {
            return this.index11(data)
        }
        else {
            const res = data.reduce((acc, e, index) => {
                // Получаем последний элемент из последней группы
                const lastGroup = acc[acc.length - 1];
                const isEngineOn = Number(e.engineOn) === 1;
                const isSpeedLow = Number(e.speed) < 6;
                const isSatsSufficient = Number(e.sats) >= 7;

                // Проверяем условия для добавления в группу
                if (isEngineOn && isSpeedLow && isSatsSufficient) {
                    // Условие для lift - сравнение с следующим элементом
                    const nextElement = data[index + 1]; // Получаем следующий элемент
                    if (nextElement && (Math.abs(Number(nextElement.lift) - Number(e.lift)) <= 2)) {
                        // Если следующий элемент существует и lift подходит, добавляем текущий элемент в группу
                        if (!lastGroup) {
                            acc.push([e]); // Создаем новую группу, если lastGroup пустой
                        } else {
                            lastGroup.push(e); // Добавляем текущий элемент в существующую группу
                        }
                    } else {
                        acc.push([e]); // Если нет следующего подходящего элемента, создаем новую группу
                    }
                } else if (
                    Number(e.engineOn) === 0 && lastGroup?.length !== 0 ||
                    Number(e.sats) < 7 && lastGroup?.length !== 0 ||
                    Number(e.speed) >= 6 && lastGroup?.length !== 0) {
                    acc.push([]); // Добавляем пустую группу, если одно из условий выполнено
                }

                return acc;
            }, []);
            const rest = res.filter(el => el.length > 1);
            const result = this.struktura(rest)
            return result;
        }

    }
}


module.exports = { ProstoyControll }