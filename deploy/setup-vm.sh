#!/bin/bash
# Run on GCE e2-micro VM after SSH-ing in.
# Sets up Node 20, PM2, clones the bot, and starts it.
set -e

echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== Installing PM2 ==="
sudo npm install -g pm2

echo "=== Installing git ==="
sudo apt-get install -y git

echo "=== Cloning whatsapp bot ==="
cd /home/$(whoami)
git clone https://github.com/gattooze/bombaybioworks.git
cd bombaybioworks/whatsapp
npm install --omit=dev

echo "=== Writing .env ==="
cat > .env << 'ENVEOF'
GEMINI_API_KEY=PLACEHOLDER_GEMINI
FIREBASE_PROJECT_ID=bombay-bioworks
GROUP_JID=120363428077194867@g.us
GROUP_NAME=Bombay Bioworks
TRIGGER_PREFIX=@hive
USE_FIRESTORE_AUTH=true
SESSION_DIR=./sessions
ENVEOF

echo "FIREBASE_SERVICE_ACCOUNT_JSON='PLACEHOLDER_SA_JSON'" >> .env

echo ""
echo "=== Edit .env with real values, then run: ==="
echo "  cd /home/$(whoami)/bombaybioworks/whatsapp"
echo "  nano .env   # fill in GEMINI_API_KEY and FIREBASE_SERVICE_ACCOUNT_JSON"
echo "  pm2 start src/index.js --name whatsapp-bot"
echo "  pm2 save"
echo "  pm2 startup  # follow the printed command to enable autostart"
