create table if not exists public.qr_reports (
  id bigint generated always as identity primary key,
  qr_id text not null check (char_length(qr_id) between 1 and 120),
  qr_name text not null check (char_length(qr_name) between 1 and 180),
  report_type text not null check (report_type in ('recipient_name', 'qr_invalid', 'location', 'other')),
  details text not null check (char_length(details) between 8 and 600),
  reporter_hash text not null check (reporter_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 600),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.qr_reports enable row level security;
revoke all on table public.qr_reports from anon, authenticated;
grant select, update on table public.qr_reports to authenticated;
grant all on table public.qr_reports to service_role;
grant usage, select on sequence public.qr_reports_id_seq to service_role;

create policy "Admins manage QR reports"
on public.qr_reports
for all
to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));

create index if not exists qr_reports_status_created_at_idx
  on public.qr_reports (status, created_at desc);

create index if not exists qr_reports_qr_id_created_at_idx
  on public.qr_reports (qr_id, created_at desc);
