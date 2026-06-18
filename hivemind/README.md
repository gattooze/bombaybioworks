# 🧠 Hivemind — Bombay Bioworks

A shared **collective intelligence + note-taking hub** for a small team talking to lots of people.
Take rich notes, log every conversation (and **who spoke to whom, when and in what form**), attach images / voice recordings / files, and search the whole shared brain.

**Live app:** _enabled via GitHub Pages — see the repo's Settings → Pages for the URL._

---

## What it does

| Area | What you get |
|------|--------------|
| 🏠 **Home** | At-a-glance status: recent notes, counts, breakdown by interaction type, quick actions. (No leaderboards or gamification.) |
| 📝 **Notes** | One unified record for everything. A note has a **type** (In person / Phone / Video / Email / Message / Event / Note), participants, context, a **full rich-text body** (headings, sizes, **bold**, *italic*, lists, colours, quotes, links…), an **auto-generated summary**, tags, and **attachments** (images, audio recordings, video, PDFs). |
| 🕸️ **Timeline** | The relationship history: **who spoke to whom, when, and in what form**, grouped by day. Same data as Notes, shown as an interaction timeline. |
| 🙋 **People** | A contact directory of everyone you talk to — org, role, contacts, tags, background, and full interaction history per person. |
| 🔍 **Search** | One search box across all notes, people, context and tags. |
| 💾 **Backup** | Export/import the whole hive as JSON. |

### On "Notes" vs "Timeline"
They're the **same records**, two lenses. A note *is* an interaction (tagged with its type). **Notes** is the working list you read and edit; **Timeline** is the chronological "who-met-whom" view of those same notes. Notes of type *Note* (a standalone thought) simply don't appear in the Timeline.

### Rich text & note-taking
The note body uses the [Quill](https://quilljs.com) editor: headings, font sizes, bold/italic/underline/strike, text & highlight colour, ordered/bulleted/checklist lists, indents, alignment, blockquotes, code blocks and links — everything you'd expect from a proper note-taking app.

### Auto-summary
Every note gets a **one-line summary generated automatically** from its body (extractive: it scores sentences by keyword salience and picks the most representative ones). It updates live as you type, and you can edit it or hit **✨ Auto-summarise** to regenerate. _(If you later want LLM-quality summaries, the summary function is the single place to swap in an API call.)_

---

## Two ways to run it

### 1. Local mode (default — zero setup)
Open the app and it just works. Data is stored privately in **your browser** (IndexedDB). Use **Settings → Export JSON** to back up or move data.

### 2. Shared cloud mode (the whole team, one brain) — ~2 minutes
To collaborate, connect a free [Supabase](https://supabase.com) project. No redeploy needed — you paste keys into **Settings**.

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql) (creates the tables + a public `attachments` storage bucket).
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. In Hivemind open **⚙️ Settings → Shared cloud sync**, paste both, click **Connect & reload**.
5. Share the app URL + the same two keys with teammates. You're all on one hive. 🧠

> The anon key is a public client key — safe to share within your team. The schema uses permissive policies so any teammate with the key can read/write. Add Supabase Auth + row-level security later if you want tighter control.

---

## Tech & rationale

- **Zero-build static SPA** (React 18 + Babel-standalone + Tailwind, Quill, Supabase — all via CDN). No `npm install`, no build step.
- **Why static?** Purely for *deployment*: GitHub Pages serves the files directly and every push updates the live site — no build server, no hosting account. It does **not** limit features — rich text, auto-summary and uploads all run client-side. Migrating to a framework (Next.js/Vite) later is straightforward.
- **Local persistence** via IndexedDB; optional shared backend via **Supabase** (Postgres + Storage).

## Run locally
Open `index.html`, or serve the folder:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy
Hosted on **GitHub Pages** from the `main` branch (root). Any push updates the live site.

---

_Built for the hive. Take notes, log what you learn, and let the collective memory compound._
