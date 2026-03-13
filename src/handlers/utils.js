const { db } = require('../db');

const GROUP_ID = process.env.GROUP_ID;

function parseAdminIds() {
  const raw = process.env.ADMIN_IDS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const ADMIN_IDS = parseAdminIds();

function isFromTargetGroup(message) {
  return GROUP_ID && message.from === GROUP_ID;
}

function getSenderJid(message) {
  // In groups, author contains the participant; in DMs, from is the user
  return message.author || message.from;
}

function isAdmin(message) {
  const sender = getSenderJid(message);
  return isFromTargetGroup(message) && ADMIN_IDS.includes(sender);
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

async function sendTaggedMessage(client, groupId, text) {
  try {
    // Neater approach: Mentioning the group ID itself tags everyone for admins
    await client.sendMessage(groupId, text, { mentions: [groupId] });
  } catch (err) {
    console.error('[utils] tagAll failed', err);
    await client.sendMessage(groupId, text);
  }
}

module.exports = {
  GROUP_ID,
  ADMIN_IDS,
  isAdmin,
  isFromTargetGroup,
  getSenderJid,
  normalizeUrl,
  incrementMessageCount,
  sendTaggedMessage
};

