-- 🧠 Hivemind — Supabase schema for Bombay Bioworks
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table if not exists people (
  id          text primary key,
  name        text not null,
  org         text,
  role        text,
  email       text,
  phone       text,
  tags        jsonb default '[]'::jsonb,
  notes       text,
  created_by  text,
  created_at  timestamptz default now()
);

-- A "note" is the single core record: a logged conversation OR a standalone note.
create table if not exists notes (
  id                    text primary key,
  title                 text,
  type                  text,                 -- in_person | phone | video | email | message | event | note | other
  datetime              timestamptz,          -- when the interaction happened
  context               text,
  location              text,
  participant_ids       jsonb default '[]'::jsonb,
  external_participants jsonb default '[]'::jsonb,
  body                  text,                 -- rich-text HTML from the editor
  summary               text,                 -- auto-generated, editable
  tags                  jsonb default '[]'::jsonb,
  attachments           jsonb default '[]'::jsonb,
  logged_by             text,
  created_by            text,
  created_at            timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security — permissive team-wide access via the anon key.
-- (Tighten later with Supabase Auth if you need per-user control.)
-- ----------------------------------------------------------------------------
alter table people enable row level security;
alter table notes  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['people','notes'] loop
    execute format('drop policy if exists "team_all" on %I;', t);
    execute format('create policy "team_all" on %I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Storage bucket for attachments (images / recordings / files)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attachments_read"  on storage.objects;
drop policy if exists "attachments_write" on storage.objects;
drop policy if exists "attachments_del"   on storage.objects;
create policy "attachments_read"  on storage.objects for select using (bucket_id = 'attachments');
create policy "attachments_write" on storage.objects for insert with check (bucket_id = 'attachments');
create policy "attachments_del"   on storage.objects for delete using (bucket_id = 'attachments');
