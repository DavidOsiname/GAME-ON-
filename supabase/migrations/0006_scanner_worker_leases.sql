-- Game ON migration 0006: scanner worker leases, stale-job recovery and safe retries.
-- A lease token prevents an expired worker from reporting a result after another
-- worker has reclaimed the same build.

alter table public.game_builds
  add column if not exists scan_started_at timestamptz,
  add column if not exists scan_worker_id text,
  add column if not exists scan_attempts integer not null default 0
    check (scan_attempts >= 0);

create index if not exists game_builds_scanner_queue_idx
  on public.game_builds(upload_status, scan_status, scan_started_at, created_at);

comment on column public.game_builds.scan_worker_id is 'Ephemeral scanner lease token; results are accepted only from the worker holding the current lease.';
comment on column public.game_builds.scan_attempts is 'Number of scanner leases claimed for this build.';

-- Recover any pre-lease or legacy scanning rows created by an earlier worker model.
update public.game_builds
set scan_status = 'quarantined',
    scan_started_at = null,
    scan_worker_id = null,
    scan_report = coalesce(scan_report, 'Requeued during scanner lease migration.')
where scan_status = 'scanning' and scan_started_at is null;
