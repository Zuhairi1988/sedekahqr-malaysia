
-- Fix: Tambah validasi pada INSERT policies supaya tidak terlalu terbuka
-- Donations: hanya boleh insert jika amount > 0 dan mosque_id wujud
DROP POLICY IF EXISTS "Public insert donations" ON donations;
CREATE POLICY "Public insert donations" ON donations
  FOR INSERT
  WITH CHECK (
    amount > 0
    AND amount <= 100000
    AND mosque_id IS NOT NULL
    AND payment_method IS NOT NULL
  );

-- Subscriptions: hanya boleh insert jika ada nama dan email
DROP POLICY IF EXISTS "Public insert subscriptions" ON subscriptions;
CREATE POLICY "Public insert subscriptions" ON subscriptions
  FOR INSERT
  WITH CHECK (
    amount > 0
    AND amount <= 100000
    AND mosque_id IS NOT NULL
    AND donor_name IS NOT NULL
    AND donor_email IS NOT NULL
    AND frequency IS NOT NULL
  );
;
