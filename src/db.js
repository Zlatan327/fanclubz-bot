const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.env.DB_DIR || '/app/data', 'fanclubz.sqlite');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT,
    joined_at INTEGER,
    msg_count INTEGER DEFAULT 0,
    invited_by TEXT,
    is_banned INTEGER DEFAULT 0,
    violations INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    posted_by TEXT,
    created_at INTEGER,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    title TEXT,
    posted_at INTEGER,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS invite_contest (
    inviter_jid TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_members_msg_count
    ON members (msg_count DESC);

  CREATE INDEX IF NOT EXISTS idx_members_is_banned
    ON members (is_banned);

  CREATE INDEX IF NOT EXISTS idx_invite_contest_count
    ON invite_contest (count DESC);

  CREATE INDEX IF NOT EXISTS idx_predictions_active_posted_at
    ON predictions (active, posted_at DESC);

  CREATE INDEX IF NOT EXISTS idx_contests_active_created_at
    ON contests (active, created_at DESC);
`);

function getOrCreateMember(id, name) {
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (row) return row;
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO members (id, name, joined_at) VALUES (?, ?, ?)'
  ).run(id, name || null, now);
  return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
}

module.exports = {
  db,
  getOrCreateMember
};

