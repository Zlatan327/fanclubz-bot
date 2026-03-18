const { db } = require('../db');

const WELCOME_MSG =
  process.env.WELCOME_MSG ||
  'Welcome {name} to Fanclubz! Read the rules: /rules • Check active predictions: /predictions • Tell us who invited you: /invited @name';

async function handleGroupJoin(client, notification) {
  const groupId = notification.id.remote; // ← any group

  const participantId = notification.recipientIds[0];
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    `INSERT INTO members (id, name, joined_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET joined_at = excluded.joined_at`
  ).run(participantId, null, now);

  const banned = db
    .prepare('SELECT is_banned FROM members WHERE id = ?')
    .get(participantId);
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
