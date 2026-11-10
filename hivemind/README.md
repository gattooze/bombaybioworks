# Hivemind · Bombay Bioworks

Internal operating platform for the Bombay Bioworks team — notes, relationships, tasks, and eventually the full plant.

**Live:** https://hivemind.bombaybioworks.com

## What it does
- Log conversations, meetings, calls, emails with rich notes and auto-summary
- Track relationships (People) with full interaction history
- Manage tasks with assignees, priorities, due dates — board and list views
- Timeline view of all interactions across the company
- Cloud-synced via Firebase Firestore; falls back to IndexedDB when signed out

## Stack
- **Build:** Vite 6 + React 18 + React Router v6
- **Styling:** Tailwind v3 PostCSS with custom forest-green palette
- **Backend:** Firebase v10 modular SDK — Firestore, Auth (Google), Storage
- **Rich text:** Quill v2 (npm) with TF-IDF auto-summary
- **Dev:** Firebase emulators (Auth 9099, Firestore 8080, Storage 9199)

## Dev setup
```bash
npm install
```

Start emulators first (separate terminal — required before `npm run dev`):
```bash
firebase emulators:start
```

Then start the dev server:
```bash
npm run dev        # Vite at localhost:5173, auto-connects to emulators
```

> Firebase CLI: install once with `npm install -g firebase-tools`, then authenticate with `firebase login`.  
> In dev mode the app talks to local emulators only — no production data is touched.

## Deploy
```bash
npm run build
firebase deploy --only hosting
```

Project: `bombay-bioworks`

## Access
Google Sign-In only. Auto-approved:
- `connect@pratikagarwal.com` — Pratik Agarwal (PA, admin)
- `mukundkhetan@gmail.com` — Mukund Khetan (MK)
- `karan@mbplgroup.com` — Karan Vora (KV)
- Any `*@bombaybioworks.com` email

Others request access from the app; admin approves via Firebase Console → Firestore → `_access/{uid}`.

## Architecture
See [`PLATFORM.md`](PLATFORM.md) for the module roadmap, ontology decisions, and target architecture.  
Firestore schema and collection shapes are in [`CLAUDE.md`](CLAUDE.md) (also serves as AI agent context).

## Design system
Bombay Bioworks Design System v1 — tokens in [`src/styles/tokens.css`](src/styles/tokens.css).

- **Fonts:** Inter (all copy) · IBM Plex Mono (numbers, stats, meta)
- **Colors:** Forest Green `#3E6448` (primary) · Steel Blue `#5C9AB8` (secondary) · Cranberry `#A85268` (CarbonFuel/energy only)
- **Tokens:** CSS custom properties (`--p`, `--tx`, `--card`, `--line`, `--sp-*`, `--r-*`, `--shadow-*`) — use these in new components, not Tailwind gray values
- **Source of truth:** [BB Design System artifact](https://claude.ai/artifact/EGNPavepYRXERqnM9aZzfc)
