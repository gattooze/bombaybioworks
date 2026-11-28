// Hivemind ontology v1: the one shared object model.
// Every reader and writer (app, WhatsApp bot, assistant, MCP server, scripts)
// validates through these schemas. Change them only in the Hivemind core thread.
import { z } from 'zod';

// ── Shared pieces ───────────────────────────────────────────────────────────
export const OBJECT_TYPES = [
  'organisation', 'person', 'interaction', 'task', 'deal', 'sample',
  'commitment', 'decision', 'observation', 'outbox', 'approval', 'event',
  'objective', 'workstream', 'status_report',
];

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optStr = z.string().optional();
const id = z.string().min(1);

export const Link = z.object({ type: z.enum(OBJECT_TYPES), id });

export const Source = z.object({
  channel: z.enum(['manual', 'whatsapp', 'email', 'calendar', 'assistant', 'import', 'linkedin_paste', 'other']).default('manual'),
  ref: optStr, // message id, Gmail thread id, file name
  by: optStr,  // who or what produced it
}).default({ channel: 'manual' });

const base = {
  id,
  created_at: isoDateTime,
  created_by: z.string().min(1),
  updated_at: isoDateTime.optional(),
  updated_by: optStr,
  tags: z.array(z.string()).default([]),
  links: z.array(Link).default([]),
  archived: z.boolean().default(false),
};

// ── CRM ─────────────────────────────────────────────────────────────────────
export const ORG_ROLES = ['customer', 'supplier', 'investor', 'government', 'lab', 'vendor', 'partner', 'other'];

export const Organisation = z.object({
  ...base,
  name: z.string().trim().min(1, 'Name is required'),
  name_key: z.string().min(1), // normalised for duplicate detection, set by the repo
  roles: z.array(z.enum(ORG_ROLES)).default([]),
  country: z.string().default('IN'),
  city: optStr,
  website: optStr,
  gstin: z.string().regex(/^[0-9A-Z]{15}$/, 'GSTIN is 15 characters').optional().or(z.literal('')),
  notes: z.string().default(''),
  owner_id: optStr, // team member responsible
  merged_into: optStr, // set on the archived duplicate by repo.merge
  source: Source,
});

// Legacy collections keep unknown fields (passthrough) so nothing already stored is lost.
// CRM shows demand contacts (buyers, prospects). Directory holds other business
// contacts (suppliers, vendors, advisors, government). Unsorted waits for triage.
export const PERSON_SEGMENTS = ['demand', 'directory', 'unsorted'];

export const Person = z.object({
  ...base,
  name: z.string().trim().min(1, 'Name is required'),
  org: z.string().default(''), // legacy free text, kept until every person has org_ids
  org_ids: z.array(id).default([]),
  role: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  linkedin_url: optStr,
  notes: z.string().default(''),
  is_team: z.boolean().default(false),
  segment: z.enum(PERSON_SEGMENTS).default('unsorted'),
  merged_into: optStr, // set on the archived duplicate by repo.merge
  source: Source,
}).passthrough();

export const INTERACTION_TYPES = ['in_person', 'phone', 'video', 'email', 'message', 'event', 'note', 'other'];

export const Interaction = z.object({
  ...base,
  title: z.string().trim().min(1, 'Title is required'),
  type: z.enum(INTERACTION_TYPES).default('note'),
  datetime: z.string().min(1),
  context: z.string().default(''),
  location: z.string().default(''),
  participant_ids: z.array(id).default([]),
  external_participants: z.array(z.string()).default([]),
  org_ids: z.array(id).default([]),
  body: z.string().default(''),
  summary: z.string().default(''),
  attachments: z.array(z.any()).default([]),
  logged_by: optStr,
  source_channel: optStr, // legacy, superseded by source
  provider_ref: optStr,   // e.g. Gmail message id, so re-syncs do not duplicate
  thread_ref: optStr,     // e.g. Gmail thread id
  source: Source,
}).passthrough();

export const Task = z.object({
  ...base,
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().default(''),
  assigned_to: z.string().nullable().default(null),
  assigned_to_name: z.string().default(''),
  due_date: isoDate.optional().or(z.literal('')),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  linked_note_id: z.string().nullable().default(null),
  linked_note_title: z.string().nullable().default(null),
}).passthrough();

export const PIPELINES = {
  sales:    ['lead', 'qualified', 'sample_sent', 'trial', 'negotiation', 'po', 'won', 'lost'],
  sourcing: ['identified', 'visited', 'sample_tested', 'terms', 'approved', 'dropped'],
  funding:  ['target', 'intro', 'pitch', 'diligence', 'term_sheet', 'closed', 'passed'],
};
export const CLOSED_STAGES = ['won', 'lost', 'approved', 'dropped', 'closed', 'passed'];
export const UNITS = ['kg', 'MT', 'L', 'pcs', 'other'];

export const Deal = z.object({
  ...base,
  title: z.string().trim().min(1, 'Title is required'),
  pipeline: z.enum(Object.keys(PIPELINES)),
  stage: z.string().min(1),
  org_id: id,
  contact_ids: z.array(id).default([]),
  owner_id: optStr,
  product: z.string().default(''), // grade or material, becomes a Product link later
  qty: z.number().nonnegative().optional(),
  unit: z.enum(UNITS).optional(),
  price: z.number().nonnegative().optional(), // per unit
  currency: z.string().default('INR'),
  value: z.number().nonnegative().optional(), // total deal value in currency
  next_action: z.string().default(''),
  next_action_date: isoDate.optional().or(z.literal('')),
  closed_reason: z.string().default(''),
  source: Source,
}).superRefine((d, ctx) => {
  if (!PIPELINES[d.pipeline]?.includes(d.stage)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: `Stage "${d.stage}" is not in the ${d.pipeline} pipeline` });
  }
});

export const SAMPLE_STATUSES = ['planned', 'sent', 'received', 'testing', 'feedback', 'closed'];

export const Sample = z.object({
  ...base,
  org_id: id,
  deal_id: optStr,
  contact_id: optStr,
  grade: z.string().trim().min(1, 'Grade is required'),
  qty: z.number().positive(),
  unit: z.enum(UNITS).default('kg'),
  spec: z.string().default(''), // spec sent with it, e.g. iodine 1000 mg/g min
  lot_ref: optStr,              // links to a Material Lot once the process module exists
  status: z.enum(SAMPLE_STATUSES).default('planned'),
  sent_date: isoDate.optional().or(z.literal('')),
  courier: z.string().default(''),
  tracking: z.string().default(''),
  feedback: z.string().default(''),
  result: z.string().default(''),
});

// ── Company state ───────────────────────────────────────────────────────────
export const Commitment = z.object({
  ...base,
  text: z.string().trim().min(1, 'What was promised is required'),
  owner_id: id,                // who owes it (a person)
  counterparty_id: optStr,     // to whom (person or organisation id)
  due_date: isoDate.optional().or(z.literal('')),
  status: z.enum(['open', 'done', 'dropped']).default('open'),
  source: Source,
});

export const Decision = z.object({
  ...base,
  text: z.string().trim().min(1, 'The decision is required'),
  rationale: z.string().default(''),
  decided_by: z.array(id).default([]),
  decided_at: isoDate,
  source: Source,
});

// What the company is trying to achieve, e.g. "First 1 MT order from a steel buyer by Mar 2027".
export const OBJECTIVE_STATUSES = ['active', 'achieved', 'dropped'];

export const Objective = z.object({
  ...base,
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().default(''),
  owner_id: optStr,            // founder person id
  metric: z.string().default(''), // how we know it is done
  target_date: isoDate.optional().or(z.literal('')),
  status: z.enum(OBJECTIVE_STATUSES).default('active'),
});

// An ongoing stream of work (Machinery, Demand, Website, Hivemind, DPR...).
export const WORKSTREAM_STATUSES = ['active', 'paused', 'done'];

export const Workstream = z.object({
  ...base,
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().default(''),
  owner_ids: z.array(id).default([]),
  objective_ids: z.array(id).default([]),
  status: z.enum(WORKSTREAM_STATUSES).default('active'),
  next_milestone: z.string().default(''),
  next_milestone_date: isoDate.optional().or(z.literal('')),
});

// Weekly snapshot of company state. One per week; the assistant drafts it, a founder edits.
export const HEALTH = ['on_track', 'at_risk', 'off_track'];

export const StatusReport = z.object({
  ...base,
  week_of: isoDate,            // Monday of the week
  summary: z.string().trim().min(1, 'Summary is required'),
  workstreams: z.array(z.object({
    workstream_id: id,
    health: z.enum(HEALTH),
    note: z.string().default(''),
  })).default([]),
  highlights: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  asks: z.array(z.string()).default([]), // what the founders need to decide or do
  source: Source,
});

// ── Capture inbox: anything machine-extracted waits here for a human ───────
export const Observation = z.object({
  ...base,
  kind: z.enum(['person', 'organisation', 'fact', 'commitment', 'decision', 'profile', 'email']),
  payload: z.record(z.any()),
  summary: z.string().default(''),
  suggested_links: z.array(Link).default([]),
  status: z.enum(['pending', 'accepted', 'rejected', 'merged']).default('pending'),
  resolved_by: optStr,
  resolved_at: isoDateTime.optional(),
  result_link: Link.optional(),
  source: Source,
});

// ── Outbound: nothing leaves the company without approval ──────────────────
export const OUTBOX_STATUSES = ['draft', 'approved', 'sending', 'sent', 'failed', 'cancelled'];

export const Outbox = z.object({
  ...base,
  channel: z.enum(['email', 'whatsapp']),
  from: z.string().default('founders@bombaybioworks.com'),
  to: z.array(z.string().min(1)).min(1, 'At least one recipient'),
  cc: z.array(z.string()).default([]),
  subject: z.string().default(''),
  body: z.string().min(1, 'Body is required'),
  category: z.string().default(''),     // used to match standing approvals
  status: z.enum(OUTBOX_STATUSES).default('draft'),
  approved_by: optStr,
  approval_id: optStr,                  // standing approval that covered it, if any
  sent_at: isoDateTime.optional(),
  error: optStr,
  provider_ref: optStr,                 // Gmail message id after sending
  source: Source,
});

export const Approval = z.object({
  ...base,
  description: z.string().trim().min(1),
  channel: z.enum(['email', 'whatsapp']),
  recipients: z.array(z.string()).default([]), // empty = any recipient within the category
  category: z.string().default(''),
  max_sends: z.number().int().positive(),
  sends_used: z.number().int().nonnegative().default(0),
  expires_at: isoDateTime,
  revoked: z.boolean().default(false),
});

// ── Event log: append-only record of every change ──────────────────────────
export const Event = z.object({
  id,
  at: isoDateTime,
  actor: z.string().min(1),
  verb: z.enum(['created', 'updated', 'deleted', 'sent', 'approved', 'merged']),
  object: Link,
  fields: z.array(z.string()).default([]),
  summary: z.string().default(''),
  source: Source,
});

// ── Registry: type → collection + schema ───────────────────────────────────
// Collection names for existing data stay as they were (people, notes, tasks).
export const REGISTRY = {
  organisation: { collection: 'organisations', schema: Organisation, label: 'Organisation' },
  person:       { collection: 'people',        schema: Person,       label: 'Person' },
  interaction:  { collection: 'notes',         schema: Interaction,  label: 'Interaction' },
  task:         { collection: 'tasks',         schema: Task,         label: 'Task' },
  deal:         { collection: 'deals',         schema: Deal,         label: 'Deal' },
  sample:       { collection: 'samples',       schema: Sample,       label: 'Sample' },
  commitment:   { collection: 'commitments',   schema: Commitment,   label: 'Commitment' },
  decision:     { collection: 'decisions',     schema: Decision,     label: 'Decision' },
  observation:  { collection: 'observations',  schema: Observation,  label: 'Observation' },
  outbox:       { collection: 'outbox',        schema: Outbox,       label: 'Outbox message' },
  approval:     { collection: 'approvals',     schema: Approval,     label: 'Standing approval' },
  event:        { collection: 'events',        schema: Event,        label: 'Event' },
  objective:    { collection: 'objectives',    schema: Objective,    label: 'Objective' },
  workstream:   { collection: 'workstreams',   schema: Workstream,   label: 'Workstream' },
  status_report:{ collection: 'status_reports',schema: StatusReport, label: 'Status report' },
};

export const collectionOf = (type) => {
  const r = REGISTRY[type];
  if (!r) throw new Error(`Unknown ontology type: ${type}`);
  return r.collection;
};
