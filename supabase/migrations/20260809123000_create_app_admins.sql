create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

revoke all on table public.app_admins from anon, authenticated;
grant select on table public.app_admins to authenticated;

drop policy if exists "Admins read own membership" on public.app_admins;
create policy "Admins read own membership"
on public.app_admins
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

grant insert, update, delete on table public.islamic_articles to authenticated;
grant usage, select on sequence public.islamic_articles_id_seq to authenticated;

drop policy if exists "Admins read all Islamic articles" on public.islamic_articles;
create policy "Admins read all Islamic articles"
on public.islamic_articles
for select
to authenticated
using ((select public.is_app_admin()));

drop policy if exists "Admins create Islamic articles" on public.islamic_articles;
create policy "Admins create Islamic articles"
on public.islamic_articles
for insert
to authenticated
with check ((select public.is_app_admin()));

drop policy if exists "Admins update Islamic articles" on public.islamic_articles;
create policy "Admins update Islamic articles"
on public.islamic_articles
for update
to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));

drop policy if exists "Admins delete Islamic articles" on public.islamic_articles;
create policy "Admins delete Islamic articles"
on public.islamic_articles
for delete
to authenticated
using ((select public.is_app_admin()));

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260809123000',
  array['-- Applied through the Supabase Management API.'],
  'create_app_admins'
)
on conflict (version) do nothing;
