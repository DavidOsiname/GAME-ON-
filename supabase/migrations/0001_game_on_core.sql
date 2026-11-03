-- Game ON shared backend — initial schema
-- Apply in a fresh Supabase project through the SQL Editor.
-- Game builds are metadata-only here. Private file ingestion/scanning/signing is a later server-only feature.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.developer_studios (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  studio_name text not null check (char_length(studio_name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  website_url text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.developer_studios(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text not null check (char_length(short_description) between 10 and 180),
  description text,
  genre text not null,
  tags text[] not null default '{}',
  supported_platforms text[] not null default '{android}',
  monetization_type text not null default 'free'
    check (monetization_type in ('free', 'paid', 'free_with_ads', 'free_with_iap', 'demo')),
  price_minor integer check (price_minor is null or price_minor >= 0),
  currency char(3),
  offline_support boolean not null default false,
  contains_ads boolean not null default false,
  has_in_app_purchases boolean not null default false,
  age_rating text,
  minimum_requirements jsonb not null default '{}'::jsonb,
  cover_image_url text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'in_review', 'published', 'rejected', 'suspended')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_public_catalogue_idx on public.games(status, created_at desc);
create index if not exists games_studio_idx on public.games(studio_id, created_at desc);

create table if not exists public.game_media (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  media_type text not null check (media_type in ('cover', 'screenshot', 'trailer')),
  object_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Never expose this table to anon/authenticated client roles.
create table if not exists public.game_builds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  version_label text not null,
  platform text not null,
  object_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256_hex char(64) not null,
  scan_status text not null default 'quarantined'
    check (scan_status in ('quarantined', 'scanning', 'clean', 'rejected', 'failed')),
  release_status text not null default 'pending'
    check (release_status in ('pending', 'approved', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (game_id, version_label, platform)
);

create table if not exists public.user_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text check (review_text is null or char_length(review_text) <= 3000),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Profile creation runs inside the auth transaction; username is a fallback and can be edited later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'player-' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Player')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable RLS on every table.
alter table public.profiles enable row level security;
alter table public.developer_studios enable row level security;
alter table public.games enable row level security;
alter table public.game_media enable row level security;
alter table public.game_builds enable row level security;
alter table public.user_library enable row level security;
alter table public.wishlists enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: users see and edit only their own account profile.
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Studios: owners can manage their studio. Store visitors can see verified studios only.
create policy "studios_public_verified_read" on public.developer_studios for select to anon, authenticated using (verification_status = 'verified' or owner_user_id = auth.uid());
create policy "studios_owner_insert" on public.developer_studios for insert to authenticated with check (owner_user_id = auth.uid());
create policy "studios_owner_update" on public.developer_studios for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- Games: anyone can read published games, studio owners can manage their own non-public drafts/submissions.
create policy "games_public_published_read" on public.games for select to anon, authenticated using (status = 'published' or exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid()));
create policy "games_owner_insert" on public.games for insert to authenticated with check (exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid()));
create policy "games_owner_update" on public.games for update to authenticated using (exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid())) with check (exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid()));
create policy "games_owner_delete_draft" on public.games for delete to authenticated using (status in ('draft', 'rejected') and exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid()));

-- Media metadata: visible only for published games or games owned by the studio.
create policy "game_media_read" on public.game_media for select to anon, authenticated using (exists (select 1 from public.games g where g.id = game_id and (g.status = 'published' or exists (select 1 from public.developer_studios s where s.id = g.studio_id and s.owner_user_id = auth.uid()))));
create policy "game_media_owner_insert" on public.game_media for insert to authenticated with check (exists (select 1 from public.games g join public.developer_studios s on s.id = g.studio_id where g.id = game_id and s.owner_user_id = auth.uid()));
create policy "game_media_owner_delete" on public.game_media for delete to authenticated using (exists (select 1 from public.games g join public.developer_studios s on s.id = g.studio_id where g.id = game_id and s.owner_user_id = auth.uid()));

-- No client policies for game_builds or audit_events. Server-only service role workflows must govern them.

create policy "library_read_own" on public.user_library for select to authenticated using (user_id = auth.uid());
create policy "library_insert_own" on public.user_library for insert to authenticated with check (user_id = auth.uid());
create policy "library_delete_own" on public.user_library for delete to authenticated using (user_id = auth.uid());

create policy "wishlist_read_own" on public.wishlists for select to authenticated using (user_id = auth.uid());
create policy "wishlist_insert_own" on public.wishlists for insert to authenticated with check (user_id = auth.uid());
create policy "wishlist_delete_own" on public.wishlists for delete to authenticated using (user_id = auth.uid());

create policy "reviews_public_approved_read" on public.reviews for select to anon, authenticated using (moderation_status = 'approved' or user_id = auth.uid());
create policy "reviews_insert_own" on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy "reviews_update_own_pending" on public.reviews for update to authenticated using (user_id = auth.uid() and moderation_status in ('pending', 'rejected')) with check (user_id = auth.uid() and moderation_status = 'pending');
create policy "reviews_delete_own_pending" on public.reviews for delete to authenticated using (user_id = auth.uid() and moderation_status = 'pending');

-- Minimal grants, with RLS providing row-level enforcement.
grant select on public.games, public.developer_studios, public.game_media, public.reviews to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.user_library, public.wishlists, public.reviews to authenticated;
grant select, insert, update, delete on public.developer_studios, public.games, public.game_media to authenticated;

-- Protect approval state: authenticated developers may submit and edit listing content,
-- but cannot publish their own titles or self-verify their studio.
create or replace function public.protect_review_states()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_table_name = 'developer_studios' then
      if tg_op = 'INSERT' then
        new.verification_status := 'pending';
      elsif new.verification_status is distinct from old.verification_status then
        raise exception 'Studio verification status is managed by Game ON.';
      end if;
    elsif tg_table_name = 'games' then
      if tg_op = 'INSERT' then
        new.status := 'submitted';
        new.rejection_reason := null;
      elsif new.status is distinct from old.status or new.rejection_reason is distinct from old.rejection_reason then
        raise exception 'Game review status is managed by Game ON.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_studio_review_state on public.developer_studios;
create trigger protect_studio_review_state
before insert or update on public.developer_studios
for each row execute function public.protect_review_states();

drop trigger if exists protect_game_review_state on public.games;
create trigger protect_game_review_state
before insert or update on public.games
for each row execute function public.protect_review_states();

-- Players can add free-to-access published games to their library. Paid entitlements
-- must be granted by a verified payment webhook/server workflow, not a client insert.
drop policy if exists "library_insert_own" on public.user_library;
create policy "library_insert_own" on public.user_library
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.games g
    where g.id = game_id
      and g.status = 'published'
      and g.monetization_type in ('free', 'free_with_ads', 'free_with_iap', 'demo')
  )
);

-- Only owners who have a library entitlement may review a game.
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_library ul
    where ul.user_id = auth.uid() and ul.game_id = reviews.game_id
  )
);

create or replace function public.protect_review_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    new.moderation_status := 'pending';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_review_moderation_state on public.reviews;
create trigger protect_review_moderation_state
before insert on public.reviews
for each row execute function public.protect_review_moderation();
