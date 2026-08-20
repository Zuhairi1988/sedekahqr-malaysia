-- Run by Supabase Cron at 10:00 AM Malaysia time (02:00 UTC), every Sunday, Monday, Wednesday and Friday.
-- The internal authorization token remains in Supabase Vault.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'generate-seo-article-drafts') then
    perform cron.unschedule('generate-seo-article-drafts');
  end if;
end $$;

select cron.schedule(
  'generate-seo-article-drafts',
  '0 2 * * 0,1,3,5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-article-draft',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'article_automation_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
