alter table public.push_subscriptions
  add column if not exists days_of_week smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[];

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_days_of_week_check;

alter table public.push_subscriptions
  add constraint push_subscriptions_days_of_week_check
  check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );