const { enqueue } = require('../queue');
const { db } = require('../db');
const { scheduleDeletion } = require('../autodelete');
const {
  isAdmin,
  isFromTargetGroup,
  getSenderJid,
  normalizeUrl,
  incrementMessageCount
} = require('./utils');

const FANCLUBZ_DOMAIN = process.env.FANCLUBZ_DOMAIN;

const commands = {
  leaderboard: require('./commands/leaderboard'),
  invites: require('./commands/invites'),
  moderation: require('./commands/moderation'),
  contests: require('./commands/contests'),
  predictions: require('./commands/predictions'),
  rules: require('./commands/rules'),
  faq: require('./commands/faq')
};

function extractUrls(text) {
  const urlRegex =
    /(?:https?:\/\/[^\s]+)|(?:www\.)?fanclubz\.[a-z]{2,}(?:\/\S*)?/gi;
  return text.match(urlRegex) || [];
}

function isFanclubzUrl(url) {
  if (!FANCLUBZ_DOMAIN) return false;
  try {
    const target = url.startsWith('http') ? url : 'https://' + url;
    const u = new URL(target);
    return u.hostname.includes(FANCLUBZ_DOMAIN);
  } catch {
    return false;
  }
}

async function handleLinkModeration(client, message) {
  const senderJid = getSenderJid(message);
  const isSenderAdmin = isAdmin(message);
  const urls = extractUrls(message.body || '');
  if (!urls.length) return;

  let hasFanclubz = false;
  let hasOther = false;
  const normalized = [];

  for (const raw of urls) {
    const norm = normalizeUrl(raw);
    normalized.push(norm);
    if (isFanclubzUrl(norm)) {
      hasFanclubz = true;
    } else {
      hasOther = true;
    }
  }

  if (hasFanclubz) {
    for (const url of normalized.filter(isFanclubzUrl)) {
      await commands.predictions.onFanclubzUrl(client, message, url);
    }
  }

  if (hasOther && !isSenderAdmin) {
    try {
      await message.delete(true);
    } catch (err) {
      console.error('[links] failed to delete message', err);
    }

    const member = db
      .prepare('SELECT violations, is_banned FROM members WHERE id = ?')
      .get(senderJid);
    const currentViolations = member ? member.violations || 0 : 0;
    const nextViolations = currentViolations + 1;

    db.prepare(
      `INSERT INTO members (id, name, joined_at, violations)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         violations = excluded.violations`
    ).run(
      senderJid,
      message._data.notifyName || null,
      Math.floor(Date.now() / 1000),
      nextViolations
    );

    if (nextViolations === 1) {
      enqueue({
        to: senderJid,
        body:
          'Only Fanclubz links are allowed from members. This is your first warning. Further violations may result in removal from the group.'
      });
    } else {
      db.prepare(
        'UPDATE members SET is_banned = 1 WHERE id = ?'
      ).run(senderJid);
      try {
        await client.removeParticipants(message.from, [senderJid]); // ← any group
      } catch (err) {
        console.error('[links] failed to remove participant', err);
      }
      enqueue({
        to: senderJid,
        body:
          'You have been removed for repeatedly sharing non-Fanclubz links. Contact an admin if you believe this is a mistake.'
      });
    }
  }
}

async function routeCommand(client, message, command, args) {
  const senderIsAdmin = isAdmin(message);

  if (
    ['/top', '/myrank', '/kick', '/ban', '/newcontest', '/endcontest', '/setrules', '/inviteleader', '/resetleader', '/endprediction'].includes(
      command
    ) &&
    !senderIsAdmin
  ) {
    return;
  }

  const originalReply = message.reply.bind(message);
  message.reply = async (...args) => {
    try {
      const reply = await originalReply(...args);
      if (reply && reply.id) {
        scheduleDeletion(reply.id._serialized, message.from, 120);
      }
      return reply;
    } catch (err) {
      console.error('[wrapper] failed to reply or schedule', err);
    }
  };

  scheduleDeletion(message.id._serialized, message.from, 120);

  switch (command) {
    case '/top':
    case '/myrank':
    case '/inviteleader':
    case '/resetleader':
      return commands.leaderboard.handle(client, message, command, args);
    case '/invited':
    case '/invitelink':
      return commands.invites.handle(client, message, command, args);
    case '/kick':
    case '/ban':
      return commands.moderation.handle(client, message, command, args);
    case '/newcontest':
    case '/endcontest':
    case '/contests':
      return commands.contests.handle(client, message, command, args);
    case '/predictions':
    case '/endprediction':
      return commands.predictions.handle(client, message, command, args);
    case '/rules':
    case '/setrules':
      return commands.rules.handle(client, message, command, args);
    case '/faq':
    case '/help':
    case '/info':
      return commands.faq.handle(client, message, command, args);
    default:
  }
}

async function handleMessage(client, message) {
  // Removed single-group check — now works in ANY group
  const senderJid = getSenderJid(message);
  const banned = db
    .prepare('SELECT is_banned FROM members WHERE id = ?')
    .get(senderJid);
  if (banned && banned.is_banned) {
    try {
      await client.removeParticipants(message.from, [senderJid]);
    } catch (err) {
      console.error('[message] failed to re-kick banned member', err);
    }
    return;
  }

  incrementMessageCount(senderJid, message._data.notifyName);

  const body = (message.body || '').trim();

  if (body.startsWith('/')) {   // ← changed to /
    const [cmd, ...rest] = body.split(/\s+/);
    await routeCommand(client, message, cmd.toLowerCase(), rest);
  } else {
    await handleLinkModeration(client, message);
  }
}

module.exports = {
  handleMessage
};
