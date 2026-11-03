-- Game ON migration 0004: player reporting and trust/safety case management.
-- Apply after 0001, 0002 and 0003.

create table if not exists public.game_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  category text not null check (category in ('misleading_listing', 'suspicious_or_unsafe', 'inappropriate_content', 'copyright_or_ip', 'harassment_or_abuse', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'resolved', 'dismissed')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  moderator_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_user_id, game_id, category)
);

create index if not exists game_reports_queue_idx
  on public.game_reports(status, created_at asc)
  where status in ('pending', 'in_review');
create index if not exists game_reports_game_idx on public.game_reports(game_id, created_at desc);

alter table public.game_reports enable row level security;

-- Players can report only published games, cannot report their own studio's game,
-- and can read only the reports they personally submitted.
drop policy if exists "game_reports_insert_own_published" on public.game_reports;
create policy "game_reports_insert_own_published" on public.game_reports
for insert to authenticated
with check (
  reporter_user_id = auth.uid()
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and moderator_note is null
  and exists (select 1 from public.games g where g.id = game_id and g.status = 'published')
  and not exists (
    select 1 from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "game_reports_read_own" on public.game_reports;
create policy "game_reports_read_own" on public.game_reports
for select to authenticated using (reporter_user_id = auth.uid());

-- No client UPDATE/DELETE policies: moderation actions are server-side only.
create or replace function public.protect_game_report_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.reporter_user_id := auth.uid();
      new.status := 'pending';
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.moderator_note := null;
    elsif new.reporter_user_id is distinct from old.reporter_user_id
       or new.status is distinct from old.status
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.moderator_note is distinct from old.moderator_note then
      raise exception 'Report ownership and moderation state are managed by Game ON.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_game_report_metadata_trigger on public.game_reports;
create trigger protect_game_report_metadata_trigger
before insert or update on public.game_reports
for each row execute function public.protect_game_report_metadata();

comment on table public.game_reports is 'Private player reports for Game ON Trust & Safety; only reporter and trusted moderators can view.';
