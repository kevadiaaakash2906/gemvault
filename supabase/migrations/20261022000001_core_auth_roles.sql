-- GemVault Phase 1: accounts, roles, business settings, audit log, and security rules.
-- Safe to read top to bottom. Run once on a NEW Supabase project (see docs/SETUP.md).

-- ---------- Roles ----------
create type public.app_role as enum ('owner', 'staff', 'seller');

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_settings (
  id boolean primary key default true check (id),            -- forces exactly one row
  business_name text not null default 'My Jewellery Business' check (char_length(business_name) between 1 and 160),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  address text,
  state_code text check (state_code is null or state_code ~ '^[0-9]{2}$'),
  currency text not null default 'INR',
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9-]{1,10}$'),
  financial_year_start_month smallint not null default 4 check (financial_year_start_month between 1 and 12),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.business_settings default values;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

-- ---------- Helper functions ----------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_roles_updated_at before update on public.user_roles
  for each row execute function public.set_updated_at();

-- Who is asking, and what are they? Inactive users have no role.
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select ur.role
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = (select auth.uid()) and p.is_active
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'owner', false)
$$;

create function public.is_staff_or_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('owner', 'staff'), false)
$$;

-- Internal: writes one audit row. Not callable from the website.
create function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Audit log can never be edited or deleted.
create function public.audit_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit log entries cannot be changed or deleted.' using errcode = '42501';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ---------- New sign-ups get a profile but NO role (so no access) ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.sync_user_email();

-- ---------- Role administration (the ONLY way roles change) ----------
create function public.set_user_role(target uuid, new_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
declare old_role public.app_role;
begin
  if not public.is_owner() then
    raise exception 'Only an owner can change roles.' using errcode = '42501';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'That user does not exist.' using errcode = 'P0002';
  end if;

  select role into old_role from public.user_roles where user_id = target;
  insert into public.user_roles (user_id, role, assigned_by)
  values (target, new_role, (select auth.uid()))
  on conflict (user_id) do update set role = excluded.role, assigned_by = excluded.assigned_by;

  perform public.write_audit('role.changed', 'user', target::text,
    jsonb_build_object('from', old_role, 'to', new_role));
end $$;

create function public.set_user_active(target uuid, active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'Only an owner can activate or deactivate accounts.' using errcode = '42501';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You cannot deactivate your own account.' using errcode = '42501';
  end if;
  update public.profiles set is_active = active where id = target;
  if not found then
    raise exception 'That user does not exist.' using errcode = 'P0002';
  end if;
  perform public.write_audit(case when active then 'user.activated' else 'user.deactivated' end, 'user', target::text, '{}'::jsonb);
end $$;

-- One-time creation of the first owner. Run by YOU in the Supabase SQL Editor (see docs/SETUP.md).
-- Refuses to run if an owner already exists. Not callable from the website.
create function public.bootstrap_first_owner(owner_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if exists (select 1 from public.user_roles where role = 'owner') then
    raise exception 'An owner already exists. Use the Team page to manage roles.';
  end if;
  select id into uid from auth.users where lower(email) = lower(owner_email);
  if uid is null then
    raise exception 'No user with that email. Create the user in Authentication > Users first.';
  end if;
  insert into public.user_roles (user_id, role, assigned_by) values (uid, 'owner', uid);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (uid, 'owner.bootstrapped', 'user', uid::text, '{}'::jsonb);
end $$;

-- ---------- Audit changes to business settings ----------
create function public.audit_business_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by = (select auth.uid());
  perform public.write_audit('settings.updated', 'business_settings', 'singleton',
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return new;
end $$;
create trigger business_settings_audit before update on public.business_settings
  for each row execute function public.audit_business_settings();

-- ---------- Function permissions (default is "everyone", so lock down first) ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_staff_or_owner() to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
-- write_audit, bootstrap_first_owner, trigger functions: no grants on purpose.

-- ---------- Table permissions + Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.user_roles, public.business_settings, public.audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;   -- cannot touch is_active/email
grant select on public.user_roles to authenticated;                     -- no insert/update/delete
grant select, update on public.business_settings to authenticated;
grant select on public.audit_logs to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());

create policy settings_select on public.business_settings for select to authenticated
  using (public.is_staff_or_owner());
create policy settings_update on public.business_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_owner());
