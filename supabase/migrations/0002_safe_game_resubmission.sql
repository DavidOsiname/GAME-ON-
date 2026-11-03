-- Game ON migration 0002: allow a developer to resubmit only their own rejected listing.
-- This does NOT let developers approve, verify or publish games.

create or replace function public.protect_review_states()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_trusted_resubmission boolean := coalesce(current_setting('gameon.resubmit_allowed', true), '') = 'true';
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
        if not (
          is_trusted_resubmission
          and old.status = 'rejected'
          and new.status = 'submitted'
          and new.rejection_reason is null
        ) then
          raise exception 'Game review status is managed by Game ON.';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.resubmit_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owns_rejected_game boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id = p_game_id
      and s.owner_user_id = auth.uid()
      and g.status = 'rejected'
  ) into owns_rejected_game;

  if not owns_rejected_game then
    raise exception 'Only a rejected game belonging to your studio can be resubmitted.';
  end if;

  perform set_config('gameon.resubmit_allowed', 'true', true);

  update public.games
  set status = 'submitted', rejection_reason = null, updated_at = now()
  where id = p_game_id;

  perform set_config('gameon.resubmit_allowed', 'false', true);
end;
$$;

revoke all on function public.resubmit_game(uuid) from public;
grant execute on function public.resubmit_game(uuid) to authenticated;
