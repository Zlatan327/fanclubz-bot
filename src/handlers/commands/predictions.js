const { db } = require('../../db');

async function onFanclubzUrl(client, message, url) {
  const groupId = message.from;
  const now = Math.floor(Date.now() / 1000);
  try {
    db.prepare(
      `INSERT INTO predictions (group_id, url, posted_at, active)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(url) DO UPDATE SET posted_at = excluded.posted_at, active = 1`
    ).run(groupId, url, now);

    await message.reply(
      '✅ Saved prediction! Type /predictions or /find <keyword> to look it up.'
    );
  } catch (err) {
    console.error('[predictions] onFanclubzUrl error', err);
  }
}

async function handle(client, message, command, args) {
  const groupId = message.from;
  if (command === '!predictions') {
    try {
      const rows = db
        .prepare(
          'SELECT id, url FROM predictions WHERE group_id = ? AND active = 1 ORDER BY posted_at DESC LIMIT 10'
        )
        .all(groupId);
      if (!rows.length) {
        await message.reply('📭 No predictions saved yet.\n\nPost a FanClubz prediction link and I\'ll track it automatically!');
        return;
      }
      const lines = rows.map((row) => `#${row.id}: ${row.url}`);
      await message.reply(
        '📊 *Recent Predictions:*\n' + lines.join('\n')
      );
    } catch (err) {
      console.error('[predictions] !predictions error', err);
      await message.reply('Failed to fetch predictions.');
    }
    return;
  }

  if (command === '!find') {
    const query = args.join(' ').trim();
    if (!query) {
      await message.reply('ℹ️ Usage: /find <keyword>');
      return;
    }
    try {
      const rows = db
        .prepare(
          "SELECT id, url FROM predictions WHERE group_id = ? AND url LIKE ? ORDER BY posted_at DESC LIMIT 10"
        )
        .all(groupId, `%${query}%`);
      if (!rows.length) {
        await message.reply(`🔍 No predictions found matching "*${query}*".`);
        return;
      }
      const lines = rows.map((row) => `#${row.id}: ${row.url}`);
      await message.reply(`🔍 *Predictions matching "${query}":*\n` + lines.join('\n'));
    } catch (err) {
      console.error('[predictions] !find error', err);
      await message.reply('Failed to search predictions.');
    }
    return;
  }

  if (command === '!stats') {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM predictions WHERE group_id = ?').get(groupId);
      await message.reply(`📈 *Group Prediction Stats*\n\n🔢 Total predictions tracked: *${row.count}*\n🌐 Platform: FanClubz\n\n_Post a FanClubz prediction link and I'll save it automatically!_`);
    } catch (err) {
      console.error('[predictions] !stats error', err);
      await message.reply('Failed to fetch stats.');
    }
    return;
  }

  if (command === '!endprediction') {
    const id = parseInt(args[0], 10);
    if (Number.isNaN(id)) {
      await message.reply('Usage: !endprediction <id>');
      return;
    }
    try {
      db.prepare('UPDATE predictions SET active = 0 WHERE group_id = ? AND id = ?').run(groupId, id);
      await message.reply(`Prediction #${id} has been closed in this group.`);
    } catch (err) {
      console.error('[predictions] !endprediction error', err);
      await message.reply('Failed to close prediction.');
    }
  }
}

module.exports = {
  handle,
  onFanclubzUrl
};

