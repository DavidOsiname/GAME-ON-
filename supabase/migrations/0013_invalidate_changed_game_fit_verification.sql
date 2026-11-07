-- Game ON migration 0013: invalidate verification when developers change a fact.
-- A previously verified value must never remain verified after developer edits.

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

      if new.official_access_url is distinct from old.official_access_url then
        new.official_access_url_verified_at := null;
      end if;
      if new.download_size_bytes is distinct from old.download_size_bytes then
        new.download_size_verified_at := null;
      end if;
      if new.internet_requirement is distinct from old.internet_requirement then
        new.internet_requirement_verified_at := null;
      end if;
      if new.minimum_requirements is distinct from old.minimum_requirements then
        new.minimum_requirements_verified_at := null;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.protect_game_platform_detail_verification() from public, anon, authenticated;

comment on function public.protect_game_platform_detail_verification() is
  'Prevents developer-controlled verification markers and clears a verification timestamp whenever the corresponding developer-supplied fact changes.';
