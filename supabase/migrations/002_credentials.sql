-- Migration 002: Per-user credential store
-- Credentials are stored encrypted. The encryption key lives in
-- SUPABASE_ENCRYPTION_KEY (server env var only — never in the DB).

-- ─── Credentials ─────────────────────────────────────────────────────────────
-- Stores per-project store and repo credentials.
-- `encrypted_value` holds AES-256-GCM ciphertext (base64).
-- The server decrypts on every use; the raw secret never leaves the server.

create table if not exists credentials (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid references projects(id) on delete cascade,
  -- NULL project_id = global/account-level credential (e.g. shared Play account)
  provider        text not null,
  -- 'google_play' | 'app_store' | 'github' | 'android_keystore'
  label           text not null,
  -- Human-readable label, e.g. "My Play Console account"
  encrypted_value text not null,
  -- AES-256-GCM encrypted JSON blob containing the actual secret fields
  metadata        jsonb not null default '{}',
  -- Non-secret metadata: account email, package name scope, etc.
  is_valid        boolean,
  -- NULL = not yet validated, true/false = last validation result
  last_validated_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_credentials_project_id on credentials(project_id);
create index if not exists idx_credentials_provider on credentials(provider);

create trigger update_credentials_updated_at
  before update on credentials
  for each row execute function update_updated_at_column();
