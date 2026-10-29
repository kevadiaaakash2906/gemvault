-- Return tests. Runs after reports.test.sql. Clean slate inside a transaction that is rolled back.
begin;
select t.admin();
truncate public.returns, public.payments, public.order_costs, public.trade_costs, public.orders, public.trades,
  public.expenses, public.memos, public.buyers;
update public.business_settings set gold_rate = 17000, usd_rate = 94;
update auth.users set encrypted_password = extensions.crypt('owner-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000001';
update auth.users set encrypted_password = extensions.crypt('staff-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000002';
update auth.users set encrypted_password = extensions.crypt('seller-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000003';

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  a uuid; b uuid; c uuid; d uuid; e uuid; tr uuid;
  r jsonb; k1 record; k2 record; n int;
begin
  perform t.as_user(owner_id);
  a := public.save_order('{"style_no":"RA","sold_to":"ALPHA","memo_no":"R1","sale_price":"1000","date_sold":"2026-09-01"}'::jsonb);
  b := public.save_order('{"style_no":"RB","sold_to":"ALPHA","memo_no":"R1","sale_price":"500","date_sold":"2026-09-02"}'::jsonb);
  c := public.save_order('{"style_no":"RC","sold_to":"BETA","memo_no":"R2","sale_price":"800","date_sold":"2026-09-05"}'::jsonb);
  d := public.save_order('{"style_no":"RD"}'::jsonb);
  e := public.save_order('{"style_no":"RE","sold_to":"DELTA","memo_no":"R4","sale_price":"100","date_sold":"2026-09-07"}'::jsonb);
  tr := public.save_trade('{"item":"RT","sold_to":"GAMMA","memo_no":"R3","sale_price":"600","date_sold":"2026-09-06"}'::jsonb,
    '{"vendor":"V","purchase_price":"450"}'::jsonb);
  perform public.record_payment((select id from public.memos where memo_no = 'R1'), 1200, '2026-09-10');
  perform public.record_payment((select id from public.memos where memo_no = 'R3'), 600, '2026-09-11');
  perform t.admin();
  insert into public.order_costs (order_id, usd_cost) values (a, 400), (b, 300), (c, 200), (d, 150), (e, 60);
  perform t.as_user(owner_id);

  -- ===== Password, reason and dates =====
  perform t.denied('a wrong password is refused', format($q$select public.return_piece('order', %L, 'Changed mind', 'not-my-password')$q$, b), 'Wrong password');
  perform t.denied('an empty password is refused', format($q$select public.return_piece('order', %L, 'Changed mind', '')$q$, b), 'Wrong password');
  perform t.denied('nobody can use someone else''s password', format($q$select public.return_piece('order', %L, 'Changed mind', 'staff-pw')$q$, b), 'Wrong password');
  perform t.ok('a refused return changes nothing', (select sale_price from public.orders where id = b) = 500 and (select count(*) from public.returns) = 0);
  perform t.denied('a reason is required', format($q$select public.return_piece('order', %L, ' ', 'owner-pw')$q$, b), 'reason');
  perform t.denied('the return date cannot be in the future', format($q$select public.return_piece('order', %L, 'Changed mind', 'owner-pw', current_date + 1)$q$, b), 'future');
  perform t.denied('the return date cannot be before the sale', format($q$select public.return_piece('order', %L, 'Changed mind', 'owner-pw', date '2026-08-01')$q$, b), 'before the sale');
  perform t.denied('an unsold piece cannot be returned', format($q$select public.return_piece('order', %L, 'Changed mind', 'owner-pw')$q$, d), 'not sold');
  perform t.denied('selling cannot be undone by editing', format($q$select public.save_order(%L::jsonb)$q$, format('{"id":"%s","style_no":"RC"}', c)), 'Return this piece');

  -- ===== Return of a piece on an UNPAID memo =====
  select * into k1 from public.orders_kpi;
  r := public.return_piece('order', c, 'Buyer did not like the colour', 'owner-pw', date '2026-09-20');
  select * into k2 from public.orders_kpi;
  perform t.ok('unpaid memo: nothing to refund', (r ->> 'refund')::numeric = 0 and r ->> 'buyer' = 'BETA');
  perform t.ok('the sale is removed from the piece', (select sale_price is null and memo_id is null and date_sold is null from public.orders where id = c));
  perform t.ok('the piece is back in stock (+1, +200 at cost)', k2.stock_items = k1.stock_items + 1 and k2.stock_value = k1.stock_value + 200);
  perform t.ok('its price leaves revenue and its cost leaves the cost total', k2.revenue = k1.revenue - 800 and k2.cost = k1.cost - 200);
  perform t.ok('its profit (600) leaves the profit total', k2.profit = k1.profit - 600);
  perform t.ok('it is gone from the profit report', (select count(*) from public.piece_profit where label = 'RC') = 0);
  perform t.ok('the memo bill drops to zero', (select total_bill = 0 and payment_status = 'Not Sold' from public.memo_summary where memo_no = 'R2'));
  perform t.ok('the return is kept with the sale details', (select buyer = 'BETA' and memo_no = 'R2' and sale_price = 800 and date_sold = date '2026-09-05'
      and returned_on = date '2026-09-20' and refund = 0 and label = 'RC' and reason = 'Buyer did not like the colour' from public.returns where piece_id = c));

  -- ===== Return of a piece on a part-paid memo: the buyer has paid more than the new bill =====
  r := public.return_piece('order', b, 'Customer changed mind', 'owner-pw');
  perform t.ok('refund = the money paid above the new bill (1200 - 1000 = 200)', (r ->> 'refund')::numeric = 200);
  perform t.ok('memo R1 is now a 1000 bill, fully paid, nothing owed', (select total_bill = 1000 and total_paid = 1000 and balance = 0 and payment_status = 'Paid' from public.memo_summary where memo_no = 'R1'));
  perform t.denied('the same piece cannot be returned twice', format($q$select public.return_piece('order', %L, 'Again', 'owner-pw')$q$, b), 'not sold');
  perform t.denied('the payment that was part-refunded cannot be cancelled', format($q$select public.void_payment(%L, 'oops')$q$, (select id from public.payments where amount = 1200)), 'refunded');

  -- ===== A trade =====
  select * into k1 from public.trades_kpi;
  r := public.return_piece('trade', tr, 'Stone loose', 'owner-pw');
  select * into k2 from public.trades_kpi;
  perform t.ok('trade fully paid then returned: the whole 600 is refunded', (r ->> 'refund')::numeric = 600);
  perform t.ok('trade is unsold again and its profit (150) is gone', (select sale_price is null from public.trades where id = tr) and coalesce(k2.net_pl, 0) = k1.net_pl - 150 and k2.sales = k1.sales - 600);
  perform t.ok('its purchase price stays in "invested"', k2.invested = k1.invested);
  perform t.ok('memo R3 holds no money and no bill', (select total_bill = 0 and total_paid = 0 from public.memo_summary where memo_no = 'R3'));

  -- ===== Money stays consistent =====
  perform t.ok('no memo is ever overpaid', (select count(*) from public.memo_summary where balance < 0) = 0);
  perform t.ok('collected + outstanding still equal the memo totals',
    (select collected from public.orders_kpi) + (select collected from public.trades_kpi) = (select sum(total_paid) from public.memo_summary)
    and (select outstanding from public.orders_kpi) + (select outstanding from public.trades_kpi) = (select sum(balance) from public.memo_summary));
  perform t.ok('returns summary: 3 returns, 1900 sales reversed, 800 refunded',
    (select returns = 3 and sales_reversed = 1900 and refunds = 800 from public.returns_summary));

  -- ===== A returned piece can be sold again =====
  perform public.save_order(format('{"id":"%s","style_no":"RC","sold_to":"EPSILON","memo_no":"R5","sale_price":"900","date_sold":"2026-10-01"}', c)::jsonb);
  perform t.ok('re-sold after a return', (select sale_price from public.orders where id = c) = 900 and (select count(*) from public.returns where piece_id = c) = 1);

  -- ===== Audit trail =====
  perform t.admin();
  perform t.ok('each return is in the audit log with its reason',
    (select count(*) from public.audit_logs where action = 'return.recorded') = 3
    and exists (select 1 from public.audit_logs where action = 'return.recorded' and details ->> 'reason' = 'Customer changed mind' and (details ->> 'refund')::numeric = 200));

  -- ===== Staff: own password, own account =====
  perform t.as_user(staff_id);
  perform t.denied('staff cannot return with the owner''s password', format($q$select public.return_piece('order', %L, 'Changed mind', 'owner-pw')$q$, e), 'Wrong password');
  r := public.return_piece('order', e, 'Wrong item sent', 'staff-pw');
  perform t.ok('staff can return a piece with their own password', (r ->> 'refund')::numeric = 0 and (select sale_price is null from public.orders where id = e));
  perform t.ok('staff can read the returns list', (select count(*) from public.returns) = 4);
  perform t.ok('staff can see costs', (select count(*) from public.order_costs) > 0);

  -- ===== Sellers and anonymous =====
  perform t.as_user(seller_id);
  perform t.denied('sellers cannot return pieces', format($q$select public.return_piece('order', %L, 'Changed mind', 'seller-pw')$q$, a), 'permission');
  perform t.ok('sellers can read the returns list', (select count(*) from public.returns) = 4);
  perform t.as_anon();
  perform t.denied('anonymous cannot return', format($q$select public.return_piece('order', %L, 'x', 'y')$q$, a), 'permission denied');
  perform t.denied('anonymous cannot read returns', $q$select * from public.returns$q$, 'permission denied');

  -- ===== Records cannot be changed =====
  perform t.as_user(owner_id);
  perform t.denied('the returns list cannot be edited', $q$update public.returns set refund = 0$q$, 'permission denied');
  perform t.denied('the returns list cannot be deleted from', $q$delete from public.returns$q$, 'permission denied');

  perform t.admin();
  raise notice 'ALL RETURN TESTS PASSED';
end $$;
rollback;
