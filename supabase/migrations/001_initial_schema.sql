-- BobShip Database Schema
-- Migration 001: Initial Schema

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Projects ────────────────────────────────────────────────────────────────

create table if not exists projects (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  repo_url      text not null,
  repo_branch   text not null default 'main',
  platform      text not null default 'android' check (platform in ('android', 'ios', 'both')),
  framework     text not null default 'react_native',
  status        text not null default 'idle' check (
    status in ('idle', 'analyzing', 'building', 'ready', 'submitting', 'submitted')
  ),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Analyses ────────────────────────────────────────────────────────────────

create table if not exists analyses (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  app_name            text,
  package_id          text,
  framework           text,
  version_name        text,
  version_code        text,
  min_sdk             text,
  target_sdk          text,
  features            jsonb not null default '[]',
  permissions         jsonb not null default '[]',
  api_deps            jsonb not null default '[]',
  privacy_flags       jsonb not null default '[]',
  navigation_screens  jsonb not null default '[]',
  existing_assets     jsonb not null default '{}',
  readiness_score     integer not null default 0,
  checks              jsonb not null default '[]',
  raw_report          text,
  created_at          timestamptz not null default now()
);

-- ─── Builds ──────────────────────────────────────────────────────────────────

create table if not exists builds (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  status          text not null default 'pending' check (
    status in ('pending', 'running', 'succeeded', 'failed')
  ),
  build_type      text not null default 'release' check (build_type in ('debug', 'release')),
  artifact_url    text,
  apk_url         text,
  build_log       text,
  gradle_version  text,
  node_version    text,
  duration_ms     integer,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Store Metadata ──────────────────────────────────────────────────────────

create table if not exists store_metadata (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  analysis_id         uuid references analyses(id) on delete set null,
  store               text not null default 'google_play' check (store in ('google_play', 'app_store')),
  language            text not null default 'en-US',
  title               text,
  short_description   text,
  full_description    text,
  whats_new           text,
  keywords            text,
  category            text,
  content_rating      text,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Screenshots ─────────────────────────────────────────────────────────────

create table if not exists screenshots (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  store         text not null default 'google_play',
  device_type   text not null default 'phone' check (device_type in ('phone', 'tablet_7', 'tablet_10')),
  screen_name   text not null,
  file_path     text,
  file_url      text,
  order_index   integer not null default 0,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── Release Jobs ─────────────────────────────────────────────────────────────

create table if not exists release_jobs (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  store               text not null default 'google_play',
  track               text not null default 'internal' check (
    track in ('internal', 'alpha', 'beta', 'production')
  ),
  status              text not null default 'pending_approval' check (
    status in ('pending_approval', 'approved', 'submitting', 'submitted', 'failed')
  ),
  build_artifact      text,
  google_edit_id      text,
  submission_result   jsonb,
  approved_at         timestamptz,
  approved_by         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────

create table if not exists audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  action      text not null,
  actor       text not null default 'system' check (actor in ('system', 'user')),
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_analyses_project_id on analyses(project_id);
create index if not exists idx_builds_project_id on builds(project_id);
create index if not exists idx_store_metadata_project_id on store_metadata(project_id);
create index if not exists idx_screenshots_project_id on screenshots(project_id);
create index if not exists idx_release_jobs_project_id on release_jobs(project_id);
create index if not exists idx_audit_logs_project_id on audit_logs(project_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_projects_status on projects(status);

-- ─── Updated At Trigger ───────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_projects_updated_at
  before update on projects
  for each row execute function update_updated_at_column();

create trigger update_builds_updated_at
  before update on builds
  for each row execute function update_updated_at_column();

create trigger update_store_metadata_updated_at
  before update on store_metadata
  for each row execute function update_updated_at_column();

create trigger update_release_jobs_updated_at
  before update on release_jobs
  for each row execute function update_updated_at_column();
