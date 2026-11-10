# Hivemind — Platform Roadmap

The operational nerve centre of Bombay Bioworks — a manufacturing company building bamboo activated carbon. Starts as a CRM and grows into a full internal platform covering relationships, production runs, quality, R&D, procurement, and eventually real-time machine data from the plant floor.

Reference architectures: Palantir Foundry (ontology layer, module composability), OSIsoft PI (time-series historian + document split), standard MES patterns (SCADA → historian → app layer).

**Live:** https://hivemind.bombaybioworks.com  
**Stack:** Vite 6 + React 18 + React Router v6 + Firebase v10 (Firestore, Auth, Storage)

---

## Current state — Phase 1 complete

The Vite migration is done. The app runs as a modular, lazy-loaded SPA with:
- App shell (Shell.jsx, React Router, global modal architecture)
- CRM (People + interaction history)
- Notes (rich text, participants, attachments, TF-IDF auto-summary)
- Tasks (board + list, priorities, assignments)
- Timeline (notes grouped by month)
- Settings
- Google Auth with allowlist access control
- IndexedDB fallback when signed out

---

## The one open architecture decision

### Define the ontology — do this before Phase 2

The shared object model all modules read from. Core objects:

- **Equipment** — carbonisers, activators, any plant asset
- **Batch** — a production run, the central object for manufacturing
- **Site** — Guwahati plant, future sites
- **Person** — contacts, team members, suppliers' reps (exists today)
- **Supplier** — raw material and service suppliers
- **Document** — SOPs, reports, compliance records

No module should query raw Firestore collections directly. Every module reads through these typed objects. This is what prevents the "every module has its own schema" entropy that kills internal platforms.

---

## The one rule above all

When machine data eventually flows from the plant, a network outage or app bug must never stop the line. **The plant runs; the app catches up.**

Every architectural decision should be made with this constraint in mind: offline-first at the floor, sync when available, never block production on connectivity.

---

## Module roadmap

### Phase 1 — Foundation ✓ done
- App shell, React Router, lazy-loaded modules, homepage
- CRM + Notes, Tasks, Timeline, Settings
- Firebase Auth + Firestore + Storage
- Bombay Bioworks design system tokens applied

### Phase 2 — Manufacturing core
- **Manufacturing Ops** — production runs, batch tracking, manual downtime logging, OEE (manual entry first)
- **Quality** — defect logging, iodine value tracking, batch traceability, SPC charts
- **R&D / Process** — experiment logs, carbonisation and activation formulation records, iteration tracking
- **Procurement** — supplier contacts, PO tracking, raw material inventory, pricing history

### Phase 3 — Plant connectivity
- **Maintenance** — equipment history, preventive maintenance schedules, work orders
- **Machine data** — real-time sensor feeds via MQTT → stream processor → time-series DB → WebSocket → live dashboards; offline-first on the floor
- **Simulator** — process modelling, yield and efficiency optimisation, what-if scenarios

### Phase 4 — Intelligence layer
- **Analytics** — cross-module reporting, BigQuery backend
- **Alerts + Anomaly** — threshold-based alerts, anomaly detection, push notifications via Cloud Functions
- **Documents + SOPs** — operating procedures, compliance docs, audit trails

---

## Target architecture

```
┌────────────────────────────────────────────────────────────┐
│  App shell  │  CRM  │  Mfg  │  Quality  │  R&D  │  ...   │
│            (each module lazy-loaded, independent route)    │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────┐
│                    Ontology layer                          │
│    Equipment · Batch · Site · Person · Supplier · Doc      │
│    (shared typed objects — no module queries raw tables)   │
└──────────┬─────────────────────────────────────┬──────────┘
           │                                     │
┌──────────▼──────────┐             ┌────────────▼──────────┐
│  Firestore          │             │  TimescaleDB/InfluxDB  │
│  Notes, tasks,      │             │  Sensor time-series,  │
│  people, batches,   │             │  OEE, energy, cycle   │
│  QC records         │             │  times                │
└─────────────────────┘             └───────────────────────┘
```

Cloud Functions handle server-side logic: AI summaries, alert thresholds, batch validation.

Machine data ingestion path:
`Plant sensors → MQTT broker (runs locally, offline-capable) → Cloud Function → time-series DB → WebSocket → app`

---

## Database split

Firestore handles documents and collaborative data. It cannot handle machine sensor data — high-frequency, time-indexed, append-only reads/writes.

Two databases (Phase 3):
- **Firestore** — notes, tasks, people, batches, decisions, QC reports
- **TimescaleDB or InfluxDB** — temperature, pressure, flow, cycle times, OEE components (anything at >1 reading/minute from a machine)

Pick the time-series DB and provision it before any plant connectivity work begins.

---

## Permission hierarchy

```
Organisation (Admin)
└── Site: Guwahati plant (Plant Manager)
    └── Production line (Manager, Operator)
        └── Equipment (Operator, Viewer)

Orthogonal: Finance / HR / supplier margins → Admin only
```

Access granted at any node is inherited downward. Financial and HR data sits outside the plant hierarchy on a separate permission axis.

---

## Tech stack

| Layer | Current | Phase 2 | Phase 3 |
|-------|---------|---------|---------|
| Build | Vite 6 + React 18 | Same | Same |
| Routing | React Router v6, lazy modules | Add ontology layer | Same |
| Backend | Firebase Firestore + Auth + Storage | Cloud Functions | TimescaleDB + MQTT |
| Styling | Tailwind v3 + BB DS tokens | Same | Same |
| Real-time | Firestore listeners | Same | WebSocket from time-series DB |

---

## Context

- Company: Bombay Bioworks — building bamboo activated carbon, Guwahati-first
- Stage: Early — first plant being designed, no machine connectivity yet
- Team: Pratik Agarwal (PA), Mukund Khetan (MK), Karan Vora (KV)
