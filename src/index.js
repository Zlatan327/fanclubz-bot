const path = require('path');
require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { handleMessage } = require('./handlers/message');
const { handleGroupJoin } = require('./handlers/groupJoin');
const { setupCron } = require('./cron');

const SESSIONS_DIR = path.join(process.env.SESSIONS_DIR || './sessions', 'test-session');

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'test-' + Date.now(),
    dataPath: SESSIONS_DIR
  }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

const http = require('http');
let lastQr = null;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  if (lastQr) {
    res.end(`
      <html>
        <head><title>Fanclubz QR Login</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;color:white;font-family:sans-serif;">
          <h1>Scan with WhatsApp</h1>
          <div style="background:white;padding:20px;border-radius:10px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQr)}" />
          </div>
          <p style="margin-top:20px;color:#888;">Refresh if the code expires</p>
          <script>setTimeout(() => location.reload(), 30000);</script>
        </body>
      </html>
    `);
  } else {
    res.end('<h1>Generating QR code...</h1><script>setTimeout(() => location.reload(), 2000);</script>');
  }
});

server.listen(3000, () => console.log('QR Code accessible at http://localhost:3000'));

client.on('qr', (qr) => {
  lastQr = qr;
  console.log('Scan this QR code with WhatsApp (or visit http://localhost:3000):');
  qrcode.generate(qr, { small: true });
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

