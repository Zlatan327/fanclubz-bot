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

const queue = [];

function enqueue(message) {
  const now = Date.now();

  const userItems = queue.filter((q) => q.to === message.to);
  if (userItems.length >= QUEUE_PER_USER_MAX) {
    console.warn(
      '[queue] dropping message due to per-user cap',
      message.to
    );
    return;
  }

  if (queue.length >= QUEUE_MAX_LENGTH) {
    const dropped = queue.shift();
    console.warn('[queue] global cap reached, dropping oldest', dropped.to);
  }

  queue.push({
    ...message,
    enqueuedAt: now,
    sendAfter: now + REPLY_DELAY_MS,
    retries: 0
  });
}

async function flush(client) {
  const now = Date.now();
  let i = 0;

  while (i < queue.length) {
    const msg = queue[i];
    if (msg.sendAfter <= now) {
      try {
        await client.sendMessage(msg.to, msg.body, msg.options || {});
        queue.splice(i, 1);
      } catch (err) {
        console.error('[queue] failed to send message', err);
        const retries = (msg.retries || 0) + 1;
        if (retries > QUEUE_MAX_RETRIES) {
          console.warn(
            '[queue] dropping message after max retries',
            msg.to
          );
          queue.splice(i, 1);
        } else {
          msg.retries = retries;
          msg.sendAfter = now + REPLY_DELAY_MS;
          i += 1;
        }
      }
      // on success or drop, do not increment i; next item has shifted into current index
    } else {
      i += 1;
    }
  }
}

module.exports = {
  enqueue,
  flush
};

