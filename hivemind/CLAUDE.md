# Hivemind — AI Agent Collaboration Guide

## What this is
Hivemind is Bombay Bioworks' internal CRM + note-taking + task management tool. It is a **zero-build SPA** deployed on Firebase Hosting at `https://bombay-bioworks.web.app`.

## Stack
- **Frontend**: React 18 (UMD CDN), Babel Standalone (runtime JSX), Tailwind Play CDN, Quill rich-text editor
- **Backend**: Firebase Firestore (data), Firebase Auth (Google Sign-In), Firebase Storage (attachments)
- **Deploy**: Firebase Hosting — `firebase deploy` from this directory
- **No bundler, no node_modules**. All JS loaded from CDN at runtime.

## Files
| File | Purpose |
|------|---------|
| `index.html` | Shell, Tailwind config, CDN imports, favicon |
| `app.jsx` | Entire application (~1100 lines React JSX) |
| `firestore.rules` | Firestore security rules (allowlist-based) |
| `firebase.json` | Firebase project config |
| `.firebaserc` | Active project: `bombay-bioworks` |

## Design System
Brand: **Bombay Bioworks v1.0**
- Primary: Forest Green `#3E6448` → Tailwind class `forest-500`
- Steel Blue: `#5C9AB8`
- Cranberry: `#A85268`
- Font: Inter (Google Fonts)
- Logo: `BBLogo` SVG component in app.jsx (hexagon with 4 gradient wave layers)
- Tailwind forest palette defined in `index.html` tailwind.config

## Access Rules
Access is controlled by `firestore.rules` AND the `Root` component in `app.jsx`.

**Auto-approved (no Firestore check):**
- `connect@pratikagarwal.com` — Pratik Agarwal (PA) — admin
- `mukundkhetan@gmail.com` — Mukund Khetan (MK)
- `karan@mbplgroup.com` — Karan Vora (KV)
- Any `*@bombaybioworks.com` email

**Allowlist-approved**: Users in `_access/{uid}` collection (admin grants via Firebase Console)

**Admin**: Only `connect@pratikagarwal.com` can read/delete `_requests` documents.

## Firestore Collections

### `people`
```
{
  id: string (UUID),
  name: string,
  org: string,
  role: string,
  email: string,
  phone: string,
  tags: string[],
  notes: string,
  created_at: ISO string,
  created_by: string
}
```

**Founder records (pre-seeded IDs):**
- Pratik Agarwal (PA): `b74cd94f-1949-407a-af1e-18985667ade3`
- Mukund Khetan (MK): `3acbe1d8-a619-4627-911b-1384446aa47d`
- Karan Vora (KV): `c50858cb-a46c-4686-8ebf-0b948dd19eb1`

### `notes`
```
{
  id: string (UUID),
  title: string,
  type: 'in_person' | 'phone' | 'video' | 'email' | 'message' | 'event' | 'note' | 'other',
  datetime: ISO string,
  context: string,
  location: string,
  participant_ids: string[] (people IDs),
  external_participants: string[],
  tags: string[],
  body: string (Quill HTML),
  summary: string,
  attachments: array,
  created_at: ISO string,
  created_by: string,
  logged_by: string
}
```

### `tasks`
```
{
  id: string (UUID),
  title: string,
  description: string,
  assigned_to: string | null (people ID),
  assigned_to_name: string,
  due_date: string (YYYY-MM-DD),
  priority: 'high' | 'medium' | 'low',
  status: 'todo' | 'in_progress' | 'done',
  linked_note_id: string | null,
  linked_note_title: string | null,
  tags: string[],
  created_at: ISO string,
  created_by: string
}
```

### `_access` (admin-managed)
```
{ uid: string } — presence = approved user
```

### `_requests` (user-created)
```
{ uid, email, name, requestedAt } — pending access request
```

## Deployment
```bash
# Deploy everything
firebase deploy

# Deploy only rules
firebase deploy --only firestore:rules

# Deploy only hosting
firebase deploy --only hosting
```

Firebase CLI is at `~/.npm-global/bin/firebase`. The project is `bombay-bioworks`.

## People aliases
When referencing founders in code, tasks, or notes:
- PA = Pratik Agarwal (`connect@pratikagarwal.com`)
- MK = Mukund Khetan (`mukundkhetan@gmail.com`)
- KV = Karan Vora (`karan@mbplgroup.com`)

## Collaboration notes
- Do not add bundlers, build steps, or node_modules to this project.
- All styling uses Tailwind utility classes with the `forest` color palette.
- Firestore rules must maintain `isApproved()` check on all app data.
- Do not weaken security rules (no `allow read, write: if true`).
- The API key in `app.jsx` is a Firebase web API key (safe to commit — Firestore rules enforce auth).
