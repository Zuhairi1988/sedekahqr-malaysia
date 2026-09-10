create table if not exists public.admin_cost_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  supabase_monthly_myr numeric(12,2) not null default 0 check (supabase_monthly_myr >= 0),
  domain_annual_myr numeric(12,2) not null default 0 check (domain_annual_myr >= 0),
  other_monthly_label text not null default 'Perkhidmatan lain',
  other_monthly_myr numeric(12,2) not null default 0 check (other_monthly_myr >= 0),
  dataforseo_per_article_myr numeric(12,2) not null default 0.40 check (dataforseo_per_article_myr >= 0),
  deepseek_per_article_myr numeric(12,2) not null default 0.10 check (deepseek_per_article_myr >= 0),
  updated_at timestamptz not null default now()
);

alter table public.admin_cost_settings enable row level security;
revoke all on table public.admin_cost_settings from anon, authenticated;
grant select, insert, update on table public.admin_cost_settings to authenticated;

drop policy if exists "Admins read own cost settings" on public.admin_cost_settings;
create policy "Admins read own cost settings"
on public.admin_cost_settings
for select
to authenticated
using (user_id = (select auth.uid()) and (select public.is_app_admin()));

drop policy if exists "Admins create own cost settings" on public.admin_cost_settings;
create policy "Admins create own cost settings"
on public.admin_cost_settings
for insert
to authenticated
with check (user_id = (select auth.uid()) and (select public.is_app_admin()));

drop policy if exists "Admins update own cost settings" on public.admin_cost_settings;
create policy "Admins update own cost settings"
on public.admin_cost_settings
for update
to authenticated
using (user_id = (select auth.uid()) and (select public.is_app_admin()))
with check (user_id = (select auth.uid()) and (select public.is_app_admin()));

create or replace function public.set_admin_cost_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_admin_cost_settings_updated_at on public.admin_cost_settings;
create trigger set_admin_cost_settings_updated_at
before update on public.admin_cost_settings
for each row execute function public.set_admin_cost_settings_updated_at();

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260910093000',
  array['-- Applied through the Supabase Management API.'],
  'create_admin_cost_settings'
)
on conflict (version) do nothing;
