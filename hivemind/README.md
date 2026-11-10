# Hivemind · Bombay Bioworks

Internal CRM + note-taking + task management for the Bombay Bioworks team.

**Live:** https://bombay-bioworks.web.app

## What it does
- Log conversations, meetings, calls with auto-summary
- Track relationships (People) with interaction history
- Manage tasks with assignees, priorities, due dates
- Timeline view of all interactions
- Cloud-synced via Firebase Firestore

## Stack
Zero-build SPA — no bundler, no node_modules.
- React 18 UMD + Babel Standalone (runtime JSX)
- Tailwind Play CDN with custom forest-green palette
- Firebase Firestore + Auth + Storage (compat SDK v9.23.0)
- Quill rich-text editor

## Access
Google Sign-In only. Auto-approved accounts:
- `connect@pratikagarwal.com` (Pratik / PA — admin)
- `mukundkhetan@gmail.com` (Mukund / MK)
- `karan@mbplgroup.com` (Karan / KV)
- Any `*@bombaybioworks.com` email

Others must request access; admin approves via Firebase Console.

## Deploy
```bash
firebase deploy
```

Firebase CLI: `~/.npm-global/bin/firebase`  
Project: `bombay-bioworks`

## Design system
Bombay Bioworks v1.0 — Forest Green (#3E6448), Steel Blue (#5C9AB8), Cranberry (#A85268), Inter font, hexagon logo.

See `CLAUDE.md` for full schema, access rules, and AI agent guidance.
