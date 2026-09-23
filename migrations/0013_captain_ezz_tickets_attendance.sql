-- 0013_captain_ezz_tickets_attendance.sql: منظومة كابتن عز - كروت ذكية وتتبع الحضور والركوب اللحظي
-- برمجة: أسامة بسيوني لتطوير المواقع والتطبيقات

-- إضافة حقول التذاكر والحضور لجدول حجوزات الباصات
ALTER TABLE shuttle_bookings ADD COLUMN ticket_code TEXT;
ALTER TABLE shuttle_bookings ADD COLUMN boarded INTEGER DEFAULT 0; -- 0: في الانتظار (أحمر), 1: ركب (أخضر)
ALTER TABLE shuttle_bookings ADD COLUMN boarded_at TEXT;
ALTER TABLE shuttle_bookings ADD COLUMN seat_no INTEGER;

-- إضافة حقول التذاكر لجدول المشاوير الخاصة
ALTER TABLE rides ADD COLUMN ticket_code TEXT;
ALTER TABLE rides ADD COLUMN boarded INTEGER DEFAULT 0;
ALTER TABLE rides ADD COLUMN boarded_at TEXT;

-- جدول العملاء المسجلين لإدارة دليل العملاء وسحب بياناتهم
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  village TEXT DEFAULT 'العياط',
  destination_fav TEXT DEFAULT 'جامعة القاهرة',
  trips_count INTEGER DEFAULT 1,
  rating REAL DEFAULT 5.0,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- توليد أكواد تذاكر فريدة للحجوزات الحالية وتحديد مقاعد وحالات ركوب متنوعة للعرض الحي
UPDATE shuttle_bookings SET ticket_code = 'EZZ-' || (1000 + id), seat_no = id WHERE ticket_code IS NULL;
UPDATE rides SET ticket_code = 'RIDE-' || (2000 + id) WHERE ticket_code IS NULL;

-- تحديث بعض الركاب الحاليين كـ "ركب" وآخرين "في الانتظار" لإظهار الشاشة الحية بالأخضر والأحمر
UPDATE shuttle_bookings SET boarded = 1, boarded_at = '06:18 ص' WHERE id IN (1, 3);
UPDATE shuttle_bookings SET boarded = 0 WHERE id NOT IN (1, 3);

-- إدراج عملاء مسجلين من قرى العياط المتنوعة
INSERT OR IGNORE INTO clients (phone, name, village, destination_fav, trips_count, notes)
VALUES
  ('01012345678', 'أحمد محمود العياطي', 'العياط - شارع الجيش', 'جامعة القاهرة (كلية تجارة)', 14, 'طالب منتظم - اشتراك شهري'),
  ('01122334455', 'مريم إبراهيم البليدي', 'قرية البليدة - كوبري البلد', 'جامعة 6 أكتوبر (طب أسنان)', 18, 'طالبة - تحرك من كوبري البليدة 06:15 ص'),
  ('01233445566', 'محمد حسن المتاني', 'قرية المتانيا', 'جامعة حلوان (هندسة)', 9, 'ركوب من مدخل المتانيا'),
  ('01099887766', 'فاطمة الزهراء البرنشتي', 'قرية برنشت', 'جامعة مصر للعلوم MUST', 12, 'طالبة - باص بنات'),
  ('01144556677', 'ياسر كمال شحاتة', 'قرية كفر شحاتة', 'جامعة عين شمس', 6, 'حجز أسبوعي'),
  ('01277889900', 'عمر عبد الرحمن طهما', 'قرية طهما', 'جامعة بني سويف', 15, 'باص الجنوب والنهضة'),
  ('01055667788', 'ندى خالد ميت القائد', 'قرية ميت القائد', 'الجامعة الألمانية GUC', 8, 'تجمع التجمع الخامس');
