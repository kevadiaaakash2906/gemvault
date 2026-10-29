-- Report tests (Who owes me, Profit report). Runs after ledger.test.sql and re-uses its accounts.
-- Works on a clean slate inside a transaction that is rolled back, so it leaves nothing behind.
begin;
select t.admin();
truncate public.returns, public.payments, public.order_costs, public.trade_costs, public.orders, public.trades,
  public.expenses, public.memos, public.buyers;
update public.business_settings set gold_rate = 17000, usd_rate = 94;

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; o6 uuid; o7 uuid; o8 uuid; t1 uuid; t2 uuid;
  r record;
begin
  perform t.as_user(owner_id);

  -- ALPHA: memo A1 = two orders + one trade. o1 cost comes from the real cost calculation (Excel row: $1,058.73).
  o1 := public.save_order('{"style_no":"O1","net_wt":"5.996","multiplier":"0.595","sold_to":"ALPHA","memo_no":"A1","sale_price":"1300","date_sold":"2026-08-26"}'::jsonb,
    '{"gold_rate":"17000","diam_amount":"33475","l_charges":"900","flat_labor":false}'::jsonb);
  o2 := public.save_order('{"style_no":"O2","sold_to":"ALPHA","memo_no":"A1","sale_price":"500","date_sold":"2026-08-30"}'::jsonb);
  t1 := public.save_trade('{"item":"T1","sold_to":"ALPHA","memo_no":"A1","sale_price":"600","date_sold":"2026-08-28"}'::jsonb,
    '{"vendor":"V","purchase_price":"450"}'::jsonb);
  -- BETA: B1 fully paid (a loss), B2 unpaid, one piece with no cost, one piece with no sale date
  o3 := public.save_order('{"style_no":"O3","sold_to":"BETA","memo_no":"B1","sale_price":"2000","date_sold":"2026-09-05"}'::jsonb);
  o4 := public.save_order('{"style_no":"O4","sold_to":"BETA","memo_no":"B2","sale_price":"800","date_sold":"2026-09-20"}'::jsonb);
  o7 := public.save_order('{"style_no":"O7","sold_to":"BETA","memo_no":"B2","sale_price":"400","date_sold":"2026-09-21"}'::jsonb);
  -- GAMMA: a placeholder sale with cost 0 and a part-paid trade memo
  o5 := public.save_order('{"style_no":"O5","sold_to":"GAMMA","memo_no":"G1","sale_price":"0.01","date_sold":"2026-09-06"}'::jsonb);
  t2 := public.save_trade('{"item":"T2","sold_to":"GAMMA","memo_no":"G2","sale_price":"900","date_sold":"2026-10-02"}'::jsonb,
    '{"vendor":"V","purchase_price":"700"}'::jsonb);
  -- DELTA: fully paid
  o8 := public.save_order('{"style_no":"O8","sold_to":"DELTA","memo_no":"D1","sale_price":"500","date_sold":"2026-09-10"}'::jsonb);
  -- an order that was never sold
  o6 := public.save_order('{"style_no":"O6"}'::jsonb);

  perform public.record_payment((select id from public.memos where memo_no = 'A1'), 1000, '2026-09-01');
  perform public.record_payment((select id from public.memos where memo_no = 'B1'), 2000, '2026-09-10');
  perform public.record_payment((select id from public.memos where memo_no = 'G2'), 300, '2026-10-05');
  perform public.record_payment((select id from public.memos where memo_no = 'D1'), 500, '2026-09-12');

  perform public.save_expense('{"expense_date":"2026-08-15","category":"Travel","description":"E1","amount":"50"}'::jsonb);
  perform public.save_expense('{"expense_date":"2026-09-06","category":"Office","description":"E2","amount":"30"}'::jsonb);
  perform public.save_expense('{"expense_date":"2026-09-06","category":"Shipping","description":"E3","amount":"20"}'::jsonb);
  perform public.save_expense('{"expense_date":"2026-11-01","category":"Travel","description":"E4","amount":"40"}'::jsonb);

  -- fixtures that the owner-facing forms cannot make: costs set directly, one sale whose date was never filled in
  perform t.admin();
  insert into public.order_costs (order_id, usd_cost) values (o2, 400), (o3, 2300), (o7, 300), (o8, 200), (o5, 0), (o6, 50);
  update public.orders set date_sold = null where id = o7;

  -- ===== Who owes me (owner view) =====
  perform t.as_user(owner_id);
  perform t.ok('4 buyers listed', (select count(*) from public.buyer_receivables) = 4);
  select * into r from public.buyer_receivables where buyer = 'ALPHA';
  perform t.ok('ALPHA billed 2400 (orders and trade on one memo)', r.total_billed = 2400);
  perform t.ok('ALPHA paid 1000, balance 1400', r.total_paid = 1000 and r.balance_due = 1400);
  perform t.ok('ALPHA waiting since its earliest sale', r.oldest_unpaid_on = date '2026-08-26' and r.open_memos = 1);
  select * into r from public.buyer_receivables where buyer = 'BETA';
  perform t.ok('BETA owes 1200 on one open memo', r.total_billed = 3200 and r.total_paid = 2000 and r.balance_due = 1200 and r.open_memos = 1);
  perform t.ok('a paid memo does not make the wait longer (BETA waits from 20 Sep, not 5 Sep)', r.oldest_unpaid_on = date '2026-09-20');
  select * into r from public.buyer_receivables where buyer = 'GAMMA';
  perform t.ok('GAMMA owes 600.01 across two open memos, oldest 6 Sep',
    r.balance_due = 600.01 and r.open_memos = 2 and r.oldest_unpaid_on = date '2026-09-06');
  select * into r from public.buyer_receivables where buyer = 'DELTA';
  perform t.ok('DELTA paid in full: nothing owed, no waiting date', r.balance_due = 0 and r.open_memos = 0 and r.oldest_unpaid_on is null);
  select * into r from public.receivables_summary;
  perform t.ok('summary totals', r.total_billed = 7000.01 and r.total_paid = 3800 and r.balance_due = 3200.01);
  perform t.ok('summary: 3 buyers owe, oldest wait from 26 Aug', r.buyers_owing = 3 and r.oldest_unpaid_on = date '2026-08-26');
  perform t.ok('summary agrees with the memo list',
    (select sum(balance) from public.memo_summary) = (select balance_due from public.receivables_summary));

  -- a cancelled payment makes the buyer owe again
  perform public.void_payment((select id from public.payments where amount = 500), 'Cheque bounced');
  perform t.ok('cancelled payment: DELTA owes 500 again and is waiting from 10 Sep',
    (select balance_due from public.buyer_receivables where buyer = 'DELTA') = 500
    and (select oldest_unpaid_on from public.buyer_receivables where buyer = 'DELTA') = date '2026-09-10');
  perform t.admin();
  update public.payments set voided_at = null, void_reason = null, voided_by = null where amount = 500;
  perform t.as_user(owner_id);

  -- ===== Profit per piece =====
  perform t.ok('sold pieces only (9 of 10; the unsold order is not listed)', (select count(*) from public.piece_profit) = 9);
  perform t.ok('O1 profit matches the Excel cost (1300 - 1058.73 = 241.27)', (select profit from public.piece_profit where label = 'O1') = 241.27);
  perform t.ok('O3 shows a loss of 300', (select profit from public.piece_profit where label = 'O3') = -300);
  perform t.ok('trade profit = sale - purchase price', (select profit from public.piece_profit where label = 'T1') = 150);
  perform t.ok('no cost row: profit unknown, not the whole sale price',
    (select profit is null and not cost_known from public.piece_profit where label = 'O4'));
  perform t.ok('cost of zero is treated as unknown too', (select profit is null and cost is null from public.piece_profit where label = 'O5'));

  -- ===== Totals by month =====
  perform t.ok('5 month rows (Aug, Sep, Oct, Nov expenses only, no date)', (select count(*) from public.monthly_profit) = 5);
  select * into r from public.monthly_profit where month = date '2026-08-01';
  perform t.ok('Aug: 3 pieces, sales 2400, order profit 341.27, trade profit 150, expenses 50, net 441.27',
    r.pieces_sold = 3 and r.sales = 2400 and r.order_profit = 341.27 and r.trade_profit = 150 and r.expenses = 50 and r.net_profit = 441.27);
  select * into r from public.monthly_profit where month = date '2026-09-01';
  perform t.ok('Sep: 4 pieces, sales 3300.01, profit 0, expenses 50, net -50, 2 pieces without cost',
    r.pieces_sold = 4 and r.sales = 3300.01 and r.order_profit = 0 and r.expenses = 50 and r.net_profit = -50 and r.no_cost_pieces = 2);
  perform t.ok('Sep margin base counts only pieces with a cost (2000 + 500)', (select costed_sales from public.monthly_profit where month = date '2026-09-01') = 2500);
  perform t.ok('Oct: trade profit 200', (select trade_profit from public.monthly_profit where month = date '2026-10-01') = 200);
  select * into r from public.monthly_profit where month = date '2026-11-01';
  perform t.ok('Nov: expenses only, net -40', r.pieces_sold = 0 and r.sales = 0 and r.expenses = 40 and r.net_profit = -40);
  select * into r from public.monthly_profit where month is null;
  perform t.ok('sale with no date is kept in its own row, not lost', r.pieces_sold = 1 and r.sales = 400 and r.order_profit = 100);
  perform t.ok('all sales are in the months: 7000.01', (select sum(sales) from public.monthly_profit) = 7000.01);
  perform t.ok('net profit = order + trade profit - expenses = 651.27', (select sum(net_profit) from public.monthly_profit) = 651.27);

  -- ===== Totals by buyer =====
  select * into r from public.buyer_profit where buyer = 'ALPHA';
  perform t.ok('ALPHA: 3 pieces, order profit 341.27, trade profit 150, total 491.27', r.pieces_sold = 3 and r.order_profit = 341.27 and r.trade_profit = 150 and r.profit = 491.27);
  select * into r from public.buyer_profit where buyer = 'BETA';
  perform t.ok('BETA: profit -200 and one piece without cost', r.profit = -200 and r.no_cost_pieces = 1 and r.sales = 3200 and r.costed_sales = 2400);
  select * into r from public.buyer_profit where buyer = 'GAMMA';
  perform t.ok('GAMMA: trading profit 200 only', r.trade_profit = 200 and r.order_profit = 0 and r.no_cost_pieces = 1);
  perform t.ok('buyer totals add up to the month totals (791.27)',
    (select sum(profit) from public.buyer_profit) = 791.27
    and (select sum(order_profit + trade_profit) from public.monthly_profit) = 791.27);

  -- ===== KPI cards (Orders, Trading, Expenses pages) =====
  select * into r from public.orders_kpi;
  perform t.ok('orders KPI: 7 sold, 1 in stock, revenue 5500.01', r.sold_items = 7 and r.stock_items = 1 and r.revenue = 5500.01);
  perform t.ok('orders KPI: cost 4258.73 and profit 441.27 (same as the Profit report)', r.cost = 4258.73 and r.profit = 441.27);
  perform t.ok('orders KPI: stock on hand is worth its cost (50)', r.stock_value = 50);
  perform t.ok('orders KPI: shared memo A1 payments split by value, collected 3250, outstanding 2250.01', r.collected = 3250 and r.outstanding = 2250.01);
  select * into r from public.trades_kpi;
  perform t.ok('trades KPI: 2 trades, 2 sold, sales 1500, invested 1150, net P/L 350', r.total_trades = 2 and r.sold_items = 2 and r.sales = 1500 and r.invested = 1150 and r.net_pl = 350);
  perform t.ok('trades KPI: collected 550, outstanding 950', r.collected = 550 and r.outstanding = 950);
  perform t.ok('orders and trading together equal the memo totals (collected 3800, owed 3200.01)',
    (select collected from public.orders_kpi) + (select collected from public.trades_kpi) = 3800
    and (select outstanding from public.orders_kpi) + (select outstanding from public.trades_kpi) = 3200.01);
  select * into r from public.expenses_kpi;
  perform t.ok('expenses KPI: total 140, 4 entries, top category Travel, average 35', r.total = 140 and r.entries = 4 and r.top_category = 'Travel' and r.avg_amount = 35);

  perform t.ok('recent payments list the buyer and memo, newest first',
    (select count(*) from public.recent_payments) = 4
    and (select buyer from public.recent_payments order by paid_on desc, created_at desc limit 1) = 'GAMMA'
    and (select memo_no from public.recent_payments order by paid_on desc, created_at desc limit 1) = 'G2');
  perform t.as_user(owner_id);
  perform public.void_payment((select id from public.payments where amount = 300), 'Entered twice');
  perform t.ok('a cancelled payment drops off the recent list', (select count(*) from public.recent_payments) = 3);
  perform t.admin();
  update public.payments set voided_at = null, void_reason = null, voided_by = null where amount = 300;
  perform t.as_user(owner_id);

  -- ===== Staff: see everything, including costs and profit =====
  perform t.as_user(staff_id);
  perform t.ok('staff can see who owes money', (select count(*) from public.buyer_receivables) = 4 and (select balance_due from public.receivables_summary) = 3200.01);
  perform t.ok('staff see the whole profit report',
    (select count(*) from public.piece_profit) = 9 and (select count(*) from public.monthly_profit) = 5 and (select count(*) from public.buyer_profit) = 4
    and (select sum(net_profit) from public.monthly_profit) = 651.27);
  perform t.ok('staff see order cost, profit and stock value',
    (select cost from public.orders_kpi) = 4258.73 and (select profit from public.orders_kpi) = 441.27 and (select stock_value from public.orders_kpi) = 50);
  perform t.ok('staff see trading invested and net P/L', (select invested from public.trades_kpi) = 1150 and (select net_pl from public.trades_kpi) = 350);
  perform t.ok('staff can see recent payments', (select count(*) from public.recent_payments) = 4);
  perform t.ok('staff see expenses', (select entries from public.expenses_kpi) = 4 and (select total from public.expenses_kpi) = 140);

  -- ===== Sellers: the same view as staff =====
  perform t.as_user(seller_id);
  perform t.ok('seller can see who owes money', (select count(*) from public.buyer_receivables) = 4 and (select balance_due from public.receivables_summary) = 3200.01);
  perform t.ok('seller sees the profit report', (select count(*) from public.piece_profit) = 9 and (select sum(net_profit) from public.monthly_profit) = 651.27);
  perform t.ok('seller sees order and trade KPIs', (select cost from public.orders_kpi) = 4258.73 and (select invested from public.trades_kpi) = 1150);
  perform t.ok('seller can see recent payments and expenses', (select count(*) from public.recent_payments) = 4 and (select entries from public.expenses_kpi) = 4);

  -- ===== Role-less users and anonymous visitors =====
  perform t.as_user('00000000-0000-0000-0000-0000000000ff');
  perform t.ok('someone with no role sees nothing',
    (select count(*) from public.buyer_receivables) = 0 and (select count(*) from public.piece_profit) = 0
    and (select count(*) from public.recent_payments) = 0 and (select entries from public.expenses_kpi) = 0);
  perform t.as_anon();
  perform t.denied('anonymous cannot read order KPIs', $q$select * from public.orders_kpi$q$, 'permission denied');
  perform t.denied('anonymous cannot read who owes', $q$select * from public.buyer_receivables$q$, 'permission denied');
  perform t.denied('anonymous cannot read profit', $q$select * from public.piece_profit$q$, 'permission denied');
  perform t.denied('anonymous cannot read monthly profit', $q$select * from public.monthly_profit$q$, 'permission denied');

  perform t.admin();
  raise notice 'ALL REPORT TESTS PASSED';
end $$;
rollback;
