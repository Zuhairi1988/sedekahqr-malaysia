create table if not exists public.qr_verifications (
  qr_id text primary key check (char_length(qr_id) between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'verified', 'suspended')),
  note text check (note is null or char_length(note) <= 360),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.qr_verifications enable row level security;
revoke all on table public.qr_verifications from anon, authenticated;
grant select on table public.qr_verifications to anon, authenticated;
grant all on table public.qr_verifications to service_role;

create policy "Public reads QR verification status"
on public.qr_verifications for select to anon, authenticated using (true);

create policy "Admins manage QR verification status"
on public.qr_verifications for all to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));
