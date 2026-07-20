const Database = require('better-sqlite3');
const path = require('path');

// اگه رو Railway بودیم از پوشه‌ی دائمی استفاده کن، وگرنه (لوکال) همینجا کنار پروژه
const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'archive.db')
  : path.join(__dirname, 'archive.db');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    username TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    text TEXT,
    media_type TEXT DEFAULT 'none',
    media_file TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  )
`);

module.exports = db;