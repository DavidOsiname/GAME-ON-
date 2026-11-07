-- Game ON migration 0010: close paid-library self-grant and harden server-only table privileges.
-- Players may add/remove free titles, but paid entitlements are created only by
-- complete_marketplace_order() after server-side provider verification.

drop policy if exists "library_insert_own" on public.user_library;
create policy "library_insert_free_or_demo_only" on public.user_library
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.games g
    where g.id = game_id
      and g.status = 'published'
      and g.monetization_type in ('free', 'free_with_ads', 'free_with_iap', 'demo')
  )
);

drop policy if exists "library_delete_own" on public.user_library;
create policy "library_delete_free_or_demo_only" on public.user_library
for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.games g
    where g.id = game_id
      and g.monetization_type in ('free', 'free_with_ads', 'free_with_iap', 'demo')
  )
);

-- These tables are written/read only by trusted server-side workflows. RLS is
-- necessary but not sufficient: explicitly remove browser-role table privileges.
revoke all on public.game_builds from public, anon, authenticated;
revoke all on public.audit_events from public, anon, authenticated;
revoke all on public.download_events from public, anon, authenticated;
grant all on public.game_builds to service_role;
grant all on public.audit_events to service_role;
grant all on public.download_events to service_role;

-- Player report submission/read is the only browser-facing report capability.
revoke all on public.game_reports from public, anon, authenticated;
grant select, insert on public.game_reports to authenticated;
grant all on public.game_reports to service_role;

-- Users can read/update their own notifications, but cannot create or delete them.
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Orders/refund decisions are never client-created or client-updated.
revoke all on public.marketplace_orders from public, anon, authenticated;
grant select on public.marketplace_orders to authenticated;
grant all on public.marketplace_orders to service_role;
revoke all on public.refund_requests from public, anon, authenticated;
grant select on public.refund_requests to authenticated;
grant all on public.refund_requests to service_role;

comment on policy "library_insert_free_or_demo_only" on public.user_library is 'Prevents authenticated clients from granting themselves paid games; paid entitlements are issued by the trusted server-only order fulfilment function.';
comment on policy "library_delete_free_or_demo_only" on public.user_library is 'Prevents users from deleting paid ownership records; processed refunds remove the entitlement through the trusted service role.';
