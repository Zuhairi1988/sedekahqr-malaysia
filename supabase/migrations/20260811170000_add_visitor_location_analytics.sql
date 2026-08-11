alter table public.site_page_views
  add column if not exists location_state text check (location_state is null or char_length(location_state) between 1 and 80),
  add column if not exists location_district text check (location_district is null or char_length(location_district) between 1 and 240);

create index if not exists site_page_views_location_state_viewed_at_idx
  on public.site_page_views (location_state, viewed_at desc)
  where location_state is not null;

create or replace function public.get_visitor_location_analytics(period_days integer default 30)
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

  return jsonb_build_object(
    'period_days', safe_days,
    'states', coalesce((
      select jsonb_agg(to_jsonb(states) order by states.visitors desc, states.state)
      from (
        select location_state as state, count(distinct visitor_hash)::integer as visitors
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
          and location_state is not null
        group by location_state
        order by visitors desc, state
        limit 8
      ) as states
    ), '[]'::jsonb),
    'districts', coalesce((
      select jsonb_agg(to_jsonb(districts) order by districts.visitors desc, districts.district)
      from (
        select location_district as district, count(distinct visitor_hash)::integer as visitors
        from public.site_page_views
        where (viewed_at at time zone 'Asia/Kuala_Lumpur')::date >= start_day
          and location_district is not null
        group by location_district
        order by visitors desc, district
        limit 8
      ) as districts
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_visitor_location_analytics(integer) from public, anon;
grant execute on function public.get_visitor_location_analytics(integer) to authenticated;
