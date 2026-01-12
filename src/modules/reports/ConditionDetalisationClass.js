


class ConditionDetalisationClass {
    constructor(intervals, data) {
        this.report = intervals,
            this.data = data
    }


    init() {
        const result = this.report.map((e) => {
            const celevoyInterval = this.data.filter(it => {
                const time = Number(it.last_valid_time);
                return time >= e.startUnix && time <= e.endUnix;
            });
            const celevoy = this.sortFilterStructura(celevoyInterval)
            this.condition(celevoy, e);
            return e
        })
        //   console.log(result)
        return result
    }






    sortFilterStructura(celevoyInterval) {
        celevoyInterval.sort((a, b) => a.last_valid_time - b.last_valid_time);
        const newGlobal = celevoyInterval.map(it => {
            return {
                time: new Date(Number(it.last_valid_time) * 1000),
                speed: Number(it.speed),
                geo: [Number(it.lat), Number(it.lon)],
                engine: Number(it.engine),
                sats: Number(it.sats),
                engineOn: Number(it.engineOn)
            }
        })
        return newGlobal
    }

    condition(element, reports) {
        const intStopNew = this.prostoy(element)
        if (intStopNew) {
            intStopNew.forEach(el => {
                const startIndex = element.findIndex(x => x.time === el[0][0]);
                const endIndex = element.findIndex(x => x.time === el[1][0]);
                if (startIndex !== -1 && endIndex !== -1) {
                    // Обновить значения в свойстве condition
                    for (let i = startIndex; i <= endIndex; i++) {
                        element[i].condition = 'Работа на холостом ходу';
                    }
                }
            })
        }
        //  console.log(element)
        const { datas } = this.calculateIntervalsAndTotalTime(element, reports);
        this.convertation(reports, datas)

        return
    }

    calculateIntervalsAndTotalTime(data, reports) {
        let totalStateDurations = {}; // Для хранения общего времени каждого состояния
        let currentState = null;
        let stateStart = null;

        data.forEach((item, index, arr) => {
            const newState = item.condition || (item.speed > 0 && item.engineOn === 1 ? 'Движение'
                : item.speed === 0 && item.engine === 1 ? 'Повёрнут ключ зажигания' : 'Парковка');
            if (newState !== currentState || index === 0) {
                if (stateStart !== null && currentState !== null) {
                    // Закрытие предыдущего интервала и добавление его продолжительности
                    const intervalSeconds = (item.time - stateStart) / 1000;
                    if (!totalStateDurations[currentState]) {
                        totalStateDurations[currentState] = 0;
                    }
                    totalStateDurations[currentState] += intervalSeconds;
                    // Добавляем интервал ко всем элементам в группе
                    const interval = intervalSeconds
                    for (let j = arr.findIndex(el => el.time === stateStart); j < index; j++) {
                        arr[j].interval = interval;
                    }
                }
                stateStart = item.time; // Начало нового состояния
            }
            item.condition = newState; // Присваиваем состояние
            currentState = newState; // Обновляем текущее состояние

            // Если это последний элемент, закрываем текущий интервал
            if (index === data.length - 1) {
                const intervalSeconds = (item.time - stateStart) / 1000;
                if (!totalStateDurations[currentState]) {
                    totalStateDurations[currentState] = 0;
                }
                totalStateDurations[currentState] += intervalSeconds;

                const interval = intervalSeconds
                for (let j = arr.findIndex(el => el.time === stateStart); j <= index; j++) {
                    arr[j].interval = interval;
                }
            }
        });
        reports.allConditionTime = totalStateDurations
        return {

            datas: data, // Данные с интервалами по каждому состоянию
        };
    }

    convertation(reports, datas) {
        let currentState = null;
        reports.detalisation = []
        datas.forEach((e, index) => {
            if (e.condition !== currentState || index === 0) {
                currentState = e.condition
                reports.detalisation.push({ condition: currentState, interval: e.interval, time: e.time })
            }
            reports.detalisation[reports.detalisation.length - 1].interval = e.interval
        })
    }

    convertToHoursAndMinutes(value) {
        const hours = Math.floor(value / 3600)
        const lastSeconds = value % 3600
        const minutes = Math.floor(lastSeconds / 60)
        return { hours: hours, minutes: minutes };
    }

    prostoy(newdata) {
        // console.log(newdata)
        if (newdata.length === 0) {
            return undefined
        }
        else {
            const res = newdata.reduce((acc, e) => {
                if (e.engineOn === 1 && e.speed < 6 && e.sats >= 7) {
                    if (Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length > 0
                        && acc[acc.length - 1][0].engineOn === 1 && acc[acc.length - 1][0].speed < 6 && acc[acc.length - 1][0].sats >= 7) {
                        acc[acc.length - 1].push(e);
                    } else {
                        acc.push([e]);
                    }
                } else if (e.engineOn === 0 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0
                    || e.speed >= 6 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0
                    || e.sats > 7 && Array.isArray(acc[acc.length - 1]) && acc[acc.length - 1].length !== 0) {
                    acc.push([]);
                }

                return acc;
            }, []).filter(el => el.length > 0).reduce((acc, el) => {
                if (((el[el.length - 1].time.getTime()) / 1000) - ((el[0].time.getTime()) / 1000) > 1200) {
                    acc.push([[el[0].time, el[0].geo, el[0].oil], [el[el.length - 1].time, el[el.length - 1].geo, el[el.length - 1].oil]])
                }
                return acc
            }, [])
            return res
        }

    }

}


module.exports = {
    ConditionDetalisationClass
}