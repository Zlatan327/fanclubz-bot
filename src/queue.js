const QUEUE_MAX_LENGTH = parseInt(process.env.QUEUE_MAX_LENGTH || '200', 10);
const QUEUE_PER_USER_MAX = parseInt(
  process.env.QUEUE_PER_USER_MAX || '10',
  10
);
const REPLY_DELAY_MS = parseInt(
  process.env.REPLY_DELAY_MS || '120000',
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
    sendAfter: now + REPLY_DELAY_MS
  });
}

async function flush(client) {
  const now = Date.now();
  let i = 0;

  while (i < queue.length) {
    const msg = queue[i];
    if (msg.sendAfter <= now) {
      queue.splice(i, 1);
      try {
        await client.sendMessage(msg.to, msg.body, msg.options || {});
      } catch (err) {
        console.error('[queue] failed to send message', err);
      }
      // do not increment i; next item has shifted into current index
    } else {
      i += 1;
    }
  }
}

module.exports = {
  enqueue,
  flush
};

