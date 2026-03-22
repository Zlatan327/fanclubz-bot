process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');
const QRCode = require('qrcode');

let latestQr = null;
let isReady = false;

const { handleMessage } = require('./handlers/message');
const { handleGroupJoin } = require('./handlers/groupJoin');
const { setupCron } = require('./cron');

const SESSIONS_DIR = process.env.SESSIONS_DIR || '/app/sessions';

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: SESSIONS_DIR
  }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
  }
});

client.on('qr', (qr) => {
  console.log('Scan this QR code with WhatsApp:');
  qrcode.generate(qr, { small: true });
  latestQr = qr;
});

client.on('ready', () => {
  console.log('✅ Fanclubz WhatsApp bot is ready.');
  isReady = true;
});

client.on('message', (message) => {
  handleMessage(client, message).catch((err) => {
    console.error('Error handling message', err);
  });
});

client.on('group_join', (notification) => {
  handleGroupJoin(client, notification).catch((err) => {
    console.error('Error handling group join', err);
  });
});

client.on('auth_failure', (msg) => {
  console.error('AUTH FAILURE', msg);
});

setupCron(client);

client.initialize();

const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('*', async (req, res) => {
  if (isReady) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>✅ Bot is Ready</title>
        <style>
          body { background-color: #111b21; color: white; text-align: center; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          h1 { color: #00ff00; }
        </style>
      </head>
      <body>
        <h1>✅ Fanclubz WhatsApp Bot is Ready!</h1>
        <p>The bot is connected and running on Railway.</p>
        <p>Check your Railway logs for full status.</p>
      </body>
      </html>
    `);
  }

  if (!latestQr) {
    return res.send(`
      <h1>⏳ Waiting for QR Code...</h1>
      <p>The bot is initializing or restoring session. Refresh in 5-10 seconds.</p>
      <script>setTimeout(() => location.reload(), 3000)</script>
    `);
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(latestQr);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scan WhatsApp QR Code</title>
        <style>
          body { background-color: #111b21; color: white; text-align: center; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .qr-container { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: inline-block; }
          img { width: 300px; height: 300px; display: block; }
          p { margin-top: 25px; color: #8696a0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>📱 Scan with WhatsApp</h1>
        <div class="qr-container">
          <img src="${qrDataUrl}" alt="QR Code" />
        </div>
        <p>Go to WhatsApp → Settings → Linked Devices → Link a Device</p>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error generating QR code');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express web server listening on port ${PORT}`);
});
