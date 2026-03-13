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
  return message.from.endsWith('@g.us');
}

function getSenderJid(message) {
  // In groups, author contains the participant; in DMs, from is the user
  return message.author || message.from;
}

async function isAdmin(client, message) {
  const sender = getSenderJid(message);
  // Global admin check
  if (ADMIN_IDS.includes(sender)) return true;

  if (!message.from.endsWith('@g.us')) return false;

  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return false;

    const participant = chat.participants.find(
      (p) => (p.id._serialized || p.id) === sender
    );
    return participant ? participant.isAdmin || participant.isSuperAdmin : false;
  } catch (err) {
    console.error('[utils] isAdmin check failed', err);
    return false;
  }
}

function normalizeUrl(url) {
  let target = url.trim();
  if (!target.startsWith('http')) {
    target = 'https://' + target;
  }
  try {
    const u = new URL(target);
    u.hash = '';
    if (u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return target;
  }
}

async function deleteMessage(client, chatId, messageId) {
  try {
    const chat = await client.getChatById(chatId);
    const msgs = await chat.fetchMessages({ limit: 50 });
    const target = msgs.find(m => m.id._serialized === messageId);
    if (target) {
      await target.delete(true);
    }
  } catch (err) {
    console.error('[utils] failed to delete message', chatId, messageId, err.message);
  }
}

function incrementMessageCount(groupId, userId, name) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO members (group_id, user_id, name, joined_at, msg_count)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(group_id, user_id) DO UPDATE SET
       msg_count = members.msg_count + 1,
       name = COALESCE(excluded.name, members.name)`
  ).run(groupId, userId, name || null, now);
}

async function sendTaggedMessage(client, groupId, text) {
  try {
    // Neater approach: Mentioning the group ID itself tags everyone for admins
    const response = await client.sendMessage(groupId, text, { mentions: [groupId] });
    return response;
  } catch (err) {
    console.error('[utils] tagAll failed', err);
    return await client.sendMessage(groupId, text);
  }
}

function scheduleDeletion(message, delayMs) {
  const deleteAt = Date.now() + delayMs;
  try {
    db.prepare(
      'INSERT INTO scheduled_deletions (chat_id, message_id, delete_at) VALUES (?, ?, ?)'
    ).run(message.from, message.id._serialized, deleteAt);
  } catch (err) {
    console.error('[utils] failed to schedule deletion', err);
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
  sendTaggedMessage,
  scheduleDeletion,
  deleteMessage
};

