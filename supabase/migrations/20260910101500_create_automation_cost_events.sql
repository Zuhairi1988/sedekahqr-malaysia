create table if not exists public.automation_cost_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('dataforseo', 'deepseek')),
  event_type text not null,
  cost_usd numeric(14,8) not null default 0 check (cost_usd >= 0),
  input_tokens integer,
  output_tokens integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.automation_cost_events enable row level security;
revoke all on table public.automation_cost_events from anon, authenticated;
grant select on table public.automation_cost_events to authenticated;

drop policy if exists "Admins read automation cost events" on public.automation_cost_events;
create policy "Admins read automation cost events"
on public.automation_cost_events
for select
to authenticated
using ((select public.is_app_admin()));

create index if not exists automation_cost_events_created_at_idx
on public.automation_cost_events (created_at desc);

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260910101500',
  array['-- Applied through the Supabase Management API.'],
  'create_automation_cost_events'
)
on conflict (version) do nothing;