const { db } = require('./db');

const QUEUE_MAX_LENGTH = parseInt(process.env.QUEUE_MAX_LENGTH || '200', 10);
const QUEUE_PER_USER_MAX = parseInt(
  process.env.QUEUE_PER_USER_MAX || '10',
  10
);
const REPLY_DELAY_MS = parseInt(
  process.env.REPLY_DELAY_MS || '120000',
  10
);
const QUEUE_MAX_RETRIES = parseInt(
  process.env.QUEUE_MAX_RETRIES || '3',
  10
);

function enqueue(message) {
  const now = Date.now();

  try {
    const userCount = db
      .prepare('SELECT COUNT(*) as count FROM message_queue WHERE recipient_jid = ?')
      .get(message.to).count;

    if (userCount >= QUEUE_PER_USER_MAX) {
      console.warn('[queue] dropping message due to per-user cap', message.to);
      return;
    }

    const totalCount = db
      .prepare('SELECT COUNT(*) as count FROM message_queue')
      .get().count;

    if (totalCount >= QUEUE_MAX_LENGTH) {
      // Drop oldest
      db.prepare('DELETE FROM message_queue WHERE id = (SELECT MIN(id) FROM message_queue)').run();
      console.warn('[queue] global cap reached, dropping oldest');
    }

    db.prepare(
      `INSERT INTO message_queue (recipient_jid, body, options, enqueued_at, send_after, retries)
       VALUES (?, ?, ?, ?, ?, 0)`
    ).run(
      message.to,
      message.body,
      JSON.stringify(message.options || {}),
      now,
      now + REPLY_DELAY_MS
    );
  } catch (err) {
    console.error('[queue] failed to enqueue message', err);
  }
}

async function flush(client) {
  const now = Date.now();

  try {
    const pending = db
      .prepare('SELECT * FROM message_queue WHERE send_after <= ?')
      .all(now);

    for (const msg of pending) {
      try {
        const options = JSON.parse(msg.options || '{}');
        await client.sendMessage(msg.recipient_jid, msg.body, options);
        db.prepare('DELETE FROM message_queue WHERE id = ?').run(msg.id);
      } catch (err) {
        console.error('[queue] failed to send message', err);
        const nextRetries = (msg.retries || 0) + 1;
        if (nextRetries > QUEUE_MAX_RETRIES) {
          console.warn('[queue] dropping message after max retries', msg.recipient_jid);
          db.prepare('DELETE FROM message_queue WHERE id = ?').run(msg.id);
        } else {
          db.prepare(
            'UPDATE message_queue SET retries = ?, send_after = ? WHERE id = ?'
          ).run(nextRetries, now + REPLY_DELAY_MS, msg.id);
        }
      }
    }
  } catch (err) {
    console.error('[queue] failed to flush queue', err);
  }
}

module.exports = {
  enqueue,
  flush
};

