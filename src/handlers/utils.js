const { db } = require('../db');

function parseAdminIds() {
  const raw = process.env.ADMIN_IDS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const ADMIN_IDS = parseAdminIds();

function isFromTargetGroup(message) {
  return true; // ← Now works in EVERY group
}

function getSenderJid(message) {
  return message.author || message.from;
}

function isAdmin(message) {
  const sender = getSenderJid(message);
  return ADMIN_IDS.includes(sender);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function incrementMessageCount(jid, name) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO members (id, name, joined_at, msg_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       msg_count = members.msg_count + 1,
       name = COALESCE(excluded.name, members.name)`
  ).run(jid, name || null, now);
}

module.exports = {
  ADMIN_IDS,
  isAdmin,
  isFromTargetGroup,
  getSenderJid,
  normalizeUrl,
  incrementMessageCount
};
