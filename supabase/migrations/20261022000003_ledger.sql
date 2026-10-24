-- GemVault Phase 2 (redesign): replaces the inventory tables with your Excel ledger:
-- Orders, Trading, Expenses, Memos (buyer + payments). Only fields from your workbook are kept.
-- Costs are in rupees (Orders) and dollars (Trading, Expenses, sales). Costs are owner-only.

-- ---------- 1. Remove the earlier inventory design ----------
drop policy if exists gemvault_files_select on storage.objects;
drop policy if exists gemvault_files_insert on storage.objects;
drop policy if exists gemvault_files_delete on storage.objects;
drop view if exists public.product_overview;
drop table if exists public.stock_movements, public.stock_levels, public.product_images, public.certificates,
  public.product_stones, public.product_costs, public.products, public.stock_locations cascade;
drop function if exists public.save_product(jsonb, jsonb, jsonb);
drop function if exists public.set_product_archived(uuid, boolean);
drop function if exists public.apply_stock_change(uuid, uuid, integer, public.stock_movement_type, text, text, text, uuid);
drop function if exists public.record_opening_stock(uuid, uuid, integer, text);
drop function if exists public.adjust_stock(uuid, uuid, integer, text, text);
drop function if exists public.transfer_stock(uuid, uuid, uuid, integer, text);
drop function if exists public.stock_movements_immutable();
drop type if exists public.stock_movement_type;
drop type if exists public.tracking_mode;

-- ---------- 2. Settings: only the rates your sheet uses ----------
alter table public.business_settings
  drop column business_name, drop column gstin, drop column address, drop column state_code,
  drop column currency, drop column invoice_prefix, drop column financial_year_start_month;
alter table public.business_settings
  add column gold_rate numeric(12,2) not null default 16000 check (gold_rate > 0),            -- rupees per gram of pure gold
  add column usd_rate numeric(8,4) not null default 94 check (usd_rate > 0),                  -- rupees per US dollar
  add column default_multiplier numeric(6,3) not null default 0.595 check (default_multiplier > 0 and default_multiplier <= 1),
  add column default_labor numeric(10,2) not null default 900 check (default_labor >= 0);    -- rupees per gram
drop policy settings_select on public.business_settings;
create policy settings_select on public.business_settings for select to authenticated using (public.is_owner());

-- ---------- 3. Tables ----------
create sequence public.orders_sr_seq;
create sequence public.trades_sr_seq;
create sequence public.expenses_sr_seq;

create table public.buyers (                                     -- "Sold To"
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create unique index buyers_name_unique on public.buyers (lower(btrim(name)));

create table public.memos (                                      -- "memo": one buyer, many pieces, payments
  id uuid primary key default gen_random_uuid(),
  memo_no text not null check (memo_no ~ '^[A-Z0-9._-]{1,20}$'),
  buyer_id uuid not null references public.buyers (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index memos_no_unique on public.memos (memo_no);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  sr_no integer not null unique default nextval('public.orders_sr_seq'),          -- Sr. No.
  customer text check (char_length(customer) <= 60),                              -- CUSTOMER
  style_no text not null check (char_length(btrim(style_no)) between 1 and 120),  -- Style No.
  jewelry_type text check (char_length(jewelry_type) <= 40),                      -- Jewelry Type
  diamond_shape text check (char_length(diamond_shape) <= 60),                    -- Diamond Shape
  order_date date,                                                                -- Date
  gross_wt numeric(10,3) check (gross_wt >= 0),                                   -- Gross Wt
  dia_qty integer check (dia_qty >= 0),                                           -- Dia Qty
  in_ct numeric(10,3) check (in_ct >= 0),                                         -- IN CT
  colour_stone numeric(10,3) check (colour_stone >= 0),                           -- COLOUR STONE
  net_wt numeric(10,3) check (net_wt >= 0),                                       -- Net Wt
  multiplier numeric(6,3) check (multiplier > 0 and multiplier <= 1),             -- Multiplier
  pg_wt numeric(10,3) check (pg_wt >= 0),                                         -- Pg Wt
  memo_id uuid references public.memos (id) on delete restrict,                   -- memo (and Sold To)
  sale_price numeric(14,2) check (sale_price >= 0),                               -- Sale Price (US$)
  date_sold date,                                                                 -- Date Sold
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((sale_price is null) = (memo_id is null)),
  check (net_wt is null or gross_wt is null or net_wt <= gross_wt)
);
create index orders_memo_idx on public.orders (memo_id);
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_costs (                                -- owner only: Gold Amount ... $
  order_id uuid primary key references public.orders (id) on delete cascade,
  gold_amount numeric(14,2) not null default 0 check (gold_amount >= 0),          -- Gold Amount (₹)
  diam_amount numeric(14,2) not null default 0 check (diam_amount >= 0),          -- Diam Amount (₹)
  l_charges numeric(10,2) not null default 0 check (l_charges >= 0),              -- L CHARGES
  labor_amount numeric(14,2) not null default 0 check (labor_amount >= 0),        -- LABOR AMOUNT (₹)
  sub_total numeric(14,2) not null default 0 check (sub_total >= 0),              -- SUB TOTAL (₹)
  usd_cost numeric(14,2) not null default 0 check (usd_cost >= 0),                -- $
  updated_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  sr_no integer not null unique default nextval('public.trades_sr_seq'),
  trade_date date,                                                                -- Date
  item text not null check (char_length(btrim(item)) between 1 and 200),          -- Item
  memo_id uuid references public.memos (id) on delete restrict,
  sale_price numeric(14,2) check (sale_price >= 0),                               -- Sale Price (US$)
  date_sold date,                                                                 -- Date Sold
  notes text check (char_length(notes) <= 300),                                   -- Notes
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((sale_price is null) = (memo_id is null))
);
create index trades_memo_idx on public.trades (memo_id);
create trigger trades_updated_at before update on public.trades for each row execute function public.set_updated_at();

create table public.trade_costs (                                -- owner only
  trade_id uuid primary key references public.trades (id) on delete cascade,
  vendor text check (char_length(vendor) <= 200),                                 -- Vendor
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0)     -- Purchase Price (US$)
);

create table public.expenses (                                   -- owner only
  id uuid primary key default gen_random_uuid(),
  sr_no integer not null unique default nextval('public.expenses_sr_seq'),
  expense_date date not null,                                                     -- Date
  category text not null check (char_length(btrim(category)) between 1 and 60),   -- Category
  description text not null check (char_length(btrim(description)) between 1 and 200), -- Description
  amount numeric(14,2) not null check (amount >= 0),                              -- Amount (US$)
  seller text check (char_length(seller) <= 120),                                 -- Seller
  notes text check (char_length(notes) <= 300),                                   -- Notes
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();

create table public.payments (                                   -- "Payment Log": one row per payment on a memo
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references public.memos (id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  idempotency_key text unique,
  voided_at timestamptz,
  void_reason text,
  voided_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((voided_at is null) = (void_reason is null))
);
create index payments_memo_idx on public.payments (memo_id);

-- ---------- 4. Views (run with the viewer's own permissions) ----------
create view public.memo_summary with (security_invoker = true) as
select m.id, m.memo_no, b.name as buyer, m.created_at,
       x.pieces, x.bill as total_bill, coalesce(p.paid, 0) as total_paid, x.bill - coalesce(p.paid, 0) as balance,
       case when x.bill = 0 then 'Not Sold'
            when coalesce(p.paid, 0) >= x.bill then 'Paid'
            when coalesce(p.paid, 0) > 0 then 'Partial'
            else 'Unpaid' end as payment_status
from public.memos m
join public.buyers b on b.id = m.buyer_id
cross join lateral (
  select (select count(*) from public.orders o where o.memo_id = m.id) + (select count(*) from public.trades t where t.memo_id = m.id) as pieces,
         coalesce((select sum(sale_price) from public.orders o where o.memo_id = m.id), 0)
       + coalesce((select sum(sale_price) from public.trades t where t.memo_id = m.id), 0) as bill
) x
left join lateral (select sum(amount) as paid from public.payments where memo_id = m.id and voided_at is null) p on true;

create view public.order_overview with (security_invoker = true) as
select o.*, ms.memo_no, ms.buyer as sold_to, ms.total_paid as memo_paid, ms.balance as memo_balance,
       case when o.sale_price is null then 'Not Sold' else ms.payment_status end as payment_status
from public.orders o left join public.memo_summary ms on ms.id = o.memo_id;

create view public.trade_overview with (security_invoker = true) as
select t.*, ms.memo_no, ms.buyer as sold_to, ms.total_paid as memo_paid, ms.balance as memo_balance,
       case when t.sale_price is null then 'Not Sold' else ms.payment_status end as payment_status
from public.trades t left join public.memo_summary ms on ms.id = t.memo_id;

-- ---------- 5. Functions ----------
-- Internal: find or create the buyer and memo. Locks the memo so simultaneous changes queue up.
create function public.get_or_create_memo(p_memo_no text, p_buyer text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare no text := upper(btrim(p_memo_no)); bname text := btrim(p_buyer); bid uuid; mid uuid; mbuyer uuid;
begin
  if no is null or no !~ '^[A-Z0-9._-]{1,20}$' then
    raise exception 'Memo number: use letters, numbers and . _ - only (up to 20).';
  end if;
  if bname is null or bname = '' then raise exception 'Enter who it was sold to.'; end if;
  insert into public.buyers (name) values (bname) on conflict (lower(btrim(name))) do nothing;
  select id into bid from public.buyers where lower(btrim(name)) = lower(bname);
  insert into public.memos (memo_no, buyer_id, created_by) values (no, bid, (select auth.uid())) on conflict (memo_no) do nothing;
  select id, buyer_id into mid, mbuyer from public.memos where memo_no = no for update;
  if mbuyer <> bid then
    raise exception 'Memo % already belongs to a different buyer. Use another memo number or the same buyer.', no;
  end if;
  return mid;
end $$;

-- Internal: a memo's payments may never exceed its bill.
create function public.assert_memo_not_overpaid(p_memo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare bill numeric; paid numeric;
begin
  if p_memo is null then return; end if;
  select total_bill, total_paid into bill, paid from public.memo_summary where id = p_memo;
  if paid > bill + 0.004 then
    raise exception 'That would leave the memo bill (%) below the % already paid.', bill, paid;
  end if;
end $$;

create function public.save_order(p jsonb, p_cost jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  oid uuid := nullif(p ->> 'id', '')::uuid;
  uid uuid := (select auth.uid());
  net numeric := nullif(p ->> 'net_wt', '')::numeric;
  mult numeric := nullif(p ->> 'multiplier', '')::numeric;
  pg numeric;
  sold_to text := nullif(btrim(p ->> 'sold_to'), '');
  memo_no text := nullif(btrim(p ->> 'memo_no'), '');
  price numeric := nullif(p ->> 'sale_price', '')::numeric;
  mid uuid; old_memo uuid;
  usd numeric; gold numeric; labor numeric; diam numeric; lch numeric; sub numeric; rate numeric;
begin
  if not public.is_staff_or_owner() then raise exception 'You do not have permission to edit orders.' using errcode = '42501'; end if;
  if p_cost is not null and not public.is_owner() then raise exception 'Only an owner can set costs.' using errcode = '42501'; end if;
  if (sold_to is null) <> (memo_no is null) or (memo_no is null) <> (price is null) then
    raise exception 'To record a sale, fill in Sold To, Memo and Sale Price together.';
  end if;
  if net is not null and mult is not null then pg := round(net * mult, 3); end if;
  if price is not null then mid := public.get_or_create_memo(memo_no, sold_to); end if;

  if oid is null then
    insert into public.orders (customer, style_no, jewelry_type, diamond_shape, order_date, gross_wt, dia_qty, in_ct,
      colour_stone, net_wt, multiplier, pg_wt, memo_id, sale_price, date_sold, created_by)
    values (nullif(btrim(p ->> 'customer'), ''), btrim(p ->> 'style_no'), nullif(btrim(p ->> 'jewelry_type'), ''),
      nullif(btrim(p ->> 'diamond_shape'), ''), nullif(p ->> 'order_date', '')::date, nullif(p ->> 'gross_wt', '')::numeric,
      nullif(p ->> 'dia_qty', '')::integer, nullif(p ->> 'in_ct', '')::numeric, nullif(p ->> 'colour_stone', '')::numeric,
      net, mult, pg, mid, price, case when price is null then null else coalesce(nullif(p ->> 'date_sold', '')::date, current_date) end, uid)
    returning id into oid;
    perform public.write_audit('order.created', 'order', oid::text, jsonb_build_object('style_no', p ->> 'style_no'));
  else
    select memo_id into old_memo from public.orders where id = oid for update;
    if not found then raise exception 'That order does not exist.' using errcode = 'P0002'; end if;
    update public.orders set customer = nullif(btrim(p ->> 'customer'), ''), style_no = btrim(p ->> 'style_no'),
      jewelry_type = nullif(btrim(p ->> 'jewelry_type'), ''), diamond_shape = nullif(btrim(p ->> 'diamond_shape'), ''),
      order_date = nullif(p ->> 'order_date', '')::date, gross_wt = nullif(p ->> 'gross_wt', '')::numeric,
      dia_qty = nullif(p ->> 'dia_qty', '')::integer, in_ct = nullif(p ->> 'in_ct', '')::numeric,
      colour_stone = nullif(p ->> 'colour_stone', '')::numeric, net_wt = net, multiplier = mult, pg_wt = pg,
      memo_id = mid, sale_price = price,
      date_sold = case when price is null then null else coalesce(nullif(p ->> 'date_sold', '')::date, current_date) end
    where id = oid;
    perform public.assert_memo_not_overpaid(old_memo);
    perform public.write_audit('order.updated', 'order', oid::text, jsonb_build_object('style_no', p ->> 'style_no'));
  end if;
  perform public.assert_memo_not_overpaid(mid);

  if p_cost is not null then
    rate := coalesce(nullif(p_cost ->> 'gold_rate', '')::numeric, (select gold_rate from public.business_settings));
    diam := coalesce(nullif(p_cost ->> 'diam_amount', '')::numeric, 0);
    lch := coalesce(nullif(p_cost ->> 'l_charges', '')::numeric, (select default_labor from public.business_settings));
    gold := round(coalesce(net, 0) * coalesce(mult, 0) * rate);
    labor := case when coalesce((p_cost ->> 'flat_labor')::boolean, false) then lch else round(coalesce(net, 0) * lch) end;
    sub := round(gold + diam + labor);
    usd := round(sub / (select usd_rate from public.business_settings), 2);
    insert into public.order_costs (order_id, gold_amount, diam_amount, l_charges, labor_amount, sub_total, usd_cost)
    values (oid, gold, diam, lch, labor, sub, usd)
    on conflict (order_id) do update set gold_amount = excluded.gold_amount, diam_amount = excluded.diam_amount,
      l_charges = excluded.l_charges, labor_amount = excluded.labor_amount, sub_total = excluded.sub_total,
      usd_cost = excluded.usd_cost, updated_at = now();
    perform public.write_audit('order.cost_set', 'order', oid::text, '{}'::jsonb);
  end if;
  return oid;
end $$;

create function public.save_trade(p jsonb, p_cost jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid := nullif(p ->> 'id', '')::uuid; uid uuid := (select auth.uid());
  sold_to text := nullif(btrim(p ->> 'sold_to'), ''); memo_no text := nullif(btrim(p ->> 'memo_no'), '');
  price numeric := nullif(p ->> 'sale_price', '')::numeric; mid uuid; old_memo uuid;
begin
  if not public.is_staff_or_owner() then raise exception 'You do not have permission to edit trades.' using errcode = '42501'; end if;
  if p_cost is not null and not public.is_owner() then raise exception 'Only an owner can set purchase details.' using errcode = '42501'; end if;
  if (sold_to is null) <> (memo_no is null) or (memo_no is null) <> (price is null) then
    raise exception 'To record a sale, fill in Sold To, Memo and Sale Price together.';
  end if;
  if price is not null then mid := public.get_or_create_memo(memo_no, sold_to); end if;
  if tid is null then
    insert into public.trades (trade_date, item, memo_id, sale_price, date_sold, notes, created_by)
    values (nullif(p ->> 'trade_date', '')::date, btrim(p ->> 'item'), mid, price,
      case when price is null then null else coalesce(nullif(p ->> 'date_sold', '')::date, current_date) end,
      nullif(btrim(p ->> 'notes'), ''), uid) returning id into tid;
    perform public.write_audit('trade.created', 'trade', tid::text, jsonb_build_object('item', p ->> 'item'));
  else
    select memo_id into old_memo from public.trades where id = tid for update;
    if not found then raise exception 'That trade does not exist.' using errcode = 'P0002'; end if;
    update public.trades set trade_date = nullif(p ->> 'trade_date', '')::date, item = btrim(p ->> 'item'),
      memo_id = mid, sale_price = price,
      date_sold = case when price is null then null else coalesce(nullif(p ->> 'date_sold', '')::date, current_date) end,
      notes = nullif(btrim(p ->> 'notes'), '') where id = tid;
    perform public.assert_memo_not_overpaid(old_memo);
    perform public.write_audit('trade.updated', 'trade', tid::text, jsonb_build_object('item', p ->> 'item'));
  end if;
  perform public.assert_memo_not_overpaid(mid);
  if p_cost is not null then
    insert into public.trade_costs (trade_id, vendor, purchase_price)
    values (tid, nullif(btrim(p_cost ->> 'vendor'), ''), coalesce(nullif(p_cost ->> 'purchase_price', '')::numeric, 0))
    on conflict (trade_id) do update set vendor = excluded.vendor, purchase_price = excluded.purchase_price;
    perform public.write_audit('trade.cost_set', 'trade', tid::text, '{}'::jsonb);
  end if;
  return tid;
end $$;

create function public.save_expense(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if not public.is_owner() then raise exception 'Only an owner can record expenses.' using errcode = '42501'; end if;
  if eid is null then
    insert into public.expenses (expense_date, category, description, amount, seller, notes, created_by)
    values ((p ->> 'expense_date')::date, btrim(p ->> 'category'), btrim(p ->> 'description'), (p ->> 'amount')::numeric,
      nullif(btrim(p ->> 'seller'), ''), nullif(btrim(p ->> 'notes'), ''), (select auth.uid())) returning id into eid;
    perform public.write_audit('expense.created', 'expense', eid::text, jsonb_build_object('amount', p ->> 'amount'));
  else
    update public.expenses set expense_date = (p ->> 'expense_date')::date, category = btrim(p ->> 'category'),
      description = btrim(p ->> 'description'), amount = (p ->> 'amount')::numeric,
      seller = nullif(btrim(p ->> 'seller'), ''), notes = nullif(btrim(p ->> 'notes'), '') where id = eid;
    if not found then raise exception 'That expense does not exist.' using errcode = 'P0002'; end if;
    perform public.write_audit('expense.updated', 'expense', eid::text, jsonb_build_object('amount', p ->> 'amount'));
  end if;
  return eid;
end $$;

create function public.record_payment(p_memo uuid, p_amount numeric, p_paid_on date, p_key text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; bill numeric; paid numeric;
begin
  if not public.is_staff_or_owner() then raise exception 'You do not have permission to record payments.' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount above zero.'; end if;
  perform 1 from public.memos where id = p_memo for update;           -- everyone paying this memo queues here
  if not found then raise exception 'That memo does not exist.' using errcode = 'P0002'; end if;
  if p_key is not null then
    select id into pid from public.payments where idempotency_key = p_key;
    if found then return pid; end if;                                 -- same request sent twice: do nothing
  end if;
  select total_bill, total_paid into bill, paid from public.memo_summary where id = p_memo;
  if paid + p_amount > bill + 0.004 then
    raise exception 'That is more than the balance still due (%).', round(bill - paid, 2);
  end if;
  insert into public.payments (memo_id, amount, paid_on, idempotency_key, created_by)
  values (p_memo, p_amount, coalesce(p_paid_on, current_date), p_key, (select auth.uid())) returning id into pid;
  return pid;
end $$;

create function public.void_payment(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
  if not public.is_owner() then raise exception 'Only an owner can cancel a payment.' using errcode = '42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'Give a reason.'; end if;
  select memo_id into mid from public.payments where id = p_payment and voided_at is null;
  if not found then raise exception 'That payment does not exist or is already cancelled.' using errcode = 'P0002'; end if;
  perform 1 from public.memos where id = mid for update;
  update public.payments set voided_at = now(), void_reason = btrim(p_reason), voided_by = (select auth.uid()) where id = p_payment;
  perform public.write_audit('payment.voided', 'payment', p_payment::text, jsonb_build_object('reason', btrim(p_reason)));
end $$;

-- Owner only. Orders and trades that were sold cannot be deleted. A full copy goes in the audit log.
create function public.delete_record(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare snap jsonb;
begin
  if not public.is_owner() then raise exception 'Only an owner can delete records.' using errcode = '42501'; end if;
  if p_kind = 'order' then
    select to_jsonb(o) into snap from public.orders o where id = p_id for update;
    if snap is null then raise exception 'That order does not exist.' using errcode = 'P0002'; end if;
    if snap ->> 'sale_price' is not null then raise exception 'A sold order cannot be deleted. Remove the sale first.'; end if;
    delete from public.orders where id = p_id;
  elsif p_kind = 'trade' then
    select to_jsonb(t) into snap from public.trades t where id = p_id for update;
    if snap is null then raise exception 'That trade does not exist.' using errcode = 'P0002'; end if;
    if snap ->> 'sale_price' is not null then raise exception 'A sold trade cannot be deleted. Remove the sale first.'; end if;
    delete from public.trades where id = p_id;
  elsif p_kind = 'expense' then
    select to_jsonb(e) into snap from public.expenses e where id = p_id for update;
    if snap is null then raise exception 'That expense does not exist.' using errcode = 'P0002'; end if;
    delete from public.expenses where id = p_id;
  else
    raise exception 'Unknown record type.';
  end if;
  perform public.write_audit(p_kind || '.deleted', p_kind, p_id::text, snap);
end $$;

-- ---------- 6. Function permissions ----------
revoke execute on function
  public.get_or_create_memo(text, text), public.assert_memo_not_overpaid(uuid), public.save_order(jsonb, jsonb),
  public.save_trade(jsonb, jsonb), public.save_expense(jsonb), public.record_payment(uuid, numeric, date, text),
  public.void_payment(uuid, text), public.delete_record(text, uuid) from public, anon, authenticated;
grant execute on function public.save_order(jsonb, jsonb), public.save_trade(jsonb, jsonb), public.save_expense(jsonb),
  public.record_payment(uuid, numeric, date, text), public.void_payment(uuid, text), public.delete_record(text, uuid) to authenticated;

-- ---------- 7. Table permissions + Row Level Security ----------
alter table public.buyers enable row level security;
alter table public.memos enable row level security;
alter table public.orders enable row level security;
alter table public.order_costs enable row level security;
alter table public.trades enable row level security;
alter table public.trade_costs enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;

revoke all on public.buyers, public.memos, public.orders, public.order_costs, public.trades, public.trade_costs,
  public.expenses, public.payments, public.memo_summary, public.order_overview, public.trade_overview from anon, authenticated;
grant select on public.buyers, public.memos, public.orders, public.order_costs, public.trades, public.trade_costs,
  public.expenses, public.payments, public.memo_summary, public.order_overview, public.trade_overview to authenticated;

create policy buyers_select on public.buyers for select to authenticated using (public.is_staff_or_owner());
create policy memos_select on public.memos for select to authenticated using (public.is_staff_or_owner());
create policy orders_select on public.orders for select to authenticated using (public.is_staff_or_owner());
create policy trades_select on public.trades for select to authenticated using (public.is_staff_or_owner());
create policy payments_select on public.payments for select to authenticated using (public.is_staff_or_owner());
create policy order_costs_select on public.order_costs for select to authenticated using (public.is_owner());
create policy trade_costs_select on public.trade_costs for select to authenticated using (public.is_owner());
create policy expenses_select on public.expenses for select to authenticated using (public.is_owner());
