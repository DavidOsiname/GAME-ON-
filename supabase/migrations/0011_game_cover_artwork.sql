-- Game ON migration 0011: public game cover artwork with studio-owner upload controls.
-- Cover images are public catalogue assets; executable game builds remain in private quarantine.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-covers',
  'game-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are studio UUID / game UUID / a fixed or uniquely versioned cover filename.
-- A developer can only write artwork beneath a game belonging to their own studio.
create policy "game_covers_owner_insert"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'game-covers'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[a-z0-9-]{1,48})?\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id::text = split_part(name, '/', 2)
      and s.id::text = split_part(name, '/', 1)
      and s.owner_user_id = auth.uid()
  )
);

create policy "game_covers_owner_update"
on storage.objects
for update to authenticated
using (
  bucket_id = 'game-covers'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[a-z0-9-]{1,48})?\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id::text = split_part(name, '/', 2)
      and s.id::text = split_part(name, '/', 1)
      and s.owner_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'game-covers'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[a-z0-9-]{1,48})?\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id::text = split_part(name, '/', 2)
      and s.id::text = split_part(name, '/', 1)
      and s.owner_user_id = auth.uid()
  )
);

create policy "game_covers_owner_delete"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'game-covers'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[a-z0-9-]{1,48})?\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.games g
    join public.developer_studios s on s.id = g.studio_id
    where g.id::text = split_part(name, '/', 2)
      and s.id::text = split_part(name, '/', 1)
      and s.owner_user_id = auth.uid()
  )
);

comment on column public.games.cover_image_url is
  'Public cover artwork URL stored in the public game-covers bucket; upload is restricted to the owning studio.';
