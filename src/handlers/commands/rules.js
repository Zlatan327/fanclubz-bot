const { db } = require('../../db');

async function handle(client, message, command, args) {
  if (command === '!rules') {
    try {
      const row = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('rules_text');
      if (!row) {
        await message.reply(
          'Group rules have not been set yet. Please contact an admin.'
        );
        return;
      }
      await message.reply('*Group Rules:*\n' + row.value);
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
        `INSERT INTO settings (key, value)
         VALUES ('rules_text', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(text);
      await message.reply('Rules have been updated.');
    } catch (err) {
      console.error('[rules] !setrules error', err);
      await message.reply('Failed to update rules.');
    }
  }
}

module.exports = {
  handle
};

