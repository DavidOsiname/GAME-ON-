-- GAME ON migration 0014: private Creator drafts with owner-checked submission.
-- A draft is private until its owner completes the required listing details and submits it.

alter table public.games
  drop constraint if exists games_short_description_check;

alter table public.games
  add constraint games_short_description_check
  check (status = 'draft' or (char_length(short_description) >= 10 and char_length(short_description) <= 180));

-- Keep review status server-controlled. Only the two owner-checked RPCs below can
-- create a draft or transition that draft into the submitted review queue.
create or replace function public.protect_review_states()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_trusted_resubmission boolean := coalesce(current_setting('gameon.resubmit_allowed', true), '') = 'true';
  is_draft_creation boolean := coalesce(current_setting('gameon.draft_creation_allowed', true), '') = 'true';
  is_draft_submission boolean := coalesce(current_setting('gameon.draft_submission_allowed', true), '') = 'true';
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
        if is_draft_creation and new.status = 'draft' then
          new.rejection_reason := null;
        else
          new.status := 'submitted';
          new.rejection_reason := null;
        end if;
      elsif new.status is distinct from old.status or new.rejection_reason is distinct from old.rejection_reason then
        if not (
          (is_trusted_resubmission and old.status = 'rejected' and new.status = 'submitted' and new.rejection_reason is null)
          or
          (is_draft_submission and old.status = 'draft' and new.status = 'submitted' and new.rejection_reason is null)
        ) then
          raise exception 'Game review status is managed by Game ON.';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_game_draft(
  p_studio_id uuid,
  p_title text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  created_game_id uuid;
begin
  if caller is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.developer_studios s
    where s.id = p_studio_id and s.owner_user_id = caller
  ) then
    raise exception 'You can only create drafts for your own studio.';
  end if;

  if p_title is null or char_length(btrim(p_title)) < 2 or char_length(btrim(p_title)) > 100 then
    raise exception 'A game title between 2 and 100 characters is required.';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'A valid unique game slug is required.';
  end if;

  perform set_config('gameon.draft_creation_allowed', 'true', true);

  insert into public.games (
    studio_id, title, slug, short_description, genre, supported_platforms, status
  ) values (
    p_studio_id, btrim(p_title), p_slug, '', '', '{}'::text[], 'draft'
  )
  returning id into created_game_id;

  perform set_config('gameon.draft_creation_allowed', 'false', true);
  return created_game_id;
exception
  when others then
    perform set_config('gameon.draft_creation_allowed', 'false', true);
    raise;
end;
$$;

create or replace function public.submit_game_draft(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_description text;
  current_genre text;
  current_platforms text[];
  current_monetization text;
  current_price integer;
  matching_detail_count integer;
begin
  if caller is null then
    raise exception 'Authentication is required.';
  end if;

  select g.short_description, g.genre, g.supported_platforms, g.monetization_type, g.price_minor
    into current_description, current_genre, current_platforms, current_monetization, current_price
  from public.games g
  join public.developer_studios s on s.id = g.studio_id
  where g.id = p_game_id
    and s.owner_user_id = caller
    and g.status = 'draft'
  for update of g;

  if not found then
    raise exception 'Only a draft belonging to your studio can be submitted.';
  end if;

  if current_description is null or char_length(btrim(current_description)) < 10 or char_length(current_description) > 180 then
    raise exception 'Add a short description between 10 and 180 characters before submitting.';
  end if;

  if current_genre is null or btrim(current_genre) = '' then
    raise exception 'Choose a game genre before submitting.';
  end if;

  if coalesce(cardinality(current_platforms), 0) = 0 then
    raise exception 'Select at least one supported platform before submitting.';
  end if;

  if exists (
    select 1 from unnest(current_platforms) as selected(platform)
    where selected.platform not in ('android', 'windows', 'web')
  ) then
    raise exception 'One or more selected platforms are not supported by GAME ON Creator.';
  end if;

  select count(*) into matching_detail_count
  from public.game_platform_details d
  where d.game_id = p_game_id
    and d.platform = any(current_platforms);

  if matching_detail_count <> cardinality(current_platforms) then
    raise exception 'Add GAME FIT details for every selected platform before submitting.';
  end if;

  if current_monetization = 'paid' and (current_price is null or current_price <= 0) then
    raise exception 'Enter a valid price for a paid game before submitting.';
  end if;

  perform set_config('gameon.draft_submission_allowed', 'true', true);

  update public.games
  set status = 'submitted', rejection_reason = null, updated_at = now()
  where id = p_game_id;

  perform set_config('gameon.draft_submission_allowed', 'false', true);
exception
  when others then
    perform set_config('gameon.draft_submission_allowed', 'false', true);
    raise;
end;
$$;

revoke all on function public.create_game_draft(uuid, text, text) from public, anon;
grant execute on function public.create_game_draft(uuid, text, text) to authenticated;

revoke all on function public.submit_game_draft(uuid) from public, anon;
grant execute on function public.submit_game_draft(uuid) to authenticated;
