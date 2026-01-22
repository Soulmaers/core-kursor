// calc/CalkuletaTrips.js


/*
класс расчета событий поездок

*/


class CalkuletaTrips {
    constructor(config) {

        this.cfg = {
            PWRP: config.events.engine.pwr,
            SPEED_THR: config.events.trips.speed,        // порог скорости для move/stop
            MIN_SATS: config.events.trips.sats,          // минимум спутников
            keepZeroParking: false,

            // дебаунс on/off (поездка↔парковка) и move/stop
            TRIP_SWITCH_SAMPLES: 2,
            SEG_SWITCH_SAMPLES: 2,

            // простой (idle)
            IDLE_MIN_SEC: config.events.idle.minD,    // >= 10 минут нулевой скорости => idle
            ZERO_ON_THR: 0,       // считаем "ноль", когда speed <= ZERO_ON_THR
            ZERO_OFF_THR: 0.5,    // выходим из "нуля", когда speed >= ZERO_OFF_THR
            IDLE_GAP_SEC: 30,     // допускаем краткие разрывы "нуля" до N сек (idle не рвём)

            // мостики/склейка (для первичного таймлайна trip/parking)
            MERGE_GAP_SEC: 5,
        };
        Object.assign(this.cfg);
        this._reset();
    }

    _reset() {
        this.result = { trips: [], parkings: [], idles: [] };
        this.trip = null;       // текущая поездка
        this.seg = null;        // текущий сегмент: move | stop | idle
        this.parking = null;    // текущая парковка

        this.prevPt = null;       // последняя точка (в т.ч. с плохими sats)
        this.lastGoodPt = null;   // последняя точка с нормальными satsengine: 1, speed: 10

        // дебаунс on/off
        this.effOn = undefined;
        this.onStreak = 0;
        this.offStreak = 0;

        // дебаунс move/stop (idle отдельно)
        this.effSegType = null; // 'move' | 'stop'
        this.moveStreak = 0;
        this.stopStreak = 0;

        // трекинг «нуля» для idle
        this.zeroStartPt = null;        // начало текущей серии "нуля"
        this.zeroBreakStartTime = null; // старт возможного "ненуля" внутри серии
        this.inIdle = false;            // ведём ли сейчас idle-сегмент
    }

    _N(v) { return v == null ? null : Number(v); }

    _msgOf(p) {
        return {
            time: this._N(p.time_terminal),
            lat: this._N(p.lat),
            lon: this._N(p.lon),
            speed: this._N(p.speed),
            oil: p.extras.oil,
            mileage: this._N(p.extras.mileage),
        };
    }

    _goodSats(pt) { return (this._N(pt.sats) ?? 0) >= this.cfg.MIN_SATS; }

    _startTrip(pt) {
        const sp = this._N(pt.speed) ?? 0;
        this.trip = {
            start: this._N(pt.time_terminal),
            end: this._N(pt.time_terminal),
            startGeo: [this._N(pt.lat), this._N(pt.lon)],
            endGeo: [this._N(pt.lat), this._N(pt.lon)],
            segments: [],
            messages: [],
            movingTime: 0,
            distance: 0,
            lastMileage: this._N(pt.extras.mileage),

            maxSpeed: sp,
            maxSpeedTime: this._N(pt.time_terminal),
            maxSpeedGeo: [this._N(pt.lat), this._N(pt.lon)],
        };
    }

    _startSeg(type, pt) {
        this.seg = { type, startPt: pt, endPt: pt, distance: 0 };
        if (type === 'move') {
            const sp = this._N(pt.speed) ?? 0;
            this.seg.messages = [this._msgOf(pt)];
            this.seg.maxSpeed = sp;
            this.seg.maxSpeedTime = this._N(pt.time_terminal);
            this.seg.maxSpeedGeo = [this._N(pt.lat), this._N(pt.lon)];
        }
    }

    // склейка/мостик внутри trip.segments (включая idle)
    _mergeOrPushTripSeg(startObj, endObj, meta) {
        const segs = this.trip.segments;
        const last = segs[segs.length - 1];

        if (last) {
            const lastEnd = last[1]?.time;
            if (lastEnd != null) {
                const gap = startObj.time - lastEnd;
                if (gap > 0 && gap <= (this.cfg.MERGE_GAP_SEC ?? 0)) {
                    startObj = { ...startObj, time: lastEnd };
                } else if (gap < 0) {
                    startObj = { ...startObj, time: lastEnd };
                }
            }
        }

        const canMerge =
            !!last &&
            (last[2]?.type === meta.type) &&
            (last[1]?.time === startObj.time);

        if (canMerge) {
            last[1] = endObj;
            last[2].time += meta.time;

            if (meta.type === 'move') {
                last[2].distance = +Number((last[2].distance || 0) + (meta.distance || 0)).toFixed(2);
                last[2].messages = (last[2].messages || []).concat(meta.messages || []);
                if ((meta.maxSpeed ?? -Infinity) > (last[2].maxSpeed ?? -Infinity)) {
                    last[2].maxSpeed = meta.maxSpeed;
                    last[2].maxSpeedTime = meta.maxSpeedTime;
                    last[2].maxSpeedGeo = meta.maxSpeedGeo;
                }
            }
        } else {
            segs.push([startObj, endObj, meta]);
        }
    }

    // верхний уровень для idle: тоже мержим/мостим (НЕ влияет на trip)
    _mergeOrPushTopIdle(startObj, endObj) {
        const arr = this.result.idles;
        const last = arr[arr.length - 1];

        if (last) {
            const lastEnd = last[1]?.time;
            if (lastEnd != null) {
                const gap = startObj.time - lastEnd;
                if (gap > 0 && gap <= (this.cfg.MERGE_GAP_SEC ?? 0)) {
                    startObj = { ...startObj, time: lastEnd };
                } else if (gap < 0) {
                    startObj = { ...startObj, time: lastEnd };
                }
            }
        }

        const canMerge = !!last && (last[1]?.time === startObj.time);
        if (canMerge) {
            last[1] = endObj;
            last[2].time += (endObj.time - startObj.time);
        } else {
            arr.push([startObj, endObj, { type: 'idle', time: (endObj.time - startObj.time) }]);
        }
    }

    _flushSeg() {
        if (!this.seg || !this.trip) return;

        const N = this._N.bind(this);
        const s = this.seg.startPt, e = this.seg.endPt;
        let tStart = (N(s.time_terminal) || 0);
        let tEnd = (N(e.time_terminal) || 0);
        if (tEnd < tStart) tEnd = tStart;

        const timeSec = tEnd - tStart;
        if (timeSec <= 0) { this.seg = null; return; }

        // конец поездки = конец ПОСЛЕДНЕГО сегмента (включая idle)
        this.trip.end = tEnd;
        this.trip.endGeo = [N(e.lat), N(e.lon)];
        let startObj = { time: tStart, oil: s.extras.oil, geo: [N(s.lat), N(s.lon)] };
        let endObj = { time: tEnd, oil: e.extras.oil, geo: [N(e.lat), N(e.lon)] };

        let meta;
        if (this.seg.type === 'move') {
            this.trip.movingTime += timeSec;
            meta = {
                type: 'move',
                time: timeSec,
                distance: +Number(this.seg.distance).toFixed(2),
                messages: this.seg.messages || [],
                maxSpeed: this.seg.maxSpeed ?? 0,
                maxSpeedTime: this.seg.maxSpeedTime ?? tStart,
                maxSpeedGeo: this.seg.maxSpeedGeo ?? startObj.geo,
            };
        } else if (this.seg.type === 'idle') {
            meta = { type: 'idle', time: timeSec };
        } else {
            meta = { type: 'stop', time: timeSec };
        }

        // в поездку пишем ВСЁ, включая idle
        this._mergeOrPushTripSeg(startObj, endObj, meta);

        // idle параллельно дублируем наверх (для оверлеев/отчётов)
        if (meta.type === 'idle') {
            this._mergeOrPushTopIdle(startObj, endObj);
        }

        this.seg = null;
    }

    _flushTrip() {
        if (!this.trip) return;
        const header = {
            type: 'trip',
            start_ts: this.trip.start,
            end_ts: this.trip.end,   // конец поездки = конец последнего сегмента
            startGeo: this.trip.startGeo,
            endGeo: this.trip.endGeo,
            time: (this.trip.end || 0) - (this.trip.start || 0),
            movingTime: this.trip.movingTime,
            distance: +Number(this.trip.distance).toFixed(2),
            messages: this.trip.messages,
            maxSpeed: this.trip.maxSpeed ?? 0,
            maxSpeedTime: this.trip.maxSpeedTime ?? this.trip.start,
            maxSpeedGeo: this.trip.maxSpeedGeo ?? this.trip.startGeo,
        };
        this.result.trips.push([header, this.trip.segments]);
        this.trip = null;
    }

    _startParking(pt) { this.parking = { startPt: pt, endPt: pt }; }

    _flushParking() {

        if (!this.parking) return;
        const N = this._N.bind(this);
        const s = this.parking.startPt, e = this.parking.endPt;
        let tStart = (N(s.time_terminal) || 0);
        let tEnd = (N(e.time_terminal) || 0);
        if (tEnd < tStart) tEnd = tStart;

        const duration = tEnd - tStart;
        if (duration <= 0 && !this.cfg.keepZeroParking) { this.parking = null; return; }
        const startObj = { time: tStart, oil: s.extras.oil, geo: [N(s.lat), N(s.lon)] };
        const endObj = { time: tEnd, oil: e.extras.oil, geo: [N(e.lat), N(e.lon)] };
        this.result.parkings.push([startObj, endObj, { type: 'parking', time: duration }]);
        this.parking = null;
    }

    // debounced on/off + move/stop (idle детектим отдельно)
    _withDebounceStates(pt) {
        const rawOn = pt.engineOn === 1;
        const moving = rawOn && (pt.speed != null ? pt.speed > this.cfg.SPEED_THR : false);
        const stopping = rawOn && (pt.speed != null ? pt.speed <= this.cfg.SPEED_THR : true);

        // on/off
        if (this.effOn === undefined) {
            this.effOn = rawOn;
            this.onStreak = this.offStreak = 0;
        }
        if (rawOn !== this.effOn) {
            if (rawOn) { this.onStreak++; this.offStreak = 0; }
            else { this.offStreak++; this.onStreak = 0; }
            const need = this.cfg.TRIP_SWITCH_SAMPLES;
            if ((rawOn && this.onStreak >= need) || (!rawOn && this.offStreak >= need)) {
                this.effOn = rawOn;
                this.onStreak = this.offStreak = 0;
                this.effSegType = null;
                this.moveStreak = this.stopStreak = 0;
            }
        } else {
            this.onStreak = this.offStreak = 0;
        }

        if (!this.effOn) {
            return { effOn: false, effMoving: false, effStopping: false, effParking: true };
        }

        // move/stop
        const rawSegType = moving ? 'move' : 'stop';
        if (!this.effSegType) {
            this.effSegType = rawSegType;
            this.moveStreak = this.stopStreak = 0;
        } else if (rawSegType !== this.effSegType) {
            if (rawSegType === 'move') { this.moveStreak++; this.stopStreak = 0; }
            else { this.stopStreak++; this.moveStreak = 0; }
            const need = this.cfg.SEG_SWITCH_SAMPLES;
            if ((rawSegType === 'move' && this.moveStreak >= need) ||
                (rawSegType === 'stop' && this.stopStreak >= need)) {
                this.effSegType = rawSegType;
                this.moveStreak = this.stopStreak = 0;
            }
        } else {
            this.moveStreak = this.stopStreak = 0;
        }

        return {
            effOn: true,
            effMoving: this.effSegType === 'move',
            effStopping: this.effSegType === 'stop',
            effParking: false,
        };
    }

    // ведение idle с гистерезисом и допуском
    _updateIdleState(pt) {
        const N = this._N.bind(this);
        const t = N(pt.time_terminal) || 0;
        const speed = N(pt.speed);

        const isZeroNow = (speed != null && speed <= (this.cfg.ZERO_ON_THR ?? 0));
        const isNonZeroNow = (speed != null && speed >= (this.cfg.ZERO_OFF_THR ?? 0.5));

        if (isZeroNow) {
            // продолжаем / начинаем серию нуля
            if (!this.zeroStartPt) this.zeroStartPt = pt;
            this.zeroBreakStartTime = null;

            // если порог длительности пройден — стартуем idle (если ещё не в idle)
            const dur = t - (N(this.zeroStartPt.last_valid_time) || t);
            if (dur >= (this.cfg.IDLE_MIN_SEC || 600) && !this.inIdle) {
                if (this.seg) {
                    // разрезаем текущий seg ровно в zeroStart
                    this.seg.endPt = this.zeroStartPt;
                    this._flushSeg();
                }
                this._startSeg('idle', this.zeroStartPt);
                this.inIdle = true;
            }

            // если уже в idle — обновляем конец
            if (this.inIdle && this.seg && this.seg.type === 'idle') {
                this.seg.endPt = pt;
            }
        } else if (isNonZeroNow) {
            // возможный короткий разрыв «нуля»
            if (this.zeroStartPt) {
                if (this.zeroBreakStartTime == null) {
                    this.zeroBreakStartTime = t;
                }
                const gap = t - this.zeroBreakStartTime;

                if (gap > (this.cfg.IDLE_GAP_SEC ?? 0)) {
                    // разрыв значимый — серия нуля закончилась на последней хорошей точке
                    const zeroEndPt = this.lastGoodPt || pt;
                    const zeroStartTime = N(this.zeroStartPt.last_valid_time) || t;
                    const zeroEndTime = N(zeroEndPt.last_valid_time) || t;
                    const zeroDur = Math.max(0, zeroEndTime - zeroStartTime);

                    if (this.inIdle) {
                        // закрываем текущий idle на zeroEnd
                        if (this.seg && this.seg.type === 'idle') {
                            this.seg.endPt = zeroEndPt;
                            this._flushSeg(); // запишет и в trip.segments, и в top-level idles
                        }
                        this.inIdle = false;
                    } else if (zeroDur >= (this.cfg.IDLE_MIN_SEC || 600)) {
                        // порог достигнут, но idle ещё не стартовали => оформить всю серию как idle
                        if (this.seg) {
                            this.seg.endPt = this.zeroStartPt;
                            this._flushSeg();
                        }
                        this._startSeg('idle', this.zeroStartPt);
                        this.seg.endPt = zeroEndPt;
                        this._flushSeg();
                    }

                    // сброс серии нуля
                    this.zeroStartPt = null;
                    this.zeroBreakStartTime = null;
                } else {
                    // короткий разрыв — idle не закрываем
                    if (this.inIdle && this.seg && this.seg.type === 'idle') {
                        this.seg.endPt = this.lastGoodPt || this.seg.endPt;
                    }
                }
            }
        }
    }

    _processPoint(raw) {
        const N = this._N.bind(this);
        const pt = {
            ...raw,
            time_terminal: N(raw.time_terminal),
            lat: N(raw.lat), lon: N(raw.lon),
            speed: N(raw.speed),
            engineOn: N(this.normaliseEngine(raw.extras.pwr)),
            mileage: N(raw.extras.mileage), sats: N(raw.sats),
        };
        const okSats = this._goodSats(pt);

        // плохие спутники — не рвём сегменты, просто пропускаем точку
        if (!okSats) { this.prevPt = pt; return; }

        this.lastGoodPt = pt;

        const { effOn, effMoving, effStopping, effParking } = this._withDebounceStates(pt);

        // idle ведём только при включённом двигателе
        if (effOn) this._updateIdleState(pt);

        if (effOn && (effMoving || effStopping)) {

            // закрыть парковку, запустить поездку
            if (this.parking) this._flushParking();
            if (!this.trip) this._startTrip(pt);

            // обновить хвост поездки и накопить сообщение
            this.trip.end = pt.time_terminal;
            this.trip.endGeo = [pt.lat, pt.lon];
            this.trip.messages.push(this._msgOf(pt));

            // max speed по поездке
            const curSp = this._N(pt.speed) ?? 0;
            if (curSp > (this.trip.maxSpeed ?? -Infinity)) {
                this.trip.maxSpeed = curSp;
                this.trip.maxSpeedTime = this._N(pt.time_terminal);
                this.trip.maxSpeedGeo = [this._N(pt.lat), this._N(pt.lon)];
            }

            // пробег по mileage
            if (pt.mileage != null && this.trip.lastMileage != null) {
                const d = pt.mileage - this.trip.lastMileage;
                if (isFinite(d) && d > 0) this.trip.distance += d;
            }
            this.trip.lastMileage = (pt.mileage != null ? pt.mileage : this.trip.lastMileage);

            // если сейчас тянем idle — move/stop не трогаем
            if (!this.inIdle) {
                const segType = effMoving ? 'move' : 'stop';
                if (!this.seg || this.seg.type !== segType) {
                    this._flushSeg();
                    this._startSeg(segType, pt);
                } else {
                    this.seg.endPt = pt;

                    if (this.seg.type === 'move') {
                        this.seg.messages.push(this._msgOf(pt));
                        if (curSp > (this.seg.maxSpeed ?? -Infinity)) {
                            this.seg.maxSpeed = curSp;
                            this.seg.maxSpeedTime = this._N(pt.time_terminal);
                            this.seg.maxSpeedGeo = [this._N(pt.lat), this._N(pt.lon)];
                        }
                        if (this.prevPt && pt.mileage != null && this.prevPt.mileage != null) {
                            const d = pt.mileage - this.prevPt.mileage;
                            if (isFinite(d) && d > 0) this.seg.distance += d;
                        }
                    }
                }
            }

        } else if (effParking) {
            // перед парковкой — аккуратно закрыть хвост возможного idle
            if (this.zeroStartPt) {
                const zeroEndPt = this.lastGoodPt || this.prevPt || pt;
                const startT = this._N(this.zeroStartPt.time_terminal) || 0;
                const endT = this._N(zeroEndPt.time_terminal) || startT;
                const zeroDur = Math.max(0, endT - startT);

                if (this.inIdle) {
                    if (this.seg && this.seg.type === 'idle') {
                        this.seg.endPt = zeroEndPt;
                        this._flushSeg();
                    }
                    this.inIdle = false;
                } else if (zeroDur >= (this.cfg.IDLE_MIN_SEC || 600)) {
                    if (this.seg) {
                        this.seg.endPt = this.zeroStartPt;
                        this._flushSeg();
                    }
                    this._startSeg('idle', this.zeroStartPt);
                    this.seg.endPt = zeroEndPt;
                    this._flushSeg();
                }
                this.zeroStartPt = null;
                this.zeroBreakStartTime = null;
            }

            // закрыть текущий сегмент/поездку, начать парковку
            if (this.seg) this._flushSeg();
            if (this.trip) this._flushTrip();

            if (!this.parking) this._startParking(pt);
            else this.parking.endPt = pt;

        } else {
            // на всякий — закрыть незавершённый сегмент
            if (this.seg) this._flushSeg();
        }

        this.prevPt = pt;
    }

    _sortAll() {
        this.result.trips.sort((a, b) => (a[0]?.start_ts ?? 0) - (b[0]?.start_ts ?? 0));
        for (const [, segs] of this.result.trips) {
            segs.sort((s1, s2) => (s1[0]?.time ?? 0) - (s2[0]?.time ?? 0));
        }
        this.result.parkings.sort((p1, p2) => (p1[0]?.time ?? 0) - (p2[0]?.time ?? 0));
        this.result.idles.sort((i1, i2) => (i1[0]?.time ?? 0) - (i2[0]?.time ?? 0));
    }

    _normalizeSegments(segs) {
        return segs.map(([s, e, meta]) => ({
            kind: meta.type,              // 'move' | 'stop' | 'idle'
            start: s.time,
            end: e.time,
            time: meta.time,
            distance: meta.distance,
            messages: meta.messages,
            startGeo: s.geo,
            endGeo: e.geo,
            startOil: s.oil,
            endOil: e.oil,
            maxSpeed: meta.maxSpeed,
            maxSpeedTime: meta.maxSpeedTime,
            maxSpeedGeo: meta.maxSpeedGeo,
        }));
    }

    _buildTimelineOnly() {
        const summary = { trips: 0, mileage: 0, parkings: 0 };
        const trips = this.result.trips.map(([header, segs]) => {
            summary.trips += header.time;
            summary.mileage += header.distance;
            return ({
                kind: 'trip',
                start: header.start_ts,
                end: header.end_ts,                  // конец поездки = конец последнего сегмента
                time: header.time,
                movingTime: header.movingTime,
                distance: header.distance,
                startGeo: header.startGeo,
                endGeo: header.endGeo,
                messages: header.messages,
                segments: this._normalizeSegments(segs), // включает idle
                maxSpeed: header.maxSpeed,
                maxSpeedTime: header.maxSpeedTime,
                maxSpeedGeo: header.maxSpeedGeo,
            });
        });

        console.log(this.result.parkings)
        const parkings = this.result.parkings.map(([s, e, meta]) => {
            summary.parkings += meta.time;
            return ({
                kind: 'parking',
                start: s.time,
                end: e.time,
                time: meta.time,
                startGeo: s.geo,
                endGeo: e.geo,
                startOil: s.oil,
                endOil: e.oil,
            });
        });

        // top-level idle для оверлеев/отчётов — НЕ влияет на границы trip
        const idles = this.result.idles.map(([s, e, meta]) => ({
            kind: 'idle',
            start: s.time,
            end: e.time,
            time: meta.time,
            startGeo: s.geo,
            endGeo: e.geo,
            startOil: s.oil,
            endOil: e.oil,
        }));

        // 1) Primary-таймлайн: только trip + parking
        const primary = [...trips, ...parkings].sort(
            (a, b) => (a.start ?? 0) - (b.start ?? 0) || (a.end ?? 0) - (b.end ?? 0)
        );

        // 2) Мостики/склейка — ТОЛЬКО между primary элементами
        const g = (this.cfg.MERGE_GAP_SEC ?? 0);
        for (let i = 1; i < primary.length; i++) {
            const prev = primary[i - 1];
            const cur = primary[i];
            if (prev.end == null || cur.start == null) continue;
            const gap = cur.start - prev.end;
            if (gap > 0 && gap <= g) {
                // стыкуем вплотную
                cur.start = prev.end;
                cur.time = (cur.end ?? cur.start) - cur.start;
            } else if (gap < 0) {
                // накладка — НИКОГДА не режем trip из-за idle (idle здесь нет),
                // здесь только trip/parking, корректируем безопасно предыдущий
                prev.end = cur.start;
                prev.time = (prev.end ?? prev.start) - prev.start;
            }
        }

        // 3) Итог: возвращаем primary как основную ленту,
        //    а idle — отдельным списком И/ИЛИ добавляем их в общий список без влияния на склейку
        const sortedItems = [...primary, ...idles].sort(
            (a, b) => (a.start ?? 0) - (b.start ?? 0) || (a.end ?? 0) - (b.end ?? 0)
        );

        return {
            sortedItems,   // для UI: есть trip/parking + отдельные idle в хронологии
            summary,
            idles,         // отдельным полем (если нужно отдельно)
            primary,       // чистый основной таймлайн без idle (если понадобится)
        };
    }

    init(data) {
        this._reset();
        if (!Array.isArray(data) || data.length === 0) return [];

        const sorted = [...data].sort(
            (a, b) => (this._N(a.time_terminal) || 0) - (this._N(b.time_terminal) || 0)
        );

        for (let i = 0; i < sorted.length; i++) this._processPoint(sorted[i]);

        // финализация хвостов (если серия "нуля" тянется до конца)
        if (this.zeroStartPt) {
            const zeroEndPt = this.lastGoodPt || this.prevPt;
            if (zeroEndPt) {
                const startT = this._N(this.zeroStartPt.time_terminal) || 0;
                const endT = this._N(zeroEndPt.time_terminal) || startT;
                const zeroDur = Math.max(0, endT - startT);
                if (this.inIdle) {
                    if (this.seg && this.seg.type === 'idle') {
                        this.seg.endPt = zeroEndPt;
                        this._flushSeg();
                    }
                    this.inIdle = false;
                } else if (zeroDur >= (this.cfg.IDLE_MIN_SEC || 600)) {
                    if (this.seg) {
                        this.seg.endPt = this.zeroStartPt;
                        this._flushSeg();
                    }
                    this._startSeg('idle', this.zeroStartPt);
                    this.seg.endPt = zeroEndPt;
                    this._flushSeg();
                }
            }
            this.zeroStartPt = null;
            this.zeroBreakStartTime = null;
        }

        if (this.seg) this._flushSeg();
        if (this.trip) this._flushTrip();
        if (this.parking) this._flushParking();

        this._sortAll();
        return this._buildTimelineOnly();
    }

    normaliseEngine(pwr) {
        return pwr >= this.cfg.PWRP ? 1 : 0
    }
}

module.exports = { CalkuletaTrips };
