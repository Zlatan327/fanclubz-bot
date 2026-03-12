const { db } = require('../../db');
const { getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const senderJid = getSenderJid(message);

  if (command === '!top') {
    const rows = db
      .prepare(
        'SELECT name, msg_count FROM members ORDER BY msg_count DESC LIMIT 10'
      )
      .all();
    if (!rows.length) {
      await message.reply('No messages tracked yet.');
      return;
    }
    const lines = rows.map(
      (row, idx) =>
        `${idx + 1}. ${row.name || 'Member'} — ${row.msg_count} msgs`
    );
    await message.reply('*Top 10 by messages:*\n' + lines.join('\n'));
    return;
  }

  if (command === '!myrank') {
    const all = db
      .prepare(
        'SELECT id, name, msg_count FROM members ORDER BY msg_count DESC'
      )
      .all();
    const index = all.findIndex((m) => m.id === senderJid);
    if (index === -1) {
      await message.reply('You have no messages recorded yet.');
      return;
    }
    const me = all[index];
    await message.reply(
      `Your rank: #${index + 1} with ${me.msg_count} messages.`
    );
    return;
  }

  if (command === '!inviteleader') {
    const rows = db
      .prepare(
        `SELECT ic.inviter_jid, ic.count, m.name
         FROM invite_contest ic
         LEFT JOIN members m ON m.id = ic.inviter_jid
         ORDER BY ic.count DESC
         LIMIT 10`
      )
      .all();
    if (!rows.length) {
      await message.reply('No invites tracked yet.');
      return;
    }
    const lines = rows.map(
      (row, idx) =>
        `${idx + 1}. ${row.name || 'Member'} — ${row.count} invites`
    );
    await message.reply(
      '*Top 10 by successful invites:*\n' + lines.join('\n')
    );
    return;
  }

  if (command === '!resetleader') {
    db.prepare('UPDATE members SET msg_count = 0').run();
    await message.reply('Leaderboard has been reset for all members.');
    return;
  }
}

module.exports = {
  handle
};

