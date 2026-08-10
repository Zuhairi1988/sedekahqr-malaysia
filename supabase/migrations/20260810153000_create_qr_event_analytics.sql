create table if not exists public.site_qr_events (
  id bigint generated always as identity primary key,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  event_type text not null check (event_type in ('qr_view', 'qr_download')),
  qr_name text not null check (char_length(qr_name) between 1 and 180),
  qr_state text not null check (char_length(qr_state) between 1 and 80),
  occurred_at timestamptz not null default now()
);

alter table public.site_qr_events enable row level security;

revoke all on table public.site_qr_events from anon, authenticated;
grant select on table public.site_qr_events to authenticated;
grant all on table public.site_qr_events to service_role;
grant usage, select on sequence public.site_qr_events_id_seq to service_role;

drop policy if exists "Admins read QR analytics" on public.site_qr_events;
create policy "Admins read QR analytics"
on public.site_qr_events
for select
to authenticated
using ((select public.is_app_admin()));

create index if not exists site_qr_events_occurred_at_idx
  on public.site_qr_events (occurred_at desc);

create index if not exists site_qr_events_name_occurred_at_idx
  on public.site_qr_events (qr_name, occurred_at desc);

create or replace function public.get_qr_analytics(period_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_days integer;
  current_day date;
  start_day date;
  result jsonb;
begin
  if not public.is_app_admin() then
    raise insufficient_privilege using message = 'Akses admin diperlukan.';
  end if;

  safe_days := case when period_days in (7, 30, 90) then period_days else 30 end;
  current_day := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  start_day := current_day - (safe_days - 1);

  select jsonb_build_object(
    'period_days', safe_days,
    'totals', jsonb_build_object(
      'views', count(*) filter (where event_type = 'qr_view')::integer,
      'downloads', count(*) filter (where event_type = 'qr_download')::integer,
      'unique_viewers', count(distinct visitor_hash) filter (where event_type = 'qr_view')::integer,
      'unique_downloaders', count(distinct visitor_hash) filter (where event_type = 'qr_download')::integer,
      'today_downloads', count(*) filter (
        where event_type = 'qr_download'
          and (occurred_at at time zone 'Asia/Kuala_Lumpur')::date = current_day
      )::integer
    ),
    'top_qr', coalesce((
      select jsonb_agg(to_jsonb(ranked) order by ranked.downloads desc, ranked.views desc, ranked.name)
      from (
        select
          qr_name as name,
          max(qr_state) as state,
          count(*) filter (where event_type = 'qr_view')::integer as views,
          count(*) filter (where event_type = 'qr_download')::integer as downloads
        from public.site_qr_events
        where (occurred_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
        group by qr_name
        order by downloads desc, views desc, qr_name
        limit 10
      ) as ranked
    ), '[]'::jsonb)
  ) into result
  from public.site_qr_events
  where (occurred_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day;

  return result;
end;
$$;

revoke all on function public.get_qr_analytics(integer) from public, anon;
grant execute on function public.get_qr_analytics(integer) to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-site-analytics';

select cron.schedule(
  'purge-site-analytics',
  '15 3 * * *',
  $$
    delete from public.site_page_views where viewed_at < now() - interval '180 days';
    delete from public.site_qr_events where occurred_at < now() - interval '180 days';
  $$
);

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260810153000',
  array['-- Applied through the Supabase Management API.'],
  'create_qr_event_analytics'
)
on conflict (version) do nothing;
