-- 0011_shuttle_system.sql: نظام رحلات باصات الطلاب والجامعات (14 راكب) والاشتراكات والمشاوير الخاصة
CREATE TABLE IF NOT EXISTS shuttle_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pickup_point TEXT NOT NULL DEFAULT 'المسجد الكبير - مدخل البلد',
  destination TEXT NOT NULL,
  departure_time TEXT NOT NULL DEFAULT '06:00 ص',
  return_time TEXT NOT NULL DEFAULT '03:30 م',
  one_way_price INTEGER NOT NULL DEFAULT 35,
  round_trip_price INTEGER NOT NULL DEFAULT 60,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shuttle_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL REFERENCES shuttle_lines(id),
  vehicle_name TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  seat_capacity INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS shuttle_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL REFERENCES shuttle_lines(id),
  vehicle_id INTEGER REFERENCES shuttle_vehicles(id),
  booking_date TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'all',
  direction TEXT NOT NULL DEFAULT 'round',
  seats_count INTEGER NOT NULL DEFAULT 1,
  pickup_location TEXT DEFAULT 'المسجد الكبير',
  dropoff_location TEXT DEFAULT 'بوابة الجامعة الرئيسية',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  fare_amount INTEGER NOT NULL DEFAULT 60,
  paid_status TEXT NOT NULL DEFAULT 'unpaid',
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS student_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'female',
  line_id INTEGER NOT NULL REFERENCES shuttle_lines(id),
  university TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'monthly',
  total_trips INTEGER NOT NULL DEFAULT 22,
  used_trips INTEGER NOT NULL DEFAULT 0,
  price_paid INTEGER NOT NULL DEFAULT 1200,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- بذور أولية لخطوط القاهرة وأكتوبر والسيارات 14 راكب
INSERT INTO shuttle_lines (id, name, pickup_point, destination, departure_time, return_time, one_way_price, round_trip_price, active)
VALUES
  (1, 'خط البلد ⬅️ جامعة القاهرة', 'المسجد الكبير - أول البلد', 'جامعة القاهرة (بين السرايات ومترو الجامعة)', '06:00 ص', '03:30 م', 35, 60, 1),
  (2, 'خط البلد ⬅️ جامعة 6 أكتوبر', 'المسجد الكبير - الموقف الرئيسي', 'جامعة 6 أكتوبر (ميدان الحصري ومحور 26 يوليو)', '06:30 ص', '04:00 م', 40, 70, 1),
  (3, 'خط البلد ⬅️ جامعة حلوان والمعادي', 'مدخل البلد - موقف الأتوبيس', 'جامعة حلوان / محطة المترو', '06:15 ص', '03:45 م', 35, 60, 1);

-- بذور سيارات 14 راكب مع أسماء السائقين وأرقامهم
INSERT INTO shuttle_vehicles (id, line_id, vehicle_name, plate_number, driver_name, driver_phone, seat_capacity, status)
VALUES
  (1, 1, 'عربية 1 (تويوتا هايس 14 راكب)', 'ق هـ ر 1425', 'كابتن أحمد سعيد', '01012345678', 14, 'active'),
  (2, 1, 'عربية 2 (تويوتا هايس 14 راكب - إضافية)', 'ق هـ ر 8891', 'كابتن محمد عبد الله', '01123456789', 14, 'active'),
  (3, 2, 'عربية 1 (كينج لونج 14 راكب - خط أكتوبر)', 'ج ي ز 5632', 'كابتن محمود حسن', '01234567890', 14, 'active');

-- بذور اشتراكات الطلاب
INSERT INTO student_subscriptions (id, student_name, student_phone, gender, line_id, university, plan_type, total_trips, used_trips, price_paid, start_date, end_date, status)
VALUES
  (1, 'سارة إبراهيم', '01099887766', 'بنات', 1, 'جامعة القاهرة - كلية طب', 'monthly', 22, 5, 1200, '2026-09-01', '2026-09-30', 'active'),
  (2, 'مريم أحمد', '01155443322', 'بنات', 1, 'جامعة القاهرة - هندسة', 'monthly', 22, 4, 1200, '2026-09-01', '2026-09-30', 'active'),
  (3, 'نورهان مصطفى', '01288776655', 'بنات', 1, 'جامعة القاهرة - علاج طبيعي', 'monthly', 22, 6, 1200, '2026-09-01', '2026-09-30', 'active'),
  (4, 'ياسمين خليل', '01044332211', 'بنات', 1, 'جامعة القاهرة - اقتصاد وعلوم سياسية', 'monthly', 22, 3, 1200, '2026-09-01', '2026-09-30', 'active'),
  (5, 'عمر خالد', '01122334455', 'شباب', 2, 'جامعة 6 أكتوبر - حاسبات ومعلومات', 'monthly', 22, 7, 1350, '2026-09-01', '2026-09-30', 'active'),
  (6, 'كريم محمود', '01233445566', 'شباب', 2, 'جامعة 6 أكتوبر - هندسة', 'monthly', 22, 8, 1350, '2026-09-01', '2026-09-30', 'active');

-- بذور حجوزات يومية لتسكين عربية 1 (14 راكب) لعرض الإشغال المباشر في لوحة التحكم
INSERT INTO shuttle_bookings (line_id, vehicle_id, booking_date, student_name, student_phone, gender, direction, seats_count, pickup_location, dropoff_location, payment_method, fare_amount, paid_status, status, notes)
VALUES
  (1, 1, date('now'), 'سارة إبراهيم', '01099887766', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية طب', 'subscription', 60, 'paid', 'confirmed', 'مقعد 1 - اشتراك شهري'),
  (1, 1, date('now'), 'مريم أحمد', '01155443322', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية هندسة', 'subscription', 60, 'paid', 'confirmed', 'مقعد 2 - اشتراك شهري'),
  (1, 1, date('now'), 'نورهان مصطفى', '01288776655', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية علاج طبيعي', 'subscription', 60, 'paid', 'confirmed', 'مقعد 3 - اشتراك شهري'),
  (1, 1, date('now'), 'ياسمين خليل', '01044332211', 'بنات', 'round', 1, 'المسجد الكبير', 'اقتصاد وعلوم سياسية', 'subscription', 60, 'paid', 'confirmed', 'مقعد 4 - اشتراك شهري'),
  (1, 1, date('now'), 'فاطمة محمود', '01066778899', 'بنات', 'round', 1, 'أول البلد - الصيدلية', 'كلية الآداب', 'cash', 60, 'paid', 'confirmed', 'مقعد 5 - كاش يومي'),
  (1, 1, date('now'), 'هدى عادل', '01199881122', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية تجارة', 'vodafone_cash', 60, 'paid', 'confirmed', 'مقعد 6 - فودافون كاش'),
  (1, 1, date('now'), 'آية سامح', '01211223344', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية دار العلوم', 'cash', 60, 'paid', 'confirmed', 'مقعد 7 - كاش يومي'),
  (1, 1, date('now'), 'سلمى شريف', '01022334455', 'بنات', 'round', 1, 'موقف البلد', 'كلية الحقوق', 'subscription', 60, 'paid', 'confirmed', 'مقعد 8 - اشتراك شهري'),
  (1, 1, date('now'), 'رنا إيهاب', '01133445566', 'بنات', 'one_way_go', 1, 'المسجد الكبير', 'بين السرايات', 'cash', 35, 'paid', 'confirmed', 'مقعد 9 - ذهاب فقط كاش'),
  (1, 1, date('now'), 'ندى طارق', '01244556677', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية العلوم', 'cash', 60, 'unpaid', 'confirmed', 'مقعد 10 - كاش عند الركوب'),
  (1, 1, date('now'), 'شهد حسن', '01055667788', 'بنات', 'round', 1, 'أمام المدرسة المشتركة', 'كلية صيدلة', 'subscription', 60, 'paid', 'confirmed', 'مقعد 11 - اشتراك شهري'),
  (1, 1, date('now'), 'ملك علاء', '01166778899', 'بنات', 'round', 1, 'المسجد الكبير', 'كلية تمريض', 'cash', 60, 'paid', 'confirmed', 'مقعد 12 - كاش يومي');
