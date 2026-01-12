


const express = require('express')

const last_messages_controller = require('../controllers/last_messages_controller')
const get_telemetry = require('../controllers/get_telemetry_controller')

function lastMessagesRouter({ db }) {
    const router = express.Router();
    //    console.log('фанк')
    // GET /api/configs/:id_object/latest
    /* router.get('/:id_object/latest', )*/
    router.get('/:id_object/latest', last_messages_controller.getLatMessages({ db }))
    router.get('/:id_object/interval', get_telemetry.get_telemetry({ db }))

    return router;
}

module.exports = { lastMessagesRouter };
