const { db } = require('../../db');
const { sendTaggedMessage, GROUP_ID } = require('../utils');

async function handle(client, message, command, args) {
  if (command === '!newcontest') {
    const text = args.join(' ');
    const [title, desc] = text.split('|').map((s) => s && s.trim());
    if (!title || !desc) {
      await message.reply(
        'Usage: !newcontest <title> | <description>'
      );
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    try {
      const res = db
        .prepare(
          'INSERT INTO contests (title, description, posted_by, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(title, desc, message.author || message.from, now);
      const id = res.lastInsertRowid;
      
      const msg = `Attention @all! New contest (#${id}) created:\n*${title}*\n${desc}`;
      await sendTaggedMessage(client, GROUP_ID, msg);
    } catch (err) {
      console.error('[contests] !newcontest error', err);
      await message.reply('Failed to create new contest.');
    }
    return;
  }

  if (command === '!endcontest') {
    const id = parseInt(args[0], 10);
    if (Number.isNaN(id)) {
      await message.reply('Usage: !endcontest <id>');
      return;
    }
    try {
      db.prepare('UPDATE contests SET active = 0 WHERE id = ?').run(id);
      await message.reply(`Contest #${id} has been marked as ended.`);
    } catch (err) {
      console.error('[contests] !endcontest error', err);
      await message.reply('Failed to end contest.');
    }
    return;
  }

  if (command === '!contests') {
    try {
      const rows = db
        .prepare(
          'SELECT id, title, description FROM contests WHERE active = 1 ORDER BY created_at DESC LIMIT 10'
        )
        .all();
      if (!rows.length) {
        await message.reply('There are no active contests right now.');
        return;
      }
      const lines = rows.map(
        (row) => `#${row.id}: *${row.title}*\n${row.description}`
      );
      await message.reply(
        '*Active contests:*\n\n' + lines.join('\n\n')
      );
    } catch (err) {
      console.error('[contests] !contests error', err);
      await message.reply('Failed to fetch contests.');
    }
  }
}

module.exports = {
  handle
};

