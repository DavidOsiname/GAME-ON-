-- Game ON migration 0008: player inbox, release history and creator analytics RPCs.
-- Analytics are aggregated per owned game. Raw download events remain server-only.

create or replace function public.get_creator_game_analytics()
returns table (
  game_id uuid,
  game_title text,
  game_status text,
  download_link_issues bigint,
  latest_download_link_at timestamptz,
  approved_builds bigint,
  latest_approved_version text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    g.id,
    g.title,
    g.status,
    coalesce(dl.issue_count, 0)::bigint,
    dl.last_issued_at,
    coalesce(b.build_count, 0)::bigint,
    b.latest_version
  from public.developer_studios s
  join public.games g on g.studio_id = s.id
  left join lateral (
    select count(*)::bigint as issue_count, max(de.created_at) as last_issued_at
    from public.download_events de
    where de.game_id = g.id
  ) dl on true
  left join lateral (
    select count(*)::bigint as build_count,
           (array_agg(gb.version_label order by gb.created_at desc))[1] as latest_version
    from public.game_builds gb
    where gb.game_id = g.id
      and gb.upload_status = 'uploaded'
      and gb.scan_status = 'clean'
      and gb.release_status = 'approved'
  ) b on true
  where s.owner_user_id = caller
  order by g.created_at desc;
end;
$$;
revoke all on function public.get_creator_game_analytics() from public, anon;
grant execute on function public.get_creator_game_analytics() to authenticated;

create or replace function public.get_game_release_history(p_game_id uuid)
returns table (
  version_label text,
  platform text,
  file_size_bytes bigint,
  sha256_hex char(64),
  released_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.games g
    where g.id = p_game_id and g.status = 'published'
  ) then
    return;
  end if;

  return query
  select gb.version_label, gb.platform, gb.file_size_bytes, gb.sha256_hex, gb.created_at
  from public.game_builds gb
  where gb.game_id = p_game_id
    and gb.upload_status = 'uploaded'
    and gb.scan_status = 'clean'
    and gb.release_status = 'approved'
  order by gb.created_at desc
  limit 30;
end;
$$;
revoke all on function public.get_game_release_history(uuid) from public;
grant execute on function public.get_game_release_history(uuid) to anon, authenticated;

comment on function public.get_creator_game_analytics() is 'Aggregated download-link issuance analytics for games belonging to the authenticated developer studio. This is not a count of completed downloads or sales.';
comment on function public.get_game_release_history(uuid) is 'Public, non-sensitive release history for published games; includes only uploaded, malware-clean, approved builds.';
