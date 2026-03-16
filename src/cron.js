const cron = require('node-cron');
const { flush } = require('./queue');
const { processDeletions } = require('./autodelete');

function setupCron(client) {
  cron.schedule(
    '*/30 * * * * *',
    async () => {
      try {
        await flush(client);
        await processDeletions(client);
      } catch (err) {
        console.error('[cron] error while flushing or deleting', err);
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

