const { db } = require('../../db');

async function onFanclubzUrl(client, message, url) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO predictions (url, posted_at, active)
     VALUES (?, ?, 1)
     ON CONFLICT(url) DO UPDATE SET posted_at = excluded.posted_at, active = 1`
  ).run(url, now);

  await message.reply(
    'Active Prediction detected on Fanclubz! Check it out and make your picks.'
  );
}

async function handle(client, message, command, args) {
  if (command === '!predictions') {
    const rows = db
      .prepare(
        'SELECT id, url FROM predictions WHERE active = 1 ORDER BY posted_at DESC LIMIT 10'
      )
      .all();
    if (!rows.length) {
      await message.reply('There are no active predictions right now.');
      return;
    }
    const lines = rows.map((row) => `#${row.id}: ${row.url}`);
    await message.reply(
      '*Active Fanclubz predictions:*\n' + lines.join('\n')
    );
    return;
  }

  if (command === '!endprediction') {
    const id = parseInt(args[0], 10);
    if (!id) {
      await message.reply('Usage: !endprediction <id>');
      return;
    }
    db.prepare('UPDATE predictions SET active = 0 WHERE id = ?').run(id);
    await message.reply(`Prediction #${id} has been closed.`);
  }
}

module.exports = {
  handle,
  onFanclubzUrl
};

