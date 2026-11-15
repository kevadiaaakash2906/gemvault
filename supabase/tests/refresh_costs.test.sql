-- Re-pricing unsold orders after a rate change. Clean slate inside a transaction that is rolled back.
begin;
select t.admin();
truncate public.order_holds, public.returns, public.payments, public.order_costs, public.trade_costs, public.orders, public.trades,
  public.expenses, public.memos, public.buyers;
update public.business_settings set gold_rate = 17000, usd_rate = 94;

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; n int; c record;
begin
  perform t.as_user(owner_id);
  o1 := public.save_order('{"style_no":"U1","net_wt":"5.996","multiplier":"0.595"}'::jsonb,
    '{"gold_rate":"17000","diam_amount":"33475","l_charges":"900","flat_labor":false}'::jsonb);
  o2 := public.save_order('{"style_no":"U2","net_wt":"1.477","multiplier":"0.595"}'::jsonb,
    '{"gold_rate":"16000","diam_amount":"12170","l_charges":"1500","flat_labor":true}'::jsonb);
  o3 := public.save_order('{"style_no":"SOLD","net_wt":"5.996","multiplier":"0.595","sold_to":"ALPHA","memo_no":"X1","sale_price":"1300","date_sold":"2026-09-01"}'::jsonb,
    '{"gold_rate":"17000","diam_amount":"33475","l_charges":"900","flat_labor":false}'::jsonb);
  o4 := public.save_order('{"style_no":"NOCOST","net_wt":"2","multiplier":"0.595"}'::jsonb);
  update public.business_settings set gold_rate = 18000;

  perform t.as_user(seller_id);
  perform t.denied('a seller cannot re-price orders', $q$select public.refresh_unsold_costs()$q$, 'permission');
  perform t.as_anon();
  perform t.denied('anonymous cannot re-price orders', $q$select public.refresh_unsold_costs()$q$, 'permission denied');

  perform t.as_user(staff_id);
  n := public.refresh_unsold_costs();
  perform t.ok('only the two unsold orders with a cost were updated', n = 2);
  perform t.as_user(owner_id);
  select * into c from public.order_costs where order_id = o1;
  perform t.ok('per-gram order uses the new gold rate (gold 64,217, sub total 103,088, $1,096.68)',
    c.gold_amount = 64217 and c.labor_amount = 5396 and c.sub_total = 103088 and c.usd_cost = 1096.68 and c.diam_amount = 33475);
  select * into c from public.order_costs where order_id = o2;
  perform t.ok('flat-labour order keeps its flat labour (gold 15,819, sub total 29,489, $313.71)',
    c.gold_amount = 15819 and c.labor_amount = 1500 and c.sub_total = 29489 and c.usd_cost = 313.71);
  select * into c from public.order_costs where order_id = o3;
  perform t.ok('a sold order keeps its saved amounts', c.gold_amount = 60650 and c.usd_cost = 1058.73);
  perform t.ok('an order with no cost on file gets none', (select count(*) from public.order_costs where order_id = o4) = 0);
  perform t.ok('running it again changes nothing more', public.refresh_unsold_costs() = 2
    and (select usd_cost from public.order_costs where order_id = o1) = 1096.68);
  perform t.admin();
  perform t.ok('the re-pricing is in the audit log', (select count(*) from public.audit_logs where action = 'costs.refreshed') = 2);
  raise notice 'ALL REFRESH COST TESTS PASSED';
end $$;
rollback;
