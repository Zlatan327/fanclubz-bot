const { db } = require('../../db');

async function handle(client, message, command, args) {
  if (command === '!rules') {
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
    return;
  }

  if (command === '!setrules') {
    const text = args.join(' ').trim();
    if (!text) {
      await message.reply('Usage: !setrules <full rules text>');
      return;
    }
    db.prepare(
      `INSERT INTO settings (key, value)
       VALUES ('rules_text', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(text);
    await message.reply('Rules have been updated.');
  }
}

module.exports = {
  handle
};

