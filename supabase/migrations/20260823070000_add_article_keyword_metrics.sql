alter table public.islamic_articles
  add column if not exists seo_keyword text,
  add column if not exists seo_keyword_source text,
  add column if not exists seo_search_volume integer,
  add column if not exists seo_competition_index smallint,
  add column if not exists seo_keyword_researched_at timestamp with time zone;

alter table public.islamic_articles
  drop constraint if exists islamic_articles_seo_keyword_source_check;

alter table public.islamic_articles
  add constraint islamic_articles_seo_keyword_source_check
  check (seo_keyword_source is null or seo_keyword_source in ('dataforseo', 'manual'));

create index if not exists islamic_articles_seo_keyword_idx
  on public.islamic_articles (seo_keyword)
  where seo_keyword is not null;