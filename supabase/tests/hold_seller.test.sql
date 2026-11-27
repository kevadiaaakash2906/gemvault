-- Sellers and "out with a customer". Clean slate inside a transaction that is rolled back.
begin;
select t.admin();
truncate public.order_holds, public.returns, public.payments, public.order_costs, public.trade_costs, public.orders, public.trades,
  public.expenses, public.memos, public.buyers;

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  nobody uuid := '00000000-0000-0000-0000-0000000000ff';
  a uuid; b uuid;
begin
  perform t.as_user(owner_id);
  a := public.save_order('{"style_no":"H1"}'::jsonb);
  b := public.save_order('{"style_no":"H2","sold_to":"ALPHA","memo_no":"H9","sale_price":"100","date_sold":"2026-09-01"}'::jsonb);

  perform t.as_user(seller_id);
  perform public.set_order_hold(a, 'CALI JEWELERS', null, 'On approval');
  perform t.ok('a seller can mark a piece as out', (select held_by = 'CALI JEWELERS' and note = 'On approval' from public.order_holds where order_id = a));
  perform t.denied('a seller cannot mark a sold piece as out', format($q$select public.set_order_hold(%L, 'X')$q$, b), 'already sold');
  perform public.clear_order_hold(a);
  perform t.ok('a seller can put it back in stock', (select count(*) from public.order_holds where order_id = a) = 0);
  perform t.denied('clearing a piece that is not out is refused', format($q$select public.clear_order_hold(%L)$q$, a), 'not marked');

  perform t.as_user(nobody);
  perform t.denied('someone with no role cannot mark a piece out', format($q$select public.set_order_hold(%L, 'X')$q$, a), 'permission');
  perform t.as_anon();
  perform t.denied('anonymous cannot mark a piece out', format($q$select public.set_order_hold(%L, 'X')$q$, a), 'permission denied');

  perform t.admin();
  perform t.ok('marking out is in the audit log', (select count(*) from public.audit_logs where action in ('order.hold_set', 'order.hold_cleared')) >= 2);
  raise notice 'ALL SELLER HOLD TESTS PASSED';
end $$;
rollback;
