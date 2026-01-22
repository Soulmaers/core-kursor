

/*
роуты  добавления конфига объекта в бд
получение телеметрии по последнему сообщению

*/
const express = require('express')

const config_controller = require('../controllers/config_controller')


function makeConfigsRouter({ db }) {
    const router = express.Router();

    // GET /api/configs/:id_object/latest
    /* router.get('/:id_object/latest', )*/
    router.post('/:id_object', config_controller.addConfig({ db }))
    router.get('/:id_object/latestCfg', config_controller.getLastConfig({ db }))


    return router;
}

module.exports = { makeConfigsRouter };
