require('dotenv').config();

const cfg = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccount.json',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'bombay-bioworks',
  groupJid: process.env.GROUP_JID,
  groupName: process.env.GROUP_NAME || 'Bombay Bioworks',
  sessionDir: process.env.SESSION_DIR || './sessions',
  dbPath: process.env.DB_PATH || './data/state.db',
  triggerPrefix: process.env.TRIGGER_PREFIX || '@hive',
};

function validate() {
  if (!cfg.geminiApiKey) {
    console.error('GEMINI_API_KEY is not set in .env');
    process.exit(1);
  }
}

module.exports = { cfg, validate };
