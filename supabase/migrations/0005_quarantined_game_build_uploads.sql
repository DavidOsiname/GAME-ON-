-- Game ON migration 0005: controlled game-build ingestion.
-- This migration creates a PRIVATE quarantine bucket. It does not make builds public,
-- approve them, or mark them clean. A trusted malware scanner must call the internal
-- scan-result endpoint before Game ON staff can approve a build for release.

alter table public.game_builds
  alter column sha256_hex drop not null;

alter table public.game_builds
  add column if not exists original_file_name text,
  add column if not exists declared_content_type text not null default 'application/octet-stream',
  add column if not exists upload_status text not null default 'uploaded'
    check (upload_status in ('awaiting_upload', 'uploaded', 'failed')),
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists uploaded_at timestamptz,
  add column if not exists scan_completed_at timestamptz,
  add column if not exists scan_report text,
  add column if not exists release_reviewed_at timestamptz,
  add column if not exists release_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists release_note text;

create index if not exists game_builds_upload_queue_idx
  on public.game_builds(upload_status, scan_status, created_at desc);
create index if not exists game_builds_release_queue_idx
  on public.game_builds(release_status, created_at desc);

-- Supabase Storage buckets are private by default; explicitly retain private access.
-- The project's global Storage limit still applies and can be lower than this bucket cap.
insert into storage.buckets (id, name, public, file_size_limit)
values ('game-build-quarantine', 'game-build-quarantine', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

-- No browser-facing storage.objects policies are created. The Creator server verifies
-- developer/game ownership and creates a one-time signed upload URL via service role.
-- No public bucket, public URL, or player download policy is created here.

comment on table public.game_builds is 'Private game build metadata. Object files remain in private quarantine until external malware scanning and Game ON release approval.';
comment on column public.game_builds.sha256_hex is 'SHA-256 written only by the trusted scanner callback after inspecting the uploaded file.';
comment on column public.game_builds.upload_status is 'Upload transfer state; independent from malware scan and Game ON release approval.';
