-- Game ON database security smoke tests.
-- Run after all migrations with: supabase db reset && supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

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

select * from finish();
rollback;
