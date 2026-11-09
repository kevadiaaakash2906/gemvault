-- GemVault: each person's chosen table columns (Orders and Trading), saved to their account so they follow them to any computer.
create table public.user_table_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  table_key text not null check (table_key in ('orders', 'trading')),
  hidden_columns text[] not null default '{}' check (cardinality(hidden_columns) <= 60),
  updated_at timestamptz not null default now(),
  primary key (user_id, table_key)
);
alter table public.user_table_prefs enable row level security;
revoke all on public.user_table_prefs from anon, authenticated;
grant select on public.user_table_prefs to authenticated;
-- Everyone sees only their own layout.
create policy user_table_prefs_select on public.user_table_prefs for select to authenticated
  using (user_id = (select auth.uid()));

create function public.save_column_prefs(p_table text, p_hidden text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); cols text[];
begin
  if uid is null then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  if p_table not in ('orders', 'trading') then raise exception 'Unknown table.'; end if;
  if exists (select 1 from unnest(coalesce(p_hidden, '{}')) h where h !~ '^[a-z_]{1,40}$') then raise exception 'Invalid column name.'; end if;
  select coalesce(array_agg(distinct h order by h), '{}') into cols from unnest(coalesce(p_hidden, '{}')) h;
  if cardinality(cols) > 60 then raise exception 'Too many columns.'; end if;
  insert into public.user_table_prefs (user_id, table_key, hidden_columns) values (uid, p_table, cols)
  on conflict (user_id, table_key) do update set hidden_columns = excluded.hidden_columns, updated_at = now();
end $$;
revoke execute on function public.save_column_prefs(text, text[]) from public, anon, authenticated;
grant execute on function public.save_column_prefs(text, text[]) to authenticated;
