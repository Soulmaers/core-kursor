// services/core/src/services/writers/RawWriter.js
const sql = require('mssql');

class RawWriter {
  constructor({
    db,
    rawTable = 'dbo.telemetry_row',
    lastTable = 'dbo.last_messages_row',
    logger = console
  } = {}) {
    this.db = db;
    this.rawTable = rawTable;
    this.lastTable = lastTable;
    this.logger = logger;
  }



  async insert(point) {
    const now = new Date();
    //   console.log(now)
    const qInsertRaw = `
        INSERT INTO ${this.rawTable}
          (id_object, imei, time_terminal, lat, lon, speed, course, sats, hdop,
           proto, port, time_received, extras)
        OUTPUT INSERTED.raw_id
        VALUES
          (@id_object, @imei, @time_terminal, @lat, @lon, @speed, @course, @sats, @hdop,
           @proto, @port, @time_received, @extras);
      `;

    const insert = await this.db.request()
      .input('id_object', sql.VarChar(32), String(point.id_object))
      .input('imei', sql.VarChar(32), String(point.imei))
      .input('time_terminal', sql.BigInt, point.time != null ? point.time : null)
      .input('proto', sql.VarChar(16), point.proto || 'ips')
      .input('port', sql.Int, point.port ?? 0)
      .input('time_received', sql.DateTime2(3), now)
      .input('lat', sql.Float, point.lat ?? null)
      .input('lon', sql.Float, point.lon ?? null)
      .input('speed', sql.Float, point.speed ?? null)
      .input('course', sql.Float, point.course ?? null)
      .input('sats', sql.Int, point.sats ?? null)
      .input('hdop', sql.Float, point.hdop ?? null)
      .input('extras', sql.NVarChar(sql.MAX), point.extras ? JSON.stringify(point.extras) : null)
      .query(qInsertRaw)


  }

  async insert_last_mess(point) {
    console.log(point.time, point.id_object)
    const now = new Date();
    const qMergeLast = `
DECLARE @nowUnix INT = DATEDIFF(SECOND, '1970-01-01', SYSUTCDATETIME());

MERGE ${this.lastTable} WITH (HOLDLOCK) AS tgt
USING (
    SELECT
        @id_object     AS id_object,
        @imei          AS imei,
        @time_terminal AS time_terminal,
        @time_received AS time_received,
        @proto         AS proto,
        @port          AS port,
        @lat           AS lat,
        @lon           AS lon,
        @speed         AS speed,
        @course        AS course,
        @sats          AS sats,
        @hdop          AS hdop,
        @extras        AS extras
) AS src
ON (tgt.id_object = src.id_object)

WHEN MATCHED AND (
      -- 1) нормальный кейс: время терминала есть, не в будущем,
      --    и оно свежее, чем то, что уже лежит в lastTable
      src.time_terminal IS NOT NULL
      AND src.time_terminal <= @nowUnix
      AND (tgt.time_terminal IS NULL OR src.time_terminal > tgt.time_terminal)

   OR
      -- 2) резервный кейс: сравниваем по time_received,
      --    когда time_terminal одинаковы или оба NULL
      (
          (src.time_terminal = tgt.time_terminal)
          OR (src.time_terminal IS NULL AND tgt.time_terminal IS NULL)
      )
      AND src.time_received > tgt.time_received
)
THEN UPDATE SET
      id_object     = src.id_object,
      time_terminal = src.time_terminal,
      time_received = src.time_received,
      proto         = src.proto,
      port          = src.port,
      lat           = src.lat,
      lon           = src.lon,
      speed         = src.speed,
      course        = src.course,
      sats          = src.sats,
      hdop          = src.hdop,
      extras        = src.extras

WHEN NOT MATCHED AND (
      -- вставляем только если время терминала не в будущем
      src.time_terminal IS NULL
      OR src.time_terminal <= @nowUnix
)
THEN INSERT (
      id_object, imei, time_terminal, time_received, proto, port,
      lat, lon, speed, course, sats, hdop, extras
)
VALUES (
      src.id_object, @imei, src.time_terminal, src.time_received, src.proto, src.port,
      src.lat, src.lon, src.speed, src.course, src.sats, src.hdop, src.extras
);
`;
    const insert = await this.db.request()
      .input('id_object', sql.VarChar(32), String(point.id_object))
      .input('imei', sql.VarChar(32), String(point.imei))
      .input('time_terminal', sql.Int, point.time != null ? point.time : null)
      .input('proto', sql.VarChar(16), point.proto || 'ips')
      .input('port', sql.Int, point.port ?? 0)
      .input('time_received', sql.DateTime2(3), now)
      .input('lat', sql.Float, point.lat ?? null)
      .input('lon', sql.Float, point.lon ?? null)
      .input('speed', sql.Float, point.speed ?? null)
      .input('course', sql.Float, point.course ?? null)
      .input('sats', sql.Int, point.sats ?? null)
      .input('hdop', sql.Float, point.hdop ?? null)
      .input('extras', sql.NVarChar(sql.MAX), point.extras ? JSON.stringify(point.extras) : null)
      .query(qMergeLast)
  }

}

module.exports = { RawWriter };
