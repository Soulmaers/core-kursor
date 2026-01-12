const GetToBaseClass = require('./GetToBaseClass')

class MutationClass {
    constructor(setting, data, params, tyres, db, cfg) {
        //  console.log(setting, data, params, tyres)
        this.db = db
        this.setting = setting
        this.cfg = cfg
        this.params = params
        this.tyresModel = tyres.map(e => e.pressure)
        this.lastValidTime = params?.time_terminal
        this.low = [setting.low_min, setting.low_max]
        this.normal = [setting.norma_min, setting.norma_max]
        this.high = [setting.high_min, setting.high_max]
        this.diapazonsState = {
            low: this.low,
            normal: this.normal,
            high: this.high
        }
        this.UTCSecBAR = 0.00024306
        this.highPorog = 9.3
        this.lowPorog = 8.5
        this.timeDiff = Number(setting.time_parking) // время определеия парковки
        this.data = data // массив с данными
        this.defaultStateCube = this.diapazonsState.normal // стартовый диапазон для первого сообщения
        this.stateCube = setting.stateCube // состояние кубика
        this.prevStateCube = setting.prevStateCube // предыдущее состояние кубика
        this.stateTravel = setting.stateTravel // состояние объекта (рейс или парковка 1-рейс 0-парковка)
        this.timeParking = setting.timeParking // время рейса с выкл двигателем
        this.lastParkingTime = setting.lastParkingTime // предыдущее время сообщения
        this.flagMutation = setting.flagMutation === 'true'
        this.timeMsg = setting.timeMsg
        this.lastTimeMsg = setting.lastTimeMsg
        this.flagLowpressure = setting.flagLowpressure === 'true'
        this.indexTyres = {}
        this.swap = [8.6, 9.2]
        this.flagstartReys = setting.flagstartReys === 'true'
    }

    // === НОРМАЛИЗАЦИЯ БАЗОВОГО ЗНАЧЕНИЯ ДАВЛЕНИЯ ===
    normalizeBaseValue(raw) {
        if (raw === undefined || raw === null || raw === '') return null
        const num = Number(raw)
        if (Number.isNaN(num)) return null
        return num
    }

    async init() {
        this.processTemplate() // собираем стор состояний шагов и условий
        this.process()
        await GetToBaseClass.updateTemplateVariables(
            this.setting.id,
            this.stateCube,
            this.prevStateCube,
            this.stateTravel,
            this.timeParking,
            this.lastParkingTime,
            this.flagMutation,
            this.timeMsg,
            this.lastTimeMsg,
            this.flagLowpressure,
            this.flagstartReys,
            this.db
        )
    }

    process() {
        this.randomCube() // бросаем кубик и обновляем состояние кубика текущее и предыдущее
        this.iteration()
    }

    iteration() {
        // console.log('iteration')
        this.data.forEach((tyres, index) => {
            this.installStateMsg(tyres)    // обновляем состояние "мутировать/не мутировать" по времени
            this.installStateTravel(tyres, index) // определяем рейс/парковка

            if (!this.params && index === 0) {
                // первое сообщение для нового объекта
                this.mutationFirstMsg(tyres)
                this.params = { extras: {} }
                for (const key of this.tyresModel) {
                    this.params.extras[key] = tyres.extras[key]
                }
            } else {
                // все остальные сообщения
                this.mutation(tyres, index)
            }
        })
    }

    installStateMsg(msg) {
        const currentTime = msg.time
        if (this.timeMsg >= 60) { // this.timeDiff
            this.flagMutation = true
            this.timeMsg = 0
            this.lastTimeMsg = null
        } else {
            if (!this.lastTimeMsg) this.lastTimeMsg = currentTime
            else {
                this.timeMsg += currentTime - this.lastTimeMsg
                this.lastTimeMsg = currentTime
            }
            this.flagMutation = false
        }
    }

    mutation(tyres, index) {
        // console.log('mutation')
        const cfg = this.cfg.sensors.custom_sensors

        const param = cfg
            .filter(e => this.tyresModel.includes(e.from))
            .map(it => {
                const base = this.normalizeBaseValue(this.params?.extras?.[it.from])
                return { ...it, value: base }
            })

        param.forEach(item => {
            if (this.flagMutation) {
                this.randomCube()
            }
            const vector = this.stor[`${this.prevStateCube}${this.stateCube}`]
            this.celevoy = vector.celevoy
            this.step = this.randomStep(vector.arrayStep)

            tyres.cube = this.stateCube
            tyres.state = this.stateTravel === 1 ? 'рейс' : 'парковка'

            const mutationValue = this.getMutationValue(
                item,
                tyres,
                this.celevoy,
                this.step,
                index
            )

            tyres.extras[item.from] = mutationValue
        })
    }

    getMutationValue(tyresOld, tyres, celevoy, step, index) {
        // базовое значение перед мутацией
        let base

        if (index === 0 || this.data.length === 1) {
            // первое сообщение в пакете — база из params (tyresOld.value)
            base = this.normalizeBaseValue(tyresOld.value)
        } else {
            // сначала пробуем предыдущее мутированное значение
            const prevRaw = this.data[index - 1]?.extras?.[tyresOld.from]
            const prevNorm = this.normalizeBaseValue(prevRaw)

            if (prevNorm !== null) {
                base = prevNorm
            } else {
                // если его нет/битое — откатываемся к params
                base = this.normalizeBaseValue(tyresOld.value)
            }
        }

        // если ниоткуда не смогли взять корректную базу — считаем, что история сломалась
        // (например, из-за перезапуска/обрыва), и даём рандом по диапазону
        let value = base
        if (value === null) {
            value = this.randomPressureToDiapazon()
        }

        let mutationValue

        if (this.stateTravel === 1) {
            // объект в рейсе
            if (tyres.state === 'парковка') {
                // рейс, но состояние парковка (твоя логика)
                mutationValue =
                    value <= this.lowPorog
                        ? Math.random() * (this.swap[1] - this.swap[0]) + this.swap[0]
                        : value
            } else {
                // обычное движение
                if (this.flagMutation) {
                    if (value < celevoy) {
                        mutationValue =
                            value + step > celevoy ? value : value + step
                    } else if (value > celevoy) {
                        mutationValue =
                            value - step < celevoy ? value : value - step
                    } else {
                        mutationValue = value
                    }
                } else {
                    mutationValue = value
                }
            }
        } else {
            // объект в парковке — работаем через низкое динамическое давление
            mutationValue = this.lowDinalicalPressureParking(
                tyresOld,
                tyres,
                value,
                index
            )
        }

        // финальная защита от NaN — если по какой-то причине всё равно вылез, лечим рандомом
        if (Number.isNaN(mutationValue)) {
            mutationValue = this.randomPressureToDiapazon()
        }

        return parseFloat(Number(mutationValue).toFixed(1))
    }

    lowDinalicalPressureParking(tyresOld, tyres, value, index) {
        const timenow = tyres.time_terminal
        const rawTimeOld =
            index === 0 || this.data.length === 1
                ? this.lastValidTime
                : this.data[index - 1].time_terminal

        // защита от undefined/null, чтобы не плодить NaN
        const timeold =
            typeof rawTimeOld === 'number' && !Number.isNaN(rawTimeOld)
                ? rawTimeOld
                : timenow

        const step = this.UTCSecBAR * (timenow - timeold)

        let newValue
        if (this.indexTyres[tyresOld.param] && value > 9) {
            newValue = value - step < 9 ? 9 : value - step
        } else {
            newValue = value
        }
        return newValue
    }

    mutationFirstMsg(tyres) {
        for (let elem of this.tyresModel) {
            const randomValue = this.randomPressureToDiapazon()
            tyres.extras[elem] = randomValue
            tyres.cube = this.stateCube
            tyres.state = this.stateTravel === 1 ? 'рейс' : 'парковка'
        }
    }

    installStateTravel(msg, index) {
        const currentTime = Math.floor(new Date(msg.dates).getTime() / 1000)
        if (msg.stop === 0) {
            if (!this.lastParkingTime) {
                this.lastParkingTime = currentTime
            } else {
                this.timeParking += currentTime - this.lastParkingTime
                this.lastParkingTime = currentTime
            }
            if (this.timeParking >= 60) {
                this.stateTravel = 0
                this.flagLowpressure = false
                this.timeParking = 0
                this.lastParkingTime = null
                if (!this.flagLowpressure) {
                    const cfg = this.cfg.sensors.custom_sensors
                    const param = cfg
                        .filter(e => this.tyresModel.includes(e.from))
                        .map(it => {
                            const base = this.normalizeBaseValue(
                                this.params?.extras?.[it.from]
                            )
                            return { ...it, value: base }
                        })

                    param.forEach(item => {
                        if (item.value !== null) {
                            const prev = this.data[index - 1]?.extras?.[item.from]
                            const prevNorm = this.normalizeBaseValue(prev)
                            const value =
                                index === 0 || this.data.length === 1
                                    ? item.value
                                    : prevNorm !== null
                                        ? prevNorm
                                        : item.value
                            this.indexTyres[item.from] =
                                value >= this.highPorog
                        }
                    })
                    this.flagLowpressure = true
                }
            }
        } else {
            if (this.stateTravel === 0) {
                this.randomCube()
            }
            this.timeParking = 0
            this.lastParkingTime = null
            this.stateTravel = 1
        }
    }

    randomPressureToDiapazon() {
        const low = parseFloat(this.defaultStateCube[0])
        const high = parseFloat(this.defaultStateCube[1])
        const value = Math.random() * (high - low) + low
        const roundedNumber = parseFloat(value.toFixed(1))
        return roundedNumber
    }

    randomCube() {
        if (this.stateCube) {
            this.prevStateCube = this.stateCube
        }
        const keys = Object.keys(this.diapazonsState)
        const randomIndex = Math.floor(Math.random() * keys.length)
        this.stateCube = keys[randomIndex]
    }

    randomStep(array) {
        const step = Math.floor(Math.random() * array.length)
        return array[step]
    }

    processTemplate() {
        this.stor = {
            normallow: {
                celevoy: Number(this.diapazonsState.low[0]),
                arrayStep: [0.1, 0.2, 0.3]
            },
            normalnormal: { celevoy: 9, arrayStep: [0.1] },
            normalhigh: {
                celevoy: Number(this.diapazonsState.high[1]),
                arrayStep: [0.1, 0.2]
            },
            lowlow: {
                celevoy: Number(this.diapazonsState.low[0]),
                arrayStep: [0.1, 0.2, 0.3]
            },
            lownormal: { celevoy: 9, arrayStep: [0.1, 0.2] },
            lowhigh: {
                celevoy: Number(this.diapazonsState.high[1]),
                arrayStep: [0.1, 0.2]
            },
            highlow: {
                celevoy: Number(this.diapazonsState.low[0]),
                arrayStep: [0.1, 0.2, 0.3]
            },
            highnormal: {
                celevoy: 9,
                arrayStep: [0.1, 0.2, 0.3]
            },
            highhigh: {
                celevoy: Number(this.diapazonsState.high[1]),
                arrayStep: [0.1, 0.2]
            }
        }
    }
}

module.exports = MutationClass
