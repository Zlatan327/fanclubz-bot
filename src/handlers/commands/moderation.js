const { db } = require('../../db');
const { GROUP_ID, getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const mentions = await message.getMentions();
  if (!mentions.length) {
    await message.reply('Please mention at least one user.');
    return;
  }

  const targets = mentions.map((c) => c.id._serialized);

  if (command === '!kick' || command === '!ban') {
    try {
      await client.removeParticipants(GROUP_ID, targets);
    } catch (err) {
      console.error('[moderation] failed to remove participants', err);
      await message.reply('Failed to remove one or more members.');
      return;
    }
  }

  if (command === '!ban') {
    try {
      const stmt = db.prepare(
        'UPDATE members SET is_banned = 1 WHERE id = ?'
      );
      for (const t of targets) {
        stmt.run(t);
      }
      await message.reply('Selected members have been banned.');
    } catch (err) {
      console.error('[moderation] !ban error', err);
      await message.reply('Failed to ban selected members.');
    }
  } else if (command === '!kick') {
    await message.reply('Selected members have been removed.');
  }
}

module.exports = {
  handle
};

