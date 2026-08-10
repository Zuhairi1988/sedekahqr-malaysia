create table if not exists public.push_subscription_rate_limits (
  bucket_start timestamptz not null,
  subject_hash text not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_start, subject_hash)
);

alter table public.push_subscription_rate_limits enable row level security;
revoke all on table public.push_subscription_rate_limits from anon, authenticated;
grant all on table public.push_subscription_rate_limits to service_role;

create or replace function public.consume_push_subscription_rate_limit(
  p_subject_hash text,
  p_max_requests integer default 6
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz;
  safe_max integer;
begin
  if length(p_subject_hash) <> 64 then
    raise exception 'Invalid rate limit subject';
  end if;

  safe_max := greatest(1, least(coalesce(p_max_requests, 6), 20));
  bucket := date_trunc('hour', now())
    + floor(extract(minute from now()) / 10) * interval '10 minutes';

  delete from public.push_subscription_rate_limits
  where bucket_start < now() - interval '24 hours';

  insert into public.push_subscription_rate_limits as limits (bucket_start, subject_hash, request_count)
  values (bucket, p_subject_hash, 1)
  on conflict (bucket_start, subject_hash) do update
    set request_count = limits.request_count + 1,
        updated_at = now()
    where limits.request_count < safe_max;

  return found;
end;
$$;

revoke all on function public.consume_push_subscription_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_push_subscription_rate_limit(text, integer) to service_role;
