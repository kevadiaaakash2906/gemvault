-- Permanent delete of memos and returns. Runs after returns.test.sql. Clean slate inside a transaction that is rolled back.
begin;
select t.admin();
truncate public.returns, public.payments, public.order_costs, public.trade_costs, public.orders, public.trades,
  public.expenses, public.memos, public.buyers;
update auth.users set encrypted_password = extensions.crypt('owner-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000001';
update auth.users set encrypted_password = extensions.crypt('staff-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000002';
update auth.users set encrypted_password = extensions.crypt('seller-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000003';

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_id uuid := '00000000-0000-0000-0000-000000000002';
  seller_id uuid := '00000000-0000-0000-0000-000000000003';
  a uuid; b uuid; tr uuid; m1 uuid; m2 uuid; m3 uuid; ret_a uuid; ret_b uuid;
begin
  perform t.as_user(owner_id);
  a := public.save_order('{"style_no":"DA","sold_to":"ALPHA","memo_no":"D1","sale_price":"1000","date_sold":"2026-09-01"}'::jsonb);
  b := public.save_order('{"style_no":"DB","sold_to":"BETA","memo_no":"D2","sale_price":"500","date_sold":"2026-09-02"}'::jsonb);
  tr := public.save_trade('{"item":"DT","sold_to":"GAMMA","memo_no":"D3","sale_price":"300","date_sold":"2026-09-03"}'::jsonb, '{"vendor":"V","purchase_price":"200"}'::jsonb);
  select id into m1 from public.memos where memo_no = 'D1';
  select id into m2 from public.memos where memo_no = 'D2';
  select id into m3 from public.memos where memo_no = 'D3';
  perform public.record_payment(m2, 500, '2026-09-10');
  perform public.record_payment(m3, 300, '2026-09-11');

  -- ===== Deleting a memo =====
  perform t.denied('a memo with pieces on it cannot be deleted', format($q$select public.delete_memo(%L, 'owner-pw')$q$, m1), 'still has 1 piece');
  perform t.denied('a wrong password cannot delete a memo', format($q$select public.delete_memo(%L, 'nope')$q$, m1), 'Wrong password');
  perform t.denied('an unknown memo cannot be deleted', $q$select public.delete_memo('00000000-0000-0000-0000-00000000dead', 'owner-pw')$q$, 'does not exist');
  perform t.ok('nothing was deleted by those attempts', (select count(*) from public.memos) = 3 and (select count(*) from public.payments) = 2);

  -- ===== Deleting a return =====
  ret_b := (public.return_piece('order', b, 'Wrong colour', 'owner-pw') ->> 'id')::uuid;       -- memo D2 was paid, so 500 is refunded
  perform t.ok('memo D2 is now empty and holds no money', (select pieces = 0 and total_paid = 0 and total_bill = 0 from public.memo_summary where memo_no = 'D2'));
  perform t.denied('a return that refunded money cannot be deleted on its own (memo would be overpaid)',
    format($q$select public.delete_return(%L, 'owner-pw')$q$, ret_b), 'overpaid');
  perform t.denied('a wrong password cannot delete a return', format($q$select public.delete_return(%L, 'nope')$q$, ret_b), 'Wrong password');

  ret_a := (public.return_piece('order', a, 'Buyer cancelled', 'owner-pw') ->> 'id')::uuid;    -- memo D1 was unpaid: no refund
  perform t.as_user(staff_id);
  perform public.delete_return(ret_a, 'staff-pw');
  perform t.ok('staff can delete a return record that moved no money', (select count(*) from public.returns where id = ret_a) = 0);
  perform t.ok('the piece stays in stock; only the record went', (select sale_price is null from public.orders where id = a));
  perform t.denied('a deleted return cannot be deleted again', format($q$select public.delete_return(%L, 'staff-pw')$q$, ret_a), 'does not exist');

  perform public.delete_memo(m1, 'staff-pw');
  perform t.ok('staff can delete an empty memo', (select count(*) from public.memos where id = m1) = 0);

  -- ===== A seller can delete too (their own password) =====
  perform t.as_user(seller_id);
  perform t.denied('the seller needs their own password, not the owner''s', format($q$select public.delete_memo(%L, 'owner-pw')$q$, m2), 'Wrong password');
  perform public.delete_memo(m2, 'seller-pw');
  perform t.ok('the memo, its payment and its return record are all gone',
    (select count(*) from public.memos where id = m2) = 0 and (select count(*) from public.payments where memo_id = m2) = 0 and (select count(*) from public.returns where id = ret_b) = 0);
  perform t.ok('the returned piece is still in stock', (select sale_price is null and memo_id is null from public.orders where id = b));
  perform t.ok('other memos are untouched', (select count(*) from public.memos) = 1 and (select count(*) from public.payments) = 1);

  -- ===== Audit copies =====
  perform t.admin();
  perform t.ok('the audit log keeps a full copy of the deleted memo',
    exists (select 1 from public.audit_logs where action = 'memo.deleted' and details ->> 'memo_no' = 'D2'
      and jsonb_array_length(details -> 'payments') = 1 and jsonb_array_length(details -> 'returns') = 1 and details ->> 'buyer' = 'BETA'));
  perform t.ok('the audit log keeps a copy of the deleted return',
    exists (select 1 from public.audit_logs where action = 'return.deleted' and details ->> 'reason' = 'Buyer cancelled'));

  -- ===== People without a role and anonymous visitors =====
  perform t.as_user('00000000-0000-0000-0000-0000000000ff');
  perform t.denied('someone with no role cannot delete a memo', format($q$select public.delete_memo(%L, 'x')$q$, m3), 'permission');
  perform t.denied('someone with no role cannot delete a return', format($q$select public.delete_return(%L, 'x')$q$, ret_b), 'permission');
  perform t.as_anon();
  perform t.denied('anonymous cannot delete memos', format($q$select public.delete_memo(%L, 'x')$q$, m3), 'permission denied');
  perform t.denied('the password check cannot be called directly', $q$select public.assert_my_password('x')$q$, 'permission denied');

  perform t.admin();
  raise notice 'ALL DELETE TESTS PASSED';
end $$;
rollback;
