create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.subuh_cron_config (
  singleton boolean primary key default true check (singleton),
  secret text not null default encode(gen_random_bytes(32), 'hex')
);

insert into private.subuh_cron_config (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.verify_subuh_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.subuh_cron_config
    where singleton = true
      and secret = candidate
  );
$$;

revoke all on function public.verify_subuh_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_subuh_cron_secret(text) to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-subuh-reminders';

select cron.schedule(
  'send-subuh-reminders',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      url := 'https://cuzzbbenqeghmhvxqmtn.supabase.co/functions/v1/send-subuh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select secret
          from private.subuh_cron_config
          where singleton = true
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260809093000',
  array['-- Applied through the Supabase Management API.'],
  'schedule_subuh_notifications'
)
on conflict (version) do nothing;
