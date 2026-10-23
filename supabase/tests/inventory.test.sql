-- Inventory security + stock-rule tests. Runs after rls.test.sql (re-uses its owner/staff/seller accounts).
do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  loc_a uuid; loc_b uuid;
  ring uuid; chain uuid; n int; bal int;
  stones jsonb := '[{"stone_type":"Diamond","shape":"Round","cut":"Brilliant","colour":"F","clarity":"VS1","carat_weight":"0.50","piece_count":"1"},
                    {"stone_type":"Ruby","carat_weight":"0.25"}]';
begin
  perform t.admin();
  select id into loc_a from public.stock_locations where name = 'Main store';
  insert into public.stock_locations (name) values ('Vault') returning id into loc_b;

  -- creating products
  perform t.as_user(staff_id);
  ring := public.save_product('{"sku":"R-001","name":"Solitaire Ring","category":"Rings","metal_type":"gold","purity":"18K","gross_weight_g":"4.2","net_metal_weight_g":"3.9","tracking":"individual","retail_price":"85000"}'::jsonb, stones, null);
  perform t.ok('staff can create a product with stones',
    (select count(*) from public.product_stones where product_id = ring) = 2);
  perform t.denied('staff cannot set purchase costs',
    format($q$select public.save_product(%L::jsonb, '[]'::jsonb, '{"purchase_cost":"100"}'::jsonb)$q$,
      '{"id":"' || ring || '","sku":"R-001","name":"Solitaire Ring","category":"Rings"}'), 'only an owner');
  perform t.denied('duplicate SKU rejected (any letter case)',
    $q$select public.save_product('{"sku":"r-001","name":"Copy","category":"Rings"}'::jsonb)$q$, 'duplicate key');
  perform t.denied('net weight above gross weight rejected',
    $q$select public.save_product('{"sku":"BAD-1","name":"Bad","category":"Rings","gross_weight_g":"1","net_metal_weight_g":"2"}'::jsonb)$q$, 'check constraint');
  perform t.denied('staff cannot write to products directly',
    $q$update public.products set retail_price = 1$q$, 'permission denied');
  perform t.ok('staff cannot read purchase costs', (select count(*) from public.product_costs) = 0);

  perform t.as_user(owner_id);
  perform public.save_product(
    format('{"id":"%s","sku":"R-001","name":"Solitaire Ring","category":"Rings","tracking":"individual","retail_price":"85000"}', ring)::jsonb,
    stones, '{"purchase_cost":"52000","additional_cost":"500","making_charges":"3000"}'::jsonb);
  perform t.ok('owner can read purchase costs', (select purchase_cost from public.product_costs where product_id = ring) = 52000);
  perform t.denied('even an owner cannot write costs directly',
    format($q$update public.product_costs set purchase_cost = 1 where product_id = %L$q$, ring), 'permission denied');

  -- sellers see nothing yet
  perform t.as_user(seller_id);
  perform t.ok('seller cannot see products', (select count(*) from public.products) = 0);
  perform t.ok('seller cannot see the product overview', (select count(*) from public.product_overview) = 0);
  perform t.ok('seller cannot see stones', (select count(*) from public.product_stones) = 0);
  perform t.ok('seller cannot see stock', (select count(*) from public.stock_levels) = 0);
  perform t.denied('seller cannot create products',
    $q$select public.save_product('{"sku":"S-1","name":"x","category":"y"}'::jsonb)$q$, 'permission');
  perform t.denied('seller cannot add certificates',
    format($q$insert into public.certificates (product_id, issuer, certificate_number) values (%L,'GIA','1')$q$, ring), 'row-level security');
  perform t.admin();

  -- opening stock
  perform t.as_user(staff_id);
  perform t.denied('one-of-a-kind piece cannot start with 2',
    format($q$select public.record_opening_stock(%L, %L, 2)$q$, ring, loc_a), 'one-of-a-kind');
  perform public.record_opening_stock(ring, loc_a, 1);
  perform t.denied('opening stock cannot be recorded twice',
    format($q$select public.record_opening_stock(%L, %L, 1)$q$, ring, loc_a), 'already recorded');
  perform t.denied('staff cannot adjust stock',
    format($q$select public.adjust_stock(%L, %L, -1, 'oops')$q$, ring, loc_a), 'only an owner');
  perform t.denied('staff cannot archive products',
    format($q$select public.set_product_archived(%L, true)$q$, ring), 'only an owner');
  perform t.denied('staff cannot write stock directly',
    format($q$update public.stock_levels set quantity = 99 where product_id = %L$q$, ring), 'permission denied');
  perform t.denied('staff cannot forge stock history',
    format($q$insert into public.stock_movements (product_id, location_id, movement_type, quantity_change, balance_after) values (%L,%L,'sale',-1,0)$q$, ring, loc_a), 'permission denied');
  perform t.denied('tracking type cannot change after stock exists',
    format($q$select public.save_product(%L::jsonb)$q$, format('{"id":"%s","sku":"R-001","name":"Solitaire Ring","category":"Rings","tracking":"quantity"}', ring)), 'cannot change');

  -- transfer
  perform public.transfer_stock(ring, loc_a, loc_b, 1);
  perform t.ok('transfer moved the piece',
    (select quantity from public.stock_levels where product_id = ring and location_id = loc_b) = 1
    and (select quantity from public.stock_levels where product_id = ring and location_id = loc_a) = 0);
  perform t.ok('transfer wrote two linked history rows',
    (select count(distinct transfer_id) from public.stock_movements where product_id = ring and transfer_id is not null) = 1
    and (select count(*) from public.stock_movements where product_id = ring and transfer_id is not null) = 2);
  perform t.denied('cannot transfer stock that is not there',
    format($q$select public.transfer_stock(%L, %L, %L, 1)$q$, ring, loc_a, loc_b), 'not enough stock');

  -- quantity-tracked stock + overselling protection
  chain := public.save_product('{"sku":"CH-22K","name":"Gold Chain","category":"Chains","tracking":"quantity","low_stock_threshold":"3"}'::jsonb);
  perform public.record_opening_stock(chain, loc_a, 10);
  perform t.as_user(owner_id);
  bal := public.adjust_stock(chain, loc_a, -3, 'Damaged in handling');
  perform t.ok('owner adjustment applied', bal = 7);
  perform t.denied('cannot remove more than exists',
    format($q$select public.adjust_stock(%L, %L, -8, 'too many')$q$, chain, loc_a), 'not enough stock');
  perform t.denied('adjustment needs a reason',
    format($q$select public.adjust_stock(%L, %L, -1, '')$q$, chain, loc_a), 'reason');
  perform public.adjust_stock(chain, loc_a, -1, 'Retry test', 'key-1');
  perform public.adjust_stock(chain, loc_a, -1, 'Retry test', 'key-1');
  perform t.ok('same request sent twice only counts once',
    (select quantity from public.stock_levels where product_id = chain and location_id = loc_a) = 6);
  perform t.ok('low-stock flag is off at 6 (limit 3)', not (select is_low_stock from public.product_overview where id = chain));
  perform public.adjust_stock(chain, loc_a, -4, 'Sold outside system');
  perform t.ok('low-stock flag turns on at 2 (limit 3)', (select is_low_stock from public.product_overview where id = chain));
  perform t.denied('cannot archive while stock remains',
    format($q$select public.set_product_archived(%L, true)$q$, chain), 'before archiving');
  perform t.admin();
  perform t.denied('stock history cannot be edited even by an administrator',
    $q$update public.stock_movements set quantity_change = 1$q$, 'cannot be changed');
  perform t.denied('stock history cannot be deleted even by an administrator',
    $q$delete from public.stock_movements$q$, 'cannot be changed');
  perform t.ok('stock changes are in the audit log',
    (select count(*) from public.audit_logs where action = 'stock.adjusted') >= 4);

  -- certificates
  perform t.as_user(staff_id);
  insert into public.certificates (product_id, issuer, certificate_number) values (ring, 'GIA', '2141234567');
  perform t.denied('duplicate certificate number rejected',
    format($q$insert into public.certificates (product_id, issuer, certificate_number) values (%L, 'gia', '2141234567')$q$, ring), 'duplicate key');

  -- stored files: staff yes, seller no
  insert into storage.objects (bucket_id, name) values ('certificates', 'x/test.pdf');
  perform t.as_user(seller_id);
  perform t.ok('seller cannot see stored files', (select count(*) from storage.objects) = 0);
  perform t.denied('seller cannot upload files',
    $q$insert into storage.objects (bucket_id, name) values ('certificates', 'evil.pdf')$q$, 'row-level security');
  perform t.admin();

  -- archived products
  perform t.as_user(owner_id);
  perform t.denied('individual piece cannot be duplicated by an adjustment',
    format($q$select public.adjust_stock(%L, %L, 1, 'nope')$q$, ring, loc_a), 'one-of-a-kind');
  perform t.admin();
  raise notice 'ALL INVENTORY TESTS PASSED';
end $$;
