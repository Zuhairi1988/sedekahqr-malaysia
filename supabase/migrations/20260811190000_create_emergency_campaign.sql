create table if not exists public.emergency_campaign (
  id boolean primary key default true check (id),
  title text not null check (char_length(title) between 8 and 120),
  message text not null check (char_length(message) between 3 and 360),
  qr_id text not null check (char_length(qr_id) between 3 and 180),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  delay_seconds smallint not null default 5 check (delay_seconds between 0 and 30),
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.emergency_campaign enable row level security;

revoke all on table public.emergency_campaign from anon, authenticated;
grant select on table public.emergency_campaign to anon, authenticated;
grant insert, update on table public.emergency_campaign to authenticated;

create or replace function public.set_emergency_campaign_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_emergency_campaign_updated_at on public.emergency_campaign;
create trigger set_emergency_campaign_updated_at
before update on public.emergency_campaign
for each row execute function public.set_emergency_campaign_updated_at();

drop policy if exists "Public reads current emergency campaign" on public.emergency_campaign;
create policy "Public reads current emergency campaign"
on public.emergency_campaign
for select
to anon, authenticated
using (is_active and starts_at <= now() and ends_at > now());

drop policy if exists "Admins read emergency campaign" on public.emergency_campaign;
create policy "Admins read emergency campaign"
on public.emergency_campaign
for select
to authenticated
using ((select public.is_app_admin()));

drop policy if exists "Admins create emergency campaign" on public.emergency_campaign;
create policy "Admins create emergency campaign"
on public.emergency_campaign
for insert
to authenticated
with check ((select public.is_app_admin()));

drop policy if exists "Admins update emergency campaign" on public.emergency_campaign;
create policy "Admins update emergency campaign"
on public.emergency_campaign
for update
to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));
