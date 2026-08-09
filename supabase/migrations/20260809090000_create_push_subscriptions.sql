create table if not exists public.push_subscriptions (
  subscription_id text primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  zone text not null check (zone ~ '^[A-Z]{3}[0-9]{2}$'),
  user_agent text,
  enabled boolean not null default true,
  last_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant all on table public.push_subscriptions to service_role;

create index if not exists push_subscriptions_due_idx
  on public.push_subscriptions (enabled, zone, last_sent_date);

create or replace function public.set_push_subscription_updated_at()
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

drop trigger if exists set_push_subscription_updated_at on public.push_subscriptions;
create trigger set_push_subscription_updated_at
before update on public.push_subscriptions
for each row execute function public.set_push_subscription_updated_at();
