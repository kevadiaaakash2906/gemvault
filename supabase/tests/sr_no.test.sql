-- Choosing the Sr. No. when adding an order. Runs last. Clean slate inside a transaction that is rolled back.
begin;
select t.admin();
truncate public.returns, public.payments, public.order_costs, public.trade_costs, public.orders, public.trades, public.expenses, public.memos, public.buyers;

do $$
declare
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  a uuid; b uuid; c uuid; d uuid; e uuid; f uuid; g uuid;
begin
  perform t.as_user(staff_id);
  a := public.save_order('{"style_no":"S1"}'::jsonb);
  b := public.save_order('{"style_no":"S2"}'::jsonb);
  perform t.ok('with no Sr. No. typed, the first order is 1 and the next is 2', (select sr_no from public.orders where id = a) = 1 and (select sr_no from public.orders where id = b) = 2);

  c := public.save_order('{"style_no":"S58","sr_no":"58"}'::jsonb);
  perform t.ok('a typed free number is used (58)', (select sr_no from public.orders where id = c) = 58);
  d := public.save_order('{"style_no":"S-NEXT"}'::jsonb);
  perform t.ok('with nothing typed it takes the last number + 1 (59)', (select sr_no from public.orders where id = d) = 59);
  e := public.save_order('{"style_no":"GAP","sr_no":"10"}'::jsonb);
  perform t.ok('a skipped number can be filled in later (10)', (select sr_no from public.orders where id = e) = 10);
  f := public.save_order('{"style_no":"S60"}'::jsonb);
  perform t.ok('and the automatic number is still the highest + 1 (60)', (select sr_no from public.orders where id = f) = 60);
  g := public.save_order('{"style_no":"S61","sr_no":"  "}'::jsonb);
  perform t.ok('a blank Sr. No. counts as nothing typed (61)', (select sr_no from public.orders where id = g) = 61);

  perform t.denied('a number already used is refused and says who has it', $q$select public.save_order('{"style_no":"X","sr_no":"58"}'::jsonb)$q$, 'already used by S58');
  perform t.denied('the refusal suggests the next free number', $q$select public.save_order('{"style_no":"X","sr_no":"2"}'::jsonb)$q$, 'next free number is 62');
  perform t.denied('letters are refused', $q$select public.save_order('{"style_no":"X","sr_no":"abc"}'::jsonb)$q$, 'whole number');
  perform t.denied('zero is refused', $q$select public.save_order('{"style_no":"X","sr_no":"0"}'::jsonb)$q$, 'whole number');
  perform t.denied('a negative number is refused', $q$select public.save_order('{"style_no":"X","sr_no":"-5"}'::jsonb)$q$, 'whole number');
  perform t.denied('a huge number is refused', $q$select public.save_order('{"style_no":"X","sr_no":"1000000"}'::jsonb)$q$, 'whole number');
  perform t.ok('refused attempts created nothing', (select count(*) from public.orders) = 7);

  perform public.save_order(format('{"id":"%s","style_no":"S58-EDITED","sr_no":"999"}', c)::jsonb);
  perform t.ok('editing an order never changes its Sr. No.', (select sr_no from public.orders where id = c) = 58 and (select style_no from public.orders where id = c) = 'S58-EDITED');

  perform t.as_user(seller_id);
  perform t.denied('sellers still cannot add orders', $q$select public.save_order('{"style_no":"Z","sr_no":"500"}'::jsonb)$q$, 'permission');
  perform t.admin();
  perform t.ok('all Sr. Nos are unique', (select count(distinct sr_no) from public.orders) = (select count(*) from public.orders));
  raise notice 'ALL SR NO TESTS PASSED';
end $$;
rollback;
