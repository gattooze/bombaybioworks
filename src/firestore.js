/**
 * Firebase Admin access, used only to store the WhatsApp session (auth-state.js).
 * Hivemind data goes through the Hivemind MCP server (hivemind-client.js), never Firestore directly.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { cfg } = require('./config');

let db;

function getDb() {
  if (db) return db;

  if (!admin.apps.length) {
    // Accept service account as JSON env var (for cloud/GCE) or file path (local dev)
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let credential;
    if (saJson) {
      credential = admin.credential.cert(JSON.parse(saJson));
    } else {
      const saPath = path.resolve(cfg.firebaseServiceAccount);
      if (!fs.existsSync(saPath)) {
        console.error(`Firebase service account not found at ${saPath}`);
        console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON env var or place serviceAccount.json here.');
        process.exit(1);
      }
      credential = admin.credential.cert(require(saPath));
    }
    admin.initializeApp({ credential, projectId: cfg.firebaseProjectId });
  }
  db = admin.firestore();
  return db;
}

module.exports = { getDb };
