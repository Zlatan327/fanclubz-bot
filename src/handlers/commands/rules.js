const { db } = require('../../db');

async function handle(client, message, command, args) {
  const groupId = message.from;
  if (command === '!rules') {
    try {
      const row = db
        .prepare('SELECT value FROM settings WHERE group_id = ? AND key = ?')
        .get(groupId, 'rules_text');
      
      const rules = row ? row.value : '• Be polite and respectful\n• No spamming or advertising\n• No non-Fanclubz links';
      
      return await message.reply('*Group Rules:*\n' + rules);
    } catch (err) {
      console.error('[rules] !rules error', err);
      await message.reply('Failed to fetch rules.');
    }
    return;
  }

  if (command === '!setrules') {
    const text = args.join(' ').trim();
    if (!text) {
      await message.reply('Usage: !setrules <full rules text>');
      return;
    }
    try {
      db.prepare(
        `INSERT INTO settings (group_id, key, value)
         VALUES (?, 'rules_text', ?)
         ON CONFLICT(group_id, key) DO UPDATE SET value = excluded.value`
      ).run(groupId, text);
      return await message.reply('Rules have been updated.');
    } catch (err) {
      console.error('[rules] !setrules error', err);
      await message.reply('Failed to update rules.');
    }
  }
}

module.exports = {
  handle
};

