-- Renaming people and deleting money transfers. Runs last, inside a transaction that is rolled back.
begin;
select t.admin();
truncate public.money_transfers;
update auth.users set encrypted_password = extensions.crypt('owner-pw', extensions.gen_salt('bf')) where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set full_name = null where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004');
do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  staff_a  uuid := '00000000-0000-0000-0000-000000000002';
  seller_a uuid := '00000000-0000-0000-0000-000000000003';
  seller_b uuid := '00000000-0000-0000-0000-000000000004';
  staff_mail text; t1 uuid; t2 uuid; t3 uuid;
begin
  select email into staff_mail from public.profiles where id = staff_a;

  -- ===== Renaming =====
  perform t.as_user(owner_id);
  perform public.rename_user(staff_a, 'Arpan');
  perform public.rename_user(seller_a, 'Het');
  perform t.ok('the owner can give people names', (select full_name from public.profiles where id = staff_a) = 'Arpan' and (select full_name from public.profiles where id = seller_a) = 'Het');
  perform t.denied('two people cannot have the same name', format($q$select public.rename_user(%L, 'Het')$q$, seller_b), 'already has the name');
  perform t.denied('even with different capitals and spaces', format($q$select public.rename_user(%L, '  hET ')$q$, seller_b), 'already has the name');
  perform t.denied('a name over 60 characters is refused', format($q$select public.rename_user(%L, repeat('x', 61))$q$, seller_b), 'too long');
  perform t.denied('an unknown person cannot be renamed', $q$select public.rename_user('00000000-0000-0000-0000-00000000dead', 'Nobody')$q$, 'does not exist');
  perform public.rename_user(seller_a, 'Het');
  perform t.ok('keeping someone''s own name is fine (it does not clash with itself)', (select full_name from public.profiles where id = seller_a) = 'Het');
  perform public.rename_user(owner_id, 'The Owner');
  perform t.ok('the owner can rename themselves too', (select full_name from public.profiles where id = owner_id) = 'The Owner');
  perform public.rename_user(seller_b, 'Temp');
  perform public.rename_user(seller_b, '   ');
  perform t.ok('a blank name clears it (the email is shown again)', (select full_name is null from public.profiles where id = seller_b));
  perform t.as_user(staff_a);
  perform t.denied('staff cannot rename people', format($q$select public.rename_user(%L, 'Boss')$q$, seller_a), 'Only an owner');
  perform t.as_user(seller_a);
  perform t.denied('a seller cannot rename people', format($q$select public.rename_user(%L, 'Boss')$q$, staff_a), 'Only an owner');
  perform t.denied('a seller cannot rename themselves directly either', format($q$update public.profiles set full_name = 'Arpan 2' where id = %L$q$, seller_a), 'permission denied');
  perform t.as_anon();
  perform t.denied('anonymous cannot rename', format($q$select public.rename_user(%L, 'x')$q$, seller_a), 'permission denied');

  -- ===== The money ledger follows a rename =====
  perform t.as_user(seller_a);
  t1 := public.send_money(staff_a, 100);
  perform t.ok('a new transfer carries the names', (select from_name = 'Het' and to_name = 'Arpan' from public.money_transfers where id = t1));
  perform t.as_user(owner_id);
  perform public.rename_user(staff_a, 'Arpan P');
  perform public.rename_user(seller_a, 'Het K');
  perform t.ok('renaming updates the names already in the ledger', (select from_name = 'Het K' and to_name = 'Arpan P' from public.money_transfers where id = t1));
  perform public.rename_user(staff_a, '');
  perform t.ok('clearing a name shows the email in the ledger', (select to_name = staff_mail from public.money_transfers where id = t1));
  perform public.rename_user(staff_a, 'Arpan');
  perform public.rename_user(seller_a, 'Het');

  -- ===== Deleting transfers from the ledger =====
  perform t.as_user(seller_a);
  t2 := public.send_money(staff_a, 250);
  t3 := public.send_money(staff_a, 400);
  perform t.as_user(staff_a);
  perform public.accept_money(t2);
  perform public.accept_money(t3);
  perform t.as_user(owner_id);
  perform public.reverse_money(t3, 'Wrong amount');
  perform t.ok('three transfers: waiting, logged and reversed', (select count(*) from public.money_transfers) = 3 and (select logged_total = 250 and pending_total = 100 from public.money_summary));
  perform t.denied('the wrong password deletes nothing', format($q$select public.delete_money(%L, 'not-my-password')$q$, t1), 'Wrong password');
  perform t.denied('an empty password deletes nothing', format($q$select public.delete_money(%L, '')$q$, t1), 'Wrong password');
  perform t.ok('nothing was deleted by those attempts', (select count(*) from public.money_transfers) = 3);
  perform t.denied('an unknown transfer cannot be deleted', $q$select public.delete_money('00000000-0000-0000-0000-00000000dead', 'owner-pw')$q$, 'does not exist');
  perform t.as_user(staff_a);
  perform t.denied('staff cannot delete a transfer', format($q$select public.delete_money(%L, 'owner-pw')$q$, t2), 'Only the owner');
  perform t.as_user(seller_a);
  perform t.denied('a seller cannot delete a transfer', format($q$select public.delete_money(%L, 'owner-pw')$q$, t1), 'Only the owner');
  perform t.denied('and cannot delete rows directly', $q$delete from public.money_transfers$q$, 'permission denied');
  perform t.as_user(owner_id);
  perform public.delete_money(t1, 'owner-pw');
  perform t.ok('a waiting transfer is deleted from the ledger and the totals', (select count(*) from public.money_transfers where id = t1) = 0 and (select pending_total = 0 from public.money_summary));
  perform public.delete_money(t2, 'owner-pw');
  perform t.ok('a logged transfer is deleted and leaves the logged total', (select count(*) from public.money_transfers where id = t2) = 0 and (select logged_total = 0 from public.money_summary));
  perform public.delete_money(t3, 'owner-pw');
  perform t.ok('a reversed transfer can be deleted too', (select count(*) from public.money_transfers) = 0 and (select count(*) from public.money_balances) = 0);
  perform t.denied('a deleted transfer cannot be deleted again', format($q$select public.delete_money(%L, 'owner-pw')$q$, t1), 'does not exist');
  perform t.as_anon();
  perform t.denied('anonymous cannot delete', format($q$select public.delete_money(%L, 'x')$q$, t1), 'permission denied');

  -- ===== A copy is kept in the audit log =====
  perform t.admin();
  perform t.ok('each deleted transfer is kept in the audit log with its details',
    (select count(*) from public.audit_logs where action = 'money.deleted') = 3
    and exists (select 1 from public.audit_logs where action = 'money.deleted' and details ->> 'status' = 'accepted' and (details ->> 'amount')::numeric = 250 and details ->> 'from_name' = 'Het')
    and exists (select 1 from public.audit_logs where action = 'money.deleted' and details ->> 'status' = 'reversed' and details ->> 'resolved_note' = 'Wrong amount'));
  perform t.ok('renames are in the audit log', (select count(*) from public.audit_logs where action = 'user.renamed') >= 8);
  raise notice 'ALL RENAME AND DELETE TESTS PASSED';
end $$;
rollback;
