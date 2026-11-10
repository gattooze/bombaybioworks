# Hivemind — Platform Roadmap

This document captures where Hivemind is going. If you are a Claude agent reading this, the current state of `app.jsx` is a Phase 1 prototype. Build toward the architecture described here.

---

## What Hivemind will become

The operational nerve centre of Bombay Bioworks — a manufacturing company building bamboo activated carbon. It starts as a CRM and grows into a full internal platform covering relationships, production runs, quality, R&D, procurement, and eventually real-time machine data from the plant floor.

The reference platform architectures we modelled this on: Palantir Foundry (ontology layer, module composability), OSIsoft PI (time-series historian + document split), and standard MES patterns (SCADA → historian → app layer).

---

## Three non-negotiable decisions

Lock these in before adding any new module. Retrofitting them onto N modules costs N× more.

### 1. Migrate to Vite
Current zero-build (single app.jsx, CDN React) is correct for a prototype. Wrong for a platform. It prevents code splitting, lazy loading, proper module isolation, and testability. Vite adds a 5-minute build step and unlocks everything else.

Do this before the next module is built.

### 2. Define the ontology
The shared object model that all modules read from. Core objects:
- **Equipment** — carbonisers, activators, any plant asset
- **Batch** — a production run, the central object for manufacturing
- **Site** — Guwahati plant, future sites
- **Person** — contacts, team members, suppliers' reps
- **Supplier** — raw material and service suppliers
- **Document** — SOPs, reports, compliance records

No module should query raw Firestore collections directly. Every module reads through these typed objects. This is what prevents the "every module has its own schema" entropy that kills internal platforms.

### 3. Split the database before machine data arrives
Firestore handles documents and collaborative data. It cannot handle machine sensor data — high-frequency, time-indexed, append-only reads/writes.

Two databases:
- **Firestore** — notes, tasks, people, batches, decisions, QC reports
- **TimescaleDB or InfluxDB** — temperature, pressure, flow, cycle times, OEE components (anything at >1 reading/minute from a machine)

Pick the time-series DB and provision it before any plant connectivity work begins. Migration after the fact is brutal.

---

## Module roadmap

### Phase 1 — Foundation (current)
- **App shell** — Vite migration, React Router, lazy-loaded modules, card grid homepage, role-aware module visibility
- **CRM + Notes** — already built, refactor into proper module structure during migration

### Phase 2 — Manufacturing core
- **Manufacturing Ops** — production runs, batch tracking, manual downtime logging, OEE (manual entry first)
- **Quality** — defect logging, iodine value tracking, batch traceability, SPC charts
- **R&D / Process** — experiment logs, carbonisation and activation formulation records, iteration tracking
- **Procurement** — supplier contacts, PO tracking, raw material inventory, pricing history

### Phase 3 — Plant connectivity
- **Maintenance** — equipment history, preventive maintenance schedules, work orders (linked to Equipment ontology object)
- **Machine data** — real-time sensor feeds via MQTT → stream processor → time-series DB → WebSocket → live dashboards; offline-first on the floor
- **Simulator** — process modelling, yield and efficiency optimisation, what-if scenarios (informed by real production data)

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

## Tech stack evolution

| Now | Phase 1 | Phase 2 | Phase 3 |
|-----|---------|---------|---------|
| Zero-build SPA | Vite + React Router | Cloud Functions backend | TimescaleDB + MQTT |
| Single app.jsx | Module files, lazy-loaded | Manufacturing modules | Real-time WebSocket |
| CDN React | npm packages | Ontology locked | Offline floor support |
| Firebase Hosting | Same hosting | Role-based permissions | Simulator |

---

## The one rule above all

When machine data eventually flows from the plant, a network outage or app bug must never stop the line. **The plant runs; the app catches up.**

Every architectural decision should be made with this constraint in mind: offline-first at the floor, sync when available, never block production on connectivity.

---

## Context

- Company: Bombay Bioworks — building bamboo activated carbon, Guwahati-first
- Stage: Early — first plant being designed, no machine connectivity yet
- Team: Pratik Agarwal (PA), Mukund Khetan (MK), Karan Vora (KV)
- Live app: https://bombay-bioworks.web.app
- Current data: 5 people + 3 notes seeded (key advisor calls, founders meeting)
