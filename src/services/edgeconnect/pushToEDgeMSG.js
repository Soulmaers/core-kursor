// services/edgeconnect/pushToEdgeMSG.js
const axios = require('axios');

const EDGE_URL = 'http://127.0.0.1:3334/edge/push'; // внутренний HTTP EDGE
const EDGE_URL_CFG = 'http://127.0.0.1:3334/edge/cfg'; // внутренний HTTP EDGE
const EDGE_TOKEN = 'dev-edge-push';

async function pushTelemetry(point, cfg) {
    // Формируем компактный пакет (всё, что нужно фронту)
    const payload = {
        imei: String(point.imei),
        ts: Date.now(),
        data: {
            id_object: point.id_object ?? null,
            time_terminal: point.time ?? null,
            time_received: new Date().toISOString(),
            lat: point.lat ?? null,
            lon: point.lon ?? null,
            speed: point.speed ?? null,
            course: point.course ?? null,
            sats: point.sats ?? null,
            hdop: point.hdop ?? null,
            proto: point.proto || 'ips',
            port: point.port ?? 0,
            extras: point.extras ?? null,
        },
        config: cfg
    };
    await axios.post(EDGE_URL, payload, {
        headers: { 'x-edge-token': EDGE_TOKEN }
    });
}


async function pushConfig(id_object, cfg) {
    // на edge нфо что конфиг обновлен
    const payload = { id_object: id_object, config: cfg }
    await axios.post(EDGE_URL_CFG, payload, {
        headers: { 'x-edge-token': EDGE_TOKEN }
    });
}

module.exports = { pushTelemetry, pushConfig };
