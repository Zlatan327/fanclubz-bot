const { enqueue } = require('../queue');
const { db } = require('../db');
const {
  GROUP_ID,
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
  help: require('./commands/help')
};

function extractUrls(text) {
  const urlRegex =
    /https?:\/\/[^\s]+/gi;
  return text.match(urlRegex) || [];
}

function isFanclubzUrl(url) {
  if (!FANCLUBZ_DOMAIN) return false;
  try {
    const u = new URL(url);
    return u.hostname.includes(FANCLUBZ_DOMAIN);
  } catch {
    return false;
  }
}

async function handleLinkModeration(client, message) {
  const senderJid = getSenderJid(message);
  const isSenderAdmin = await isAdmin(client, message);
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

    const groupId = message.from;
    const member = db
      .prepare('SELECT violations, is_banned FROM members WHERE group_id = ? AND user_id = ?')
      .get(groupId, senderJid);
    const currentViolations = member ? member.violations || 0 : 0;
    const nextViolations = currentViolations + 1;

    db.prepare(
      `INSERT INTO members (group_id, user_id, name, joined_at, violations)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(group_id, user_id) DO UPDATE SET
         violations = excluded.violations`
    ).run(
      groupId,
      senderJid,
      message._data.notifyName || null,
      Math.floor(Date.now() / 1000),
      nextViolations
    );

    if (nextViolations === 1) {
      enqueue({
        to: groupId,
        body:
          'Only Fanclubz links are allowed from members. This is your first warning. Further violations may result in removal from the group.'
      });
    } else {
      db.prepare(
        'UPDATE members SET is_banned = 1 WHERE group_id = ? AND user_id = ?'
      ).run(groupId, senderJid);
      try {
        await client.removeParticipants(groupId, [senderJid]);
      } catch (err) {
        console.error('[links] failed to remove participant', err);
      }
      enqueue({
        to: groupId,
        body:
          'A member has been removed for repeatedly sharing non-Fanclubz links.'
      });
    }
  }
}

async function routeCommand(client, message, command, args) {
  const senderIsAdmin = await isAdmin(client, message);

  if (
    ['!top', '!myrank', '!kick', '!ban', '!newcontest', '!endcontest', '!setrules', '!inviteleader', '!resetleader', '!endprediction', '!everyone', '!clear'].includes(
      command
    ) &&
    !senderIsAdmin
  ) {
    return;
  }

  switch (command) {
    case '!help':
    case '!commands':
      return commands.help.handle(client, message, command, args);
    case '!top':
    case '!myrank':
    case '!inviteleader':
    case '!resetleader':
    case '!active':
      return commands.leaderboard.handle(client, message, command, args);
    case '!invited':
    case '!invitelink':
    case '!intro':
    case '!invites':
      return commands.invites.handle(client, message, command, args);
    case '!kick':
    case '!ban':
    case '!everyone':
    case '!clear':
      return commands.moderation.handle(client, message, command, args);
    case '!newcontest':
    case '!endcontest':
    case '!contests':
      return commands.contests.handle(client, message, command, args);
    case '!predictions':
    case '!endprediction':
    case '!find':
    case '!stats':
      return commands.predictions.handle(client, message, command, args);
    case '!rules':
    case '!setrules':
      return commands.rules.handle(client, message, command, args);
    default:
  }
}

async function handleMessage(client, message) {
  console.log(`[message] from: ${message.from}, author: ${message.author}, body: ${message.body}`);
  if (!isFromTargetGroup(message)) {
    return;
  }

  const senderJid = getSenderJid(message);
  const groupId = message.from;
  const banned = db
    .prepare('SELECT is_banned FROM members WHERE group_id = ? AND user_id = ?')
    .get(groupId, senderJid);
  if (banned && banned.is_banned) {
    try {
      await client.removeParticipants(groupId, [senderJid]);
    } catch (err) {
      console.error('[message] failed to re-kick banned member', err);
    }
    return;
  }

  incrementMessageCount(message.from, senderJid, message._data.notifyName);

  const body = (message.body || '').trim();

  if (body.startsWith('!') || body.startsWith('/')) {
    const [cmd, ...rest] = body.split(/\s+/);
    // Remove the prefix from the command name before routing
    const commandName = '!' + cmd.slice(1).toLowerCase();
    await routeCommand(client, message, commandName, rest);
  } else {
    await handleLinkModeration(client, message);
  }
}

module.exports = {
  handleMessage
};

