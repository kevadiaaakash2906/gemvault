-- Ledger tests (orders, trading, expenses, memos, payments). Runs after rls.test.sql and re-uses its accounts.
do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  o1 uuid; o2 uuid; o3 uuid; tr uuid; ex uuid; pay1 uuid; pay2 uuid; memo uuid; n int; c record;
begin
  perform t.admin();
  -- Starting rates are the old app's defaults. Set the owner's rate for this test:
  update public.business_settings set gold_rate = 17000, usd_rate = 94;

  -- staff can add an order but never sees or sets costs
  perform t.as_user(staff_id);
  o1 := public.save_order('{"customer":"HET","style_no":"BR-100","jewelry_type":"Bracelet","diamond_shape":"Round","order_date":"2026-06-10","gross_wt":"7.026","dia_qty":"60","in_ct":"5.15","colour_stone":"0","net_wt":"5.996","multiplier":"0.595"}'::jsonb);
  perform t.ok('staff can create an order (weights only)', (select pg_wt from public.orders where id = o1) = 3.568);
  perform t.ok('staff gets the next serial number', (select sr_no from public.orders where id = o1) >= 1);
  perform t.ok('staff cannot read order costs', (select count(*) from public.order_costs) = 0);
  perform t.denied('staff cannot set costs',
    format($q$select public.save_order(%L::jsonb, '{"diam_amount":"100"}'::jsonb)$q$, format('{"id":"%s","style_no":"BR-100"}', o1)), 'only an owner');
  perform t.denied('staff cannot write orders directly', $q$update public.orders set style_no = 'X'$q$, 'permission denied');
  perform t.denied('net weight above gross weight rejected',
    $q$select public.save_order('{"style_no":"BAD","gross_wt":"1","net_wt":"2"}'::jsonb)$q$, 'check constraint');
  perform t.denied('half-filled sale rejected',
    format($q$select public.save_order(%L::jsonb)$q$, format('{"id":"%s","style_no":"BR-100","sold_to":"Cali","sale_price":"500"}', o1)), 'together');

  -- owner cost calculation reproduces the rows in the Excel sheet
  perform t.as_user(owner_id);
  perform public.save_order(
    format('{"id":"%s","customer":"HET","style_no":"BR-100","net_wt":"5.996","multiplier":"0.595"}', o1)::jsonb,
    '{"gold_rate":"17000","diam_amount":"33475","l_charges":"900","flat_labor":false}'::jsonb);
  select * into c from public.order_costs where order_id = o1;
  perform t.ok('gold amount matches Excel (60,650)', c.gold_amount = 60650);
  perform t.ok('labour amount matches Excel (5,396)', c.labor_amount = 5396);
  perform t.ok('sub total matches Excel (99,521)', c.sub_total = 99521);
  perform t.ok('dollar cost matches Excel (1,058.73)', c.usd_cost = 1058.73);
  o2 := public.save_order('{"style_no":"ER-200","jewelry_type":"Earring","net_wt":"1.477","multiplier":"0.595"}'::jsonb,
    '{"gold_rate":"16000","diam_amount":"12170","l_charges":"1500","flat_labor":true}'::jsonb);
  select * into c from public.order_costs where order_id = o2;
  perform t.ok('flat-labour earring matches Excel (sub total 27,731, $295.01)', c.sub_total = 27731 and c.usd_cost = 295.01);
  perform t.ok('owner can read costs', (select count(*) from public.order_costs) = 2);

  -- selling, memos and payments
  perform t.as_user(staff_id);
  perform public.save_order(format('{"id":"%s","style_no":"BR-100","net_wt":"5.996","multiplier":"0.595","sold_to":"CALI JEWELERS","memo_no":"m1","sale_price":"1000","date_sold":"2026-06-12"}', o1)::jsonb);
  o3 := public.save_order('{"style_no":"RG-300","sold_to":"cali jewelers","memo_no":"M1","sale_price":"500"}'::jsonb);
  perform t.ok('same buyer name in another letter case reuses one buyer', (select count(*) from public.buyers) = 1);
  perform t.ok('two pieces on one memo', (select pieces from public.memo_summary where memo_no = 'M1') = 2);
  perform t.ok('memo bill is the sum of sale prices', (select total_bill from public.memo_summary where memo_no = 'M1') = 1500);
  perform t.denied('a memo cannot belong to two buyers',
    $q$select public.save_order('{"style_no":"X","sold_to":"Someone Else","memo_no":"M1","sale_price":"10"}'::jsonb)$q$, 'different buyer');
  memo := (select id from public.memos where memo_no = 'M1');
  perform t.ok('unpaid at first', (select payment_status from public.memo_summary where id = memo) = 'Unpaid');
  pay1 := public.record_payment(memo, 400, '2026-10-01', 'k1');
  perform t.ok('partial after a part payment', (select payment_status from public.memo_summary where id = memo) = 'Partial'
    and (select balance from public.memo_summary where id = memo) = 1100);
  perform public.record_payment(memo, 400, '2026-10-01', 'k1');
  perform t.ok('same payment sent twice counts once', (select count(*) from public.payments where memo_id = memo) = 1);
  perform t.denied('cannot pay more than the balance',
    format($q$select public.record_payment(%L, 1200, '2026-10-02')$q$, memo), 'more than the balance');
  perform t.denied('cannot pay zero or negative',
    format($q$select public.record_payment(%L, -5, '2026-10-02')$q$, memo), 'above zero');
  pay2 := public.record_payment(memo, 1100, '2026-10-05');
  perform t.ok('paid in full', (select payment_status from public.memo_summary where id = memo) = 'Paid');
  perform t.denied('cannot lower the bill below what is paid',
    format($q$select public.save_order(%L::jsonb)$q$, format('{"id":"%s","style_no":"RG-300","sold_to":"CALI JEWELERS","memo_no":"M1","sale_price":"50"}', o3)), 'below the');
  perform t.denied('a sale cannot be removed by editing (it must be a return)',
    format($q$select public.save_order(%L::jsonb)$q$, format('{"id":"%s","style_no":"BR-100"}', o1)), 'Return this piece');
  perform t.denied('staff cannot cancel payments',
    format($q$select public.void_payment(%L, 'mistake')$q$, pay2), 'only an owner');
  perform t.denied('staff cannot change payments directly',
    $q$update public.payments set amount = 1$q$, 'permission denied');
  perform t.denied('staff cannot delete payments', $q$delete from public.payments$q$, 'permission denied');
  perform t.denied('staff cannot delete records',
    format($q$select public.delete_record('order', %L)$q$, o2), 'only an owner');

  perform t.as_user(owner_id);
  perform t.denied('cancelling a payment needs a reason',
    format($q$select public.void_payment(%L, '')$q$, pay2), 'reason');
  perform public.void_payment(pay2, 'Cheque bounced');
  perform t.ok('cancelled payment reopens the balance', (select balance from public.memo_summary where id = memo) = 1100);
  perform t.ok('cancelled payment is kept with its reason', (select void_reason from public.payments where id = pay2) = 'Cheque bounced');
  perform t.denied('cancelled payment cannot be cancelled twice',
    format($q$select public.void_payment(%L, 'again')$q$, pay2), 'already cancelled');

  -- deleting
  perform t.denied('a sold order cannot be deleted',
    format($q$select public.delete_record('order', %L)$q$, o1), 'sold order');
  perform public.delete_record('order', o2);
  perform t.ok('an unsold order can be deleted by the owner', (select count(*) from public.orders where id = o2) = 0);
  perform t.ok('the deleted order is copied into the audit log',
    (select count(*) from public.audit_logs where action = 'order.deleted' and details ->> 'style_no' = 'ER-200') = 1);

  -- trading
  perform t.as_user(staff_id);
  tr := public.save_trade('{"trade_date":"2026-08-08","item":"EM BEZEL 14KWG","notes":"test"}'::jsonb);
  perform t.denied('staff cannot set trade purchase price',
    format($q$select public.save_trade(%L::jsonb, '{"purchase_price":"2495.90"}'::jsonb)$q$, format('{"id":"%s","item":"EM BEZEL 14KWG"}', tr)), 'only an owner');
  perform t.ok('staff cannot read trade costs', (select count(*) from public.trade_costs) = 0);
  perform public.save_trade(format('{"id":"%s","item":"EM BEZEL 14KWG","sold_to":"VELVET BOX JEWELS","memo_no":"M2","sale_price":"2880"}', tr)::jsonb);
  perform t.ok('a sold trade counts in its memo', (select total_bill from public.memo_summary where memo_no = 'M2') = 2880);
  perform t.as_user(owner_id);
  perform public.save_trade(format('{"id":"%s","item":"EM BEZEL 14KWG","sold_to":"VELVET BOX JEWELS","memo_no":"M2","sale_price":"2880"}', tr)::jsonb,
    '{"vendor":"CARAT CASTING","purchase_price":"2495.90"}'::jsonb);
  perform t.ok('owner can read trade costs', (select purchase_price from public.trade_costs where trade_id = tr) = 2495.90);

  -- expenses are owner only
  perform t.as_user(staff_id);
  perform t.denied('staff cannot add expenses',
    $q$select public.save_expense('{"expense_date":"2026-09-06","category":"Travel","description":"Flight","amount":"379.83"}'::jsonb)$q$, 'only an owner');
  perform t.ok('staff cannot read expenses', (select count(*) from public.expenses) = 0);
  perform t.as_user(owner_id);
  ex := public.save_expense('{"expense_date":"2026-09-06","category":"Travel","description":"MIAMI FLIGHT","amount":"379.83","seller":"MIAMI"}'::jsonb);
  perform t.ok('owner can add and read expenses', (select amount from public.expenses where id = ex) = 379.83);
  perform t.denied('negative expense rejected',
    $q$select public.save_expense('{"expense_date":"2026-09-06","category":"Travel","description":"x","amount":"-1"}'::jsonb)$q$, 'check constraint');

  -- sellers see nothing
  perform t.as_user(seller_id);
  perform t.ok('seller cannot see orders', (select count(*) from public.order_overview) = 0 and (select count(*) from public.orders) = 0);
  perform t.ok('seller cannot see trades', (select count(*) from public.trades) = 0);
  perform t.ok('seller cannot see buyers, memos or payments',
    (select count(*) from public.buyers) + (select count(*) from public.memos) + (select count(*) from public.payments) + (select count(*) from public.memo_summary) = 0);
  perform t.denied('seller cannot create orders', $q$select public.save_order('{"style_no":"S"}'::jsonb)$q$, 'permission');
  perform t.denied('seller cannot record payments',
    format($q$select public.record_payment(%L, 1, '2026-10-02')$q$, memo), 'permission');
  perform t.as_anon();
  perform t.denied('anonymous cannot read orders', $q$select * from public.orders$q$, 'permission denied');
  perform t.denied('anonymous cannot read memo summary', $q$select * from public.memo_summary$q$, 'permission denied');
  perform t.admin();
  perform t.ok('payment cancellation is in the audit log', (select count(*) from public.audit_logs where action = 'payment.voided') = 1);
  raise notice 'ALL LEDGER TESTS PASSED';
end $$;
