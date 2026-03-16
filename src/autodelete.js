const { db } = require('./db');

function scheduleDeletion(messageId, chatId, delaySeconds = 120) {
  const deleteAt = Math.floor(Date.now() / 1000) + delaySeconds;
  try {
    db.prepare(
      'INSERT INTO messages_to_delete (message_id, chat_id, delete_at) VALUES (?, ?, ?)'
    ).run(messageId, chatId, deleteAt);
  } catch (err) {
    console.error('[autodelete] failed to schedule deletion', err);
  }
}

async function processDeletions(client) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const rows = db
      .prepare('SELECT * FROM messages_to_delete WHERE delete_at <= ?')
      .all(now);

    for (const row of rows) {
      try {
        const msg = await client.getMessageById(row.message_id);
        if (msg) {
          await msg.delete(true); // true = delete for everyone
        }
      } catch (err) {
        console.warn(`[autodelete] failed to delete ${row.message_id}: ${err.message}`);
      } finally {
        db.prepare('DELETE FROM messages_to_delete WHERE message_id = ?').run(row.message_id);
      }
    }
  } catch (err) {
    console.error('[autodelete] error processing deletions', err);
  }
}

module.exports = {
  scheduleDeletion,
  processDeletions
};
