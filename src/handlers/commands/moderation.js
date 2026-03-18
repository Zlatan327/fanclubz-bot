const { db } = require('../../db');
const { getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const mentions = await message.getMentions();
  if (!mentions.length) {
    await message.reply('Please mention at least one user.');
    return;
  }

  const targets = mentions.map((c) => c.id._serialized);

  if (command === '/kick' || command === '/ban') {  // ← updated
    try {
      await client.removeParticipants(message.from, targets); // ← any group
    } catch (err) {
      console.error('[moderation] failed to remove participants', err);
      await message.reply('Failed to remove one or more members.');
      return;
    }
  }

  if (command === '/ban') {
    const stmt = db.prepare(
      'UPDATE members SET is_banned = 1 WHERE id = ?'
    );
    for (const t of targets) {
      stmt.run(t);
    }
    await message.reply('Selected members have been banned.');
  } else if (command === '/kick') {
    await message.reply('Selected members have been removed.');
  }
}

module.exports = {
  handle
};
