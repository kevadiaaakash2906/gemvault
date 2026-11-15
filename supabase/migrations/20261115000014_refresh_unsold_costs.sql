-- Re-price every unsold order's cost with the current gold and dollar rates. Sold pieces keep their saved amounts.
create function public.refresh_unsold_costs() returns integer
language plpgsql security definer set search_path = '' as $$
declare gr numeric; ur numeric; n integer;
begin
  if not public.is_staff_or_owner() then raise exception 'You do not have permission to change rates.' using errcode = '42501'; end if;
  select gold_rate, usd_rate into gr, ur from public.business_settings;
  with calc as (
    select c.order_id, c.diam_amount,
           round(o.net_wt * o.multiplier * gr) as gold,
           case when c.labor_amount = c.l_charges and round(o.net_wt * c.l_charges) <> c.l_charges
                then c.l_charges else round(o.net_wt * c.l_charges) end as labor
    from public.order_costs c join public.orders o on o.id = c.order_id
    where o.sale_price is null and o.net_wt is not null and o.multiplier is not null
  ), upd as (
    update public.order_costs c set
      gold_amount = calc.gold, labor_amount = calc.labor,
      sub_total = round(calc.gold + calc.diam_amount + calc.labor),
      usd_cost = round(round(calc.gold + calc.diam_amount + calc.labor) / ur, 2),
      updated_at = now()
    from calc where c.order_id = calc.order_id
    returning 1
  )
  select count(*) into n from upd;
  perform public.write_audit('costs.refreshed', 'business_settings', 'singleton',
    jsonb_build_object('orders', n, 'gold_rate', gr, 'usd_rate', ur));
  return n;
end $$;

revoke execute on function public.refresh_unsold_costs() from public, anon, authenticated;
grant execute on function public.refresh_unsold_costs() to authenticated;
