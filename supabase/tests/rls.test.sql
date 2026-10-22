-- Security tests for roles and Row Level Security. Any failure stops the run with an error.
drop schema if exists t cascade;
create schema t;
create function t.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  set role authenticated;
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  set role anon;
end $$;
create function t.admin() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', '', false); end $$;
-- Passes only if running the SQL raises an error (optionally containing some text).
create function t.denied(label text, stmt text, must_contain text default '') returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(lower(must_contain) in lower(sqlerrm)) = 0 then
      raise exception 'FAIL [%]: wrong error: %', label, sqlerrm;
    end if;
    raise notice 'PASS  %', label;
    return;
  end;
  raise exception 'FAIL [%]: this should have been blocked', label;
end $$;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL [%]', label; end if;
  raise notice 'PASS  %', label;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

do $$
declare
  owner_id  uuid := '00000000-0000-0000-0000-000000000001';
  staff_id  uuid := '00000000-0000-0000-0000-000000000002';
  sellera   uuid := '00000000-0000-0000-0000-000000000003';
  sellerb   uuid := '00000000-0000-0000-0000-000000000004';
  newbie    uuid := '00000000-0000-0000-0000-000000000005';
  n int;
begin
  insert into auth.users (id, email) values
    (owner_id, 'owner@x.com'), (staff_id, 'staff@x.com'), (sellera, 'a@x.com'),
    (sellerb, 'b@x.com'), (newbie, 'new@x.com');

  perform t.ok('new sign-ups get a profile', (select count(*) from public.profiles) = 5);
  perform t.ok('new sign-ups get NO role', (select count(*) from public.user_roles) = 0);

  -- first owner bootstrap
  perform t.as_user(owner_id);
  perform t.denied('website users cannot run bootstrap_first_owner',
    $q$select public.bootstrap_first_owner('owner@x.com')$q$, 'permission denied');
  perform t.admin();
  perform public.bootstrap_first_owner('owner@x.com');
  perform t.denied('bootstrap refuses a second owner',
    $q$select public.bootstrap_first_owner('staff@x.com')$q$, 'already exists');

  -- owner assigns roles
  perform t.as_user(owner_id);
  perform public.set_user_role(staff_id, 'staff');
  perform public.set_user_role(sellera, 'seller');
  perform public.set_user_role(sellerb, 'seller');
  perform t.denied('owner cannot change own role',
    format($q$select public.set_user_role(%L, 'staff')$q$, owner_id), 'own role');
  perform t.ok('owner sees every profile', (select count(*) from public.profiles) = 5);
  perform t.ok('owner sees every role', (select count(*) from public.user_roles) = 4);

  -- staff
  perform t.as_user(staff_id);
  perform t.denied('staff cannot assign roles',
    format($q$select public.set_user_role(%L, 'owner')$q$, sellera), 'only an owner');
  perform t.denied('staff cannot deactivate users',
    format($q$select public.set_user_active(%L, false)$q$, sellera), 'only an owner');
  perform t.ok('staff reads business settings', (select count(*) from public.business_settings) = 1);
  update public.business_settings set business_name = 'Hacked by staff';
  get diagnostics n = row_count;
  perform t.ok('staff cannot edit business settings', n = 0);
  perform t.ok('staff cannot read the audit log', (select count(*) from public.audit_logs) = 0);
  perform t.ok('staff sees only their own profile', (select count(*) from public.profiles) = 1);

  -- sellers
  perform t.as_user(sellera);
  perform t.ok('seller sees only their own profile',
    (select count(*) from public.profiles where id <> sellera) = 0);
  perform t.ok('seller cannot see other roles', (select count(*) from public.user_roles) = 1);
  perform t.ok('seller cannot read business settings', (select count(*) from public.business_settings) = 0);
  perform t.ok('seller cannot read the audit log', (select count(*) from public.audit_logs) = 0);
  perform t.denied('seller cannot give themselves owner (direct update)',
    format($q$update public.user_roles set role = 'owner' where user_id = %L$q$, sellera), 'permission denied');
  perform t.denied('seller cannot insert a role',
    format($q$insert into public.user_roles (user_id, role) values (%L, 'owner')$q$, newbie), 'permission denied');
  perform t.denied('seller cannot delete roles',
    $q$delete from public.user_roles$q$, 'permission denied');
  perform t.denied('seller cannot call set_user_role',
    format($q$select public.set_user_role(%L, 'owner')$q$, sellera), 'only an owner');
  perform t.denied('seller cannot reactivate/deactivate',
    format($q$update public.profiles set is_active = true where id = %L$q$, sellera), 'permission denied');
  perform t.denied('seller cannot change their email column',
    format($q$update public.profiles set email = 'x@y.com' where id = %L$q$, sellera), 'permission denied');
  update public.profiles set full_name = 'Seller A' where id = sellera;
  perform t.ok('seller can edit their own name', (select full_name from public.profiles where id = sellera) = 'Seller A');
  update public.profiles set full_name = 'Pwned' where id = sellerb;
  get diagnostics n = row_count;
  perform t.ok('seller cannot edit another seller', n = 0);
  perform t.denied('seller cannot write audit entries directly',
    $q$select public.write_audit('x','y','z')$q$, 'permission denied');
  perform t.denied('seller cannot insert into audit log',
    $q$insert into public.audit_logs (action, entity_type) values ('x','y')$q$, 'permission denied');

  -- user with no role
  perform t.as_user(newbie);
  perform t.ok('role-less user is not owner/staff', public.current_app_role() is null);
  perform t.ok('role-less user sees no settings', (select count(*) from public.business_settings) = 0);

  -- anonymous visitors
  perform t.as_anon();
  perform t.denied('anonymous cannot read profiles', $q$select * from public.profiles$q$, 'permission denied');
  perform t.denied('anonymous cannot read settings', $q$select * from public.business_settings$q$, 'permission denied');
  perform t.denied('anonymous cannot call set_user_role',
    format($q$select public.set_user_role(%L, 'owner')$q$, sellera), 'permission denied');

  -- owner powers + audit trail
  perform t.as_user(owner_id);
  update public.business_settings set business_name = 'Real Jewellers';
  perform t.ok('owner can edit business settings', (select business_name from public.business_settings) = 'Real Jewellers');
  perform public.set_user_active(sellerb, false);
  perform t.ok('audit log recorded role changes and settings edit',
    (select count(*) from public.audit_logs where action in ('role.changed','settings.updated','user.deactivated')) >= 5);
  perform t.denied('audit log cannot be edited',
    $q$update public.audit_logs set action = 'tampered'$q$, 'permission denied');
  perform t.admin();
  perform t.denied('audit log cannot be edited even by an administrator',
    $q$update public.audit_logs set action = 'tampered'$q$, 'cannot be changed');
  perform t.denied('audit log cannot be deleted even by an administrator',
    $q$delete from public.audit_logs$q$, 'cannot be changed');

  -- deactivated users lose their role
  perform t.as_user(sellerb);
  perform t.ok('deactivated seller has no active role', public.current_app_role() is null);

  -- settings validation
  perform t.as_user(owner_id);
  perform t.denied('bad GSTIN rejected',
    $q$update public.business_settings set gstin = 'NOTAGSTIN'$q$, 'check constraint');
  perform t.admin();
  raise notice 'ALL SECURITY TESTS PASSED';
end $$;
