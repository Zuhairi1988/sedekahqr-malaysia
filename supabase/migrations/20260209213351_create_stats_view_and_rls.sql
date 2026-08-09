
-- VIEW: Statistik Masjid (auto-calculate collected & donors)
CREATE OR REPLACE VIEW mosque_stats AS
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

-- ROW LEVEL SECURITY
ALTER TABLE mosques ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read mosques" ON mosques FOR SELECT USING (true);
CREATE POLICY "Public insert donations" ON donations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read donations" ON donations FOR SELECT USING (true);
CREATE POLICY "Public insert subscriptions" ON subscriptions FOR INSERT WITH CHECK (true);
;
