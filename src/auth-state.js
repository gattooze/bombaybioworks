/**
 * Firestore-backed auth state for Baileys.
 * Stores WhatsApp session credentials in Firestore so the bot
 * survives Cloud Run restarts without needing to re-scan QR.
 *
 * Data is stored under: _whatsapp_session/{SESSION_DOC_ID}/
 */
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const admin = require('firebase-admin');

const SESSION_COLLECTION = '_whatsapp_session';
const CREDS_DOC = 'creds';
const KEYS_COLLECTION = 'keys';

async function useFirestoreAuthState(firestore, sessionId = 'default') {
  const sessionRef = firestore.collection(SESSION_COLLECTION).doc(sessionId);
  const keysRef = sessionRef.collection(KEYS_COLLECTION);

  // Load credentials
  const credsDoc = await sessionRef.collection('data').doc(CREDS_DOC).get();
  const creds = credsDoc.exists
    ? JSON.parse(credsDoc.data().value, BufferJSON.reviver)
    : initAuthCreds();

  async function saveCreds() {
    await sessionRef.collection('data').doc(CREDS_DOC).set({
      value: JSON.stringify(creds, BufferJSON.replacer),
      updated_at: new Date().toISOString(),
    });
  }

  const keys = {
    async get(type, ids) {
      const result = {};
      await Promise.all(ids.map(async (id) => {
        const doc = await keysRef.doc(`${type}_${id}`).get();
        if (doc.exists) {
          result[id] = JSON.parse(doc.data().value, BufferJSON.reviver);
        }
      }));
      return result;
    },
    async set(data) {
      const batch = firestore.batch();
      for (const [type, entries] of Object.entries(data)) {
        for (const [id, value] of Object.entries(entries)) {
          const ref = keysRef.doc(`${type}_${id}`);
          if (value) {
            batch.set(ref, {
              value: JSON.stringify(value, BufferJSON.replacer),
              type,
              id,
              updated_at: new Date().toISOString(),
            });
          } else {
            batch.delete(ref);
          }
        }
      }
      await batch.commit();
    },
    async clear() {
      const snap = await keysRef.get();
      const batch = firestore.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    },
  };

  return { state: { creds, keys }, saveCreds };
}

module.exports = { useFirestoreAuthState };
