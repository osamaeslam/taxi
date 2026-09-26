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
