-- Money ledger tests. Runs last. Works inside a transaction that is rolled back, so it leaves nothing behind.
begin;
select t.admin();
truncate public.money_transfers;
do $$
declare
  owner_id  uuid := '00000000-0000-0000-0000-000000000001';
  staff_a   uuid := '00000000-0000-0000-0000-000000000002';   -- "Arpan"
  seller_a  uuid := '00000000-0000-0000-0000-000000000003';   -- "Het"
  seller_b  uuid := '00000000-0000-0000-0000-000000000004';
  staff_b   uuid := '00000000-0000-0000-0000-0000000000b2';
  staff_off uuid := '00000000-0000-0000-0000-0000000000b3';
  nobody    uuid := '00000000-0000-0000-0000-0000000000ff';
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; r record;
begin
  insert into auth.users (id, email) values (staff_b, 'second@x.com'), (staff_off, 'off@x.com');
  insert into public.user_roles (user_id, role) values (staff_b, 'staff'), (staff_off, 'staff');
  update public.profiles set is_active = false where id = staff_off;
  update public.profiles set full_name = 'Arpan' where id = staff_a;
  update public.profiles set full_name = 'Het' where id = seller_a;
  update public.profiles set full_name = 'Second Staff' where id = staff_b;

  -- ===== The seller sends =====
  perform t.as_user(seller_a);
  perform t.ok('the seller can choose from the active staff only (not the owner, sellers or switched-off staff)',
    (select count(*) from public.money_recipients()) = 2 and (select count(*) from public.money_recipients() where name = 'Arpan') = 1);
  t1 := public.send_money(staff_a, 500, null, 'Zelle on Monday');
  select * into r from public.money_transfers where id = t1;
  perform t.ok('a new transfer is pending, with names and date filled in', r.status = 'pending' and r.from_name = 'Het' and r.to_name = 'Arpan' and r.amount = 500 and r.sent_on = current_date and r.note = 'Zelle on Monday');
  perform t.ok('pending money is not logged anywhere', (select logged_total = 0 and pending_total = 500 and pending_count = 1 from public.money_summary));
  perform t.denied('the same transfer sent twice in a minute is refused', format($q$select public.send_money(%L, 500, null, 'Zelle on Monday')$q$, staff_a), 'just sent');
  perform t.denied('zero is refused', format($q$select public.send_money(%L, 0)$q$, staff_a), 'more than zero');
  perform t.denied('a negative amount is refused', format($q$select public.send_money(%L, -5)$q$, staff_a), 'more than zero');
  perform t.denied('three decimals are refused', format($q$select public.send_money(%L, 10.555)$q$, staff_a), '2 decimals');
  perform t.denied('a huge amount is refused', format($q$select public.send_money(%L, 10000001)$q$, staff_a), 'too large');
  perform t.denied('a future date is refused', format($q$select public.send_money(%L, 10, current_date + 1)$q$, staff_a), 'future');
  perform t.denied('a date over a year ago is refused', format($q$select public.send_money(%L, 10, current_date - 400)$q$, staff_a), 'year ago');
  perform t.denied('a note over 200 characters is refused', format($q$select public.send_money(%L, 10, null, repeat('x', 201))$q$, staff_a), 'too long');
  perform t.denied('money cannot be sent to the owner', format($q$select public.send_money(%L, 10)$q$, owner_id), 'active staff');
  perform t.denied('money cannot be sent to another seller', format($q$select public.send_money(%L, 10)$q$, seller_b), 'active staff');
  perform t.denied('money cannot be sent to switched-off staff', format($q$select public.send_money(%L, 10)$q$, staff_off), 'active staff');
  perform t.denied('money cannot be sent to someone who does not exist', $q$select public.send_money('00000000-0000-0000-0000-00000000dead', 10)$q$, 'active staff');
  perform t.ok('refused attempts created nothing', (select count(*) from public.money_transfers) = 1);

  -- ===== Only staff receive; only the named person accepts =====
  perform t.as_user(staff_a);
  perform t.ok('the staff member sees what was sent to them', (select count(*) from public.money_transfers where id = t1) = 1);
  perform t.denied('staff cannot send money', format($q$select public.send_money(%L, 10)$q$, staff_b), 'Only a seller');
  perform t.as_user(staff_b);
  perform t.ok('other staff do not see it', (select count(*) from public.money_transfers) = 0);
  perform t.denied('other staff cannot accept it', format($q$select public.accept_money(%L)$q$, t1), 'Only Arpan can accept');
  perform t.as_user(seller_a);
  perform t.denied('the seller cannot accept their own transfer', format($q$select public.accept_money(%L)$q$, t1), 'Only Arpan can accept');
  perform t.as_user(owner_id);
  perform t.denied('even the owner cannot accept it for someone else', format($q$select public.accept_money(%L)$q$, t1), 'Only Arpan can accept');
  perform t.denied('and the owner cannot send money', format($q$select public.send_money(%L, 10)$q$, staff_a), 'Only a seller');

  -- ===== Accepting logs it =====
  perform t.as_user(staff_a);
  perform public.accept_money(t1);
  select * into r from public.money_transfers where id = t1;
  perform t.ok('accepted: logged with the time and who accepted', r.status = 'accepted' and r.accepted_at is not null and r.resolved_by = staff_a);
  perform t.ok('the staff member now has 500 logged and nothing waiting', (select logged_total = 500 and logged_count = 1 and pending_total = 0 from public.money_summary));
  perform t.denied('it cannot be accepted twice', format($q$select public.accept_money(%L)$q$, t1), 'already accepted');
  perform t.denied('it cannot be rejected after it was accepted', format($q$select public.reject_money(%L, 'changed my mind')$q$, t1), 'already accepted');
  perform t.as_user(seller_a);
  perform t.denied('the seller cannot cancel it after it was accepted', format($q$select public.cancel_money(%L)$q$, t1), 'already accepted');
  perform t.ok('the seller sees it as logged', (select logged_total = 500 and pending_total = 0 from public.money_summary));
  perform t.ok('the totals by person show Het to Arpan', (select logged_total = 500 and from_name = 'Het' and to_name = 'Arpan' from public.money_balances));

  -- ===== Rejecting needs a reason and is not logged =====
  t2 := public.send_money(staff_a, 300, null, 'wrong day?');
  perform t.as_user(staff_a);
  perform t.denied('rejecting needs a reason', format($q$select public.reject_money(%L, ' ')$q$, t2), 'reason');
  perform public.reject_money(t2, 'Not received');
  select * into r from public.money_transfers where id = t2;
  perform t.ok('rejected with its reason, and not logged', r.status = 'rejected' and r.resolved_note = 'Not received' and r.accepted_at is null);
  perform t.ok('the logged total is still 500', (select logged_total = 500 and pending_total = 0 from public.money_summary));

  -- ===== The sender can withdraw a pending transfer =====
  perform t.as_user(seller_a);
  t3 := public.send_money(staff_a, 200);
  perform t.as_user(staff_b);
  perform t.denied('other people cannot cancel it', format($q$select public.cancel_money(%L)$q$, t3), 'sender or the owner');
  perform t.as_user(staff_a);
  perform t.denied('the receiver cannot cancel it (they accept or reject)', format($q$select public.cancel_money(%L)$q$, t3), 'sender or the owner');
  perform t.as_user(seller_a);
  perform public.cancel_money(t3);
  perform t.ok('the sender cancelled it while pending', (select status = 'cancelled' from public.money_transfers where id = t3));
  perform t.as_user(staff_a);
  perform t.denied('a cancelled transfer cannot be accepted', format($q$select public.accept_money(%L)$q$, t3), 'already cancelled');

  -- ===== The owner =====
  perform t.as_user(seller_a);
  t4 := public.send_money(staff_a, 150);
  perform t.as_user(owner_id);
  perform t.ok('the owner sees every transfer', (select count(*) from public.money_transfers) = 4);
  perform t.ok('the owner sees all totals', (select logged_total = 500 and pending_total = 150 from public.money_summary));
  perform t.denied('the owner needs a reason to clear someone else''s pending transfer', format($q$select public.cancel_money(%L)$q$, t4), 'reason');
  perform public.cancel_money(t4, 'Staff left the company');
  perform t.ok('the owner cleared it', (select status = 'cancelled' and resolved_note = 'Staff left the company' from public.money_transfers where id = t4));
  perform t.as_user(staff_a);
  perform t.denied('staff cannot reverse a logged transfer', format($q$select public.reverse_money(%L, 'oops')$q$, t1), 'Only the owner');
  perform t.as_user(seller_a);
  perform t.denied('a seller cannot reverse a logged transfer', format($q$select public.reverse_money(%L, 'oops')$q$, t1), 'Only the owner');
  perform t.as_user(owner_id);
  perform t.denied('reversing needs a reason', format($q$select public.reverse_money(%L, '')$q$, t1), 'reason');
  perform t.denied('only a logged transfer can be reversed', format($q$select public.reverse_money(%L, 'not logged')$q$, t2), 'Only a logged');
  perform public.reverse_money(t1, 'Entered the wrong amount');
  perform t.ok('reversed: out of the logged total, but kept in the list', (select status = 'reversed' and resolved_note = 'Entered the wrong amount' from public.money_transfers where id = t1)
    and (select logged_total = 0 from public.money_summary));

  -- ===== Privacy =====
  perform t.as_user(seller_b);
  perform t.ok('another seller sees none of it', (select count(*) from public.money_transfers) = 0 and (select count(*) from public.money_balances) = 0);
  perform t.as_user(nobody);
  perform t.ok('someone with no role sees nothing', (select count(*) from public.money_transfers) = 0);
  perform t.denied('and cannot send', format($q$select public.send_money(%L, 10)$q$, staff_a), 'Only a seller');
  perform t.as_anon();
  perform t.denied('anonymous cannot read transfers', $q$select * from public.money_transfers$q$, 'permission denied');
  perform t.denied('anonymous cannot send', format($q$select public.send_money(%L, 10)$q$, staff_a), 'permission denied');
  perform t.as_user(seller_a);
  perform t.denied('a seller cannot write the table directly', $q$insert into public.money_transfers (from_user, from_name, to_user, to_name, amount) values (gen_random_uuid(), 'x', gen_random_uuid(), 'y', 1)$q$, 'permission denied');
  perform t.denied('a seller cannot edit a transfer directly', $q$update public.money_transfers set status = 'accepted'$q$, 'permission denied');
  perform t.denied('a seller cannot delete a transfer', $q$delete from public.money_transfers$q$, 'permission denied');

  -- ===== People who are switched off =====
  perform t.admin();
  update public.profiles set is_active = false where id = seller_a;
  perform t.as_user(seller_a);
  perform t.denied('a switched-off seller cannot send', format($q$select public.send_money(%L, 10)$q$, staff_a), 'Only a seller');
  perform t.admin();
  update public.profiles set is_active = true where id = seller_a;
  perform t.as_user(seller_a);
  t5 := public.send_money(staff_b, 75);
  perform t.admin();
  update public.profiles set is_active = false where id = staff_b;
  perform t.as_user(staff_b);
  perform t.denied('switched-off staff cannot accept', format($q$select public.accept_money(%L)$q$, t5), 'do not have access');
  perform t.as_user(owner_id);
  perform public.cancel_money(t5, 'Staff member switched off');
  perform t.ok('the owner can clear what is stuck with someone who was switched off', (select status = 'cancelled' from public.money_transfers where id = t5));

  -- ===== Audit trail =====
  perform t.admin();
  perform t.ok('every step is in the audit log',
    (select count(*) from public.audit_logs where action = 'money.sent' and entity_type = 'money') = 5
    and (select count(*) from public.audit_logs where action = 'money.accepted') = 1
    and (select count(*) from public.audit_logs where action = 'money.rejected') = 1
    and (select count(*) from public.audit_logs where action = 'money.cancelled') = 3
    and (select count(*) from public.audit_logs where action = 'money.reversed') = 1);
  raise notice 'ALL MONEY TESTS PASSED';
end $$;
rollback;
