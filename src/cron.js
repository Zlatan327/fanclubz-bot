const cron = require('node-cron');
const { flush } = require('./queue');

function setupCron(client) {
  cron.schedule(
    '*/30 * * * * *',
    async () => {
      try {
        await flush(client);
      } catch (err) {
        console.error('[cron] error while flushing queue', err);
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

