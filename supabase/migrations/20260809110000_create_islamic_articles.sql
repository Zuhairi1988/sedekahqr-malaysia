create table if not exists public.islamic_articles (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 8 and 180),
  excerpt text not null check (char_length(excerpt) between 30 and 360),
  category text not null check (category in ('Al-Quran', 'Hadis', 'Doa', 'Sirah', 'Akhlak', 'Sedekah')),
  author text not null default 'Editorial SedekahQR',
  cover_image text not null,
  reading_minutes smallint not null default 5 check (reading_minutes between 1 and 60),
  content jsonb not null check (jsonb_typeof(content) = 'array'),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.islamic_articles enable row level security;

revoke all on table public.islamic_articles from anon, authenticated;
grant select on table public.islamic_articles to anon, authenticated;
grant all on table public.islamic_articles to service_role;

drop policy if exists "Public read published Islamic articles" on public.islamic_articles;
create policy "Public read published Islamic articles"
on public.islamic_articles
for select
to anon, authenticated
using (is_published = true and published_at is not null and published_at <= now());

create index if not exists islamic_articles_published_idx
  on public.islamic_articles (published_at desc)
  where is_published = true;

create index if not exists islamic_articles_category_idx
  on public.islamic_articles (category, published_at desc)
  where is_published = true;

create or replace function public.set_islamic_article_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_islamic_article_updated_at on public.islamic_articles;
create trigger set_islamic_article_updated_at
before update on public.islamic_articles
for each row execute function public.set_islamic_article_updated_at();

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260809110000',
  array['-- Applied through the Supabase Management API.'],
  'create_islamic_articles'
)
on conflict (version) do nothing;
