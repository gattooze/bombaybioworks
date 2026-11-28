require('dotenv').config();

const list = (v) => (v || '').split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);

const cfg = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  extractModel: process.env.EXTRACT_MODEL || 'claude-haiku-5-5',
  answerModel: process.env.ANSWER_MODEL || 'claude-haiku-5-5',
  maxToolTurns: Number(process.env.MAX_TOOL_TURNS || 8),
  hivemindUrl: process.env.HIVEMIND_MCP_URL || 'https://hivemind-mcp-849464697051.asia-south1.run.app/mcp',
  hivemindSecret: process.env.HIVEMIND_MCP_SECRET,
  // Founders' WhatsApp numbers with country code, comma separated. Only these can instruct Hive.
  founderPhones: list(process.env.FOUNDER_PHONES),
  // Hive replies only when this is false. Keep true until Hive has its own number.
  readOnly: process.env.READ_ONLY !== 'false',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccount.json',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'bombay-bioworks',
  groupJid: process.env.GROUP_JID,
  groupName: process.env.GROUP_NAME || 'Bombay Bioworks',
  sessionDir: process.env.SESSION_DIR || './sessions',
  dbPath: process.env.DB_PATH || './data/state.db',
  triggerPrefix: process.env.TRIGGER_PREFIX || '@hive',
};

function validate() {
  const missing = ['ANTHROPIC_API_KEY', 'HIVEMIND_MCP_SECRET'].filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing in .env: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!cfg.founderPhones.length) console.warn('FOUNDER_PHONES is empty: nobody can give Hive instructions.');
}

module.exports = { cfg, validate };
