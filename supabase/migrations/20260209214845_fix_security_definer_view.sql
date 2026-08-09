
-- Fix: Tukar mosque_stats view kepada SECURITY INVOKER
CREATE OR REPLACE VIEW public.mosque_stats
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.name,
  m.type,
  m.district,
  m.area,
  m.description,
  m.bank_name,
  m.bank_account,
  m.qr_image_url,
  m.emoji,
  m.bg_gradient,
  m.target_amount,
  m.is_active,
  COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'completed'), 0) AS total_collected,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'completed') AS total_donations,
  COUNT(DISTINCT d.donor_email) FILTER (WHERE d.status = 'completed') AS total_donors
FROM mosques m
LEFT JOIN donations d ON d.mosque_id = m.id
GROUP BY m.id;
;
