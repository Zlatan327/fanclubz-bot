const { db } = require('../../db');
const { getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const senderJid = getSenderJid(message);

  if (command === '!invited') {
    const mentions = await message.getMentions();
    if (!mentions.length) {
      await message.reply(
        'Please mention exactly one person: !invited @name'
      );
      return;
    }
    const inviter = mentions[0].id._serialized;

    const existing = db
      .prepare('SELECT invited_by FROM members WHERE id = ?')
      .get(senderJid);
    if (existing && existing.invited_by) {
      await message.reply('You have already set who invited you.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO members (id, name, joined_at, invited_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET invited_by = excluded.invited_by`
    ).run(
      senderJid,
      message._data.notifyName || null,
      now,
      inviter
    );

    db.prepare(
      `INSERT INTO invite_contest (inviter_jid, count)
       VALUES (?, 1)
       ON CONFLICT(inviter_jid) DO UPDATE SET count = count + 1`
    ).run(inviter);

    await message.reply('Got it, your inviter has been credited.');
    return;
  }

  if (command === '!invitelink') {
    const inviteLink = process.env.INVITE_LINK;
    if (!inviteLink) {
      await message.reply(
        'An invite link is not configured. Please contact an admin.'
      );
      return;
    }
    try {
      await client.sendMessage(senderJid, `Here is the invite link:\n${inviteLink}`);
    } catch (err) {
      console.error('[invitelink] failed to DM invite link', err);
      await message.reply(
        'Could not send you the invite link. Please contact an admin.'
      );
    }
  }
}

module.exports = {
  handle
};

