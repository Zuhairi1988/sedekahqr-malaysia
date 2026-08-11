alter table public.site_page_views
  add column if not exists lcp_ms integer check (lcp_ms between 0 and 60000),
  add column if not exists inp_ms integer check (inp_ms between 0 and 60000),
  add column if not exists cls_milli integer check (cls_milli between 0 and 10000),
  add column if not exists ttfb_ms integer check (ttfb_ms between 0 and 60000);

create or replace function public.get_web_performance_analytics(period_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  safe_days integer;
  start_day date;
begin
  if not public.is_app_admin() then
    raise insufficient_privilege using message = 'Akses admin diperlukan.';
  end if;

  safe_days := case when period_days in (7, 30, 90) then period_days else 30 end;
  start_day := (now() at time zone 'Asia/Kuala_Lumpur')::date - (safe_days - 1);

  return (
    select jsonb_build_object(
      'period_days', safe_days,
      'samples', count(*) filter (where lcp_ms is not null),
      'p75_lcp_ms', round(percentile_cont(0.75) within group (order by lcp_ms))::integer,
      'p75_inp_ms', round(percentile_cont(0.75) within group (order by inp_ms))::integer,
      'p75_cls_milli', round(percentile_cont(0.75) within group (order by cls_milli))::integer,
      'p75_ttfb_ms', round(percentile_cont(0.75) within group (order by ttfb_ms))::integer
    )
    from public.site_page_views
    where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
  );
end;
$$;

revoke all on function public.get_web_performance_analytics(integer) from public, anon;
grant execute on function public.get_web_performance_analytics(integer) to authenticated;
