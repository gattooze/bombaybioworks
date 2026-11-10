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
npm run dev                        # Vite at localhost:5173, auto-connects to emulators
~/.npm-global/bin/firebase emulators:start   # separate terminal
```

## Deploy
```bash
npm run build
~/.npm-global/bin/firebase deploy --only hosting
```

Firebase CLI: `~/.npm-global/bin/firebase`  
Project: `bombay-bioworks`

## Access
Google Sign-In only. Auto-approved:
- `connect@pratikagarwal.com` — Pratik Agarwal (PA, admin)
- `mukundkhetan@gmail.com` — Mukund Khetan (MK)
- `karan@mbplgroup.com` — Karan Vora (KV)
- Any `*@bombaybioworks.com` email

Others request access from the app; admin approves via Firebase Console → Firestore → `_access/{uid}`.

## Architecture
See `PLATFORM.md` for the full module roadmap, data ontology, and non-negotiable architecture decisions.  
See `CLAUDE.md` for Firestore schema, access rules, and AI agent guidance.

## Design system
Forest Green `#3E6448` · Steel Blue `#5C9AB8` · Cranberry `#A85268` · Inter font · hexagon BBLogo
