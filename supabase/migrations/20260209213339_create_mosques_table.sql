
CREATE TABLE mosques (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('masjid', 'surau')),
  district TEXT NOT NULL,
  area TEXT NOT NULL,
  description TEXT,
  bank_name TEXT,
  bank_account TEXT,
  qr_image_url TEXT,
  emoji TEXT DEFAULT '🕌',
  bg_gradient TEXT DEFAULT 'linear-gradient(135deg, #0d6b4e, #10b981)',
  target_amount NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE donations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mosque_id BIGINT REFERENCES mosques(id) ON DELETE CASCADE,
  donor_name TEXT,
  donor_email TEXT,
  donor_phone TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('qr', 'transfer', 'autodebit')),
  frequency TEXT CHECK (frequency IN ('sekali', 'harian', 'mingguan', 'bulanan', 'tahunan')),
  reference_no TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mosque_id BIGINT REFERENCES mosques(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_phone TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('harian', 'mingguan', 'bulanan', 'tahunan')),
  payment_method TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  next_charge_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
;
