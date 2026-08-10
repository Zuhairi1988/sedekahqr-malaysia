create table if not exists public.site_page_views (
  id bigint generated always as identity primary key,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  path text not null check (char_length(path) between 1 and 240 and path ~ '^/[a-z0-9/_-]*$'),
  page_title text not null check (char_length(page_title) between 1 and 180),
  referrer_host text check (referrer_host is null or char_length(referrer_host) between 1 and 180),
  device_type text not null check (device_type in ('desktop', 'mobile', 'tablet')),
  viewed_at timestamptz not null default now()
);

alter table public.site_page_views enable row level security;

revoke all on table public.site_page_views from anon, authenticated;
grant select on table public.site_page_views to authenticated;
grant all on table public.site_page_views to service_role;
grant usage, select on sequence public.site_page_views_id_seq to service_role;

drop policy if exists "Admins read site analytics" on public.site_page_views;
create policy "Admins read site analytics"
on public.site_page_views
for select
to authenticated
using ((select public.is_app_admin()));

create index if not exists site_page_views_viewed_at_idx
  on public.site_page_views (viewed_at desc);

create index if not exists site_page_views_path_viewed_at_idx
  on public.site_page_views (path, viewed_at desc);

create index if not exists site_page_views_visitor_viewed_at_idx
  on public.site_page_views (visitor_hash, viewed_at desc);

create or replace function public.get_site_analytics(period_days integer default 30)
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
  previous_start date;
  result jsonb;
begin
  if not public.is_app_admin() then
    raise insufficient_privilege using message = 'Akses admin diperlukan.';
  end if;

  safe_days := case when period_days in (7, 30, 90) then period_days else 30 end;
  current_day := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  start_day := current_day - (safe_days - 1);
  previous_start := start_day - safe_days;

  select jsonb_build_object(
    'period_days', safe_days,
    'generated_at', now(),
    'totals', jsonb_build_object(
      'views', (
        select count(*)::integer
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
      ),
      'visitors', (
        select count(distinct visitor_hash)::integer
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
      ),
      'today_views', (
        select count(*)::integer
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date = current_day
      ),
      'today_visitors', (
        select count(distinct visitor_hash)::integer
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date = current_day
      ),
      'previous_views', (
        select count(*)::integer
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= previous_start
          and (viewed_at at time zone 'Asia/Kuala_Lumpur')::date < start_day
      )
    ),
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', daily.day,
          'views', daily.views,
          'visitors', daily.visitors
        )
        order by daily.day
      )
      from (
        select
          series.day::date as day,
          count(views.id)::integer as views,
          count(distinct views.visitor_hash)::integer as visitors
        from generate_series(start_day, current_day, interval '1 day') as series(day)
        left join public.site_page_views as views
          on (views.viewed_at at time zone 'Asia/Kuala_Lumpur')::date = series.day::date
        group by series.day
      ) as daily
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(to_jsonb(pages) order by pages.views desc, pages.path)
      from (
        select
          path,
          max(page_title) as title,
          count(*)::integer as views,
          count(distinct visitor_hash)::integer as visitors
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
        group by path
        order by views desc, path
        limit 8
      ) as pages
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(to_jsonb(referrers) order by referrers.views desc, referrers.source)
      from (
        select
          coalesce(nullif(referrer_host, ''), 'Terus / tidak diketahui') as source,
          count(*)::integer as views
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
        group by coalesce(nullif(referrer_host, ''), 'Terus / tidak diketahui')
        order by views desc
        limit 6
      ) as referrers
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(to_jsonb(devices) order by devices.views desc, devices.device)
      from (
        select device_type as device, count(*)::integer as views
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
        group by device_type
        order by views desc
      ) as devices
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_site_analytics(integer) from public, anon;
grant execute on function public.get_site_analytics(integer) to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-site-analytics';

select cron.schedule(
  'purge-site-analytics',
  '15 3 * * *',
  $$delete from public.site_page_views where viewed_at < now() - interval '180 days'$$
);

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260810093000',
  array['-- Applied through the Supabase Management API.'],
  'create_site_analytics'
)
on conflict (version) do nothing;
