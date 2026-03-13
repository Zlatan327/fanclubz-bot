const cron = require('node-cron');
const { flush } = require('./queue');
const { db } = require('./db');
const { deleteMessage } = require('./handlers/utils');

function setupCron(client) {
  // Flush queue and process deletions frequently (every 2s)
  cron.schedule(
    '*/2 * * * * *',
    async () => {
      try {
        await flush(client);
        
        const now = Date.now();
        const pendingDeletions = db.prepare('SELECT * FROM scheduled_deletions WHERE delete_at <= ?').all(now);
        
        for (const del of pendingDeletions) {
          await deleteMessage(client, del.chat_id, del.message_id);
          db.prepare('DELETE FROM scheduled_deletions WHERE id = ?').run(del.id);
        }
      } catch (err) {
        console.error('[cron] error in execution loop', err);
      }
    },
    {
      timezone: process.env.TZ || 'Africa/Lagos'
    }
  );
}

module.exports = {
  setupCron
};

