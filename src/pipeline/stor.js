

// Уникальные ID типов техники (для внутреннего использования)
export const VEHICLE_TYPE_IDS = {
    SAMOSVAL: 1,
    BETONOMESHALKA: 2,
    BENZOVOZ: 3,
    FURA: 4,
    LEGKOVOY: 5,
    FURGON: 6,
    GAZEL: 7,
    MANIPULYATOR: 8,
    KRAN: 9,
    KATOK: 10,
    TRAKTOR: 11,
    EKSKAVATOR_POGRUZCHIK: 12,
    FRONTALNY_POGRUZCHIK: 13,
    EKSKAVATOR: 14,
    BULDOZER: 15,
    MIKSER: 16,
    DRUGOE: 17
};

// Человекочитаемые названия (для UI, логов)
export const VEHICLE_TYPE_NAMES = {
    [VEHICLE_TYPE_IDS.SAMOSVAL]: 'Самосвал',
    [VEHICLE_TYPE_IDS.BETONOMESHALKA]: 'Бетономешалка',
    [VEHICLE_TYPE_IDS.BENZOVOZ]: 'Бензовоз',
    [VEHICLE_TYPE_IDS.FURA]: 'Фура',
    [VEHICLE_TYPE_IDS.LEGKOVOY]: 'Легковой автомобиль',
    [VEHICLE_TYPE_IDS.FURGON]: 'Фургон',
    [VEHICLE_TYPE_IDS.GAZEL]: 'Газель',
    [VEHICLE_TYPE_IDS.MANIPULYATOR]: 'Манипулятор',
    [VEHICLE_TYPE_IDS.KRAN]: 'Кран',
    [VEHICLE_TYPE_IDS.KATOK]: 'Каток',
    [VEHICLE_TYPE_IDS.TRAKTOR]: 'Трактор',
    [VEHICLE_TYPE_IDS.EKSKAVATOR_POGRUZCHIK]: 'Экскаватор‑погрузчик',
    [VEHICLE_TYPE_IDS.FRONTALNY_POGRUZCHIK]: 'Фронтальный погрузчик',
    [VEHICLE_TYPE_IDS.EKSKAVATOR]: 'Экскаватор',
    [VEHICLE_TYPE_IDS.BULDOZER]: 'Бульдозер',
    [VEHICLE_TYPE_IDS.MIKSER]: 'Миксер',
    [VEHICLE_TYPE_IDS.DRUGOE]: 'Другое'
};

// Стандартные датчики (используются во всех типах техники)
const BASE_SENSORS = [
    { name: 'Скорость', type: 'speed', param: 'speed', from: 'speed', measur: 'км/ч' },
    { name: 'Курс', type: 'course', param: 'course', from: 'course', measur: null },
    { name: 'Широта', type: 'lat', param: 'lat', from: 'lat', measur: null },
    { name: 'Долгота', type: 'lon', param: 'lon', from: 'lon', measur: null },
    { name: 'Спутники', type: 'sats', param: 'sats', from: 'sats', measur: null },
    { name: 'Время терминала', type: 'time', param: 'time_terminal', from: 'time_terminal', measur: null },
];



const GLOBAL = {
    [VEHICLE_TYPE_IDS.SAMOSVAL]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.SAMOSVAL],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.BETONOMESHALKA]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.BETONOMESHALKA],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.BENZOVOZ]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.BENZOVOZ],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.FURA]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.FURA],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.LEGKOVOY]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.LEGKOVOY],
        events: {
            refill: { minV: 5, time: 600 },
            drain: { minV: 5, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.FURGON]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.FURGON],
        events: {
            refill: { minV: 10, time: 600 },
            drain: { minV: 10, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 126, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.GAZEL]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.GAZEL],
        events: {
            refill: { minV: 10, time: 600 },
            drain: { minV: 10, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 126, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.MANIPULYATOR]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.MANIPULYATOR],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.KRAN]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.KRAN],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.KATOK]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.KATOK],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.TRAKTOR]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.TRAKTOR],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.EKSKAVATOR_POGRUZCHIK]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.EKSKAVATOR_POGRUZCHIK],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.FRONTALNY_POGRUZCHIK]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.FRONTALNY_POGRUZCHIK],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.EKSKAVATOR]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.EKSKAVATOR],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.BULDOZER]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.BULDOZER],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.MIKSER]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.MIKSER],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    },
    [VEHICLE_TYPE_IDS.DRUGOE]: {
        type: VEHICLE_TYPE_NAMES[VEHICLE_TYPE_IDS.DRUGOE],
        events: {
            refill: { minV: 20, time: 600 },
            drain: { minV: 20, time: 600 },
            trips: { minD: 0, speed: 10, sats: 7, engine: 1 },
            parkings: { minD: 0, engine: 0 },
            idle: { minD: 1200, engine: 1, speed: 10 },
            stops: { engine: 1, speed: 10 },
            pressure: {},
            temp: {},
            speed: { maxS: 96, timeD: 30 },
            geo: {}
        },
        sensors: { base_sensors: BASE_SENSORS, custom_sensors: [] },
        ui: { sensors: ['speed', 'ignition', 'pwr', 'oil', 'engine'] }
    }
}





