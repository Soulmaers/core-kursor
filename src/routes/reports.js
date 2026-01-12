

const express = require('express')

const get_report = require('../controllers/get_reports_controller')


function makeReports({ db }) {
    const router = express.Router();

    router.get('/pdf_report', get_report.get_report_pdf({ db }))


    return router;
}

module.exports = { makeReports };