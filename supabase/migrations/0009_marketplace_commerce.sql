-- Game ON migration 0009: paid orders, refunds and developer sales reporting.
-- Payment confirmation and entitlement grants are server-only; the browser never writes paid orders.

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[A-Za-z0-9.=\-]{10,80}$'),
  user_id uuid not null references auth.users(id) on delete restrict,
  game_id uuid not null references public.games(id) on delete restrict,
  studio_id uuid not null references public.developer_studios(id) on delete restrict,
  game_title_snapshot text not null,
  amount_minor bigint not null check (amount_minor > 0),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  developer_net_minor bigint not null check (developer_net_minor >= 0),
  check (platform_fee_minor + developer_net_minor = amount_minor),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 2500),
  currency char(3) not null default 'NGN',
  provider text not null default 'paystack' check (provider in ('paystack')),
  provider_transaction_id text,
  provider_status text,
  checkout_url text,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketplace_orders_provider_transaction_uidx on public.marketplace_orders(provider, provider_transaction_id) where provider_transaction_id is not null;
create index if not exists marketplace_orders_user_idx on public.marketplace_orders(user_id, created_at desc);
create index if not exists marketplace_orders_studio_idx on public.marketplace_orders(studio_id, created_at desc) where status = 'paid';
create index if not exists marketplace_orders_game_idx on public.marketplace_orders(game_id, created_at desc);
alter table public.marketplace_orders enable row level security;
revoke all on public.marketplace_orders from anon, authenticated;
grant select on public.marketplace_orders to authenticated;
create policy "marketplace_orders_read_own" on public.marketplace_orders
  for select to authenticated using (user_id = auth.uid());
-- No authenticated insert/update/delete: orders are created and settled by trusted server routes.

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'requested' check (status in ('requested','processing','processed','rejected','failed','needs_attention')),
  admin_note text,
  provider_refund_id text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists refund_requests_status_idx on public.refund_requests(status, requested_at asc);
create index if not exists refund_requests_user_idx on public.refund_requests(user_id, requested_at desc);
alter table public.refund_requests enable row level security;
revoke all on public.refund_requests from anon, authenticated;
grant select on public.refund_requests to authenticated;
create policy "refund_requests_read_own" on public.refund_requests
  for select to authenticated using (user_id = auth.uid());
-- Refund request creation and processing are restricted to authenticated server routes.

create or replace function public.complete_marketplace_order(
  p_reference text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.marketplace_orders%rowtype;
begin
  select * into order_row
  from public.marketplace_orders
  where reference = p_reference
  for update;

  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if order_row.amount_minor <> p_amount_minor or upper(trim(order_row.currency::text)) <> upper(trim(p_currency)) then
    raise exception 'Payment amount or currency does not match order' using errcode = '22023';
  end if;

  if order_row.status = 'paid' then
    if order_row.provider_transaction_id is distinct from p_provider_transaction_id then
      raise exception 'Order was already fulfilled with a different transaction' using errcode = '23505';
    end if;
    return true;
  end if;
  if order_row.status <> 'pending' then raise exception 'Order is not awaiting payment' using errcode = '55000'; end if;

  update public.marketplace_orders
  set status = 'paid', provider_status = 'success', provider_transaction_id = p_provider_transaction_id,
      paid_at = now(), updated_at = now()
  where id = order_row.id;

  insert into public.user_library(user_id, game_id)
  values (order_row.user_id, order_row.game_id)
  on conflict (user_id, game_id) do nothing;

  insert into public.notifications(user_id, notification_type, title, message, entity_type, entity_id)
  values (order_row.user_id, 'system', 'Purchase complete', order_row.game_title_snapshot || ' has been added to your library.', 'marketplace_order', order_row.id);

  return true;
end;
$$;
revoke all on function public.complete_marketplace_order(text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.complete_marketplace_order(text,text,bigint,text) to service_role;

create or replace function public.get_creator_sales_summary()
returns table (
  game_id uuid,
  game_title text,
  paid_orders bigint,
  gross_sales_minor bigint,
  platform_fees_minor bigint,
  developer_net_minor bigint,
  latest_sale_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query
  select g.id, g.title,
         count(o.id)::bigint,
         coalesce(sum(o.amount_minor),0)::bigint,
         coalesce(sum(o.platform_fee_minor),0)::bigint,
         coalesce(sum(o.developer_net_minor),0)::bigint,
         max(o.paid_at)
  from public.developer_studios s
  join public.games g on g.studio_id = s.id
  left join public.marketplace_orders o on o.game_id = g.id and o.studio_id = s.id and o.status = 'paid'
  where s.owner_user_id = caller
  group by g.id, g.title
  order by coalesce(sum(o.developer_net_minor),0) desc, g.title asc;
end;
$$;
revoke all on function public.get_creator_sales_summary() from public, anon;
grant execute on function public.get_creator_sales_summary() to authenticated;

comment on table public.marketplace_orders is 'Immutable purchase snapshots. Only trusted server-side payment verification can mark an order paid and grant the game-library entitlement.';
comment on table public.refund_requests is 'Player refund requests. Actual refund processing requires authorised Game ON staff and provider confirmation.';
comment on function public.complete_marketplace_order(text,text,bigint,text) is 'Idempotently marks a pending order paid after trusted provider verification and adds its game to the buyer library.';
comment on function public.get_creator_sales_summary() is 'Per-game gross sales, proposed Game ON platform fee and estimated developer net; excludes payment processor fees, tax, refunds and payouts.';
