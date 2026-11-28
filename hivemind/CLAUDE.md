# Hivemind: guide for AI agents

Hivemind is Bombay Bioworks' internal platform: CRM, notes, tasks, and over time the
assistant, production, quality and plant data. Live at https://hivemind.bombaybioworks.com.
Roadmap and architecture: `PLATFORM.md`.

## Stack
- Vite 6 + React 18 + React Router v6, Tailwind v3 with the BB DS v1.0 tokens (`src/styles/tokens.css`)
- Firebase v10: Firestore, Auth (Google), Storage. Project `bombay-bioworks`
- zod for the ontology schemas; vitest for tests

## Layout
| Path | What |
|---|---|
| `app/index.html` | Vite entry. Keep it here. |
| `index.html` | GitHub Pages redirect for bombaybioworks.com/hivemind. Not the app. Do not turn it back into the Vite entry. |
| `ontology/` | The shared object model: schemas, repo, normalisation, storage adapters. Framework-free, used by the app, the bot and scripts. |
| `src/` | The React app. `lib/store.js` builds the repo; `context/AppContext.jsx` exposes it. |
| `firestore.rules` | Per-collection rules. Unlisted collections are closed. |
| `tests/` | `ontology.test.js` (pure), `rules.test.js` (needs the emulator) |
| `scripts/` | One-off jobs, dry run by default (`migrate-orgs.mjs`) |

## The rules that matter
1. **Every read and write goes through the ontology repo** (`ontology/repo.js`). It validates
   against `ontology/schemas.js` and writes an Event in the same batch. Never call Firestore
   directly from a module, the bot or a script.
2. **Only the Hivemind core thread changes `ontology/`.** Other workstreams ask for schema changes there.
   A schema change ships with: the zod schema, the matching block in `firestore.rules`, and tests.
3. **Events are append-only.** A client may only log itself as the actor. Only the server marks
   outbound messages sent.
4. **Nothing leaves the company without approval.** Outbound email and WhatsApp go to `outbox`
   as drafts. A person approves, or a standing approval in `approvals` (granted only by Pratik) covers it.
5. **Machine-extracted data lands in `observations`** (the capture inbox) for a human to accept,
   never straight into people or notes.
6. Apply the BB Design System v1.0 to all UI. No em-dashes in user-facing copy.
7. Do not weaken security rules. Keep `isApproved()` on every collection.

## Collections
Existing data keeps its collection names: `people` (Person), `notes` (Interaction), `tasks` (Task).
New: `organisations`, `deals`, `samples`, `commitments`, `decisions`, `observations`, `outbox`,
`approvals`, `events`. Field definitions live in `ontology/schemas.js`, which is the source of truth.

Founder person ids: PA `b74cd94f-1949-407a-af1e-18985667ade3`, MK `3acbe1d8-a619-4627-911b-1384446aa47d`,
KV `c50858cb-a46c-4686-8ebf-0b948dd19eb1`.

## Access
Auto-approved: connect@pratikagarwal.com (admin), mukundkhetan@gmail.com, karan@mbplgroup.com,
any @bombaybioworks.com address. Others need a `_access/{uid}` doc (Firebase console).
Company mailbox: founders@bombaybioworks.com (a Workspace user).

## Commands
```bash
npm install
npm run dev          # needs the emulators running: npm run emulators
npm test             # ontology tests
npm run test:rules   # rules tests, starts the Firestore emulator (needs Java)
npm run build        # outputs dist/
npm run migrate:orgs # dry run; add -- --apply to write
```
Deploys: merging to main runs `.github/workflows/firebase-deploy.yml` (build, then Firebase Hosting).
Pull requests get a preview channel that talks to the **live** Firestore. Treat previews as production data.
Rules deploy separately: `npx firebase deploy --only firestore:rules`.

## Hivemind data from any Claude thread

Native MCP tools from `.mcp.json` do not load in project threads (tested 28 Nov 2026).
Call the live server directly instead. It works from every cloud session in this environment:
the allowed host is set, and the environment's network secret adds the Bearer token, so no secret
goes in code or chat.

```bash
hivemind/mcp/hm.sh hivemind_attention
hivemind/mcp/hm.sh hivemind_search '{"query":"steel"}'
hivemind/mcp/hm.sh hivemind_list '{"type":"person","where":{"segment":"demand"},"limit":20}'
hivemind/mcp/hm.sh hivemind_get '{"type":"person","id":"<id>"}'
hivemind/mcp/hm.sh hivemind_describe '{"type":"person"}'
```

Tools: `hivemind_describe`, `hivemind_search`, `hivemind_get`, `hivemind_timeline`, `hivemind_list`,
`hivemind_attention`, `hivemind_create`, `hivemind_update`, `hivemind_capture`.
Run `hivemind_describe` before a write to see the fields. Writes go through the ontology repo
and log an Event. Facts you are unsure of go to `hivemind_capture`, not `hivemind_create`.
The script exits 1 on a tool error and 2 if the server is unreachable (host not allowed or secret missing).
