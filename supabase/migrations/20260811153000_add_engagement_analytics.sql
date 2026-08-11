alter table public.site_page_views
  add column if not exists engagement_seconds integer
  check (engagement_seconds between 0 and 14400);

alter table public.site_page_views
  alter column engagement_seconds drop not null,
  alter column engagement_seconds drop default;

update public.site_page_views
set engagement_seconds = null
where engagement_seconds = 0;

create or replace function public.get_site_analytics(period_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
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

  with period_views as (
    select
      visitor_hash,
      viewed_at,
      engagement_seconds,
      lag(viewed_at) over (partition by visitor_hash order by viewed_at) as previous_viewed_at
    from public.site_page_views
    where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
  ),
  marked_views as (
    select
      *,
      sum(case when previous_viewed_at is null or viewed_at - previous_viewed_at > interval '30 minutes' then 1 else 0 end)
        over (partition by visitor_hash order by viewed_at rows unbounded preceding) as session_number
    from period_views
  ),
  sessions as (
    select
      visitor_hash,
      session_number,
      count(*) as page_count,
      sum(coalesce(engagement_seconds, 0)) as engagement_seconds,
      bool_or(engagement_seconds is not null) as has_engagement
    from marked_views
    group by visitor_hash, session_number
  ),
  engagement_metrics as (
    select
      (select round(avg(engagement_seconds))::integer from period_views where engagement_seconds is not null) as average_page_seconds,
      case when count(*) filter (where has_engagement) = 0 then null
        else round(100.0 * count(*) filter (where has_engagement and page_count = 1 and engagement_seconds < 10) / count(*) filter (where has_engagement), 1)
      end as bounce_rate
    from sessions
  )
  select jsonb_build_object(
    'period_days', safe_days,
    'generated_at', now(),
    'totals', jsonb_build_object(
      'views', (select count(*)::integer from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day),
      'visitors', (select count(distinct visitor_hash)::integer from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day),
      'today_views', (select count(*)::integer from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date = current_day),
      'today_visitors', (select count(distinct visitor_hash)::integer from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date = current_day),
      'previous_views', (select count(*)::integer from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= previous_start and (viewed_at at time zone 'Asia/Kuala_Lumpur')::date < start_day),
      'average_page_seconds', (select average_page_seconds from engagement_metrics),
      'bounce_rate', (select bounce_rate from engagement_metrics)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', daily.day, 'views', daily.views, 'visitors', daily.visitors) order by daily.day) from (select series.day::date as day, count(views.id)::integer as views, count(distinct views.visitor_hash)::integer as visitors from generate_series(start_day, current_day, interval '1 day') as series(day) left join public.site_page_views as views on (views.viewed_at at time zone 'Asia/Kuala_Lumpur')::date = series.day::date group by series.day) as daily), '[]'::jsonb),
    'top_pages', coalesce((select jsonb_agg(to_jsonb(pages) order by pages.views desc, pages.path) from (select path, max(page_title) as title, count(*)::integer as views, count(distinct visitor_hash)::integer as visitors from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day group by path order by views desc, path limit 8) as pages), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(to_jsonb(referrers) order by referrers.views desc, referrers.source) from (select coalesce(nullif(referrer_host, ''), 'Terus / tidak diketahui') as source, count(*)::integer as views from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day group by coalesce(nullif(referrer_host, ''), 'Terus / tidak diketahui') order by views desc limit 6) as referrers), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(to_jsonb(devices) order by devices.views desc, devices.device) from (select device_type as device, count(*)::integer as views from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day group by device_type order by views desc) as devices), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_site_analytics(integer) from public, anon;
grant execute on function public.get_site_analytics(integer) to authenticated;
