

/*
роут получения событий за интервал
*/
const express = require('express')

const get_events = require('../controllers/get_events_controller')


function makeEvents({ db }) {
    const router = express.Router();

    // GET /api/configs/:id_object/latest
    /* router.get('/:id_object/latest', )*/
    router.get('/:id_object/interval', get_events.get_events({ db }))



    return router;
}

module.exports = { makeEvents };