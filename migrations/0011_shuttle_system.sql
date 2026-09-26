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
