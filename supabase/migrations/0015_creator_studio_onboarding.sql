-- GAME ON Creator: guided studio setup and private business contact details.

alter table public.developer_studios
  add column if not exists logo_url text
  check (logo_url is null or logo_url ~ '^https://[^[:space:]]+$');

comment on column public.developer_studios.logo_url is
  'Public studio logo URL. Uploads are restricted to the authenticated studio owner in the studio-logos bucket.';

create table if not exists public.developer_studio_contacts (
  studio_id uuid primary key references public.developer_studios(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  contact_role text not null check (char_length(btrim(contact_role)) between 2 and 60),
  official_email text not null check (
    char_length(official_email) between 5 and 254
    and official_email = lower(official_email)
    and official_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.developer_studio_contacts is
  'Private Creator onboarding contact details. Not exposed to Store visitors or anonymous users.';

alter table public.developer_studio_contacts enable row level security;

create policy "developer_studio_contacts_owner_read"
on public.developer_studio_contacts
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.developer_studios s
    where s.id = studio_id
      and s.owner_user_id = (select auth.uid())
  )
);

create policy "developer_studio_contacts_owner_insert"
on public.developer_studio_contacts
for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.developer_studios s
    where s.id = studio_id
      and s.owner_user_id = (select auth.uid())
  )
);

create policy "developer_studio_contacts_owner_update"
on public.developer_studio_contacts
for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.developer_studios s
    where s.id = studio_id
      and s.owner_user_id = (select auth.uid())
  )
)
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.developer_studios s
    where s.id = studio_id
      and s.owner_user_id = (select auth.uid())
  )
);

revoke all on table public.developer_studio_contacts from public, anon, authenticated;
grant select, insert, update on table public.developer_studio_contacts to authenticated;

-- Studio logos are public brand assets, but only the owning authenticated account can write them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-logos',
  'studio-logos',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "studio_logos_owner_read"
on storage.objects
for select to authenticated
using (
  bucket_id = 'studio-logos'
  and name ~ '^[0-9a-f-]{36}/studio-logo\.(jpg|jpeg|png|webp)$'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "studio_logos_owner_insert"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'studio-logos'
  and name ~ '^[0-9a-f-]{36}/studio-logo\.(jpg|jpeg|png|webp)$'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "studio_logos_owner_update"
on storage.objects
for update to authenticated
using (
  bucket_id = 'studio-logos'
  and name ~ '^[0-9a-f-]{36}/studio-logo\.(jpg|jpeg|png|webp)$'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'studio-logos'
  and name ~ '^[0-9a-f-]{36}/studio-logo\.(jpg|jpeg|png|webp)$'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "studio_logos_owner_delete"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'studio-logos'
  and name ~ '^[0-9a-f-]{36}/studio-logo\.(jpg|jpeg|png|webp)$'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
