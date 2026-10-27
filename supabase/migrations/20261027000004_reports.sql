-- GemVault reports: "Who owes me" (owner + staff) and the Profit report (owner only).
-- Read-only views. Nothing here changes your data. All views run with the viewer's own permissions.

-- ---------- 1. Who owes me ----------
-- One row per buyer. A memo is "waiting" while its balance is above zero. Payments belong to the memo
-- (not to single pieces), so a part-paid memo counts as waiting from the day of its earliest sale.
-- Balance is bill minus payments, the same figure as the Memos page and the Overview.
create view public.buyer_receivables with (security_invoker = true) as
select b.id as buyer_id, b.name as buyer,
       count(*) as memos,
       coalesce(sum(ms.total_bill), 0) as total_billed,
       coalesce(sum(ms.total_paid), 0) as total_paid,
       coalesce(sum(ms.balance), 0) as balance_due,
       count(*) filter (where ms.balance > 0) as open_memos,
       min(md.billed_on) filter (where ms.balance > 0) as oldest_unpaid_on
from public.buyers b
join public.memos m on m.buyer_id = b.id
join public.memo_summary ms on ms.id = m.id
cross join lateral (
  -- Bill date = earliest "Date Sold" on the memo; falls back to the day the memo was created.
  select coalesce(
           least((select min(o.date_sold) from public.orders o where o.memo_id = m.id),
                 (select min(t.date_sold) from public.trades t where t.memo_id = m.id)),
           m.created_at::date) as billed_on
) md
group by b.id, b.name;

-- One row with the grand totals (so the page does not have to add up every buyer itself).
create view public.receivables_summary with (security_invoker = true) as
select coalesce(sum(total_billed), 0) as total_billed,
       coalesce(sum(total_paid), 0) as total_paid,
       coalesce(sum(balance_due), 0) as balance_due,
       count(*) filter (where balance_due > 0) as buyers_owing,
       min(oldest_unpaid_on) as oldest_unpaid_on
from public.buyer_receivables;

-- ---------- 2. Profit report (owner only) ----------
-- Profit per sold piece = sale price minus cost, in US dollars (orders: the "$" cost column; trades: purchase price).
-- A piece with no cost on file (or a cost of zero) has UNKNOWN profit: it is left out of every profit total
-- instead of counting its whole sale price as profit. Rows come back only for an owner.
create view public.piece_profit with (security_invoker = true) as
select 'Order'::text as kind, o.id as piece_id, o.sr_no, o.style_no as label,
       b.id as buyer_id, b.name as buyer, m.memo_no, o.date_sold, o.sale_price,
       case when c.order_id is not null and c.usd_cost > 0 then c.usd_cost end as cost,
       (c.order_id is not null and c.usd_cost > 0) as cost_known,
       case when c.order_id is not null and c.usd_cost > 0 then o.sale_price - c.usd_cost end as profit
from public.orders o
join public.memos m on m.id = o.memo_id
join public.buyers b on b.id = m.buyer_id
left join public.order_costs c on c.order_id = o.id
where o.sale_price is not null and public.is_owner()
union all
select 'Trade'::text, t.id, t.sr_no, t.item,
       b.id, b.name, m.memo_no, t.date_sold, t.sale_price,
       case when tc.trade_id is not null and tc.purchase_price > 0 then tc.purchase_price end,
       (tc.trade_id is not null and tc.purchase_price > 0),
       case when tc.trade_id is not null and tc.purchase_price > 0 then t.sale_price - tc.purchase_price end
from public.trades t
join public.memos m on m.id = t.memo_id
join public.buyers b on b.id = m.buyer_id
left join public.trade_costs tc on tc.trade_id = t.id
where t.sale_price is not null and public.is_owner();

-- Totals by month. Sales and profit fall in the month of "Date Sold"; expenses in the month of their date.
-- A month can have only expenses. Sales with no "Date Sold" are kept together in one row with month = null.
create view public.monthly_profit with (security_invoker = true) as
with sales as (
  select date_trunc('month', date_sold::timestamp)::date as month,
         count(*) as pieces_sold,
         sum(sale_price) as sales,
         coalesce(sum(sale_price) filter (where cost_known), 0) as costed_sales,
         coalesce(sum(profit) filter (where kind = 'Order'), 0) as order_profit,
         coalesce(sum(profit) filter (where kind = 'Trade'), 0) as trade_profit,
         count(*) filter (where not cost_known) as no_cost_pieces,
         coalesce(sum(sale_price) filter (where not cost_known), 0) as no_cost_sales
  from public.piece_profit
  group by 1
), spend as (
  select date_trunc('month', expense_date::timestamp)::date as month, sum(amount) as expenses
  from public.expenses
  where public.is_owner()
  group by 1
)
select coalesce(s.month, e.month) as month,
       coalesce(s.pieces_sold, 0) as pieces_sold,
       coalesce(s.sales, 0) as sales,
       coalesce(s.costed_sales, 0) as costed_sales,
       coalesce(s.order_profit, 0) as order_profit,
       coalesce(s.trade_profit, 0) as trade_profit,
       coalesce(e.expenses, 0) as expenses,
       coalesce(s.order_profit, 0) + coalesce(s.trade_profit, 0) - coalesce(e.expenses, 0) as net_profit,
       coalesce(s.no_cost_pieces, 0) as no_cost_pieces,
       coalesce(s.no_cost_sales, 0) as no_cost_sales
from sales s
full join spend e on e.month = s.month;

-- Totals by buyer. Expenses are not tied to a buyer, so they are not in this view.
create view public.buyer_profit with (security_invoker = true) as
select buyer_id, buyer,
       count(*) as pieces_sold,
       sum(sale_price) as sales,
       coalesce(sum(sale_price) filter (where cost_known), 0) as costed_sales,
       coalesce(sum(profit) filter (where kind = 'Order'), 0) as order_profit,
       coalesce(sum(profit) filter (where kind = 'Trade'), 0) as trade_profit,
       coalesce(sum(profit), 0) as profit,
       count(*) filter (where not cost_known) as no_cost_pieces
from public.piece_profit
group by buyer_id, buyer;

-- ---------- 3. Permissions ----------
revoke all on public.buyer_receivables, public.receivables_summary, public.piece_profit,
  public.monthly_profit, public.buyer_profit from anon, authenticated;
grant select on public.buyer_receivables, public.receivables_summary, public.piece_profit,
  public.monthly_profit, public.buyer_profit to authenticated;
