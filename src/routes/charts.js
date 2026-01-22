/*
основные роуты получения телеметрии для графиков

*/

const express = require('express')

const get_charts = require('../controllers/get_charts_controller')


function makeCharts({ db }) {
    const router = express.Router();

    router.get('/:id_object/interval', get_charts.get_mileage_telemetry({ db }))
    router.get('/:id_object/fuel', get_charts.get_fuel_telemetry({ db }))
    router.get('/:id_object/condition', get_charts.get_condition_telemetry({ db }))
    router.get('/:id_object/oilinfo', get_charts.get_oil_info_telemetry({ db }))
    router.get('/:id_object/skdsh', get_charts.get_skdsh_telemetry({ db }))

    return router;
}

module.exports = { makeCharts };