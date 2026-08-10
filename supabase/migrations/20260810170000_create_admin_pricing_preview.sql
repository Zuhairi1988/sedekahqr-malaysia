create table if not exists public.admin_pricing_preview (
  id smallint primary key default 1 check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_pricing_preview enable row level security;

revoke all on table public.admin_pricing_preview from anon, authenticated;
grant select on table public.admin_pricing_preview to authenticated;

drop policy if exists "Admins read pricing preview" on public.admin_pricing_preview;
create policy "Admins read pricing preview"
on public.admin_pricing_preview
for select
to authenticated
using ((select public.is_app_admin()));

comment on table public.admin_pricing_preview is
  'Private pricing draft. RLS permits reads only for registered app administrators.';

-- The pricing payload is inserted directly during deployment and is deliberately
-- excluded from this public repository.
