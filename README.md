# Hive: the Bombay Bioworks WhatsApp bot

Hive sits in the founders' WhatsApp group. It reads every message, sends what matters
(people, organisations, commitments, decisions, business numbers) to the Hivemind capture
inbox for a founder to accept, and, once it has its own number, answers when tagged and takes
instructions from founders.

```
WhatsApp group ─ Baileys ─┬─ every message ─ Claude Haiku extraction ─ hivemind_capture ─ inbox
                          └─ @hive / @mention / reply to Hive ─ Claude + Hivemind tools ─ reply
```

Hive's rules live in `hivemind/assistant/INSTRUCTIONS.md`. All reads and writes go through the
Hivemind MCP server, so they are validated and logged like any other change.

## Who can do what
| Sender | Ask questions | Change records | Draft outbound messages |
|---|---|---|---|
| Founder (number in `FOUNDER_PHONES`) | Yes | Yes, logged and undoable | Yes, as drafts a founder approves in Hivemind |
| Anyone else in the group | Yes | No | No |

Nothing is ever sent outside the group by Hive. `READ_ONLY=true` (the default) means extract
only, never reply. Keep it on until Hive runs on its own SIM: Baileys is an unofficial client,
and WhatsApp can ban numbers that send automated messages.

## Setup
1. `npm install` (Node 18 or later).
2. `cp .env.example .env` and fill in `ANTHROPIC_API_KEY`, `HIVEMIND_MCP_SECRET`
   (`gcloud secrets versions access latest --secret hivemind-mcp-secret`), `FOUNDER_PHONES`.
3. `npm start`, then scan the QR code from Hive's phone: WhatsApp, Linked devices, Link a device.
4. `npm run groups` to find the group JID, set `GROUP_JID`, restart.
5. When ready for replies: `READ_ONLY=false`, restart.

Backfill from a chat export: `node src/history.js path/to/WhatsApp_Chat.txt` (resumable).

Server: `deploy/create-vm.sh` then `deploy/setup-vm.sh` on an e2-micro VM. Set
`USE_FIRESTORE_AUTH=true` to keep the WhatsApp session in Firestore.

## Cost
Haiku 5.5 at USD 0.10 / 0.50 per million tokens. A busy day of group traffic plus a few dozen
questions should stay well under a dollar (guess, to be measured on a week of real traffic).
Set a monthly limit in the Anthropic console; the company cap is USD 25.

## Files
| File | What |
|---|---|
| `src/index.js` | Connects to WhatsApp, routes each message to extraction or a reply |
| `src/llm.js` | Claude calls: structured extraction and the tool-use loop for replies |
| `src/hivemind-client.js` | JSON-RPC client for the Hivemind MCP server |
| `src/capture.js` | Turns extracted items into capture-inbox entries |
| `src/group.js` | Sender phone, founder check, tag detection, recent-message buffer |
| `src/history.js` | Backfill from a chat export |
| `src/auth-state.js`, `src/firestore.js` | WhatsApp session storage in Firestore |
