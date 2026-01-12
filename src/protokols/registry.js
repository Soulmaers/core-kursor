



const { WialonApi } = require('./wialonApi');
const ListenPortIPS = require('./wialonIps');
const { Navtelecom } = require('./navtelecom');
const { connection } = require('../../../../servers/services/db');

const { ObjectRegistry } = require('../services/registry/object-registry');
const { RawWriter } = require('../services/writers/RawWriter');
const { NormWriter } = require('../services/writers/NormWriter');
const { EventWriter } = require('../services/writers/EventWriter');
const { ConfigService } = require('../services/config/ConfigService');
const { Normalizer } = require('../services/normalize/Normalizer');
const { EventEngine } = require('../services/events/EventEngine');
const { TelemetryPipeline } = require('../pipeline/TelemetryPipeline');
const CompilingStruktura = require('../modules/simulater/CompilingStruktura')


class ProtocolRegistry {
    constructor({ db }) {
        // общие сервисы один раз
        const rawWriter = new RawWriter({ db });
        const normWriter = new NormWriter({ db });
        const eventWriter = new EventWriter({ db });
        const configSvc = new ConfigService({ db });
        const normalizer = new Normalizer();
        const eventEngine = new EventEngine();
        this.objectRegistry = new ObjectRegistry({ db });
        const simulator = new CompilingStruktura({ db });
        this.pipeline = new TelemetryPipeline({
            rawWriter, configSvc, normalizer, normWriter, eventEngine, eventWriter, simulator
        })
    }

    init() {
        //  console.log(this.objectRegistry)
        //  new WialonApi()
        new ListenPortIPS(20332, { pipeline: this.pipeline, objectRegistry: this.objectRegistry });
        // new Navtelecom()
    }
}

module.exports = { ProtocolRegistry };
