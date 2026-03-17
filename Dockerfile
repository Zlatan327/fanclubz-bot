FROM node:20-slim

RUN apt-get update && apt-get install -y \
  chromium fonts-liberation libatk-bridge2.0-0 \
  libdrm2 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2 \
  build-essential python3 --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/


CMD ["node", "src/index.js"]

