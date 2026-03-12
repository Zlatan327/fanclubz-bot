require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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

