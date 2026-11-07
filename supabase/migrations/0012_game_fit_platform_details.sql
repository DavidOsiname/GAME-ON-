-- Game ON migration 0012: trustworthy, per-platform GAME FIT details.
-- Existing catalogue fields remain untouched. New details default to unknown and unverified.

alter table public.games
  add column if not exists supported_languages text[] not null default '{}';

create table if not exists public.game_platform_details (
  game_id uuid not null references public.games(id) on delete cascade,
  platform text not null check (platform in ('android', 'windows', 'web')),
  official_access_url text,
  download_size_bytes bigint check (download_size_bytes is null or download_size_bytes between 1 and 1099511627776),
  internet_requirement text not null default 'unknown'
    check (internet_requirement in ('unknown', 'offline', 'online', 'both')),
  minimum_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(minimum_requirements) = 'object'),
  recommended_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(recommended_requirements) = 'object'),
  official_access_url_verified_at timestamptz,
  download_size_verified_at timestamptz,
  internet_requirement_verified_at timestamptz,
  minimum_requirements_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, platform),
  check (
    official_access_url is null
    or (
      char_length(official_access_url) between 12 and 2048
      and official_access_url ~ '^https://[^[:space:]]+$'
    )
  )
);

create index if not exists game_platform_details_platform_idx
  on public.game_platform_details(platform, game_id);

alter table public.game_platform_details enable row level security;

-- Explicit grants are required; RLS alone does not expose or secure a Data API table.
revoke all on table public.game_platform_details from public, anon, authenticated;
grant select on table public.game_platform_details to anon;
grant select, insert, update, delete on table public.game_platform_details to authenticated;
grant all on table public.game_platform_details to service_role;

create policy "game_platform_details_public_or_owner_read"
on public.game_platform_details
for select to anon, authenticated
using (
  exists (
    select 1
    from public.games g
    where g.id = game_platform_details.game_id
      and (
        g.status = 'published'
        or exists (
          select 1
          from public.developer_studios s
          where s.id = g.studio_id
            and s.owner_user_id = (select auth.uid())
        )
      )
  )
);

create policy "game_platform_details_owner_insert"
on public.game_platform_details
for insert to authenticated
with check (
  exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_platform_details.game_id
      and s.owner_user_id = (select auth.uid())
      and g.status in ('draft', 'submitted', 'in_review', 'rejected')
  )
);

create policy "game_platform_details_owner_update"
on public.game_platform_details
for update to authenticated
using (
  exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_platform_details.game_id
      and s.owner_user_id = (select auth.uid())
      and g.status in ('draft', 'submitted', 'in_review', 'rejected')
  )
)
with check (
  exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_platform_details.game_id
      and s.owner_user_id = (select auth.uid())
      and g.status in ('draft', 'submitted', 'in_review', 'rejected')
  )
);

create policy "game_platform_details_owner_delete"
on public.game_platform_details
for delete to authenticated
using (
  exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_platform_details.game_id
      and s.owner_user_id = (select auth.uid())
      and g.status in ('draft', 'submitted', 'in_review', 'rejected')
  )
);

-- Developer accounts may submit facts, but cannot self-assign Game ON verification.
create or replace function public.protect_game_platform_detail_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.official_access_url_verified_at := null;
      new.download_size_verified_at := null;
      new.internet_requirement_verified_at := null;
      new.minimum_requirements_verified_at := null;
    else
      if new.official_access_url_verified_at is distinct from old.official_access_url_verified_at
        or new.download_size_verified_at is distinct from old.download_size_verified_at
        or new.internet_requirement_verified_at is distinct from old.internet_requirement_verified_at
        or new.minimum_requirements_verified_at is distinct from old.minimum_requirements_verified_at then
        raise exception 'GAME ON verification markers are managed by authorised moderators.';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.protect_game_platform_detail_verification() from public, anon, authenticated;

drop trigger if exists protect_game_platform_detail_verification on public.game_platform_details;
create trigger protect_game_platform_detail_verification
before insert or update on public.game_platform_details
for each row execute function public.protect_game_platform_detail_verification();

comment on table public.game_platform_details is
  'Per-platform Game Fit facts. Developer-entered values are unverified until authorised Game ON moderation records a verification timestamp.';
comment on column public.game_platform_details.official_access_url is
  'HTTPS game access/store page supplied by the developer; it is not endorsed or verified unless official_access_url_verified_at is set.';
comment on column public.game_platform_details.internet_requirement is
  'Unknown, offline, online, or both. Unknown is the default; a missing legacy checkbox is not interpreted as online-only.';
comment on column public.games.supported_languages is
  'Languages declared by the developer. Empty means unknown or not supplied, not language-independent.';
