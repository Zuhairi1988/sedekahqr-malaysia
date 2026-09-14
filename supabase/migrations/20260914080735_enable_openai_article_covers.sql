update storage.buckets
set
  file_size_limit = 3145728,
  allowed_mime_types = array['image/webp', 'image/svg+xml']
where id = 'article-covers';

alter table public.automation_cost_events
drop constraint if exists automation_cost_events_provider_check;

alter table public.automation_cost_events
add constraint automation_cost_events_provider_check
check (provider in ('dataforseo', 'deepseek', 'openai'));
