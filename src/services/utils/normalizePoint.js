

function normalizePoint(point) {
    if (!point.extras) {
        point.extras = {};
        return point;
    }

    if (typeof point.extras === 'string') {
        try {
            point.extras = JSON.parse(point.extras);
        } catch (e) {
            console.warn('Bad extras JSON', e);
            point.extras = {};
        }
    }


    return point;
}


module.exports = { normalizePoint }