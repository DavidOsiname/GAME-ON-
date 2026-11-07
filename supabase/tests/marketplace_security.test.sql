-- Game ON database security smoke tests.
-- Run after all migrations with: supabase db reset && supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(50);

select has_table('public', 'marketplace_orders', 'marketplace order ledger exists');
select has_table('public', 'refund_requests', 'refund request ledger exists');
select ok((select relrowsecurity from pg_class where oid = 'public.marketplace_orders'::regclass), 'marketplace orders enforce row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.refund_requests'::regclass), 'refund requests enforce row-level security');

select ok(has_table_privilege('authenticated', 'public.marketplace_orders', 'SELECT'), 'players can read their own orders through RLS');
select ok(not has_table_privilege('anon', 'public.marketplace_orders', 'SELECT'), 'anonymous users cannot read orders');
select ok(not has_table_privilege('authenticated', 'public.marketplace_orders', 'INSERT'), 'players cannot create paid order rows directly');
select ok(not has_table_privilege('authenticated', 'public.marketplace_orders', 'UPDATE'), 'players cannot alter paid order rows');
select ok(not has_table_privilege('authenticated', 'public.refund_requests', 'INSERT'), 'players cannot create refund ledger rows directly');
select ok(not has_table_privilege('authenticated', 'public.refund_requests', 'UPDATE'), 'players cannot alter refund decisions');

select ok(not has_function_privilege('anon', 'public.complete_marketplace_order(text,text,bigint,text)', 'EXECUTE'), 'anonymous users cannot fulfil orders');
select ok(not has_function_privilege('authenticated', 'public.complete_marketplace_order(text,text,bigint,text)', 'EXECUTE'), 'players cannot fulfil orders');
select ok(has_function_privilege('service_role', 'public.complete_marketplace_order(text,text,bigint,text)', 'EXECUTE'), 'trusted service role can fulfil provider-verified orders');
select ok(not has_function_privilege('anon', 'public.get_creator_sales_summary()', 'EXECUTE'), 'anonymous users cannot view creator sales summaries');
select ok(has_function_privilege('authenticated', 'public.get_creator_sales_summary()', 'EXECUTE'), 'authenticated creators can call the ownership-filtered sales summary');
select ok(has_function_privilege('anon', 'public.get_game_release_history(uuid)', 'EXECUTE'), 'public users can read non-sensitive release history');

select ok(exists(select 1 from storage.buckets where id = 'game-build-quarantine' and public = false), 'game build quarantine bucket remains private');
select ok((select relrowsecurity from pg_class where oid = 'public.game_builds'::regclass), 'game build metadata enforces row-level security');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_read_own'), 'notification reads are constrained by owner policy');
select ok(has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'), 'players can mark their own notification read state');
select ok(not has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE'), 'players cannot alter notification content');
select ok(not has_table_privilege('anon', 'public.download_events', 'SELECT'), 'anonymous users cannot read download analytics');
select ok(not has_table_privilege('anon', 'public.game_builds', 'SELECT'), 'anonymous users cannot read private game-build metadata');
select ok(not has_table_privilege('authenticated', 'public.game_builds', 'SELECT'), 'players and developers cannot read private game-build metadata directly');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'user_library' and policyname = 'library_insert_free_or_demo_only' and with_check ilike '%monetization_type%' and with_check ilike '%demo%' and with_check ilike '%free%'), 'client library inserts are restricted to free and demo games');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'user_library' and policyname = 'library_delete_free_or_demo_only' and qual ilike '%monetization_type%' and qual ilike '%demo%' and qual ilike '%free%'), 'players cannot directly delete paid-game ownership records');


select ok(exists(select 1 from storage.buckets where id = 'game-covers' and public = true and file_size_limit = 5242880), 'game cover assets use a public bucket with a 5 MiB upload cap');
select ok((select allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[] from storage.buckets where id = 'game-covers'), 'game cover bucket accepts only declared safe image formats');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'game_covers_owner_insert'), 'only owning developers can upload game cover assets');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'game_covers_owner_delete'), 'only owning developers can delete their game cover assets');
select ok((
  select count(*) = 3
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in ('game_covers_owner_insert', 'game_covers_owner_update', 'game_covers_owner_delete')
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%cover(-[a-z0-9-]{1,48})?%'
), 'cover upload, replacement and delete policies accept versioned filenames');


select has_table('public', 'game_platform_details', 'per-platform GAME FIT details exist');
select ok((select relrowsecurity from pg_class where oid = 'public.game_platform_details'::regclass), 'per-platform GAME FIT details enforce row-level security');
select has_column('public', 'games', 'supported_languages', 'game listings can declare supported languages');
select has_column('public', 'game_platform_details', 'official_access_url', 'platform details can store an official access URL');
select has_column('public', 'game_platform_details', 'download_size_bytes', 'platform details can store download size');
select has_column('public', 'game_platform_details', 'internet_requirement', 'platform details distinguish unknown, offline, online and both');
select has_column('public', 'game_platform_details', 'minimum_requirements', 'platform details can store minimum device requirements');

select ok(has_table_privilege('anon', 'public.game_platform_details', 'SELECT'), 'anonymous players can read published platform details through RLS');
select ok(not has_table_privilege('anon', 'public.game_platform_details', 'INSERT'), 'anonymous players cannot submit platform details');
select ok(not has_table_privilege('anon', 'public.game_platform_details', 'UPDATE'), 'anonymous players cannot alter platform details');
select ok(not has_table_privilege('anon', 'public.game_platform_details', 'DELETE'), 'anonymous players cannot delete platform details');
select ok(has_table_privilege('authenticated', 'public.game_platform_details', 'SELECT'), 'signed-in users can read permitted platform details');
select ok(has_table_privilege('authenticated', 'public.game_platform_details', 'INSERT'), 'signed-in developers can submit platform details subject to ownership RLS');
select ok(has_table_privilege('authenticated', 'public.game_platform_details', 'UPDATE'), 'signed-in developers can update permitted platform details subject to ownership RLS');
select ok(has_table_privilege('authenticated', 'public.game_platform_details', 'DELETE'), 'signed-in developers can remove permitted platform details subject to ownership RLS');

select ok((
  select count(*) = 4
  from pg_policies
  where schemaname = 'public'
    and tablename = 'game_platform_details'
    and policyname in (
      'game_platform_details_public_or_owner_read',
      'game_platform_details_owner_insert',
      'game_platform_details_owner_update',
      'game_platform_details_owner_delete'
    )
), 'platform details have separate read, insert, update and delete ownership policies');

select ok(exists(
  select 1 from pg_trigger
  where tgrelid = 'public.game_platform_details'::regclass
    and tgname = 'protect_game_platform_detail_verification'
    and not tgisinternal
), 'developer edits cannot bypass Game ON verification protection');

select ok(
  pg_get_functiondef('public.protect_game_platform_detail_verification()'::regprocedure)
    like '%new.official_access_url_verified_at := null%'
  and pg_get_functiondef('public.protect_game_platform_detail_verification()'::regprocedure)
    like '%GAME ON verification markers are managed%',
  'verification markers are cleared on developer insert and protected on update'
);

select ok(
  pg_get_functiondef('public.protect_game_platform_detail_verification()'::regprocedure)
    like '%new.official_access_url_verified_at := null%'
  and pg_get_functiondef('public.protect_game_platform_detail_verification()'::regprocedure)
    like '%new.download_size_verified_at := null%'
  and pg_get_functiondef('public.protect_game_platform_detail_verification()'::regprocedure)
    like '%new.internet_requirement_verified_at := null%'
  and pg_get_functiondef('public.protect_game_platform_detail_verification()'::regprocedure)
    like '%new.minimum_requirements_verified_at := null%',
  'changing developer-provided GAME FIT facts invalidates the corresponding Game ON verification timestamp'
);

select * from finish();
rollback;
