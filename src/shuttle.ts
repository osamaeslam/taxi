import type { D1Database } from '@cloudflare/workers-types';

export interface ShuttleLine {
  id: number;
  name: string;
  pickup_point: string;
  destination: string;
  departure_time: string;
  return_time: string;
  one_way_price: number;
  round_trip_price: number;
  active: number;
}

export interface ShuttleVehicle {
  id: number;
  line_id: number;
  vehicle_name: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  seat_capacity: number;
  status: string;
  line_name?: string;
  booked_seats?: number;
  remaining_seats?: number;
}

export interface ShuttleBooking {
  id: number;
  line_id: number;
  vehicle_id: number | null;
  booking_date: string;
  student_name: string;
  student_phone: string;
  gender: string;
  direction: string; // round | one_way_go | one_way_back
  seats_count: number;
  pickup_location: string;
  dropoff_location: string;
  payment_method: string; // cash | subscription | vodafone_cash | instapay
  fare_amount: number;
  paid_status: string; // paid | unpaid
  status: string; // confirmed | waitlist | cancelled | attended
  ticket_code?: string;
  boarded?: number; // 0: waiting (red), 1: boarded (green)
  boarded_at?: string;
  seat_no?: number;
  notes?: string;
  line_name?: string;
  departure_time?: string;
  return_time?: string;
  vehicle_name?: string;
  plate_number?: string;
  driver_name?: string;
  driver_phone?: string;
  created_at: number;
}

export interface StudentSubscription {
  id: number;
  student_name: string;
  student_phone: string;
  gender: string;
  line_id: number;
  university: string;
  plan_type: string;
  total_trips: number;
  used_trips: number;
  price_paid: number;
  start_date: string;
  end_date: string;
  status: string;
  line_name?: string;
}

export async function getShuttleLines(db: D1Database): Promise<ShuttleLine[]> {
  const res = await db.prepare('SELECT * FROM shuttle_lines WHERE active = 1 ORDER BY id ASC').all<ShuttleLine>();
  return res.results || [];
}

export async function getShuttleVehicles(db: D1Database, date?: string): Promise<ShuttleVehicle[]> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const vehiclesRes = await db.prepare(`
    SELECT v.*, l.name as line_name 
    FROM shuttle_vehicles v 
    JOIN shuttle_lines l ON v.line_id = l.id 
    WHERE v.status = 'active'
    ORDER BY v.line_id ASC, v.id ASC
  `).all<ShuttleVehicle>();

  const vehicles = vehiclesRes.results || [];

  for (const v of vehicles) {
    const countRes = await db.prepare(`
      SELECT COALESCE(SUM(seats_count), 0) as total_booked 
      FROM shuttle_bookings 
      WHERE vehicle_id = ? AND booking_date = ? AND status != 'cancelled'
    `).bind(v.id, targetDate).first<{ total_booked: number }>();

    v.booked_seats = countRes?.total_booked ?? 0;
    v.remaining_seats = Math.max(0, v.seat_capacity - v.booked_seats);
  }

  return vehicles;
}

export async function getShuttleBookings(db: D1Database, date?: string, lineId?: number, vehicleId?: number): Promise<ShuttleBooking[]> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  let query = `
    SELECT b.*, l.name as line_name, l.departure_time, l.return_time, 
           v.vehicle_name, v.plate_number, v.driver_name, v.driver_phone
    FROM shuttle_bookings b
    JOIN shuttle_lines l ON b.line_id = l.id
    LEFT JOIN shuttle_vehicles v ON b.vehicle_id = v.id
    WHERE b.booking_date = ?
  `;
  const params: any[] = [targetDate];

  if (lineId) {
    query += ' AND b.line_id = ?';
    params.push(lineId);
  }
  if (vehicleId) {
    query += ' AND b.vehicle_id = ?';
    params.push(vehicleId);
  }

  query += ' ORDER BY b.vehicle_id ASC, b.id ASC';

  const res = await db.prepare(query).bind(...params).all<ShuttleBooking>();
  return res.results || [];
}

export async function findOrCreateVehicleForBooking(db: D1Database, lineId: number, date: string, seatsNeeded = 1): Promise<number | null> {
  const vehicles = await getShuttleVehicles(db, date);
  const lineVehicles = vehicles.filter((v) => v.line_id === lineId && v.status === 'active');

  for (const v of lineVehicles) {
    if ((v.remaining_seats ?? 0) >= seatsNeeded) {
      return v.id;
    }
  }

  // If all active are full, assign to the last one or return first
  if (lineVehicles.length > 0) {
    return lineVehicles[0].id;
  }
  return null;
}

export async function bookShuttleSeat(
  db: D1Database,
  data: {
    lineId: number;
    studentName: string;
    studentPhone: string;
    gender?: string;
    direction?: string;
    seatsCount?: number;
    bookingDate?: string;
    pickupLocation?: string;
    dropoffLocation?: string;
    paymentMethod?: string;
    fareAmount?: number;
    notes?: string;
  }
): Promise<{ ok: boolean; bookingId?: number; vehicleId?: number | null; ticketCode?: string; error?: string }> {
  const date = data.bookingDate || new Date().toISOString().slice(0, 10);
  const seats = data.seatsCount || 1;

  // Check existing active subscription
  let paymentMethod = data.paymentMethod || 'cash';
  let paidStatus = 'unpaid';
  const sub = await db.prepare(`
    SELECT * FROM student_subscriptions 
    WHERE student_phone = ? AND line_id = ? AND status = 'active' AND used_trips < total_trips
  `).bind(data.studentPhone, data.lineId).first<StudentSubscription>();

  if (sub) {
    paymentMethod = 'subscription';
    paidStatus = 'paid';
    await db.prepare('UPDATE student_subscriptions SET used_trips = used_trips + 1 WHERE id = ?').bind(sub.id).run();
  }

  // Find vehicle with capacity (up to 14 seats)
  const vehicleId = await findOrCreateVehicleForBooking(db, data.lineId, date, seats);

  // Count existing seats for this vehicle to assign seat number
  const bookedCountRes = await db.prepare(
    `SELECT COUNT(*) as cnt FROM shuttle_bookings WHERE vehicle_id = ? AND booking_date = ? AND status != 'cancelled'`
  ).bind(vehicleId || 0, date).first<{ cnt: number }>();
  const seatNo = (bookedCountRes?.cnt || 0) + 1;

  const res = await db.prepare(`
    INSERT INTO shuttle_bookings (
      line_id, vehicle_id, booking_date, student_name, student_phone, gender,
      direction, seats_count, pickup_location, dropoff_location,
      payment_method, fare_amount, paid_status, status, notes, seat_no, boarded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, 0)
  `).bind(
    data.lineId,
    vehicleId,
    date,
    data.studentName,
    data.studentPhone,
    data.gender || 'all',
    data.direction || 'round',
    seats,
    data.pickupLocation || 'موقف العياط',
    data.dropoffLocation || 'بوابة الجامعة',
    paymentMethod,
    data.fareAmount || 60,
    paidStatus,
    data.notes || (paymentMethod === 'subscription' ? 'خصم من رصيد الاشتراك' : 'حجز عادي'),
    seatNo
  ).run();

  const bookingId = res.meta.last_row_id;
  const ticketCode = `EZZ-${1000 + bookingId}`;

  // Update ticket code
  await db.prepare('UPDATE shuttle_bookings SET ticket_code = ? WHERE id = ?').bind(ticketCode, bookingId).run();

  // Register or update client in clients table
  try {
    const line = await db.prepare('SELECT name FROM shuttle_lines WHERE id = ?').bind(data.lineId).first<{ name: string }>();
    await db.prepare(`
      INSERT INTO clients (phone, name, village, destination_fav, trips_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(phone) DO UPDATE SET 
        name = excluded.name,
        trips_count = trips_count + 1,
        destination_fav = excluded.destination_fav
    `).bind(
      data.studentPhone,
      data.studentName,
      data.pickupLocation || 'العياط',
      line?.name || 'جامعات مصر'
    ).run();
  } catch (e) {
    // Non-fatal if clients table sync fails
  }

  return { ok: true, bookingId, vehicleId, ticketCode };
}

export async function cancelShuttleBooking(db: D1Database, phone: string, date?: string): Promise<boolean> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const booking = await db.prepare(`
    SELECT * FROM shuttle_bookings 
    WHERE student_phone = ? AND booking_date = ? AND status != 'cancelled'
    ORDER BY id DESC LIMIT 1
  `).bind(phone, targetDate).first<ShuttleBooking>();

  if (!booking) return false;

  await db.prepare("UPDATE shuttle_bookings SET status = 'cancelled' WHERE id = ?").bind(booking.id).run();

  // If subscription, refund trip
  if (booking.payment_method === 'subscription') {
    await db.prepare(`
      UPDATE student_subscriptions 
      SET used_trips = MAX(0, used_trips - 1) 
      WHERE student_phone = ? AND line_id = ? AND status = 'active'
    `).bind(phone, booking.line_id).run();
  }

  return true;
}

export async function getStudentSubscriptions(db: D1Database): Promise<StudentSubscription[]> {
  const res = await db.prepare(`
    SELECT s.*, l.name as line_name
    FROM student_subscriptions s
    JOIN shuttle_lines l ON s.line_id = l.id
    ORDER BY s.id DESC
  `).all<StudentSubscription>();
  return res.results || [];
}

export async function generateDriverManifest(db: D1Database, vehicleId: number, date?: string): Promise<string> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const vehicle = await db.prepare(`
    SELECT v.*, l.name as line_name, l.departure_time, l.return_time
    FROM shuttle_vehicles v
    JOIN shuttle_lines l ON v.line_id = l.id
    WHERE v.id = ?
  `).bind(vehicleId).first<any>();

  if (!vehicle) return 'السيارة غير موجودة';

  const bookings = await db.prepare(`
    SELECT * FROM shuttle_bookings 
    WHERE vehicle_id = ? AND booking_date = ? AND status != 'cancelled'
    ORDER BY id ASC
  `).bind(vehicleId, targetDate).all<ShuttleBooking>();

  const list = bookings.results || [];
  let text = `📋 *كشف ركاب ${vehicle.vehicle_name}*\n`;
  text += `📅 التاريخ: ${targetDate}\n`;
  text += `🛣️ الخط: ${vehicle.line_name}\n`;
  text += `⏰ موعد الذهاب: ${vehicle.departure_time} | العودة: ${vehicle.return_time}\n`;
  text += `👤 السائق: ${vehicle.driver_name} (${vehicle.driver_phone})\n`;
  text += `👥 عدد الركاب: ${list.reduce((sum, b) => sum + b.seats_count, 0)} من أصل ${vehicle.seat_capacity}\n`;
  text += `────────────────────\n`;

  list.forEach((b, idx) => {
    const payLabel = b.payment_method === 'subscription' ? '✅ اشتراك' : (b.paid_status === 'paid' ? '💵 مسدد كاش' : '⏳ كاش عند الركوب');
    const dirLabel = b.direction === 'round' ? 'ذهاب وعودة' : (b.direction === 'one_way_go' ? 'ذهاب فقط' : 'عودة فقط');
    text += `${idx + 1}. *${b.student_name}* (${b.seats_count} مقعد) - ${dirLabel}\n`;
    text += `   📍 الركوب: ${b.pickup_location} ⬅️ ${b.dropoff_location}\n`;
    text += `   📞 ${b.student_phone} | ${payLabel}\n`;
  });

  text += `────────────────────\n`;
  text += `نتمنى لكم رحلة آمنة وموفقة! 🚕✨`;
  return text;
}

export async function getBookingByTicket(db: D1Database, ticketCodeOrPhone: string): Promise<ShuttleBooking | null> {
  const clean = ticketCodeOrPhone.trim();
  const res = await db.prepare(`
    SELECT b.*, l.name as line_name, l.departure_time, l.return_time,
           v.vehicle_name, v.plate_number, v.driver_name, v.driver_phone
    FROM shuttle_bookings b
    JOIN shuttle_lines l ON b.line_id = l.id
    LEFT JOIN shuttle_vehicles v ON b.vehicle_id = v.id
    WHERE b.ticket_code = ? OR b.student_phone = ? OR ('EZZ-' || (1000 + b.id)) = ?
    ORDER BY b.id DESC LIMIT 1
  `).bind(clean, clean, clean).first<ShuttleBooking>();

  return res || null;
}

export async function toggleBoarding(db: D1Database, bookingId: number, forcedState?: number): Promise<{ ok: boolean; boarded: number; boardedAt: string }> {
  const current = await db.prepare('SELECT boarded FROM shuttle_bookings WHERE id = ?').bind(bookingId).first<{ boarded: number }>();
  if (!current) {
    return { ok: false, boarded: 0, boardedAt: '' };
  }

  const newState = forcedState !== undefined ? forcedState : (current.boarded === 1 ? 0 : 1);
  const timeStr = newState === 1 ? new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

  await db.prepare('UPDATE shuttle_bookings SET boarded = ?, boarded_at = ? WHERE id = ?')
    .bind(newState, timeStr, bookingId)
    .run();

  return { ok: true, boarded: newState, boardedAt: timeStr };
}

export async function markBoardedByCodeOrPhone(db: D1Database, identifier: string): Promise<{ ok: boolean; booking?: ShuttleBooking; error?: string }> {
  const clean = identifier.trim();
  const today = new Date().toISOString().slice(0, 10);
  
  // Find booking
  const booking = await db.prepare(`
    SELECT b.*, l.name as line_name, v.vehicle_name, v.driver_name, v.driver_phone
    FROM shuttle_bookings b
    JOIN shuttle_lines l ON b.line_id = l.id
    LEFT JOIN shuttle_vehicles v ON b.vehicle_id = v.id
    WHERE (b.ticket_code = ? OR b.student_phone = ? OR ('EZZ-' || (1000 + b.id)) = ?)
      AND b.booking_date = ? AND b.status != 'cancelled'
    ORDER BY b.id DESC LIMIT 1
  `).bind(clean, clean, clean, today).first<ShuttleBooking>();

  if (!booking) {
    // Try any date for this ticket
    const anyBooking = await db.prepare(`
      SELECT b.*, l.name as line_name, v.vehicle_name, v.driver_name, v.driver_phone
      FROM shuttle_bookings b
      JOIN shuttle_lines l ON b.line_id = l.id
      LEFT JOIN shuttle_vehicles v ON b.vehicle_id = v.id
      WHERE (b.ticket_code = ? OR b.student_phone = ? OR ('EZZ-' || (1000 + b.id)) = ?)
        AND b.status != 'cancelled'
      ORDER BY b.id DESC LIMIT 1
    `).bind(clean, clean, clean).first<ShuttleBooking>();

    if (!anyBooking) {
      return { ok: false, error: 'لم يتم العثور على حجز نشط بهذا الكود أو الرقم' };
    }

    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    await db.prepare('UPDATE shuttle_bookings SET boarded = 1, boarded_at = ? WHERE id = ?').bind(timeStr, anyBooking.id).run();
    anyBooking.boarded = 1;
    anyBooking.boarded_at = timeStr;
    return { ok: true, booking: anyBooking };
  }

  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  await db.prepare('UPDATE shuttle_bookings SET boarded = 1, boarded_at = ? WHERE id = ?').bind(timeStr, booking.id).run();
  booking.boarded = 1;
  booking.boarded_at = timeStr;

  return { ok: true, booking };
}

export async function getClientsDirectory(db: D1Database): Promise<any[]> {
  const res = await db.prepare(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM shuttle_bookings b WHERE b.student_phone = c.phone) as shuttle_trips,
           (SELECT COUNT(*) FROM rides r WHERE r.client_phone = c.phone) as private_trips
    FROM clients c
    ORDER BY c.trips_count DESC, c.created_at DESC
  `).all<any>();

  return res.results || [];
}

export async function generateBookingsCsv(db: D1Database, targetDate?: string): Promise<string> {
  const date = targetDate || new Date().toISOString().slice(0, 10);
  
  const bookings = await db.prepare(`
    SELECT b.id, b.ticket_code, b.student_name, b.student_phone, b.booking_date,
           l.name as line_name, l.departure_time, l.return_time,
           b.pickup_location, b.dropoff_location, b.direction, b.seats_count,
           b.fare_amount, b.payment_method, b.paid_status,
           b.boarded, b.boarded_at, b.seat_no,
           v.vehicle_name, v.plate_number, v.driver_name, v.driver_phone
    FROM shuttle_bookings b
    JOIN shuttle_lines l ON b.line_id = l.id
    LEFT JOIN shuttle_vehicles v ON b.vehicle_id = v.id
    WHERE b.booking_date = ? AND b.status != 'cancelled'
    ORDER BY b.vehicle_id ASC, b.seat_no ASC, b.id ASC
  `).bind(date).all<any>();

  // UTF-8 BOM for Microsoft Excel Arabic support
  let csv = '\uFEFF';
  csv += 'كود التذكرة,اسم العميل / الطالب,رقم الموبايل,الجامعة / الخط,تاريخ المشوار,موعد التحرك,موعد العودة,مكان الركوب (العياط/القرية),نوع الحجز,رقم المقعد,الأجرة (جنيه),حالة الدفع,اسم السائق,موبايل السائق,السيارة,رقم اللوحة,حالة الحضور والركوب,وقت الركوب\n';

  for (const b of (bookings.results || [])) {
    const dir = b.direction === 'round' ? 'ذهاب وعودة' : (b.direction === 'one_way_go' ? 'ذهاب فقط' : 'عودة فقط');
    const boardedStatus = b.boarded === 1 ? '🟢 ركب وحضر' : '🔴 لم يركب بعد (في الانتظار)';
    const ticket = b.ticket_code || ('EZZ-' + (1000 + b.id));
    
    csv += `"${ticket}","${b.student_name}","${b.student_phone}","${b.line_name}","${b.booking_date}","${b.departure_time}","${b.return_time}","${b.pickup_location || 'العياط'}","${dir}","${b.seat_no || 1}","${b.fare_amount}","${b.paid_status === 'paid' ? 'مسدد' : 'عند الركوب'}","${b.driver_name || 'كابتن'}","${b.driver_phone || '—'}","${b.vehicle_name || '14 راكب'}","${b.plate_number || '—'}","${boardedStatus}","${b.boarded_at || '—'}"\n`;
  }

  return csv;
}

