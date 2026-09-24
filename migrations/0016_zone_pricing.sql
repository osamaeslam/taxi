-- جدول إدارة تسعيرة المناطق الديناميكية (بوت واتساب والرحلات)
CREATE TABLE IF NOT EXISTS zone_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📍',
  base_price INTEGER NOT NULL DEFAULT 40,
  return_price INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- إدخال الفئات الأساسية الخمسة المعتمدة
INSERT OR IGNORE INTO zone_pricing (id, category_key, name, icon, base_price, return_price, description, sort_order, is_active)
VALUES
  (1, 'inside_ayat', 'داخل العياط', '🏙️', 40, 70, 'مشاوير داخلية في نطاق مدينة العياط، المحطة، السوق، والمواقف والمصالح', 1, 1),
  (2, 'rural_area', 'منطقة ريفية', '🌾', 70, 120, 'قرى وعزب ونجوع العياط (البليدة، المتانيا، برنشت، كفر شحاتة، ميت القائد، طهما، بهبيت، جرزا...)', 2, 1),
  (3, 'city', 'مدينة', '🚗', 240, 420, 'مشاوير المدن والمحافظات (الجيزة، 6 أكتوبر، الشيخ زايد، الهرم، حلوان، الفيوم، بني سويف)', 3, 1),
  (4, 'cairo_airport', 'مطار القاهرة', '✈️', 550, 950, 'توصيل واستقبال مطار القاهرة الدولي ومطار سفنكس الدولي والرحلات الجوية', 4, 1),
  (5, 'private_ride', 'مشوار خاص', '👑', 450, 800, 'مشوار خاص مخصص بالساعة، يوم كامل، مناسبات، مشاوير انتظار، أو سفر عائلي حر', 5, 1);
