const { db } = require('../../db');
const { GROUP_ID, getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const mentions = await message.getMentions();
  const groupId = message.from;
  if (!mentions.length) {
    await message.reply('Please mention at least one user.');
    return;
  }

  const targets = mentions.map((c) => c.id._serialized);

  if (command === '!kick' || command === '!ban') {
    try {
      await client.removeParticipants(groupId, targets);
      const now = Math.floor(Date.now() / 1000);
      const actor = getSenderJid(message);
      for (const t of targets) {
        db.prepare(
          'INSERT INTO activity_log (group_id, user_id, action, actor_id, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).run(groupId, t, command === '!kick' ? 'kick' : 'ban', actor, now);
      }
    } catch (err) {
      console.error('[moderation] failed to remove participants', err);
      await message.reply('Failed to remove one or more members.');
      return;
    }
  }

  if (command === '!ban') {
    try {
      const stmt = db.prepare(
        'UPDATE members SET is_banned = 1 WHERE group_id = ? AND user_id = ?'
      );
      for (const t of targets) {
        stmt.run(groupId, t);
      }
      await message.reply('Selected members have been banned in this group.');
    } catch (err) {
      console.error('[moderation] !ban error', err);
      await message.reply('Failed to ban selected members.');
    }
  } else if (command === '!kick') {
    await message.reply('Selected members have been removed.');
  }

  if (command === '!everyone') {
    try {
      const chat = await message.getChat();
      const mentions = chat.participants.map(p => p.id._serialized);
      await client.sendMessage(groupId, '📢 *@all* — Attention everyone!', { mentions });
    } catch (err) {
      console.error('[moderation] !everyone error', err);
      await message.reply('Failed to tag everyone.');
    }
  }

  if (command === '!clear') {
    try {
      db.prepare('DELETE FROM predictions WHERE group_id = ?').run(groupId);
      await message.reply('🗑️ All predictions for this group have been cleared.');
    } catch (err) {
      console.error('[moderation] !clear error', err);
      await message.reply('Failed to clear predictions.');
    }
  }
}

module.exports = {
  handle
};

