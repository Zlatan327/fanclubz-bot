const { db } = require('../db');
const { GROUP_ID } = require('./utils');

const WELCOME_MSG =
  process.env.WELCOME_MSG ||
  'Welcome {name} to Fanclubz! Read the rules: !rules • Check active predictions: !predictions • Tell us who invited you: !invited @name';

async function handleGroupJoin(client, notification) {
  const groupId = notification.id.remote;
  const participantId = notification.recipientIds[0];
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    `INSERT INTO members (group_id, user_id, joined_at)
     VALUES (?, ?, ?)
     ON CONFLICT(group_id, user_id) DO UPDATE SET joined_at = excluded.joined_at`
  ).run(groupId, participantId, now);

  db.prepare(
    'INSERT INTO activity_log (group_id, user_id, action, timestamp) VALUES (?, ?, ?, ?)'
  ).run(groupId, participantId, 'join', now);

  const banned = db
    .prepare('SELECT is_banned FROM members WHERE group_id = ? AND user_id = ?')
    .get(groupId, participantId);
  if (banned && banned.is_banned) {
    try {
      await client.removeParticipants(groupId, [participantId]);
    } catch (err) {
      console.error('[group_join] failed to auto-kick banned member', err);
    }
    return;
  }

  let displayName = 'there';
  try {
    const contact = await client.getContactById(participantId);
    displayName =
      contact.pushname || contact.name || contact.shortName || displayName;
  } catch (err) {
    console.error('[group_join] failed to fetch contact name', err);
  }

  const msg = WELCOME_MSG.replace('{name}', displayName);
  await client.sendMessage(groupId, msg);
}

module.exports = {
  handleGroupJoin
};

