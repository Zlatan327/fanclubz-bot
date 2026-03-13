const { db } = require('../../db');
const { getSenderJid } = require('../utils');

async function handle(client, message, command) {
  const senderJid = getSenderJid(message);
  const groupId = message.from;

  if (command === '!invited') {
    const mentions = await message.getMentions();
    if (!mentions.length) {
      await message.reply(
        'Please mention exactly one person: !invited @name'
      );
      return;
    }
    const inviter = mentions[0].id._serialized;

    try {
      const existing = db
        .prepare('SELECT invited_by FROM members WHERE group_id = ? AND user_id = ?')
        .get(groupId, senderJid);
      if (existing && existing.invited_by) {
        await message.reply('You have already set who invited you in this group.');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        `INSERT INTO members (group_id, user_id, name, joined_at, invited_by)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(group_id, user_id) DO UPDATE SET invited_by = excluded.invited_by`
      ).run(
        groupId,
        senderJid,
        message._data.notifyName || null,
        now,
        inviter
      );

      db.prepare(
        `INSERT INTO invite_contest (group_id, inviter_jid, count)
         VALUES (?, ?, 1)
         ON CONFLICT(group_id, inviter_jid) DO UPDATE SET count = count + 1`
      ).run(groupId, inviter);

      db.prepare(
        'INSERT INTO activity_log (group_id, user_id, action, actor_id, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).run(groupId, senderJid, 'intro', inviter, now);

      await message.reply('Got it, your inviter has been credited for this group.');
    } catch (err) {
      console.error('[invites] !invited error', err);
      await message.reply('Failed to credit inviter.');
    }
    return;
  }

  if (command === '!invites') {
    try {
      const rows = db.prepare('SELECT * FROM activity_log WHERE group_id = ? ORDER BY timestamp DESC LIMIT 20').all(groupId);
      if (!rows.length) {
        await message.reply('📭 No invite/join activity recorded yet.\n\nTip: Ask members to type "/intro @person" to register who invited them!');
        return;
      }

      let text = '📊 *Group Invite History*\n\n';
      for (const row of rows) {
        const date = new Date(row.timestamp * 1000).toISOString().split('T')[0];
        let emoji = '➡️';
        if (row.action === 'intro') emoji = '📝';
        if (row.action === 'kick') emoji = '🦵';
        if (row.action === 'ban') emoji = '🔨';
        
        text += `${emoji} *${row.user_id.split('@')[0]}* — ${row.action} ${row.actor_id ? `(by ${row.actor_id.split('@')[0]})` : ''} — ${date}\n`;
      }
      await message.reply(text);
    } catch (err) {
      console.error('[invites] !invites error', err);
      await message.reply('Failed to fetch invite history.');
    }
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

