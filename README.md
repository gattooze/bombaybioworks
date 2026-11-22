# Bombay Bioworks WhatsApp Intelligence Bot

Always-on bot that sits in the team WhatsApp group, extracts intelligence from messages (numbers, figures, decisions), feeds it into Hivemind, and answers questions on demand.

**Flow:**
```
WhatsApp group
    → Baileys (WhatsApp Web library)
    → Claude Haiku (extract numbers, facts, people)
    → Hivemind Firestore (notes + people collections)
    ← @hive question → Claude answers from Hivemind context
```

---

## First-time setup

### 1. Install dependencies

```bash
cd whatsapp
npm install
```

Requires Node.js ≥18 and Python/make for `better-sqlite3` compilation (Xcode CLI tools on macOS).

### 2. Firebase service account

Download from: **Firebase Console → Project Settings → Service Accounts → Generate new private key**

Save it as `whatsapp/serviceAccount.json` (never commit this file — it's gitignored).

### 3. Create .env

```bash
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
FIREBASE_PROJECT_ID=bombay-bioworks
FIREBASE_SERVICE_ACCOUNT=./serviceAccount.json
GROUP_JID=                    # fill in after step 5
```

### 4. Link WhatsApp (one-time QR scan)

```bash
npm run groups
```

Scan the QR code with WhatsApp → **Linked Devices → Link a Device**.

After connecting, the script lists all your groups with their JIDs:
```
Bombay Bioworks
  JID: 1234567890-1234567890@g.us
  Participants: 3
```

Copy the JID and set `GROUP_JID=` in `.env`.

---

## Processing chat history (7+ months)

Export the group chat from WhatsApp:  
**WhatsApp → [Group] → ⋯ More → Export Chat → Without Media**

This downloads a `.txt` file. Run:

```bash
node src/history.js ~/Downloads/WhatsApp\ Chat\ -\ Bombay\ Bioworks.txt
```

Progress is checkpointed — if interrupted, re-run the same command to resume.

When complete, open **Hivemind → Notes** and filter by tag `whatsapp` to see all extracted intelligence.

---

## Running the live bot

**Local / development (laptop must stay on):**
```bash
npm start
```

**Cloud Run (always-on, recommended for production):**
See [Cloud Run deployment](#cloud-run-deployment) below.

Once running, the bot:
- Extracts facts/numbers from every message → adds to Hivemind Notes
- Answers questions: anyone in the group can type `@hive <question>` to query the full knowledge base

---

## Asking questions in the group

Send a WhatsApp message starting with `@hive`:

```
@hive what was the bamboo price we agreed with Assam supplier?
@hive what iodine value did we get from the last batch?
@hive who is our contact at IPIRTI?
@hive what was the activation yield in October?
```

Hive searches Hivemind's notes and replies in the group.

---

## Cloud Run deployment

This is the right way to run the bot — your laptop doesn't need to be on.

The bot uses **Firestore** to store its WhatsApp session credentials, so it survives container restarts without needing to re-scan QR.

### First run (get the session into Firestore)

```bash
# Run locally once to scan QR and populate Firestore session
USE_FIRESTORE_AUTH=true npm start
```

Scan the QR. Once connected, Ctrl+C. The session is now in Firestore under `_whatsapp_session/whatsapp-bot`.

### Build and deploy to Cloud Run

```bash
# Build the container
gcloud builds submit --tag gcr.io/bombay-bioworks/whatsapp-bot

# Deploy with min 1 instance (always on)
gcloud run deploy whatsapp-bot \
  --image gcr.io/bombay-bioworks/whatsapp-bot \
  --platform managed \
  --region asia-south1 \
  --min-instances 1 \
  --max-instances 1 \
  --memory 512Mi \
  --no-allow-unauthenticated \
  --set-env-vars "ANTHROPIC_API_KEY=sk-ant-...,FIREBASE_PROJECT_ID=bombay-bioworks,GROUP_JID=...,USE_FIRESTORE_AUTH=true"
```

> **Note:** `--min-instances 1` is required. Without it, the container scales to zero and loses the WebSocket connection.

### Firestore rules for session storage

Add this to your `firestore.rules` to restrict session access to the bot's service account:

```
match /_whatsapp_session/{document=**} {
  allow read, write: if false; // server-only via Admin SDK
}
```

---

## Architecture

```
WhatsApp group messages
        ↓
  Baileys (Node.js)              — receives messages via WhatsApp Web protocol
        ↓
  extract.js (Claude Haiku)      — extracts facts, people, decisions per message
        ↓
  firestore.js                   — writes to Hivemind's notes + people collections
        ↑
  responder.js (Claude Haiku)    — queries Hivemind context to answer @hive questions
        ↑
  @hive trigger in group         — anyone types "@hive ..."
```

**What goes into Hivemind:**
- Each extracted fact → a `note` with tags `['whatsapp', 'extracted', category]`
- Each new external person → a `people` record tagged `whatsapp`
- Browse them in Hivemind → Notes → filter by tag `whatsapp`

**Future (Phase 2):**
- Hivemind UI shows an "Assistant" panel that surfaces WhatsApp intelligence inline
- Other channels (email, calls) feed the same pipeline
- Cross-channel timeline: see all intelligence by person, topic, or date

---

## Files

```
whatsapp/
  src/
    index.js        — main process: Baileys connection + message listener
    history.js      — parse WhatsApp .txt export → batch extract → Hivemind
    extract.js      — Claude Haiku extraction (facts, people, decisions)
    firestore.js    — write intelligence to Hivemind Firestore
    auth-state.js   — Firestore-backed session persistence for cloud deployment
    responder.js    — answer @hive questions from Hivemind context
    store.js        — SQLite for local processing state (progress checkpointing)
    config.js       — env vars
    list-groups.js  — helper to list all WhatsApp groups and their JIDs
  Dockerfile        — Cloud Run container
  .env.example      — env var template
  serviceAccount.json  — Firebase service account (gitignored, never commit)
```
