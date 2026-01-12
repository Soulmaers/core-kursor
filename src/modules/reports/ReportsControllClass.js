
const { CalculateReports } = require('./Calculate')
const { ProstoyControll } = require('./ProstoyControllCalculater')
const { SCDSHClass } = require('./SKDSHClass')
//const { OilCalculator } = require('./OilControllCalculater')
//const { DrainCalculate } = require('./DrainControllCalculate')
const { ConditionDetalisationClass } = require('./ConditionDetalisationClass')
const { ToBaseMethods } = require('./ToBaseMethods')
const { ProcessDB } = require('../events/ProcessDB')


const { OilCalculator } = require('../events/OilCalculate')
const { DrainCalculate } = require('../events/DrainCalculate')
const { CalkuletaTrips } = require('../events/HistoryCalkulate')

const Runs = require('./Runs')
const Helpers = require('./Helpers')

const XLSX = require('xlsx');
class ReportsControllClass {
    constructor(object, setAttributes) {
        this.object = object
        this.idTemplates = String(this.object[0].idTemplates)
        this.interval = this.object[0].data
        this.setAttributes = setAttributes

    }



    async init({ db }) {
        this.instance_process = new ProcessDB({ db })
        this.date = CalculateReports.convertFormatTime(this.interval)
        this.attributes = await this.getAttributesTemplates({ db })
        const globalStruktura = Promise.all(this.object.map(async el => {
            const localCopyAttributes = JSON.parse(JSON.stringify(this.attributes))
            const [data, cfg] = await Promise.all([
                this.instance_process.get_telemetry(el.idObject, this.interval[0], this.interval[1]),
                this.instance_process.getLastConfig(el.idObject)
            ]);
            const config = JSON.parse(cfg[0].config_json)
            //   console.log(data)
            return this.startCalculate(el, localCopyAttributes, data, config, { db })
        }))
        return await globalStruktura
    }
    async startCalculate(object, localCopyAttributes, data, config, { db }) {
        const runsObject = Helpers.getDateIntervals(...this.interval)
        const { idObject, objectName, groupName, typeIndex } = object
        if (!data || data.length === 0) {
            localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Группа объектов') { e.result = groupName, e.local = '' } })
            localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Объект') { e.result = objectName, e.local = '', e.setAttributes = setAttributes } })
            localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Начало интервала') { e.result = CalculateReports.converterTimes(this.interval[0]), e.local = '' } })
            localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Конец интервала') { e.result = CalculateReports.converterTimes(this.interval[1]), e.local = '' } })
            localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Пробег') { e.result = 0, e.local = 'км' } })
            return localCopyAttributes
        }


        const motoChartsData = await ToBaseMethods.sumIdwToBase(this.date, idObject, { db })
        console.log(motoChartsData)
        let volume = 0//await databaseService.getTarirData(idObject, 'oil')
        //  volume = volume.length !== 0 ? Number(volume[volume.length - 1].litrazh) : 'Н/Д'
        const instanceRefill = new OilCalculator(data, config)
        const refill = await instanceRefill.init()
        console.log(refill)
        const instanceDrain = new DrainCalculate(data, config)
        const drain = await instanceDrain.init()
        console.log(drain)
        const startOil = data[0].dut ? (CalculateReports.startAndFinishOil(data))[0] : 'Н/Д'
        const zapravleno = refill ? refill[0] : 'Н/Д'
        const countZapravka = refill ? refill[1] : []
        const slito = drain ? drain[0] : 'Н/Д'
        const countSliv = drain ? drain[1] : []
        const finishOil = data[0].dut ? (CalculateReports.startAndFinishOil(data))[1] : 'Н/Д'
        const mileage = data[0].mileage ? Math.max(0, CalculateReports.calculationMileage(data).toFixed(2)) : 'Н/Д'






        const traveling = Helpers.calcSumm(CalculateReports.traveling(data, config), 'traveling')
        const parkings = Helpers.calcSumm(CalculateReports.parkings(data, config), 'parkings')
        const stops = Helpers.calcSumm(CalculateReports.stops(data, config), 'stops')


        const arrayGeo = CalculateReports.geoTreks(data, traveling)

        const moto = await CalculateReports.moto(data, setAttributes, idObject)
        this.instance = new ProstoyControll(data, typeIndex, setAttributes, idObject)
        const prostoy = Helpers.calcSumm(this.instance.init(), 'prostoy')

        this.instanceSKDSH = new SCDSHClass(object)
        const skdsh = await this.instanceSKDSH.init()
        const rashodDUT = data[0].dut ? Math.max(0, parseFloat((startOil + zapravleno - finishOil).toFixed(2))) : 'Н/Д'
        const rashodDUTKM = data[0].dut && mileage ? parseFloat(((rashodDUT / mileage) * 100).toFixed(2)) : 'Н/Д'
        const rashodDUTMCH = data[0].dut && moto.motoAll !== 0 ? parseFloat(((rashodDUT / moto.motoAll) * 3600).toFixed(2)) : 'Н/Д'

        const allOil = Helpers.calcSumm(countZapravka.concat(countSliv), 'oil')

        // console.log(traveling)
        const reversGeo = await Promise.all(allOil.map(async e => await Helpers.geocoding(e.geo)))
        const reversGeoTravelStart = await Promise.all(traveling.map(async e => await Helpers.geocoding(e[0].geo)))
        const reversGeoTravelFinish = await Promise.all(traveling.map(async e => await Helpers.geocoding(e[1].geo)))
        const reversGeoPark = await Promise.all(parkings.map(async e => await Helpers.geocoding(e.geo)))
        const reversGeoStop = await Promise.all(stops.map(async e => await Helpers.geocoding(e.geo)))
        // console.log(runsObject)
        const instanceRuns = new Runs(data, runsObject, setAttributes, idObject, traveling, parkings, stops, prostoy)
        const runs = await instanceRuns.init()

        const instanceCondition = new ConditionDetalisationClass(runsObject, data)
        const condition = instanceCondition.init()

        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Группа объектов') { e.result = groupName, e.local = '' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Объект') { e.result = objectName, e.local = '', e.setAttributes = setAttributes, e.geoTrek = arrayGeo } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Начало интервала') { e.result = CalculateReports.converterTimes(this.interval[0]), e.local = '' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Конец интервала') { e.result = CalculateReports.converterTimes(this.interval[1]), e.local = '' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Пробег') { e.result = mileage, e.local = 'км' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Потрачено по ДУТ') { e.result = rashodDUT, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Средний расход по ДУТ на 100км') { e.result = rashodDUTKM, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Средний расход по ДУТ в моточасах') { e.result = rashodDUTMCH, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Начальный уровень топлива') { e.result = startOil, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Конечный уровень топлива') { e.result = finishOil, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Объем топливного бака') { e.result = volume, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Моточасы') { e.result = CalculateReports.formatTime(moto.motoAll), e.local = 'ч' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Всего заправлено') { e.result = zapravleno, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Всего слито') { e.result = slito, e.local = 'л' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Количество заправок') { e.result = countZapravka.length, e.local = 'шт' } })
        localCopyAttributes.statistic['Статистика'].forEach(e => { if (e.name === 'Количество сливов') { e.result = countSliv.length, e.local = 'шт' } })

        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Начало') { e.width = '128px', e.result = moto.moto.map(e => CalculateReports.converterTimes(e[0].time)), e.local = '' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Начальное местоположение') { e.width = '400px', e.result = moto.moto.map(e => e[0].geo), e.local = '' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Конец') { e.width = '128px', e.result = moto.moto.map(e => CalculateReports.converterTimes(e[1].time)), e.local = '' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Конечное местоположение') { e.width = '400px', e.result = moto.moto.map(e => e[1].geo), e.local = '' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Моточасы') { e.width = '128px', e.result = moto.moto.map(e => CalculateReports.formatTime(e[2].moto)), e.local = 'ч' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Пробег') { e.width = '128px', e.result = moto.moto.map(e => e[2].distance), e.local = 'км' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Средние обороты двигателя') { e.result = moto.moto.map(e => e[2].mediumEngineRPM), e.local = 'об/мин' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Максимальные обороты двигателя') { e.result = moto.moto.map(e => e[2].maxEngineRPM), e.local = 'об/мин' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Потрачено по ДУТ') { e.width = '128px', e.result = moto.moto.map(e => e[2].rashodDUT), e.local = 'л' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Средний расход по ДУТ на 100 км') { e.width = '138px', e.result = moto.moto.map(e => e[2].rashodDUTKM), e.local = 'л' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Начальный уровень топлива') { e.width = '128px', e.result = moto.moto.map(e => e[0].oil), e.local = 'л' } })
        localCopyAttributes.component['Моточасы'].forEach(e => { if (e.name === 'Конечный уровень топлива') { e.width = '128px', e.result = moto.moto.map(e => e[1].oil), e.local = 'л' } })

        localCopyAttributes.component['Простои на холостом ходу'].forEach(e => {
            if (e.name === 'Начало') {
                e.fontWeight = 'bold', e.width = '128px', e.result = prostoy.map(e => {
                    const convertedTime = CalculateReports.converterTimes(e[0].time);
                    return convertedTime === '-' ? 'Итого' : convertedTime;
                }), e.local = ''
            }
        })
        localCopyAttributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Начальное местоположение') { e.fontWeight = 'bold', e.width = '400px', e.result = prostoy.map(e => e[0].geo), e.local = '' } })
        localCopyAttributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Конец') { e.fontWeight = 'bold', e.width = '128px', e.result = prostoy.map(e => CalculateReports.converterTimes(e[1].time)), e.local = '' } })
        localCopyAttributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Конечное местоположение') { e.fontWeight = 'bold', e.width = '400px', e.result = prostoy.map(e => e[1].geo), e.local = '' } })
        localCopyAttributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Моточасы') { e.fontWeight = 'bold', e.width = '128px', e.result = prostoy.map(e => CalculateReports.formatTime(e[2].moto)), e.local = 'ч' } })
        // this.attributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Потрачено по ДУТ') { e.result = prostoy.map(e => e[2].rashodDUT), e.local = 'л' } })
        // this.attributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Средний расход по ДУТ в моточасах') { e.result = prostoy.map(e => e[2].rashodDUTMCH), e.local = 'л' } })
        // this.attributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Начальный уровень топлива') { e.result = prostoy.map(e => e[0].oil), e.local = 'л' } })
        //  this.attributes.component['Простои на холостом ходу'].forEach(e => { if (e.name === 'Конечный уровень топлива') { e.result = prostoy.map(e => e[1].oil), e.local = 'л' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Дата') { e.result = runs.rows.map(e => e.date), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Километраж') { e.result = runs.rows.map(e => e.mileages), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Время в движении') { e.result = runs.rows.map(e => e.timeMove), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Потрачено по ДУТ') { e.result = runs.rows.map(e => e.rashod), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Средний расход л/100км') { e.result = runs.rows.map(e => e.medium), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Поездки (количество)') { e.result = runs.rows.map(e => e.countTraveling), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Стоянки (количество)') { e.result = runs.rows.map(e => e.countParkings), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Остановки (количество)') { e.result = runs.rows.map(e => e.countStops), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Простои на ХХ (количество)') { e.result = runs.rows.map(e => e.prostoy), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Кол-во нарушений (количество)') { e.result = runs.rows.map(e => e.alarm), e.local = '' } })
        localCopyAttributes.component['Пробеги']?.forEach(e => { if (e.name === 'Итоговая информация') { e.result = runs.summary, e.local = '', e.flag = true } })


        localCopyAttributes.component['Учёт топлива'].forEach(e => {
            if (e.name === 'Дата и время') {
                e.fontWeight = 'bold', e.width = '112px', e.result = allOil.map(e => {
                    const convertedTime = CalculateReports.converterTimes(e.time);
                    return convertedTime === '-' ? 'Итого' : convertedTime;
                }), e.local = ''
            }
        })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'Местоположение') { e.fontWeight = 'bold', e.width = '400px', e.textAlign = 'left', e.reversGeo = reversGeo, e.result = allOil.map(e => e.geo), e.colorMarker = allOil.map(e => e.value === 0 ? 'red' : 'green'), e.typeIcon = allOil.map(e => e.value === 0 ? 'fas fa-fill-drip' : 'fas fa-gas-pump'), e.geo = allOil.map(e => e.geo), e.local = '' } })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'Начальный уровень топлива') { e.fontWeight = 'bold', e.result = allOil.map(e => e.startOil), e.local = 'л' } })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'Конечный уровень топлива') { e.fontWeight = 'bold', e.result = allOil.map(e => e.finishOil), e.local = 'л' } })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'Всего заправлено') { e.fontWeight = 'bold', e.width = '112px', e.result = allOil.map(e => e.value), e.local = 'л' } })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'Всего слито') { e.fontWeight = 'bold', e.width = '80px', e.result = allOil.map(e => e.value2), e.local = 'л' } })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'Объём бака') { e.fontWeight = 'bold', e.width = '80px', e.result = allOil.map(e => volume), e.local = 'л' } })
        localCopyAttributes.component['Учёт топлива'].forEach(e => { if (e.name === 'До MAX уровня') { e.fontWeight = 'bold', e.width = '100px', e.result = allOil.map(e => e.finishOil !== '-' ? volume - e.finishOil : '-'), e.local = 'л', e.color = allOil.map(it => (volume - it.finishOil) < 0 ? '#F9966B' : null) } })

        localCopyAttributes.component['Поездки'].forEach(e => {
            if (e.name === 'Начало') {
                e.fontWeight = 'bold', e.width = '128px', e.result = traveling.map(e => {
                    const convertedTime = CalculateReports.converterTimes(e[0].time);
                    return convertedTime === '-' ? 'Итого' : convertedTime;
                }), e.local = ''
            }
        })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Начальное местоположение') { e.fontWeight = 'bold', e.width = '400px', e.textAlign = 'left', e.reversGeo = reversGeoTravelStart, e.result = traveling.map(e => e[0].geo), e.typeIcon = traveling.map(e => 'fas fa-map-marker-alt'), e.colorMarker = traveling.map(e => 'rgba(6, 28, 71, 1)'), e.geo = traveling.map(e => e[0].geo), e.local = '' } })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Конец') { e.fontWeight = 'bold', e.width = '128px', e.result = traveling.map(e => CalculateReports.converterTimes(e[1].time)), e.local = '' } })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Конечное местоположение') { e.fontWeight = 'bold', e.width = '400px', e.textAlign = 'left', e.reversGeo = reversGeoTravelFinish, e.result = traveling.map(e => e[1].geo), e.typeIcon = traveling.map(e => 'fas fa-map-marker-alt'), e.colorMarker = traveling.map(e => 'rgba(6, 28, 71, 1)'), e.geo = traveling.map(e => e[1].geo), e.local = '' } })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Длительность') { e.fontWeight = 'bold', e.width = '128px', e.result = traveling.map(e => CalculateReports.formatTime(e[2].time)), e.local = '' } })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Пробег') { e.fontWeight = 'bold', e.width = '128px', e.result = traveling.map(e => e[2].distance), e.local = 'км' } })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Средняя скорость') { e.fontWeight = 'bold', e.width = '142px', e.result = traveling.map(e => e[2].averageSpeed), e.local = 'км/ч' } })
        //localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Максимальная скорость') { e.result = traveling.map(e => e[2].maxSpeed), e.typeIcon = traveling.map(e => 'fas fa-map-marker-alt'), e.maxSpeedColorBack = traveling.map(e => e[2].maxSpeedFieldColor), e.colorMarker = traveling.map(e => 'darkred'), e.geo = traveling.map(e => e[2].geoSpeed), e.local = 'км/ч' } })
        localCopyAttributes.component['Поездки'].forEach(e => { if (e.name === 'Max, скорость') { e.fontWeight = 'bold', e.width = '142px', e.result = traveling.map(e => e[2].maxSpeed), e.interval = traveling.map(e => [e[0].time, e[1].time]), e.typeIcon = traveling.map(e => 'fas fa-map-marker-alt'), e.main = traveling.map(e => e[2].main), e.sub = traveling.map(e => e[2].sub), e.maxSpeedColorBack = traveling.map(e => e[2].maxSpeedFieldColor), e.colorMarker = traveling.map(e => 'darkred'), e.geo = traveling.map(e => e[2].geoSpeed), e.local = 'км/ч' } })

        localCopyAttributes.component['Стоянки'].forEach(e => {
            if (e.name === 'Начало') {
                e.fontWeight = 'bold', e.width = '128px', e.result = parkings.map(e => {
                    const convertedTime = CalculateReports.converterTimes(e.time);
                    return convertedTime === '-' ? 'Итого' : convertedTime;
                }), e.local = ''
            }
        })
        localCopyAttributes.component['Стоянки'].forEach(e => { if (e.name === 'Длительность') { e.fontWeight = 'bold', e.width = '128px', e.result = parkings.map(e => CalculateReports.formatTime(e.diff)), e.local = '' } })
        localCopyAttributes.component['Стоянки'].forEach(e => { if (e.name === 'Местоположение') { e.fontWeight = 'bold', e.width = '400px', e.textAlign = 'left', e.reversGeo = reversGeoPark, e.result = parkings.map(e => e.geo), e.geo = parkings.map(e => e.geo), e.typeIcon = parkings.map(e => 'fas fa-map-marker-alt'), e.colorMarker = parkings.map(e => 'rgba(6, 28, 71, 1)'), e.local = '' } })

        localCopyAttributes.component['Остановки'].forEach(e => {
            if (e.name === 'Начало') {
                e.fontWeight = 'bold', e.width = '128px', e.result = stops.map(e => {
                    const convertedTime = CalculateReports.converterTimes(e.time);
                    return convertedTime === '-' ? 'Итого' : convertedTime;
                }), e.local = ''
            }
        })
        localCopyAttributes.component['Остановки'].forEach(e => { if (e.name === 'Длительность') { e.fontWeight = 'bold', e.width = '128px', e.result = stops.map(e => CalculateReports.formatTime(e.diff)), e.local = '' } })
        localCopyAttributes.component['Остановки'].forEach(e => { if (e.name === 'Местоположение') { e.fontWeight = 'bold', e.width = '400px', e.textAlign = 'left', e.reversGeo = reversGeoStop, e.result = stops.map(e => e.geo), e.geo = stops.map(e => e.geo), e.typeIcon = stops.map(e => 'fas fa-map-marker-alt'), e.colorMarker = stops.map(e => 'rgba(6, 28, 71, 1)'), e.local = '' } })


        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Колесо') { e.result = skdsh.components.map(e => e.sensor), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Ожидание') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.intervals.potery.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Низкое') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.intervals.belowKnd.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Ниже нормы') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.intervals.betweenKndDnn.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Нормальное') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.intervals.betweenDnnDvn.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Выше нормы') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.intervals.betweenDvnKvd.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Высокое') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.intervals.aboveKvd.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Всего') { e.result = skdsh.components.map(e => CalculateReports.convertTime(e.intervals.all.totalTime)), e.local = '' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Минимальное давление в БАР') { e.result = skdsh.components.map(e => e.intervals.porogy[0]), e.local = 'Бар' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Максимальное давление в БАР') { e.result = skdsh.components.map(e => e.intervals.porogy[1]), e.local = 'Бар' } })
        localCopyAttributes.component['СКДШ'].forEach(e => { if (e.name === 'Среднее давление в БАР') { e.result = skdsh.components.map(e => e.intervals.porogy[2]), e.local = 'Бар' } })


        localCopyAttributes.graphic['Учёт топлива'].forEach(e => { if (e.name === 'Дата и время') { e.result = instanceRefill.dataOrigin.map(e => e.last_valid_time) } e.chartType = 'osX' })
        localCopyAttributes.graphic['Учёт топлива'].forEach(e => { if (e.name === 'Обработанные значения') { e.result = instanceRefill.data ? instanceRefill.data.map(e => e.oil) : [], e.color = 'blue', e.chartType = 'line' } })
        localCopyAttributes.graphic['Учёт топлива'].forEach(e => { if (e.name === 'Исходные значения') { e.result = instanceRefill.dataOrigin ? instanceRefill.dataOrigin.map(e => e.oil) : [], e.color = 'red', e.chartType = 'line' } })
        localCopyAttributes.graphic['Учёт топлива'].forEach(e => { if (e.name === 'Движение') { e.result = traveling, e.color = "rgb(183,170,14)", e.chartType = 'rect' } })
        localCopyAttributes.graphic['Учёт топлива'].forEach(e => { if (e.name === 'Работа двигателя') { e.result = moto.moto, e.color = "rgb(255,209,215)", e.chartType = 'rect' } })
        localCopyAttributes.graphic['Учёт топлива'].push({ name: 'Заправки', checked: true, result: countZapravka, icon: "../../../../image/ref.png", chartType: 'icon' })
        localCopyAttributes.graphic['Учёт топлива'].push({ name: 'Сливы', checked: true, result: countSliv, icon: "../../../../image/drain.png", chartType: 'icon' })


        localCopyAttributes.graphic['Поездки по дням'].forEach(e => { if (e.name === 'Пробег') { { e.result = runs.rows.map(e => e.mileages), e.local = '' } } })
        localCopyAttributes.graphic['Поездки по дням'].forEach(e => { if (e.name === 'Начало') { { e.result = runs.rows.map(e => e.date), e.local = '' } } })
        // localCopyAttributes.graphic['Поездки по дням'].unshift({ name: 'Подпись оси', checked: true, chartType: 'osX', result: motoChartsData.map(e => (e.data)), y: motoChartsData.map(e => Number(e.moto)) })



        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Колесо') { e.result = skdsh.components.map(e => e.sensor), e.y = ([this.interval[1] - this.interval[0]]), e.chartType = 'osX', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Ожидание') { e.result = skdsh.components.map(e => e.intervals.intervals.potery.totalTime), e.color = 'lightgray', e.chartType = 'rect', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Низкое') { e.result = skdsh.components.map(e => e.intervals.intervals.belowKnd.totalTime), e.color = '#e34040', e.chartType = 'rect', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Ниже нормы') { e.result = skdsh.components.map(e => e.intervals.intervals.betweenKndDnn.totalTime), e.color = '#e8eb65', e.chartType = 'rect', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Нормальное') { e.result = skdsh.components.map(e => e.intervals.intervals.betweenDnnDvn.totalTime), e.color = 'darkgreen', e.chartType = 'rect', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Выше нормы') { e.result = skdsh.components.map(e => e.intervals.intervals.betweenDvnKvd.totalTime), e.color = '#9e9913', e.chartType = 'rect', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Высокое') { e.result = skdsh.components.map(e => e.intervals.intervals.aboveKvd.totalTime), e.color = 'darkred', e.chartType = 'rect', e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Всего') { e.result = skdsh.components.map(e => e.intervals.all.totalTime), e.local = '' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Минимум') { e.result = skdsh.components.map(e => e.intervals.porogy[0]), e.local = 'Бар' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Максимум') { e.result = skdsh.components.map(e => e.intervals.porogy[1]), e.local = 'Бар' } })
        localCopyAttributes.graphic['СКДШ'].forEach(e => { if (e.name === 'Среднее') { e.result = skdsh.components.map(e => e.intervals.porogy[2]), e.local = 'Бар' } })


        localCopyAttributes.graphic['Моточасы'].forEach(e => { if (e.name === 'Двигатель заведён') { e.chartType = 'rect', e.color = "#3333FF", e.local = '', e.result = motoChartsData.map(e => Number(e.moto)) } })
        localCopyAttributes.graphic['Моточасы'].forEach(e => { if (e.name === 'Техника в работе') { e.chartType = 'rect', e.color = "#FF6633", e.local = '', e.result = motoChartsData.map(e => Number(e.moto) - Number(e.prostoy)) } })
        localCopyAttributes.graphic['Моточасы'].unshift({ condition: condition, name: 'Подпись оси', checked: true, chartType: 'osX', result: motoChartsData.map(e => (e.data)), y: motoChartsData.map(e => Number(e.moto)) })
        return localCopyAttributes

    }
    async getAttributesTemplates({ db }) {
        const result = await ToBaseMethods.getAttributeTemplaceToBase(this.idTemplates, { db })
        const res = JSON.parse(result[0].jsonAttributes)
        return res
    }

    async getSetAttributesTemplates(idObject, { db }) {
        const result = await ToBaseMethods.getSettingsToBase(idObject, { db })
        const res = JSON.parse(result[0].jsonsetAttribute)
        return res
    }
    async getDataGlobalStor(idObject) {
        const result = await this.instance_process.get_telemetry(idObject, String(this.interval[0]), String(this.interval[1]))
        result.sort((a, b) => {
            return new Date(a.time_terminal) - new Date(b.time_terminal);
        });
        return result
    }
}


module.exports = {
    ReportsControllClass
}