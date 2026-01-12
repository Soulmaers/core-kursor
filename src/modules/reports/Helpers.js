

const axios = require('axios')

class Helpers {


    static getDateIntervals(startUnix, endUnix) {
        const intervals = [];

        const startDate = new Date(startUnix * 1000);
        const endDate = new Date(endUnix * 1000);

        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endOfDay = new Date(startDay.getTime() + (24 * 60 * 60 * 1000) - 1);

        const endOfDayUnix = Math.floor(endOfDay.getTime() / 1000);

        if (startDay.getTime() <= endDate.getTime()) {

            const day = startDate.getDate().toString().padStart(2, '0'); // Добавляем ведущий ноль, если нужно
            const month = (startDate.getMonth() + 1).toString().padStart(2, '0'); // Месяцы начинаются с 0
            const year = startDate.getFullYear();

            intervals.push({
                date: `${day}.${month}.${year}`, // Формат 01.02.2025
                startUnix: startUnix,
                endUnix: Math.min(endUnix, endOfDayUnix)
            });

            if (endDate.getTime() > endOfDay.getTime()) {
                const nextDayStart = endOfDayUnix + 1;
                intervals.push(...Helpers.getDateIntervals(nextDayStart, endUnix));
            }
        }

        return intervals;
    }


    static formatHMS(unix) {
        const hours = Math.floor(unix / 3600);           // 1 час = 3600 секунд
        const minutes = Math.floor((unix % 3600) / 60);   // Остаток от часов / 60
        const seconds = unix % 60;
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');
        const formattedDate = `${hours}:${formattedMinutes}:${formattedSeconds}`;
        return formattedDate;
    }



    static processArrayRow(currentInterval, times) {
        const timeExcess = times ? times : 0
        const maxSpeed = currentInterval.reduce((max, current) => {
            return Math.max(max, Number(current.speed));
        }, 0);
        const totalSpeed = currentInterval.reduce((sum, current) => {
            return sum + Number(current.speed);
        }, 0);

        const averageSpeed = totalSpeed / currentInterval.length;
        const objectMaxSpeed = currentInterval.find(e => Number(e.speed) === maxSpeed)
        const distance = Number(currentInterval[currentInterval.length - 1].mileage) - Number(currentInterval[0].mileage)
        const time = Number(currentInterval[currentInterval.length - 1].last_valid_time) - Number(currentInterval[0].last_valid_time)
        if (time < timeExcess) return null
        const row = [{ time: currentInterval[0].last_valid_time, oil: currentInterval[0].oil, geo: [currentInterval[0].lat, currentInterval[0].lon] },
        { time: currentInterval[currentInterval.length - 1].last_valid_time, oil: currentInterval[currentInterval.length - 1].oil, geo: [currentInterval[currentInterval.length - 1].lat, currentInterval[currentInterval.length - 1].lon] }, {
            maxSpeed: maxSpeed, geoSpeed: [objectMaxSpeed.lat, objectMaxSpeed.lon], maxSpeedFieldColor: '', averageSpeed: parseFloat(averageSpeed.toFixed(0)), distance: parseFloat(distance.toFixed(2)), time: time, sub: true
        }]
        return row
    }

    static async geocoding(geo) {

        const apiKey = '9614b4770a4f42de900e70207075c2b8'
        try {
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${Number(geo[0])},${Number(geo[1])}&key=${apiKey}&language=ru`;
            const response = await axios.get(url);
            // console.log(response.data.results[0].components)
            const { city = '', road = '', house_number = '' } = response.data.results[0].components;
            const fullAddress = [city, road, house_number].filter(Boolean).join(', ');

            if (!city && !road && !house_number) {
                return '-'; // Если ни одно свойство не задано, возвращаем пустую строку
            }

            return fullAddress || '-'
        }

        catch (error) {
            //   console.error('Ошибка при запросе:', error);
            return ''
        }
    }

    static calcSumm(data, pref) {

        if (data.length === 0) return data
        switch (pref) {
            case 'traveling':
                const distance = data.reduce((acc, e) => {
                    //  console.log(e)
                    if (!e[2].sub) acc += e[2].distance
                    return acc
                }, 0)
                const time = data.reduce((acc, e) => {
                    if (!e[2].sub) acc += e[2].time
                    return acc
                }, 0)

                const maxSpeed = Math.max(...data.map(e => e[2].maxSpeed));
                const averageSpeedValueArray = data.reduce((acc, e) => {
                    if (!e[2].sub) {
                        // console.log(acc)
                        return acc + (e[2]?.averageSpeed || 0);
                    }
                    return acc;
                }, 0)
                const averageSpeedValue = averageSpeedValueArray / data.filter(e => !e[2].sub).length

                data.push([{
                    time: null,
                    oil: '-',
                    geo: '-'//['-', '-']
                },
                {
                    time: null,
                    oil: '-',
                    geo: '-'//['-', '-']
                }, {
                    maxSpeed: maxSpeed,
                    geoSpeed: '-',//['-', '-']
                    maxSpeedFieldColor: '',
                    averageSpeed: averageSpeedValue.toFixed(0),
                    distance: distance.toFixed(2),
                    time: time,
                    main: 0
                }])
                break;
            case 'parkings':
            case 'stops':
                const diffSumm = data.reduce((acc, e) => {
                    acc += e.diff
                    return acc
                }, 0)
                data.push({ time: null, geo: '-', diff: diffSumm })
                break;
            case 'prostoy':
                const MotoSumm = data.reduce((acc, e) => {
                    acc += e[2].moto
                    return acc
                }, 0)
                data.push([{
                    time: null,
                    oil: '-',
                    geo: '-'//['-', '-']
                },
                {
                    time: null,
                    oil: '-',
                    geo: '-'//['-', '-']
                }, {
                    moto: MotoSumm,
                    rashodDUT: '-',//['-', '-']
                    rashodDUTMCH: '-',
                    time: '-'

                }])
                break;
            case 'oil':
                //  console.log(allOil)
                const allzapravleno = data.reduce((acc, e) => {
                    acc += e.value
                    return acc
                }, 0)
                const allslito = data.reduce((acc, e) => {
                    acc += e.value2
                    return acc
                }, 0)

                data.push({
                    value: allzapravleno,
                    value2: allslito,
                    time: null,
                    geo: '-',
                    startOil: '-',
                    finishOil: '-'
                })
                break;
        }

        return data
    }
}


module.exports = Helpers