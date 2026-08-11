do $$
declare
  function_name text;
  definition text;
begin
  foreach function_name in array array[
    'get_site_analytics_range',
    'get_qr_analytics_range',
    'get_web_performance_analytics_range',
    'get_visitor_location_analytics_range'
  ] loop
    select pg_get_functiondef(p.oid)
    into definition
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = function_name
      and pg_get_function_identity_arguments(p.oid) = 'p_period_days integer, p_end_date date';

    definition := replace(
      definition,
      'case when p_period_days in (7, 14, 30) then p_period_days else 0 end',
      'case when p_period_days between 1 and 180 then p_period_days else 0 end'
    );
    execute definition;
  end loop;
end;
$$;
