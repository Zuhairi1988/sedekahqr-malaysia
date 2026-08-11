create or replace function public.get_site_analytics_range(p_period_days integer default 30, p_end_date date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  end_day date := least(coalesce(p_end_date, (now() at time zone 'Asia/Kuala_Lumpur')::date), (now() at time zone 'Asia/Kuala_Lumpur')::date);
  safe_days integer := case when p_period_days in (7, 14, 30) then p_period_days else 0 end;
  start_day date;
  chart_start date;
begin
  if not public.is_app_admin() then raise insufficient_privilege using message = 'Akses admin diperlukan.'; end if;
  start_day := case when safe_days = 0 then null else end_day - (safe_days - 1) end;
  chart_start := coalesce(start_day, (select min((viewed_at at time zone 'Asia/Kuala_Lumpur')::date) from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date <= end_day), end_day);
  return (
    with views as (
      select * from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date <= end_day and (start_day is null or (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day)
    ), sessions as (
      select visitor_hash, count(*) as page_count, sum(coalesce(engagement_seconds, 0)) as seconds, bool_or(engagement_seconds is not null) as measured from views group by visitor_hash
    )
    select jsonb_build_object(
      'period_days', safe_days, 'end_date', end_day,
      'totals', jsonb_build_object(
        'views', (select count(*)::integer from views), 'visitors', (select count(distinct visitor_hash)::integer from views),
        'today_views', (select count(*)::integer from views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date = end_day),
        'today_visitors', (select count(distinct visitor_hash)::integer from views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date = end_day),
        'previous_views', 0,
        'average_page_seconds', (select round(avg(engagement_seconds))::integer from views where engagement_seconds is not null),
        'bounce_rate', (select case when count(*) filter (where measured) = 0 then null else round(100.0 * count(*) filter (where measured and page_count = 1 and seconds < 10) / count(*) filter (where measured), 1) end from sessions)
      ),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', view_count, 'visitors', visitor_count) order by day) from (select series.day::date as day, count(v.id)::integer as view_count, count(distinct v.visitor_hash)::integer as visitor_count from generate_series(chart_start, end_day, interval '1 day') series(day) left join views v on (v.viewed_at at time zone 'Asia/Kuala_Lumpur')::date = series.day::date group by series.day) daily), '[]'::jsonb),
      'top_pages', coalesce((select jsonb_agg(to_jsonb(pages) order by pages.views desc, pages.path) from (select path, max(page_title) as title, count(*)::integer as views, count(distinct visitor_hash)::integer as visitors from views group by path order by views desc, path limit 8) pages), '[]'::jsonb),
      'referrers', coalesce((select jsonb_agg(to_jsonb(referrers) order by referrers.views desc, referrers.source) from (select coalesce(nullif(referrer_host, ''), 'Terus / tidak diketahui') as source, count(*)::integer as views from views group by coalesce(nullif(referrer_host, ''), 'Terus / tidak diketahui') order by views desc, source limit 6) referrers), '[]'::jsonb),
      'devices', coalesce((select jsonb_agg(to_jsonb(devices) order by devices.views desc, devices.device) from (select device_type as device, count(*)::integer as views from views group by device_type order by views desc) devices), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.get_qr_analytics_range(p_period_days integer default 30, p_end_date date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare end_day date := least(coalesce(p_end_date, (now() at time zone 'Asia/Kuala_Lumpur')::date), (now() at time zone 'Asia/Kuala_Lumpur')::date); safe_days integer := case when p_period_days in (7, 14, 30) then p_period_days else 0 end; start_day date;
begin
  if not public.is_app_admin() then raise insufficient_privilege using message = 'Akses admin diperlukan.'; end if;
  start_day := case when safe_days = 0 then null else end_day - (safe_days - 1) end;
  return (with events as (select * from public.site_qr_events where (occurred_at at time zone 'Asia/Kuala_Lumpur')::date <= end_day and (start_day is null or (occurred_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day)) select jsonb_build_object('period_days', safe_days, 'end_date', end_day, 'totals', jsonb_build_object('views', count(*) filter (where event_type = 'qr_view')::integer, 'downloads', count(*) filter (where event_type = 'qr_download')::integer, 'unique_viewers', count(distinct visitor_hash) filter (where event_type = 'qr_view')::integer, 'unique_downloaders', count(distinct visitor_hash) filter (where event_type = 'qr_download')::integer, 'today_downloads', count(*) filter (where event_type = 'qr_download' and (occurred_at at time zone 'Asia/Kuala_Lumpur')::date = end_day)::integer), 'top_qr', coalesce((select jsonb_agg(to_jsonb(ranked) order by ranked.downloads desc, ranked.views desc, ranked.name) from (select qr_name as name, max(qr_state) as state, count(*) filter (where event_type = 'qr_view')::integer as views, count(*) filter (where event_type = 'qr_download')::integer as downloads from events group by qr_name order by downloads desc, views desc, name limit 10) ranked), '[]'::jsonb)) from events);
end;
$$;

create or replace function public.get_web_performance_analytics_range(p_period_days integer default 30, p_end_date date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare end_day date := least(coalesce(p_end_date, (now() at time zone 'Asia/Kuala_Lumpur')::date), (now() at time zone 'Asia/Kuala_Lumpur')::date); safe_days integer := case when p_period_days in (7, 14, 30) then p_period_days else 0 end; start_day date;
begin if not public.is_app_admin() then raise insufficient_privilege using message = 'Akses admin diperlukan.'; end if; start_day := case when safe_days = 0 then null else end_day - (safe_days - 1) end; return (select jsonb_build_object('period_days', safe_days, 'end_date', end_day, 'samples', count(*) filter (where lcp_ms is not null), 'p75_lcp_ms', round(percentile_cont(0.75) within group (order by lcp_ms))::integer, 'p75_inp_ms', round(percentile_cont(0.75) within group (order by inp_ms))::integer, 'p75_cls_milli', round(percentile_cont(0.75) within group (order by cls_milli))::integer, 'p75_ttfb_ms', round(percentile_cont(0.75) within group (order by ttfb_ms))::integer) from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date <= end_day and (start_day is null or (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day)); end;
$$;

create or replace function public.get_visitor_location_analytics_range(p_period_days integer default 30, p_end_date date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare end_day date := least(coalesce(p_end_date, (now() at time zone 'Asia/Kuala_Lumpur')::date), (now() at time zone 'Asia/Kuala_Lumpur')::date); safe_days integer := case when p_period_days in (7, 14, 30) then p_period_days else 0 end; start_day date;
begin if not public.is_app_admin() then raise insufficient_privilege using message = 'Akses admin diperlukan.'; end if; start_day := case when safe_days = 0 then null else end_day - (safe_days - 1) end; return (with views as (select * from public.site_page_views where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date <= end_day and (start_day is null or (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day)) select jsonb_build_object('period_days', safe_days, 'end_date', end_day, 'states', coalesce((select jsonb_agg(to_jsonb(states) order by states.visitors desc, states.state) from (select location_state as state, count(distinct visitor_hash)::integer as visitors from views where location_state is not null group by location_state order by visitors desc, state limit 8) states), '[]'::jsonb), 'districts', coalesce((select jsonb_agg(to_jsonb(districts) order by districts.visitors desc, districts.district) from (select location_district as district, count(distinct visitor_hash)::integer as visitors from views where location_district is not null group by location_district order by visitors desc, district limit 8) districts), '[]'::jsonb))); end;
$$;

revoke all on function public.get_site_analytics_range(integer, date) from public, anon;
revoke all on function public.get_qr_analytics_range(integer, date) from public, anon;
revoke all on function public.get_web_performance_analytics_range(integer, date) from public, anon;
revoke all on function public.get_visitor_location_analytics_range(integer, date) from public, anon;
grant execute on function public.get_site_analytics_range(integer, date) to authenticated;
grant execute on function public.get_qr_analytics_range(integer, date) to authenticated;
grant execute on function public.get_web_performance_analytics_range(integer, date) to authenticated;
grant execute on function public.get_visitor_location_analytics_range(integer, date) to authenticated;
