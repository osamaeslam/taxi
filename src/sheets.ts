import type { D1Database } from '@cloudflare/workers-types';

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// ================================================================
// كود استقبال حجوزات كابتن عز في Google Sheets تلقائياً
// برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات
// ================================================================
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // إنشاء الترويسة الملونة تلقائياً إذا كان الشيت جديداً وفارغاً
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "وقت التسجيل",
        "النوع",
        "التاريخ",
        "رقم التذكرة",
        "اسم العميل / الطالب",
        "رقم الواتساب",
        "مكان الركوب (القرية)",
        "الوجهة / خط الجامعة",
        "الأجرة (جنيه)",
        "حالة الركوب / الحضور",
        "ملاحظات"
      ]);
      var headerRange = sheet.getRange(1, 1, 1, 11);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0e7c66");
      headerRange.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
    
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "لا توجد بيانات مستلمة" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var payload = JSON.parse(e.postData.contents);
    
    // 1. فحص الاتصال التجريبي (Ping)
    if (payload.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        message: "تم الاتصال بنجاح! شيت جوجل جاهز لاستقبال حجوزات كابتن عز 🚕"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. مزامنة دفعة كاملة (Batch Sync)
    if (payload.action === "batch" && Array.isArray(payload.rows)) {
      payload.rows.forEach(function(row) {
        sheet.appendRow(row);
      });
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        count: payload.rows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. إضافة صف حجز مفرد لحظي (Single Row Append)
    if (payload.row && Array.isArray(payload.row)) {
      sheet.appendRow(payload.row);
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true, ignored: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export async function getSheetsWebhookUrl(db: D1Database): Promise<string> {
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'google_sheets_webhook_url'").first<{ value: string }>();
    return row?.value || '';
  } catch {
    return '';
  }
}

export async function setSheetsWebhookUrl(db: D1Database, url: string): Promise<void> {
  await db.prepare(`
    INSERT INTO settings (key, value) VALUES ('google_sheets_webhook_url', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).bind(url.trim()).run();
}

export async function pushRowToGoogleSheets(
  db: D1Database,
  data: {
    type: string;
    date: string;
    ticketCode: string;
    name: string;
    phone: string;
    from: string;
    to: string;
    price: string | number;
    status: string;
    notes?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = await getSheetsWebhookUrl(db);
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { ok: false, error: 'لم يتم ضبط رابط Google Sheets Webhook بعد' };
  }

  const nowStr = new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
  const row = [
    nowStr,
    data.type,
    data.date,
    data.ticketCode,
    data.name,
    data.phone,
    data.from,
    data.to,
    data.price,
    data.status,
    data.notes || ''
  ];

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append', row }),
    });
    if (!res.ok) {
      return { ok: false, error: `Google Sheets responded with status ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.warn('[GoogleSheets] Failed to push row:', err);
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function testSheetsConnection(webhookUrl: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { ok: false, error: 'الرابط غير صالح. يجب أن يبدأ بـ https://' };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'ping' }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok && j.ok) {
      return { ok: true, message: j.message || 'تم الاتصال بنجاح بشيت جوجل!' };
    }
    return { ok: false, error: j.error || `خطأ استجابة (${res.status})` };
  } catch (e: any) {
    return { ok: false, error: 'تعذر الوصول للرابط: ' + (e?.message || e) };
  }
}

export async function syncAllBookingsAndRidesToSheets(db: D1Database): Promise<{ ok: boolean; count: number; error?: string }> {
  const webhookUrl = await getSheetsWebhookUrl(db);
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { ok: false, count: 0, error: 'لم يتم حفظ رابط Webhook في الإعدادات بعد' };
  }

  // 1. Shuttles
  const shuttles = await db.prepare(`
    SELECT b.*, l.name as line_name
    FROM shuttle_bookings b
    JOIN shuttle_lines l ON b.line_id = l.id
    ORDER BY b.id ASC
  `).all<any>();

  // 2. Rides
  const rides = await db.prepare(`
    SELECT r.*, d.name as driver_name
    FROM rides r
    LEFT JOIN drivers d ON r.driver_id = d.id
    ORDER BY r.id ASC
  `).all<any>();

  const rows: any[][] = [];

  for (const b of (shuttles.results || [])) {
    const statusText = b.boarded === 1 ? '🟢 ركب وحضر' : (b.status === 'cancelled' ? '❌ ملغي' : '🔴 في الانتظار');
    const createdStr = b.created_at ? new Date(b.created_at * 1000).toLocaleString('ar-EG') : b.booking_date;
    rows.push([
      createdStr,
      '🎓 باص جامعة',
      b.booking_date,
      b.ticket_code || ('EZZ-' + (1000 + b.id)),
      b.student_name,
      b.student_phone,
      b.pickup_location || 'العياط',
      b.line_name || 'جامعة',
      b.fare_amount || 60,
      statusText,
      b.notes || ''
    ]);
  }

  for (const r of (rides.results || [])) {
    const statusText = r.boarded === 1 ? '🟢 ركب وحضر' : (r.status === 'COMPLETED' ? '✅ تم المشوار' : (r.status === 'CANCELLED' ? '❌ ملغي' : '⏳ جاري/بانتظار'));
    rows.push([
      r.created_at || new Date().toLocaleString('ar-EG'),
      '🚗 مشوار خاص',
      (r.created_at || '').slice(0, 10),
      r.ticket_code || ('RIDE-' + (2000 + r.id)),
      r.client_name || 'عميل',
      r.client_phone,
      r.from_text || 'العياط',
      r.to_text || 'وجهة خاصة',
      r.final_price || r.price || r.client_offered_price || 0,
      statusText,
      (r.driver_name ? `كابتن: ${r.driver_name}` : '')
    ]);
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'batch', rows }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok && j.ok) {
      await db.prepare(`
        INSERT INTO settings (key, value) VALUES ('last_sheets_sync', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).bind(new Date().toISOString()).run();
      return { ok: true, count: rows.length };
    }
    return { ok: false, count: 0, error: j.error || `استجابة غير متوقعة (${res.status})` };
  } catch (e: any) {
    return { ok: false, count: 0, error: String(e?.message || e) };
  }
}
