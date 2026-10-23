-- GemVault Phase 2: products, stones, certificates, photos, stock ledger, locations.
-- Costs live in their own owner-only table. Stock changes only happen through the functions below.

create type public.tracking_mode as enum ('individual', 'quantity');
create type public.stock_movement_type as enum
  ('opening', 'adjustment', 'transfer_in', 'transfer_out', 'purchase_receipt', 'sale', 'return');

-- ---------- Tables ----------
create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index stock_locations_name_unique on public.stock_locations (lower(name));
insert into public.stock_locations (name) values ('Main store');   -- a starting place to hold stock, not sample data

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  barcode text check (barcode is null or char_length(barcode) between 1 and 64),
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 4000),
  category text not null check (char_length(category) between 1 and 80),
  collection text check (char_length(collection) <= 80),
  metal_type text check (metal_type in ('gold', 'silver', 'platinum', 'palladium', 'other')),
  purity text check (char_length(purity) <= 20),
  gross_weight_g numeric(12,3) check (gross_weight_g >= 0),
  net_metal_weight_g numeric(12,3) check (net_metal_weight_g >= 0),
  tracking public.tracking_mode not null default 'individual',
  retail_price numeric(14,2) not null default 0 check (retail_price >= 0),
  hsn_code text check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$'),
  gst_rate numeric(5,2) check (gst_rate between 0 and 100),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_metal_weight_g is null or gross_weight_g is null or net_metal_weight_g <= gross_weight_g)
);
create unique index products_sku_unique on public.products (lower(sku));
create unique index products_barcode_unique on public.products (barcode) where barcode is not null;
create index products_category_idx on public.products (category);
create index products_created_idx on public.products (created_at desc);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Confidential. Only owners can read or write (policies below).
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  additional_cost numeric(14,2) not null default 0 check (additional_cost >= 0),
  making_charges numeric(14,2) not null default 0 check (making_charges >= 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.product_stones (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  stone_type text not null check (char_length(stone_type) between 1 and 60),
  shape text check (char_length(shape) <= 60),
  cut text check (char_length(cut) <= 60),
  colour text check (char_length(colour) <= 60),
  clarity text check (char_length(clarity) <= 60),
  carat_weight numeric(10,3) check (carat_weight > 0),
  length_mm numeric(8,2) check (length_mm >= 0),
  width_mm numeric(8,2) check (width_mm >= 0),
  depth_mm numeric(8,2) check (depth_mm >= 0),
  origin text check (char_length(origin) <= 80),
  treatment text check (char_length(treatment) <= 120),
  piece_count integer not null default 1 check (piece_count >= 1),
  created_at timestamptz not null default now()
);
create index product_stones_product_idx on public.product_stones (product_id);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  issuer text not null check (char_length(issuer) between 1 and 80),
  certificate_number text not null check (char_length(certificate_number) between 1 and 80),
  issued_on date,
  file_path text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index certificates_unique on public.certificates (lower(issuer), lower(certificate_number));
create index certificates_product_idx on public.certificates (product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

create table public.stock_levels (
  product_id uuid not null references public.products (id) on delete restrict,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id),
  check (reserved <= quantity)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity_change integer not null check (quantity_change <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text check (char_length(reason) <= 300),
  reference text,
  idempotency_key text unique,
  transfer_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create function public.stock_movements_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Stock history cannot be changed or deleted. Record a correction instead.' using errcode = '42501';
end $$;
create trigger stock_movements_no_change before update or delete on public.stock_movements
  for each row execute function public.stock_movements_immutable();

-- One row per product with stock totals. Runs with the viewer's own permissions.
create view public.product_overview with (security_invoker = true) as
select p.*,
       coalesce(s.total_quantity, 0)::integer as total_quantity,
       coalesce(s.total_reserved, 0)::integer as total_reserved,
       (p.low_stock_threshold > 0 and coalesce(s.total_quantity, 0) <= p.low_stock_threshold) as is_low_stock
from public.products p
left join (
  select product_id, sum(quantity) as total_quantity, sum(reserved) as total_reserved
  from public.stock_levels group by product_id
) s on s.product_id = p.id;

-- ---------- Functions ----------
create function public.save_product(p jsonb, p_stones jsonb default '[]'::jsonb, p_cost jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := nullif(p ->> 'id', '')::uuid;
  uid uuid := (select auth.uid());
  new_tracking public.tracking_mode := coalesce(nullif(p ->> 'tracking', ''), 'individual')::public.tracking_mode;
  old_tracking public.tracking_mode;
  s jsonb;
begin
  if not public.is_staff_or_owner() then
    raise exception 'You do not have permission to edit products.' using errcode = '42501';
  end if;
  if p_cost is not null and not public.is_owner() then
    raise exception 'Only an owner can set purchase costs.' using errcode = '42501';
  end if;

  if pid is null then
    insert into public.products (sku, barcode, name, description, category, collection, metal_type, purity,
      gross_weight_g, net_metal_weight_g, tracking, retail_price, hsn_code, gst_rate, low_stock_threshold, created_by)
    values (btrim(p ->> 'sku'), nullif(btrim(p ->> 'barcode'), ''), btrim(p ->> 'name'),
      nullif(btrim(p ->> 'description'), ''), btrim(p ->> 'category'), nullif(btrim(p ->> 'collection'), ''),
      nullif(p ->> 'metal_type', ''), nullif(btrim(p ->> 'purity'), ''),
      nullif(p ->> 'gross_weight_g', '')::numeric, nullif(p ->> 'net_metal_weight_g', '')::numeric,
      new_tracking, coalesce(nullif(p ->> 'retail_price', '')::numeric, 0),
      nullif(btrim(p ->> 'hsn_code'), ''), nullif(p ->> 'gst_rate', '')::numeric,
      coalesce(nullif(p ->> 'low_stock_threshold', '')::integer, 0), uid)
    returning id into pid;
    perform public.write_audit('product.created', 'product', pid::text, jsonb_build_object('sku', p ->> 'sku'));
  else
    select tracking into old_tracking from public.products where id = pid for update;
    if not found then raise exception 'That product does not exist.' using errcode = 'P0002'; end if;
    if old_tracking <> new_tracking and exists (select 1 from public.stock_movements where product_id = pid) then
      raise exception 'Tracking type cannot change after stock has been recorded.';
    end if;
    update public.products set
      sku = btrim(p ->> 'sku'), barcode = nullif(btrim(p ->> 'barcode'), ''), name = btrim(p ->> 'name'),
      description = nullif(btrim(p ->> 'description'), ''), category = btrim(p ->> 'category'),
      collection = nullif(btrim(p ->> 'collection'), ''), metal_type = nullif(p ->> 'metal_type', ''),
      purity = nullif(btrim(p ->> 'purity'), ''),
      gross_weight_g = nullif(p ->> 'gross_weight_g', '')::numeric,
      net_metal_weight_g = nullif(p ->> 'net_metal_weight_g', '')::numeric,
      tracking = new_tracking, retail_price = coalesce(nullif(p ->> 'retail_price', '')::numeric, 0),
      hsn_code = nullif(btrim(p ->> 'hsn_code'), ''), gst_rate = nullif(p ->> 'gst_rate', '')::numeric,
      low_stock_threshold = coalesce(nullif(p ->> 'low_stock_threshold', '')::integer, 0)
    where id = pid;
    perform public.write_audit('product.updated', 'product', pid::text, jsonb_build_object('sku', p ->> 'sku'));
  end if;

  delete from public.product_stones where product_id = pid;
  for s in select * from jsonb_array_elements(coalesce(p_stones, '[]'::jsonb)) loop
    insert into public.product_stones (product_id, stone_type, shape, cut, colour, clarity, carat_weight,
      length_mm, width_mm, depth_mm, origin, treatment, piece_count)
    values (pid, btrim(s ->> 'stone_type'), nullif(btrim(s ->> 'shape'), ''), nullif(btrim(s ->> 'cut'), ''),
      nullif(btrim(s ->> 'colour'), ''), nullif(btrim(s ->> 'clarity'), ''),
      nullif(s ->> 'carat_weight', '')::numeric, nullif(s ->> 'length_mm', '')::numeric,
      nullif(s ->> 'width_mm', '')::numeric, nullif(s ->> 'depth_mm', '')::numeric,
      nullif(btrim(s ->> 'origin'), ''), nullif(btrim(s ->> 'treatment'), ''),
      coalesce(nullif(s ->> 'piece_count', '')::integer, 1));
  end loop;

  if p_cost is not null then
    insert into public.product_costs (product_id, purchase_cost, additional_cost, making_charges, updated_by)
    values (pid, coalesce(nullif(p_cost ->> 'purchase_cost', '')::numeric, 0),
      coalesce(nullif(p_cost ->> 'additional_cost', '')::numeric, 0),
      coalesce(nullif(p_cost ->> 'making_charges', '')::numeric, 0), uid)
    on conflict (product_id) do update set purchase_cost = excluded.purchase_cost,
      additional_cost = excluded.additional_cost, making_charges = excluded.making_charges,
      updated_by = excluded.updated_by, updated_at = now();
    perform public.write_audit('product.cost_set', 'product', pid::text, '{}'::jsonb);
  end if;
  return pid;
end $$;

create function public.set_product_archived(target uuid, archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'Only an owner can archive or restore products.' using errcode = '42501';
  end if;
  perform 1 from public.products where id = target for update;
  if not found then raise exception 'That product does not exist.' using errcode = 'P0002'; end if;
  if archived and coalesce((select sum(quantity) from public.stock_levels where product_id = target), 0) > 0 then
    raise exception 'Move or write off all stock before archiving this product.';
  end if;
  update public.products set is_archived = archived, archived_at = case when archived then now() end where id = target;
  perform public.write_audit(case when archived then 'product.archived' else 'product.restored' end, 'product', target::text, '{}'::jsonb);
end $$;

-- Internal: the single place where stock numbers change. Locks the product first so
-- simultaneous requests queue up instead of overselling.
create function public.apply_stock_change(
  p_product uuid, p_location uuid, p_delta integer, p_type public.stock_movement_type,
  p_reason text, p_reference text, p_key text, p_transfer uuid
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  trk public.tracking_mode; archived boolean; cur integer; res integer; nxt integer; others integer;
begin
  if p_delta = 0 then raise exception 'Quantity must not be zero.'; end if;
  select tracking, is_archived into trk, archived from public.products where id = p_product for update;
  if not found then raise exception 'That product does not exist.' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.stock_locations where id = p_location and is_active) then
    raise exception 'That stock location does not exist or is switched off.';
  end if;

  if p_key is not null then
    select balance_after into nxt from public.stock_movements where idempotency_key = p_key;
    if found then return nxt; end if;          -- same request sent twice: do nothing the second time
  end if;
  if archived then raise exception 'This product is archived.'; end if;

  insert into public.stock_levels (product_id, location_id) values (p_product, p_location) on conflict do nothing;
  select quantity, reserved into cur, res from public.stock_levels
   where product_id = p_product and location_id = p_location for update;
  nxt := cur + p_delta;
  if nxt < 0 then raise exception 'Not enough stock. Only % available there.', cur; end if;
  if nxt < res then raise exception 'Cannot go below the % reserved for customers.', res; end if;
  if trk = 'individual' then
    select coalesce(sum(quantity), 0) into others from public.stock_levels
     where product_id = p_product and location_id <> p_location;
    if nxt + others > 1 then
      raise exception 'A one-of-a-kind piece can only exist once across all locations.';
    end if;
  end if;

  update public.stock_levels set quantity = nxt, updated_at = now()
   where product_id = p_product and location_id = p_location;
  insert into public.stock_movements (product_id, location_id, movement_type, quantity_change, balance_after,
      reason, reference, idempotency_key, transfer_id, created_by)
  values (p_product, p_location, p_type, p_delta, nxt, p_reason, p_reference, p_key, p_transfer, (select auth.uid()));
  return nxt;
end $$;

create function public.record_opening_stock(p_product uuid, p_location uuid, p_qty integer, p_key text default null)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff_or_owner() then
    raise exception 'You do not have permission to record stock.' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Opening quantity must be at least 1.'; end if;
  perform 1 from public.products where id = p_product for update;
  if exists (select 1 from public.stock_movements where product_id = p_product
             and (p_key is null or idempotency_key is distinct from p_key)) then
    raise exception 'Opening stock was already recorded. Ask an owner to make an adjustment instead.';
  end if;
  return public.apply_stock_change(p_product, p_location, p_qty, 'opening', 'Opening stock', null, p_key, null);
end $$;

create function public.adjust_stock(p_product uuid, p_location uuid, p_delta integer, p_reason text, p_key text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare result integer;
begin
  if not public.is_owner() then
    raise exception 'Only an owner can adjust stock.' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'Give a reason for the adjustment.';
  end if;
  result := public.apply_stock_change(p_product, p_location, p_delta, 'adjustment', btrim(p_reason), null, p_key, null);
  perform public.write_audit('stock.adjusted', 'product', p_product::text,
    jsonb_build_object('location', p_location, 'change', p_delta, 'reason', btrim(p_reason)));
  return result;
end $$;

create function public.transfer_stock(p_product uuid, p_from uuid, p_to uuid, p_qty integer, p_key text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare tid uuid := gen_random_uuid();
begin
  if not public.is_staff_or_owner() then
    raise exception 'You do not have permission to move stock.' using errcode = '42501';
  end if;
  if p_from = p_to then raise exception 'Choose two different locations.'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be at least 1.'; end if;
  perform public.apply_stock_change(p_product, p_from, -p_qty, 'transfer_out', 'Transfer', null,
    case when p_key is null then null else p_key || ':out' end, tid);
  perform public.apply_stock_change(p_product, p_to, p_qty, 'transfer_in', 'Transfer', null,
    case when p_key is null then null else p_key || ':in' end, tid);
  return tid;
end $$;

-- ---------- Function permissions ----------
revoke execute on function
  public.save_product(jsonb, jsonb, jsonb), public.set_product_archived(uuid, boolean),
  public.apply_stock_change(uuid, uuid, integer, public.stock_movement_type, text, text, text, uuid),
  public.record_opening_stock(uuid, uuid, integer, text), public.adjust_stock(uuid, uuid, integer, text, text),
  public.transfer_stock(uuid, uuid, uuid, integer, text), public.stock_movements_immutable()
  from public, anon, authenticated;
grant execute on function public.save_product(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.set_product_archived(uuid, boolean) to authenticated;
grant execute on function public.record_opening_stock(uuid, uuid, integer, text) to authenticated;
grant execute on function public.adjust_stock(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.transfer_stock(uuid, uuid, uuid, integer, text) to authenticated;

-- ---------- Table permissions + Row Level Security ----------
alter table public.stock_locations enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_stones enable row level security;
alter table public.certificates enable row level security;
alter table public.product_images enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.stock_locations, public.products, public.product_costs, public.product_stones,
  public.certificates, public.product_images, public.stock_levels, public.stock_movements,
  public.product_overview from anon, authenticated;

grant select, insert, update on public.stock_locations to authenticated;
grant select on public.products, public.product_stones, public.stock_levels, public.stock_movements,
  public.product_overview to authenticated;
grant select on public.product_costs to authenticated;
grant select, insert, update, delete on public.certificates, public.product_images to authenticated;

create policy locations_select on public.stock_locations for select to authenticated using (public.is_staff_or_owner());
create policy locations_insert on public.stock_locations for insert to authenticated with check (public.is_owner());
create policy locations_update on public.stock_locations for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy products_select on public.products for select to authenticated using (public.is_staff_or_owner());
create policy stones_select on public.product_stones for select to authenticated using (public.is_staff_or_owner());
create policy costs_select on public.product_costs for select to authenticated using (public.is_owner());
create policy levels_select on public.stock_levels for select to authenticated using (public.is_staff_or_owner());
create policy movements_select on public.stock_movements for select to authenticated using (public.is_staff_or_owner());

create policy certificates_all on public.certificates for all to authenticated
  using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy images_all on public.product_images for all to authenticated
  using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());

-- ---------- Private file storage (photos and certificates) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']),
  ('certificates', 'certificates', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy gemvault_files_select on storage.objects for select to authenticated
  using (bucket_id in ('product-images', 'certificates') and public.is_staff_or_owner());
create policy gemvault_files_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'certificates') and public.is_staff_or_owner());
create policy gemvault_files_delete on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'certificates') and public.is_staff_or_owner());
