
const GetToBaseClass = require('./GetToBaseClass')
const MutationClass = require('./MutationClass')
const XLSX = require('xlsx')

class CompilingStruktura {
    constructor({ db }) {
        this.db = db
    }

    async init(data, idDonor, cfg) {
        this.data = data
        this.idDonor = idDonor
        this.config = cfg

        return await this.getData()

    }

    async getData() {

        this.settings = await GetToBaseClass.getSettingSimulation(this.idDonor, this.db)
        if (!this.settings) return null
        const promises = this.settings.map(async e => {
            try {
                const dataCopy = this.data.map(item => ({ ...item }))
                const tyres = await GetToBaseClass.getTyres(e.id_object, this.db)

                const parametrs = await GetToBaseClass.getLatMessages(e.id_object, this.db)

                if (!tyres || e.start === 0) return null

                const dopdata = await this.processFormStrukture(e, dataCopy, this.config)
                //  console.log(dopdata)
                const instance = new MutationClass(e, dopdata, parametrs, tyres, this.db, this.config)
                await instance.init()

                return { data: dopdata, idObject: e.id_object }
            }
            catch (e) {
                console.log(e)
            }
        })
        const result = await Promise.all(promises)
        // result[0].data.foreAch(el => this.exportToExcel(el))
        return result

    }


    exportToExcel(data) {
        // Создаем новую рабочую книгу
        const wb = XLSX.utils.book_new();

        // Преобразуем массив в формат, подходящий для Excel
        const worksheetData = data.map(e => ({
            State: e.state,
            Cube: e.cube,
            Value: e.extras,
            Dates: new Date(e.time_terminal)
        }));

        // Создаем рабочий лист
        const ws = XLSX.utils.json_to_sheet(worksheetData);

        // Добавляем лист в книгу
        XLSX.utils.book_append_sheet(wb, ws, 'Данные');

        // Генерируем файл и скачиваем его
        XLSX.writeFile(wb, 'data.xlsx');
    }

    dateConvert() {
        const allEqual = this.time.every(val => val === this.time[0]);
        if (allEqual) {
            const [time1, time2] = this.time

            const formattedDateTime1 = `${time1.split('.')[2]}-${time1.split('.')[1]}-${time1.split('.')[0]}`
            const formattedDateTime2 = `${time2.split('.')[2]}-${time2.split('.')[1]}-${time2.split('.')[0]}`
            const timeStart = Math.floor(new Date(formattedDateTime1).getTime() / 1000)
            const timeFinish = Math.floor(new Date(formattedDateTime2).getTime() / 1000)
            this.time = [timeStart - 10800, timeFinish + 86399 - 10800]
        }
        else {
            this.time = this.time.map(e => {
                const formattedDate = `${e.split('.')[2]}-${e.split('.')[1]}-${e.split('.')[0]}`
                const unix = Math.floor(new Date(formattedDate).getTime() / 1000)
                return unix
            })
            this.time = [this.time[0] - 10800, this.time[1] + 86399 - 10800]
        }
    }


    async processFormStrukture(e, dataCopy, cfg) {

        const porog = cfg.events.engine.pwr
        //    console.log(porog)
        dataCopy.sort((a, b) => Number(a.time_terminal) - Number(b.time_terminal));
        const processedData = dataCopy.map(elem => {
            return {
                ...elem,
                stop: elem.extras.pwr >= porog ? 1 : 0,
                port: 1,
                id_object: e.id_object,
                imei: e.imei_object
            }

        });
        return processedData

    }
}





module.exports = CompilingStruktura