-- Game ON migration 0003: auditable server-controlled moderation.
-- Apply after 0001_game_on_core.sql and 0002_safe_game_resubmission.sql.

-- Game listing moderation metadata.
alter table public.games
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_note text;

-- Studio verification metadata.
alter table public.developer_studios
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists verification_note text;

-- Player review moderation metadata.
alter table public.reviews
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_note text;

create index if not exists games_moderation_queue_idx
  on public.games(status, created_at asc)
  where status in ('submitted', 'in_review', 'rejected');

create index if not exists studios_verification_queue_idx
  on public.developer_studios(verification_status, created_at asc)
  where verification_status in ('pending', 'rejected');

create index if not exists reviews_moderation_queue_idx
  on public.reviews(moderation_status, created_at asc)
  where moderation_status = 'pending';

comment on column public.games.reviewed_by is 'Game ON administrator who made the last moderation decision; written only by trusted server-side admin workflow.';
comment on column public.developer_studios.verification_reviewed_by is 'Game ON administrator who made the last studio verification decision; written only by trusted server-side admin workflow.';
comment on column public.reviews.moderated_by is 'Game ON administrator who made the last player-review moderation decision; written only by trusted server-side admin workflow.';

-- Developers may edit draft, submitted, or rejected listing content, but must not
-- mutate a listing while it is in review or after it has been published.
drop policy if exists "games_owner_update" on public.games;
drop policy if exists "games_owner_update_unlocked" on public.games;
create policy "games_owner_update_unlocked" on public.games
for update to authenticated
using (
  status in ('draft', 'submitted', 'rejected')
  and exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid())
)
with check (
  status in ('draft', 'submitted', 'rejected')
  and exists (select 1 from public.developer_studios s where s.id = studio_id and s.owner_user_id = auth.uid())
);

-- Only trusted server-side moderation workflows may write moderation metadata.
-- Authenticated clients cannot self-verify, self-publish, self-approve reviews,
-- or forge reviewer identities/timestamps/notes. A service-role server workflow
-- is allowlisted separately in the Creator server route.
create or replace function public.protect_moderation_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_table_name = 'games' then
      if tg_op = 'INSERT' then
        new.reviewed_at := null;
        new.reviewed_by := null;
        new.moderation_note := null;
      elsif new.reviewed_at is distinct from old.reviewed_at
         or new.reviewed_by is distinct from old.reviewed_by
         or new.moderation_note is distinct from old.moderation_note then
        raise exception 'Game moderation metadata is managed by Game ON.';
      end if;
    elsif tg_table_name = 'developer_studios' then
      if tg_op = 'INSERT' then
        new.verification_reviewed_at := null;
        new.verification_reviewed_by := null;
        new.verification_note := null;
      elsif new.verification_reviewed_at is distinct from old.verification_reviewed_at
         or new.verification_reviewed_by is distinct from old.verification_reviewed_by
         or new.verification_note is distinct from old.verification_note then
        raise exception 'Studio verification metadata is managed by Game ON.';
      end if;
    elsif tg_table_name = 'reviews' then
      if tg_op = 'INSERT' then
        -- A player may never self-approve a review by supplying moderation_status.
        new.moderation_status := 'pending';
        new.moderated_at := null;
        new.moderated_by := null;
        new.moderation_note := null;
      elsif new.moderated_at is distinct from old.moderated_at
         or new.moderated_by is distinct from old.moderated_by
         or new.moderation_note is distinct from old.moderation_note then
        raise exception 'Review moderation metadata is managed by Game ON.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_game_moderation_metadata on public.games;
create trigger protect_game_moderation_metadata
before insert or update on public.games
for each row execute function public.protect_moderation_metadata();

drop trigger if exists protect_studio_moderation_metadata on public.developer_studios;
create trigger protect_studio_moderation_metadata
before insert or update on public.developer_studios
for each row execute function public.protect_moderation_metadata();

drop trigger if exists protect_review_moderation_metadata on public.reviews;
create trigger protect_review_moderation_metadata
before insert or update on public.reviews
for each row execute function public.protect_moderation_metadata();

-- Once a listing is in review or published, a developer cannot change media metadata
-- behind the reviewer's/player's back. Media changes must use a future reviewed workflow.
drop policy if exists "game_media_owner_insert" on public.game_media;
create policy "game_media_owner_insert_unlocked" on public.game_media
for insert to authenticated
with check (
  exists (
    select 1 from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_id
      and g.status in ('draft', 'submitted', 'rejected')
      and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "game_media_owner_delete" on public.game_media;
create policy "game_media_owner_delete_unlocked" on public.game_media
for delete to authenticated
using (
  exists (
    select 1 from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = game_id
      and g.status in ('draft', 'submitted', 'rejected')
      and s.owner_user_id = auth.uid()
  )
);

-- Prevent a studio owner from reviewing their own title, even if they add it to their library.
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own_entitled_not_own_game" on public.reviews
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_library ul
    where ul.user_id = auth.uid() and ul.game_id = reviews.game_id
  )
  and not exists (
    select 1 from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = reviews.game_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "reviews_update_own_pending" on public.reviews;
create policy "reviews_update_own_pending_not_own_game" on public.reviews
for update to authenticated
using (
  user_id = auth.uid()
  and moderation_status in ('pending', 'rejected')
  and not exists (
    select 1 from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = reviews.game_id and s.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and moderation_status = 'pending'
  and not exists (
    select 1 from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = reviews.game_id and s.owner_user_id = auth.uid()
  )
);
