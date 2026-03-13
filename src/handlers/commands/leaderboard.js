const { db } = require('../../db');
const { getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const senderJid = getSenderJid(message);
  const groupId = message.from;

  if (command === '!top') {
    try {
      const rows = db
        .prepare(
          'SELECT name, msg_count FROM members WHERE group_id = ? ORDER BY msg_count DESC LIMIT 10'
        )
        .all(groupId);
      if (!rows.length) {
        await message.reply('No messages tracked in this group yet.');
        return;
      }
      const lines = rows.map(
        (row, idx) =>
          `${idx + 1}. ${row.name || 'Member'} — ${row.msg_count} msgs`
      );
      return await message.reply('*Top 10 by messages (This Group):*\n' + lines.join('\n'));
    } catch (err) {
      console.error('[leaderboard] !top error', err);
      return await message.reply('Failed to fetch leaderboard.');
    }
    return;
  }

  if (command === '!myrank') {
    const row = db
      .prepare(
        `SELECT rank, msg_count FROM (
           SELECT user_id, msg_count, ROW_NUMBER() OVER (ORDER BY msg_count DESC) as rank
           FROM members
           WHERE group_id = ?
         ) WHERE user_id = ?`
      )
      .get(groupId, senderJid);

    if (!row) {
      await message.reply('You have no messages recorded in this group yet.');
      return;
    }
    return await message.reply(
      `Your rank in this group: #${row.rank} with ${row.msg_count} messages.`
    );
    return;
  }

  if (command === '!inviteleader') {
    const rows = db
      .prepare(
        `SELECT ic.inviter_jid, ic.count, m.name
         FROM invite_contest ic
         LEFT JOIN members m ON m.user_id = ic.inviter_jid AND m.group_id = ic.group_id
         WHERE ic.group_id = ?
         ORDER BY ic.count DESC
         LIMIT 10`
      )
      .all(groupId);
    if (!rows.length) {
      await message.reply('No invites tracked in this group yet.');
      return;
    }
    const lines = rows.map(
      (row, idx) =>
        `${idx + 1}. ${row.name || 'Member'} — ${row.count} invites`
    );
    return await message.reply(
      '*Top 10 by successful invites (This Group):*\n' + lines.join('\n')
    );
    return;
  }

  if (command === '!resetleader') {
    db.prepare('UPDATE members SET msg_count = 0 WHERE group_id = ?').run(groupId);
    return await message.reply('Group leaderboard has been reset.');
    return;
  }
}

module.exports = {
  handle
};

