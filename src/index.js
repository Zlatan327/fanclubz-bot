require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');
const QRCode = require('qrcode');

let latestQr = null;

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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('Scan this QR code with WhatsApp:');
  qrcode.generate(qr, { small: true });
  latestQr = qr;
});

client.on('ready', () => {
  console.log('Fanclubz WhatsApp bot is ready.');
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

const server = http.createServer(async (req, res) => {
  if (!latestQr) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<h1>Waiting for QR Code...</h1><p>The bot is initializing or checking session. Please refresh in a few seconds.</p><script>setTimeout(() => location.reload(), 2000)</script>');
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(latestQr);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scan WhatsApp QR Code</title>
        <style>
          body { background-color: #111b21; color: white; text-align: center; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          img { border: 12px solid white; border-radius: 8px; max-width: 90vw; }
          p { margin-top: 20px; color: #8696a0; }
        </style>
      </head>
      <body>
        <h1>Scan with WhatsApp</h1>
        <img src="${qrDataUrl}" alt="QR Code" />
        <p>Linked Devices > Link a Device</p>
      </body>
      </html>
    `);
  } catch (err) {
    res.writeHead(500);
    res.end('Error generating QR code');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT} to serve QR code`);
});


