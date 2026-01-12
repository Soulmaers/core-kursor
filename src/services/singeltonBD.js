const { createDbPool } = require('./db/db');

// Единственный инстанс на весь процесс
const db = await createDbPool()

module.exports = { db };