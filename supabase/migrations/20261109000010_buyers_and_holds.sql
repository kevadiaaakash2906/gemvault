-- GemVault: (1) rename and merge buyers, (2) pieces "out with a customer" without a fake sale.
-- Additive only: no existing table, view or function is changed.

-- ---------- 1. Buyers: rename and merge (owner only) ----------
create function public.rename_buyer(p_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare nm text := btrim(p_name);
begin
  if not public.is_owner() then raise exception 'Only an owner can rename buyers.' using errcode = '42501'; end if;
  if nm is null or char_length(nm) not between 1 and 120 then raise exception 'Enter a name of up to 120 characters.'; end if;
  if exists (select 1 from public.buyers where lower(btrim(name)) = lower(nm) and id <> p_id) then
    raise exception 'Another buyer already has that name. Use Merge instead.';
  end if;
  update public.buyers set name = nm where id = p_id;
  if not found then raise exception 'That buyer does not exist.' using errcode = 'P0002'; end if;
  perform public.write_audit('buyer.renamed', 'buyer', p_id::text, jsonb_build_object('name', nm));
end $$;

-- Moves every memo of p_from to p_into, then removes p_from. Memo numbers, bills and payments do not change.
create function public.merge_buyers(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare fname text; iname text; moved integer;
begin
  if not public.is_owner() then raise exception 'Only an owner can merge buyers.' using errcode = '42501'; end if;
  if p_from = p_into then raise exception 'Choose two different buyers.'; end if;
  select name into fname from public.buyers where id = p_from for update;
  if not found then raise exception 'The buyer to merge does not exist.' using errcode = 'P0002'; end if;
  select name into iname from public.buyers where id = p_into for update;
  if not found then raise exception 'The buyer to keep does not exist.' using errcode = 'P0002'; end if;
  update public.memos set buyer_id = p_into where buyer_id = p_from;
  get diagnostics moved = row_count;
  delete from public.buyers where id = p_from;
  perform public.write_audit('buyer.merged', 'buyer', p_into::text,
    jsonb_build_object('merged_name', fname, 'into_name', iname, 'memos_moved', moved));
end $$;

-- ---------- 2. Pieces out with a customer (not sold) ----------
create table public.order_holds (
  order_id uuid primary key references public.orders (id) on delete cascade,
  held_by text not null check (char_length(btrim(held_by)) between 1 and 120),
  held_since date not null default current_date,
  note text check (char_length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.order_holds enable row level security;
revoke all on public.order_holds from anon, authenticated;
grant select on public.order_holds to authenticated;
-- Whoever can see the order can see where it is.
create policy order_holds_select on public.order_holds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- When a sale is recorded on a piece, it is no longer "out": the marker goes away by itself.
create function public.clear_hold_when_sold() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.memo_id is not null then delete from public.order_holds where order_id = new.id; end if;
  return null;
end $$;
create trigger orders_clear_hold after insert or update of memo_id on public.orders
  for each row execute function public.clear_hold_when_sold();

create function public.set_order_hold(p_order uuid, p_held_by text, p_since date default null, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare who text := btrim(p_held_by); sold numeric;
begin
  if not public.is_staff_or_owner() then raise exception 'You do not have permission to do this.' using errcode = '42501'; end if;
  if who is null or who = '' then raise exception 'Enter who has the piece.'; end if;
  select sale_price into sold from public.orders where id = p_order for update;
  if not found then raise exception 'That order does not exist.' using errcode = 'P0002'; end if;
  if sold is not null then raise exception 'This piece is already sold. Return it first if it came back.'; end if;
  insert into public.order_holds (order_id, held_by, held_since, note, created_by)
  values (p_order, who, coalesce(p_since, current_date), nullif(btrim(p_note), ''), (select auth.uid()))
  on conflict (order_id) do update set held_by = excluded.held_by, held_since = excluded.held_since, note = excluded.note;
  perform public.write_audit('order.hold_set', 'order', p_order::text, jsonb_build_object('held_by', who));
end $$;

create function public.clear_order_hold(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff_or_owner() then raise exception 'You do not have permission to do this.' using errcode = '42501'; end if;
  delete from public.order_holds where order_id = p_order;
  if not found then raise exception 'That piece is not marked as out.' using errcode = 'P0002'; end if;
  perform public.write_audit('order.hold_cleared', 'order', p_order::text, '{}'::jsonb);
end $$;

-- ---------- 3. Function permissions ----------
revoke execute on function public.rename_buyer(uuid, text), public.merge_buyers(uuid, uuid), public.clear_hold_when_sold(),
  public.set_order_hold(uuid, text, date, text), public.clear_order_hold(uuid) from public, anon, authenticated;
grant execute on function public.rename_buyer(uuid, text), public.merge_buyers(uuid, uuid),
  public.set_order_hold(uuid, text, date, text), public.clear_order_hold(uuid) to authenticated;
