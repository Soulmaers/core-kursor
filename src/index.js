
/*Сервер core -связь с бд
маршруты обработки входящих данных
запуск прослушки протоколов по TCP

*/


const express = require('express')
const cors = require('cors')
const path = require('path');
const { createDbPool } = require('./services/db/db');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { authEdge } = require('./middlewares/authEdge');
const { makeConfigsRouter } = require('./routes/configs');
const { lastMessagesRouter } = require('./routes/lastmessages')
const { makeEvents } = require('./routes/events');
const { makeCharts } = require('./routes/charts')
const { makeReports } = require('./routes/reports')
const { ProtocolRegistry } = require('./protokols/registry')

const PORT = process.env.PORTCORE || 3338

const app = express()

app.use(cors())
app.use(express.json())



async function init() {
    // console.log()
    try {
        const db = await createDbPool();               // ← один пул на процесс
        const registry = new ProtocolRegistry({ db }); // ← передали вниз
        registry.init();
        app.use('/configs', authEdge, makeConfigsRouter({ db }));  //-роуты для работы с конфигом
        app.use('/telemetry', authEdge, lastMessagesRouter({ db }));  //-роуты для работы с конфигом
        app.use('/events', authEdge, makeEvents({ db }));  //-роуты для работы с событиями
        app.use('/charts', authEdge, makeCharts({ db }));  //-роуты для работы с данными для графиков
        app.use('/reports', authEdge, makeReports({ db }));  //-роуты для работы с отчетами и документами


        makeCharts
        lastMessagesRouter
        app.listen(PORT, () => console.log(`запущен сервер CORE на порту ${PORT}`));
    } catch (e) {
        console.error('Ошибка инициализации:', e);
    }
}

init()