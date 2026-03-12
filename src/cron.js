const cron = require('node-cron');
const { flush } = require('./queue');

function setupCron(client) {
  cron.schedule(
    '*/30 * * * * *',
    () => {
      flush(client);
    },
    {
      timezone: process.env.TZ || 'Africa/Lagos'
    }
  );
}

module.exports = {
  setupCron
};

