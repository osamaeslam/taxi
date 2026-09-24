/**
 * صفحة التذكرة الذكية وصفحة الحجز العامة — منظومة كابتن عز
 * برمجة: أسامة بسيوني لتطوير المواقع والتطبيقات
 */

import type { ShuttleBooking } from './shuttle.js';

function escHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTicketHtml(booking: ShuttleBooking, hostUrl: string): string {
  const ticketCode = booking.ticket_code || ('EZZ-' + (1000 + booking.id));
  const isBoarded = booking.boarded === 1;
  const dirLabel = booking.direction === 'round' ? 'ذهاب وعودة 🔄' : (booking.direction === 'one_way_go' ? 'ذهاب فقط ➡️' : 'عودة فقط ⬅️');
  const payLabel = booking.payment_method === 'subscription' ? 'اشتراك شهري ✅' : (booking.paid_status === 'paid' ? 'مدفوع كاش 💵' : 'الدفع كاش عند الركوب ⏳');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>تذكرة كابتن عز الذكية — ${escHtml(ticketCode)}</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0e7c66">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="كابتن عز">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <style>
    :root {
      --primary: #0e7c66;
      --primary-dark: #095344;
      --accent: #f39c12;
      --bg: #f4f6f8;
      --card: #ffffff;
      --ink: #1f2937;
      --muted: #6b7280;
      --line: #e5e7eb;
      --green: #10b981;
      --green-bg: #ecfdf5;
      --red: #ef4444;
      --red-bg: #fef2f2;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Noto Naskh Arabic', sans-serif; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--ink); padding: 16px 12px; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
    .ticket-wrapper { width: 100%; max-width: 450px; margin: 0 auto; }
    
    .brand-bar { text-align: center; margin-bottom: 12px; }
    .brand-title { font-size: 20px; font-weight: 800; color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 6px; }
    .dev-badge { display: inline-block; font-size: 11px; background: #e6f4ea; color: #137333; padding: 3px 10px; border-radius: 20px; margin-top: 4px; font-weight: 600; border: 1px solid #ceead6; }

    .ticket-card { background: var(--card); border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid var(--line); position: relative; }
    
    .ticket-header { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #fff; padding: 20px; text-align: center; position: relative; }
    .ticket-type { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 6px; }
    .ticket-code { font-size: 26px; font-weight: 900; letter-spacing: 2px; }
    .seat-badge { background: var(--accent); color: #fff; padding: 3px 10px; border-radius: 8px; font-size: 13px; font-weight: bold; margin-top: 6px; display: inline-block; }

    .ticket-divider { position: relative; height: 24px; background: var(--card); display: flex; align-items: center; }
    .ticket-divider::before { content: ''; position: absolute; left: -12px; width: 24px; height: 24px; border-radius: 50%; background: var(--bg); border: 1px solid var(--line); }
    .ticket-divider::after { content: ''; position: absolute; right: -12px; width: 24px; height: 24px; border-radius: 50%; background: var(--bg); border: 1px solid var(--line); }
    .ticket-divider .dashed-line { width: 100%; border-top: 2px dashed #d1d5db; }

    .ticket-body { padding: 18px 20px; }
    
    /* حالة الحضور والركوب */
    .status-box { padding: 14px; border-radius: 12px; margin-bottom: 18px; text-align: center; transition: all 0.3s ease; }
    .status-box.boarded { background: var(--green-bg); border: 2px solid var(--green); color: #065f46; }
    .status-box.waiting { background: var(--red-bg); border: 2px solid var(--red); color: #991b1b; }
    .status-icon { font-size: 24px; margin-bottom: 4px; }
    .status-title { font-size: 16px; font-weight: 800; }
    .status-subtitle { font-size: 12px; opacity: 0.85; margin-top: 2px; }

    /* شبكة البيانات */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .info-item { background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6; }
    .info-label { font-size: 11px; color: var(--muted); margin-bottom: 3px; }
    .info-val { font-size: 14px; font-weight: 700; color: var(--ink); }

    .route-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
    .route-label { font-size: 11px; color: #166534; font-weight: bold; margin-bottom: 4px; }
    .route-val { font-size: 15px; font-weight: 800; color: #14532d; }

    /* بيانات السائق */
    .driver-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin-bottom: 18px; }
    .driver-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .driver-name { font-size: 15px; font-weight: bold; color: #1e40af; }
    .driver-car { font-size: 12px; color: #3b82f6; font-weight: 600; }
    .driver-actions { display: flex; gap: 8px; margin-top: 10px; }
    .driver-btn { flex: 1; text-align: center; text-decoration: none; padding: 8px; border-radius: 6px; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .btn-call { background: #2563eb; color: #fff; }
    .btn-wa { background: #16a34a; color: #fff; }

    /* زر الحضور والركوب الحي */
    .action-section { margin-top: 10px; text-align: center; }
    .board-btn { width: 100%; padding: 15px; border: 0; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
    .board-btn.to-board { background: #10b981; color: #fff; }
    .board-btn.to-board:hover { background: #059669; transform: translateY(-1px); }
    .board-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .barcode-area { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--line); }
    .barcode-strip { height: 40px; background: repeating-linear-gradient(90deg, #111, #111 2px, #fff 2px, #fff 4px, #111 4px, #111 7px, #fff 7px, #fff 9px); width: 80%; margin: 0 auto 6px; border-radius: 2px; }
    .barcode-text { font-size: 11px; font-family: monospace; color: var(--muted); letter-spacing: 2px; }

    .footer-dev { text-align: center; margin-top: 18px; font-size: 12px; color: var(--muted); line-height: 1.6; }
    .footer-dev strong { color: var(--ink); }
    
    @media print {
      body { background: #fff; padding: 0; }
      .ticket-wrapper { max-width: 100%; }
      .driver-actions, .action-section, .footer-dev button { display: none !important; }
      .ticket-card { box-shadow: none; border: 1px solid #000; }
    }
  </style>
</head>
<body>

<div class="ticket-wrapper">
  <div class="brand-bar">
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px;">
      <img src="/icon-192.png" alt="أيقونة كابتن عز" style="width:40px;height:40px;border-radius:10px;box-shadow:0 3px 8px rgba(0,0,0,0.2);border:1.5px solid #f59e0b;object-fit:cover;">
      <div class="brand-title">كابتن عز — تذكرة الركوب الذكية</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
      <div class="dev-badge">برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
      <button id="pwaTicketBtn" onclick="triggerPwaInstallTicket()" style="background:#f59e0b;color:#fff;border:0;padding:3px 12px;border-radius:15px;font-size:11px;font-weight:bold;cursor:pointer;display:inline-flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(245,158,11,0.3);">
        📲 تثبيت التطبيق
      </button>
    </div>
  </div>

  <div class="ticket-card" id="ticketCard">
    <div class="ticket-header">
      <div class="ticket-type">${escHtml(dirLabel)}</div>
      <div class="ticket-code">${escHtml(ticketCode)}</div>
      <div class="seat-badge">مقعد رقم #${booking.seat_no || 1} • سعة 14 راكب</div>
    </div>

    <div class="ticket-divider"><div class="dashed-line"></div></div>

    <div class="ticket-body">
      <!-- حالة الحضور والركوب -->
      <div id="statusBox" class="status-box ${isBoarded ? 'boarded' : 'waiting'}">
        <div class="status-icon">${isBoarded ? '🟢' : '🔴'}</div>
        <div class="status-title" id="statusTitle">${isBoarded ? 'تم الحضور والركوب ✅' : 'في الانتظار — لم تركب بعد'}</div>
        <div class="status-subtitle" id="statusSubtitle">
          ${isBoarded ? ('تم تأكيد صعودك الساعة ' + escHtml(booking.boarded_at || '')) : 'يرجى الضغط على زر الركوب فور صعودك الباص لإبلاغ الكابتن'}
        </div>
      </div>

      <!-- زر الحضور الفوري -->
      <div class="action-section">
        <button id="boardBtn" class="board-btn to-board" onclick="confirmBoarding()" ${isBoarded ? 'style="display:none;"' : ''}>
          <span>🟢 أنا ركبت الآن (تأكيد الحضور والركوب)</span>
        </button>
      </div>

      <!-- خط السير والوجهة -->
      <div class="route-box" style="margin-top: 14px;">
        <div class="route-label">🎓 خط السير والجامعة</div>
        <div class="route-val">${escHtml(booking.line_name || 'خط جامعات مصر')}</div>
      </div>

      <!-- بيانات الراكب والرحلة -->
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">👤 اسم الطالب / الراكب</div>
          <div class="info-val">${escHtml(booking.student_name)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">📞 رقم الهاتف</div>
          <div class="info-val" dir="ltr">${escHtml(booking.student_phone)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">📅 تاريخ المشوار</div>
          <div class="info-val">${escHtml(booking.booking_date)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">⏰ موعد التحرك</div>
          <div class="info-val">${escHtml(booking.departure_time || '06:15 ص')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">📍 نقطة الركوب</div>
          <div class="info-val">${escHtml(booking.pickup_location || 'موقف العياط')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">💵 الأجرة المقررة</div>
          <div class="info-val">${booking.fare_amount} جنيه (${escHtml(payLabel)})</div>
        </div>
      </div>

      <!-- بيانات السائق والسيارة -->
      <div class="driver-box">
        <div class="driver-header">
          <div>
            <div class="driver-name">👤 ${escHtml(booking.driver_name || 'كابتن الخط')}</div>
            <div class="driver-car">🚐 ${escHtml(booking.vehicle_name || 'تويوتا هايس 14 راكب')} ${booking.plate_number ? ('(' + escHtml(booking.plate_number) + ')') : ''}</div>
          </div>
        </div>
        <div class="driver-actions">
          <a href="tel:${escHtml(booking.driver_phone || '01011223344')}" class="driver-btn btn-call">📞 اتصال بالكابتن</a>
          <a href="https://wa.me/2${escHtml(booking.driver_phone || '01011223344')}?text=أهلاً+كابتن،+أنا+الراكب+${encodeURIComponent(booking.student_name)}+كود+${encodeURIComponent(ticketCode)}" target="_blank" class="driver-btn btn-wa">💬 واتساب الكابتن</a>
        </div>
      </div>

      <!-- باركود التذكرة -->
      <div class="barcode-area">
        <div class="barcode-strip"></div>
        <div class="barcode-text">* ${escHtml(ticketCode)} *</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px;">تذكرة إلكترونية معتمدة • منظومة كابتن عز</div>
      </div>
    </div>
  </div>

  <div class="footer-dev">
    <div>برمجة وتطوير: <strong>أسامة بسيوني لتطوير المواقع والتطبيقات</strong></div>
    <div style="margin-top:6px;display:flex;gap:8px;justify-content:center;">
      <button onclick="window.print()" style="background:#fff;border:1px solid #d1d5db;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;">🖨️ طباعة التذكرة</button>
      <button onclick="shareTicket()" style="background:var(--primary);color:#fff;border:0;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;">📤 مشاركة التذكرة عبر واتساب</button>
    </div>
  </div>
</div>

<script>
async function confirmBoarding() {
  const btn = document.getElementById('boardBtn');
  btn.disabled = true;
  btn.innerHTML = '⏳ جاري تأكيد الحضور...';
  
  try {
    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '${escHtml(ticketCode)}' })
    });
    const data = await res.json();
    if (data.ok) {
      const box = document.getElementById('statusBox');
      box.className = 'status-box boarded';
      document.getElementById('statusTitle').innerText = 'تم الحضور والركوب ✅';
      document.getElementById('statusSubtitle').innerText = 'تم تأكيد صعودك الساعة ' + (data.time || 'الآن') + ' — رحلة سعيدة وموفقة!';
      btn.style.display = 'none';
      alert('🎉 مرحباً بك يا ${escHtml(booking.student_name)}! تم تسجيل صعودك وركوبك بنجاح ونورت باص كابتن عز 🚕');
    } else {
      alert(data.error || 'حدث خطأ، يرجى إبلاغ الكابتن');
      btn.disabled = false;
      btn.innerHTML = '🟢 أنا ركبت الآن (تأكيد الحضور والركوب)';
    }
  } catch (err) {
    alert('تعذر الاتصال بالخادم، يرجى إبلاغ الكابتن شفوياً أو عبر واتساب');
    btn.disabled = false;
    btn.innerHTML = '🟢 أنا ركبت الآن (تأكيد الحضور والركوب)';
  }
}

function shareTicket() {
  const text = '🎫 *تذكرة كابتن عز الذكية*\\n' +
    '👤 الراكب: ${escHtml(booking.student_name)}\\n' +
    '🎓 الخط: ${escHtml(booking.line_name || '')}\\n' +
    '⏰ التحرك: ${escHtml(booking.departure_time || '06:15 ص')}\\n' +
    '🔖 كود التذكرة: ${escHtml(ticketCode)}\\n' +
    '🔗 رابط التذكرة المباشر:\\n' + window.location.href;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// PWA Service Worker & Install flow
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
let ticketPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ticketPwaPrompt = e;
});
function triggerPwaInstallTicket() {
  if (ticketPwaPrompt) {
    ticketPwaPrompt.prompt();
    ticketPwaPrompt = null;
  } else {
    alert('📱 لتثبيت التطبيق على هاتفك بدون علامة كروم:\\n1. اضغط على قائمة الثلاث نقاط (⋮) في المتصفح\\n2. اختر «تثبيت التطبيق» (Install App) أو «إضافة إلى الشاشة الرئيسية»');
  }
}
</script>

</body>
</html>`;
}

export function renderPublicBookingPage(lines: any[]): string {
  const lineOptions = lines.map(l => `<option value="${l.id}" data-round="${l.round_trip_price}" data-oneway="${l.one_way_price}">${escHtml(l.name)} (${l.departure_time})</option>`).join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>حجز باصات ومشاوير كابتن عز — العياط والجامعات</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0e7c66">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="كابتن عز">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <style>
    :root {
      --primary: #0e7c66;
      --primary-dark: #095344;
      --bg: #f8fafc;
      --card: #ffffff;
      --ink: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --accent: #f59e0b;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Noto Naskh Arabic', sans-serif; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--ink); padding: 16px 12px; min-height: 100vh; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 520px; }
    
    .brand-card { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #fff; border-radius: 16px; padding: 22px; text-align: center; margin-bottom: 16px; box-shadow: 0 8px 20px rgba(14,124,102,0.25); }
    .brand-card h1 { font-size: 24px; font-weight: 900; margin-bottom: 6px; }
    .brand-card p { font-size: 13px; opacity: 0.9; line-height: 1.5; }
    .dev-tag { display: inline-block; background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px; margin-top: 10px; font-weight: 600; }

    .form-card { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 22px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    input, select, textarea { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 10px; font-size: 14px; color: var(--ink); background: #fff; outline: none; transition: border-color 0.2s; }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); }

    .radio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .radio-card { border: 1.5px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; cursor: pointer; transition: all 0.2s; }
    .radio-card.active { border-color: var(--primary); background: #f0fdf4; }
    .radio-card input { display: none; }
    .radio-title { font-size: 14px; font-weight: 800; }
    .radio-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }

    .price-preview { background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 12px; text-align: center; margin: 16px 0; }
    .price-num { font-size: 24px; font-weight: 900; color: #065f46; }
    .price-lbl { font-size: 12px; color: #047857; font-weight: 600; }

    .submit-btn { width: 100%; background: var(--primary); color: #fff; padding: 14px; border: 0; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(14,124,102,0.3); transition: all 0.2s; }
    .submit-btn:hover { background: var(--primary-dark); }

    .villages-hint { font-size: 11px; color: var(--muted); margin-top: 4px; }
    
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>

<div class="container">
  <div class="brand-card">
    <div style="display:flex;justify-content:center;margin-bottom:10px;">
      <img src="/icon-192.png" alt="كابتن عز" style="width:62px;height:62px;border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,0.3);border:2px solid #f59e0b;object-fit:cover;">
    </div>
    <h1>كابتن عز — باصات الجامعات والمشاوير</h1>
    <p>منظومة حجز باصات وسيارات الجامعات المصرية والمشاوير الخاصة<br>خدمة مراكز العياط وقراها بأمان ودقة والتزام</p>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <div class="dev-tag">برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
      <button id="pwaBookingBtn" onclick="triggerBookingPwaInstall()" style="background:#f59e0b;color:#fff;border:0;padding:4px 12px;border-radius:15px;font-size:11px;font-weight:bold;cursor:pointer;display:inline-flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(245,158,11,0.3);">
        📲 تثبيت التطبيق
      </button>
    </div>
  </div>

  <!-- تبديل نوع الخدمة -->
  <div style="display:flex;gap:10px;margin-bottom:16px;">
    <a href="/book" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:12px;font-weight:bold;font-size:14px;background:var(--primary);color:#fff;box-shadow:0 3px 8px rgba(14,124,102,0.3);border:2px solid var(--primary);display:flex;align-items:center;justify-content:center;gap:6px;">
      <span>🎓</span>
      <span>باصات الجامعات (14 راكب)</span>
    </a>
    <a href="/ride" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:12px;font-weight:bold;font-size:14px;background:var(--card);color:#2563eb;border:2px solid #93c5fd;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 5px rgba(0,0,0,0.04);">
      <span>🚗</span>
      <span>طلب مشوار خاص / تاكسي</span>
    </a>
  </div>

  <div class="form-card">
    <form id="bookingForm" onsubmit="return submitBooking(event)">
      <div class="form-group">
        <label>👤 اسم الطالب / العميل ثلاثي *</label>
        <input type="text" id="student_name" placeholder="مثال: أحمد محمود العياطي" required>
      </div>

      <div class="form-group">
        <label>📱 رقم الموبايل (واتساب) *</label>
        <input type="tel" id="student_phone" placeholder="010XXXXXXXX" dir="ltr" required>
      </div>

      <div class="form-group">
        <label>📍 القرية / نقطة الركوب بالعياط *</label>
        <input type="text" id="pickup_location" placeholder="مثال: موقف العياط / كوبري البليدة / المتانيا" required>
        <div class="villages-hint">نغطي: العياط، البليدة، المتانيا، برنشت، طهما، ميت القائد، كفر عمار، كفر شحاتة، بهبيت، جرزا...</div>
      </div>

      <div class="form-group">
        <label>🎓 خط الجامعة / الوجهة المطلوبة *</label>
        <select id="line_id" onchange="updatePrice()" required>
          ${lineOptions}
        </select>
      </div>

      <div class="form-group">
        <label>نوع الرحلة *</label>
        <div class="radio-grid">
          <div class="radio-card active" id="cardRound" onclick="setDirection('round')">
            <input type="radio" name="direction" value="round" checked>
            <div class="radio-title">ذهاب وعودة 🔄</div>
            <div class="radio-desc">رحلة كاملة مع العودة</div>
          </div>
          <div class="radio-card" id="cardGo" onclick="setDirection('one_way_go')">
            <input type="radio" name="direction" value="one_way_go">
            <div class="radio-title">ذهاب فقط ➡️</div>
            <div class="radio-desc">توصيل للجامعة فقط</div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>📅 تاريخ المشوار</label>
        <input type="date" id="booking_date" value="${new Date().toISOString().slice(0, 10)}">
      </div>

      <div class="form-group">
        <label>ملاحظات إضافية</label>
        <input type="text" id="notes" placeholder="مثال: طلب مقعد أمامي / باص بنات">
      </div>

      <div class="price-preview">
        <div class="price-lbl">الأجرة المقررة للتذكرة</div>
        <div class="price-num" id="priceDisplay">60 جنيه</div>
        <div class="price-lbl" style="font-size:11px;color:#047857;margin-top:2px;">الدفع كاش عند الركوب أو اشتراك شهري</div>
      </div>

      <button type="submit" id="submitBtn" class="submit-btn">
        <span>🎫 تأكيد الحجز واستخراج التذكرة الذكية</span>
      </button>
    </form>
  </div>

  <div class="footer">
    <div>منظومة كابتن عز لنقل الطلاب والمشاوير 🇪🇬</div>
    <div style="font-weight:600;color:#334155;margin-top:3px;">برمجة: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
  </div>
</div>

<script>
let currentDir = 'round';

function setDirection(dir) {
  currentDir = dir;
  document.getElementById('cardRound').className = 'radio-card ' + (dir === 'round' ? 'active' : '');
  document.getElementById('cardGo').className = 'radio-card ' + (dir === 'one_way_go' ? 'active' : '');
  updatePrice();
}

function updatePrice() {
  const sel = document.getElementById('line_id');
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const roundPrice = opt.getAttribute('data-round') || 60;
  const onewayPrice = opt.getAttribute('data-oneway') || 35;
  const p = currentDir === 'round' ? roundPrice : onewayPrice;
  document.getElementById('priceDisplay').innerText = p + ' جنيه';
}
updatePrice();

async function submitBooking(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '⏳ جاري إصدار التذكرة وحفظ المقعد...';

  const payload = {
    studentName: document.getElementById('student_name').value.trim(),
    studentPhone: document.getElementById('student_phone').value.trim(),
    pickupLocation: document.getElementById('pickup_location').value.trim(),
    lineId: Number(document.getElementById('line_id').value),
    direction: currentDir,
    bookingDate: document.getElementById('booking_date').value,
    notes: document.getElementById('notes').value.trim()
  };

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok && data.ticketCode) {
      window.location.href = '/ticket/' + data.ticketCode;
    } else {
      alert(data.error || 'حدث خطأ في الحجز');
      btn.disabled = false;
      btn.innerHTML = '🎫 تأكيد الحجز واستخراج التذكرة الذكية';
    }
  } catch (err) {
    alert('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    btn.disabled = false;
    btn.innerHTML = '🎫 تأكيد الحجز واستخراج التذكرة الذكية';
  }
  return false;
}

// PWA Service Worker & Install flow
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
let bookingPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  bookingPwaPrompt = e;
});
function triggerBookingPwaInstall() {
  if (bookingPwaPrompt) {
    bookingPwaPrompt.prompt();
    bookingPwaPrompt = null;
  } else {
    alert('📱 لتثبيت التطبيق على هاتفك بدون علامة كروم:\n1. اضغط على قائمة الثلاث نقاط (⋮) في أعلى المتصفح\n2. اختر «تثبيت التطبيق» (Install App) أو «إضافة إلى الشاشة الرئيسية»');
  }
}
</script>

</body>
</html>`;
}

export function renderPrivateRideBookingPage(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>حجز مشوار خاص وتوصيل — كابتن عز العياط</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#2563eb">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="كابتن عز">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --bg: #f8fafc;
      --card: #ffffff;
      --ink: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --accent: #f59e0b;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Noto Naskh Arabic', sans-serif; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--ink); padding: 16px 12px; min-height: 100vh; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 520px; }
    
    .brand-card { background: linear-gradient(135deg, #1e40af, #2563eb); color: #fff; border-radius: 16px; padding: 22px; text-align: center; margin-bottom: 16px; box-shadow: 0 8px 20px rgba(37,99,235,0.25); }
    .brand-card h1 { font-size: 24px; font-weight: 900; margin-bottom: 6px; }
    .brand-card p { font-size: 13px; opacity: 0.9; line-height: 1.5; }
    .dev-tag { display: inline-block; background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px; margin-top: 10px; font-weight: 600; }

    .form-card { background: var(--card); border-radius: 16px; border: 1px solid var(--border); padding: 22px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    input, select, textarea { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 10px; font-size: 14px; color: var(--ink); background: #fff; outline: none; transition: border-color 0.2s; }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); }

    .car-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .car-card { border: 1.5px solid var(--border); border-radius: 10px; padding: 10px 6px; text-align: center; cursor: pointer; transition: all 0.2s; }
    .car-card.active { border-color: var(--primary); background: #eff6ff; }
    .car-icon { font-size: 22px; margin-bottom: 4px; }
    .car-name { font-size: 13px; font-weight: 800; }
    .car-desc { font-size: 10px; color: var(--muted); }

    .submit-btn { width: 100%; background: var(--primary); color: #fff; padding: 14px; border: 0; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: all 0.2s; }
    .submit-btn:hover { background: var(--primary-dark); }

    .villages-hint { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>

<div class="container">
  <div class="brand-card">
    <div style="display:flex;justify-content:center;margin-bottom:10px;">
      <img src="/icon-192.png" alt="كابتن عز" style="width:62px;height:62px;border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,0.3);border:2px solid #f59e0b;object-fit:cover;">
    </div>
    <h1>كابتن عز — طلب مشوار خاص وتاكسي</h1>
    <p>سيارات ملاكي حديثة وتاكسي وفان عائلي في خدمتك 24 ساعة<br>توصيل آمن وسريع من وإلى العياط وقراها والقاهرة والجيزة</p>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <div class="dev-tag">برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
    </div>
  </div>

  <!-- تبديل نوع الخدمة -->
  <div style="display:flex;gap:10px;margin-bottom:16px;">
    <a href="/book" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:12px;font-weight:bold;font-size:14px;background:var(--card);color:#0e7c66;border:2px solid #a7f3d0;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 5px rgba(0,0,0,0.04);">
      <span>🎓</span>
      <span>باصات الجامعات (14 راكب)</span>
    </a>
    <a href="/ride" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:12px;font-weight:bold;font-size:14px;background:var(--primary);color:#fff;box-shadow:0 3px 8px rgba(37,99,235,0.3);border:2px solid var(--primary);display:flex;align-items:center;justify-content:center;gap:6px;">
      <span>🚗</span>
      <span>طلب مشوار خاص / تاكسي</span>
    </a>
  </div>

  <div class="form-card">
    <form id="rideBookingForm" onsubmit="return submitRideBooking(event)">
      <div class="form-group">
        <label>👤 اسم العميل ثلاثي *</label>
        <input type="text" id="client_name" placeholder="مثال: محمود عبد الفتاح" required>
      </div>

      <div class="form-group">
        <label>📱 رقم الموبايل (واتساب) *</label>
        <input type="tel" id="client_phone" placeholder="010XXXXXXXX" dir="ltr" required>
      </div>

      <div class="form-group">
        <label>📍 مكان الركوب (العياط أو القرية) *</label>
        <input type="text" id="pickup_location" placeholder="مثال: العياط البلد / برنشت / كوبري البليدة" required>
        <div class="villages-hint">نغطي: العياط، برنشت، البليدة، المتانيا، طهما، ميت القائد، كفر شحاتة، جرزا، باجة...</div>
      </div>

      <div class="form-group">
        <label>🏁 مكان التوصيل / النزول المطلوب *</label>
        <input type="text" id="dropoff_location" placeholder="مثال: المهندسين / المعادي / 6 أكتوبر / مستشفى / مطار القاهرة" required>
      </div>

      <div class="form-group">
        <label>🚗 نوع السيارة المفضلة *</label>
        <div class="car-grid">
          <div class="car-card active" id="carModern" onclick="setCarType('ملاكي حديث مكيف')">
            <div class="car-icon">🚗</div>
            <div class="car-name">ملاكي حديث</div>
            <div class="car-desc">مكيف 4 ركاب</div>
          </div>
          <div class="car-card" id="carTaxi" onclick="setCarType('تاكسي العياط')">
            <div class="car-icon">🚕</div>
            <div class="car-name">تاكسي</div>
            <div class="car-desc">مشوار اقتصادي</div>
          </div>
          <div class="car-card" id="carVan" onclick="setCarType('فان عائلي 7-14 راكب')">
            <div class="car-icon">🚐</div>
            <div class="car-name">فان عائلي</div>
            <div class="car-desc">مشاوير ومناسبات</div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>⏰ توقيت المشوار *</label>
        <div style="display:flex;gap:10px;">
          <select id="ride_time_mode" onchange="toggleTimeInput()">
            <option value="now">⚡ فوري الآن (أقرب كابتن)</option>
            <option value="scheduled">📅 حجز موعد لاحق محدد</option>
          </select>
        </div>
        <div id="scheduledTimeBox" style="display:none;margin-top:8px;">
          <input type="datetime-local" id="scheduled_datetime">
        </div>
      </div>

      <div class="form-group">
        <label>💰 السعر المقدر / ميزانيتك المقترحة (اختياري)</label>
        <input type="number" id="offered_price" placeholder="مثال: 200 (جنيه)">
        <div style="margin-top:6px;">
          <div style="font-size:12px;font-weight:bold;color:#334155;margin-bottom:4px;">🏷️ أو اختر من تسعيرة فئات المناطق الرسمية:</div>
          <div id="zonePricingChips" style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" onclick="setOfferedPrice(40)" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 9px;border-radius:8px;font-size:12px;cursor:pointer;">🏙️ داخل العياط: 40ج</button>
            <button type="button" onclick="setOfferedPrice(70)" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 9px;border-radius:8px;font-size:12px;cursor:pointer;">🌾 منطقة ريفية: 70ج</button>
            <button type="button" onclick="setOfferedPrice(240)" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 9px;border-radius:8px;font-size:12px;cursor:pointer;">🚗 مدينة: 240ج</button>
            <button type="button" onclick="setOfferedPrice(550)" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 9px;border-radius:8px;font-size:12px;cursor:pointer;">✈️ مطار القاهرة: 550ج</button>
            <button type="button" onclick="setOfferedPrice(450)" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 9px;border-radius:8px;font-size:12px;cursor:pointer;">👑 مشوار خاص: 450ج</button>
          </div>
        </div>
        <div class="villages-hint" style="margin-top:6px;">يمكنك اقتراح سعرك وسيقوم الكابتن بالتأكيد أو التفاوض معك فوراً عبر واتساب.</div>
      </div>

      <div class="form-group">
        <label>📝 ملاحظات إضافية للكابتن</label>
        <input type="text" id="notes" placeholder="مثال: وجود حقائب سفر / طلب تكييف">
      </div>

      <button type="submit" id="submitRideBtn" class="submit-btn">
        <span>🚗 تأكيد طلب المشوار واستخراج التذكرة</span>
      </button>
    </form>
  </div>

  <div class="footer">
    <div>منظومة كابتن عز لخدمات النقل الذكي والمشاوير 🇪🇬</div>
    <div style="font-weight:600;color:#334155;margin-top:3px;">برمجة: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
  </div>
</div>

<script>
let selectedCarType = 'ملاكي حديث مكيف';

function setCarType(type) {
  selectedCarType = type;
  document.getElementById('carModern').className = 'car-card ' + (type.includes('ملاكي') ? 'active' : '');
  document.getElementById('carTaxi').className = 'car-card ' + (type.includes('تاكسي') ? 'active' : '');
  document.getElementById('carVan').className = 'car-card ' + (type.includes('فان') ? 'active' : '');
}

function setOfferedPrice(price) {
  const inp = document.getElementById('offered_price');
  if (inp) {
    inp.value = price;
    inp.focus();
  }
}

// Fetch dynamic zone pricing from server
async function loadDynamicZoneChips() {
  try {
    const res = await fetch('/api/zone-pricing');
    const data = await res.json();
    if (data.ok && Array.isArray(data.zones) && data.zones.length > 0) {
      const container = document.getElementById('zonePricingChips');
      if (container) {
        container.innerHTML = data.zones.map(z => 
          \`<button type="button" onclick="setOfferedPrice(\${z.base_price})" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 9px;border-radius:8px;font-size:12px;cursor:pointer;">\${z.icon || '📍'} \${z.name}: \${z.base_price}ج</button>\`
        ).join('');
      }
    }
  } catch (e) {}
}
loadDynamicZoneChips();

function toggleTimeInput() {
  const mode = document.getElementById('ride_time_mode').value;
  document.getElementById('scheduledTimeBox').style.display = mode === 'scheduled' ? 'block' : 'none';
}

async function submitRideBooking(e) {
  e.preventDefault();
  const btn = document.getElementById('submitRideBtn');
  btn.disabled = true;
  btn.innerHTML = '⏳ جاري تسجيل المشوار وتعيين الكود...';

  const timeMode = document.getElementById('ride_time_mode').value;
  const scheduledTime = timeMode === 'scheduled' ? document.getElementById('scheduled_datetime').value : 'فوري الآن';

  const payload = {
    clientName: document.getElementById('client_name').value.trim(),
    clientPhone: document.getElementById('client_phone').value.trim(),
    pickupLocation: document.getElementById('pickup_location').value.trim(),
    dropoffLocation: document.getElementById('dropoff_location').value.trim(),
    carType: selectedCarType,
    rideTime: scheduledTime,
    offeredPrice: Number(document.getElementById('offered_price').value) || undefined,
    notes: document.getElementById('notes').value.trim()
  };

  try {
    const res = await fetch('/api/book-ride', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok && data.ticketCode) {
      window.location.href = '/ticket/' + data.ticketCode;
    } else {
      alert(data.error || 'حدث خطأ أثناء تسجيل المشوار');
      btn.disabled = false;
      btn.innerHTML = '🚗 تأكيد طلب المشوار واستخراج التذكرة';
    }
  } catch (err) {
    alert('تعذر الاتصال بالخادم، يرجى المحاولة ثانية');
    btn.disabled = false;
    btn.innerHTML = '🚗 تأكيد طلب المشوار واستخراج التذكرة';
  }
  return false;
}
</script>

</body>
</html>`;
}

export function renderRideTicketHtml(ride: any, hostUrl: string): string {
  const ticketCode = ride.ticket_code || ('RIDE-' + (2000 + ride.id));
  const isBoarded = ride.boarded === 1;
  const priceDisplay = (ride.final_price || ride.price || ride.client_offered_price) ? `${ride.final_price || ride.price || ride.client_offered_price} جنيه` : 'قيد التفاوض والاتفاق';

  const statusMap: Record<string, { label: string; bg: string; color: string; desc: string }> = {
    'NEW': { label: '⏳ بانتظار الكابتن', bg: '#fef3c7', color: '#92400e', desc: 'تم استلام طلبك وجاري إبلاغ كباتن العياط' },
    'DISPATCHING': { label: '📡 جاري تعيين أقرب كابتن', bg: '#e0f2fe', color: '#0369a1', desc: 'يتم الآن مطابقة أقرب سيارة لموقعك' },
    'ASSIGNED': { label: '🚗 الكابتن في الطريق إليك', bg: '#ecfdf5', color: '#065f46', desc: 'تم قبول المشوار من الكابتن وهو متوجه لموقعك' },
    'ARRIVED': { label: '📍 الكابتن وصل لنقطة الركوب', bg: '#f0fdf4', color: '#15803d', desc: 'الكابتن بانتظارك الآن، يرجى الصعود للسيارة' },
    'IN_RIDE': { label: '🛣️ المشوار جاري حالياً', bg: '#eff6ff', color: '#1d4ed8', desc: 'نتمنى لك رحلة سعيدة وآمنة' },
    'COMPLETED': { label: '✅ تم الوصول والمشوار بنجاح', bg: '#dcfce7', color: '#166534', desc: 'شكراً لاختيارك كابتن عز' },
    'CANCELLED': { label: '❌ المشوار ملغي', bg: '#fee2e2', color: '#991b1b', desc: 'تم إلغاء هذا المشوار' }
  };

  const currentSt = statusMap[ride.status] || { label: ride.status, bg: '#f1f5f9', color: '#334155', desc: '' };

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>تذكرة مشوار خاص — ${escHtml(ticketCode)}</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#1e40af">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <style>
    :root {
      --primary: #1e40af;
      --accent: #f59e0b;
      --bg: #f8fafc;
      --card: #ffffff;
      --ink: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --green: #10b981;
      --green-bg: #ecfdf5;
      --red: #ef4444;
      --red-bg: #fef2f2;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Noto Naskh Arabic', sans-serif; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--ink); padding: 16px 12px; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
    .ticket-wrapper { width: 100%; max-width: 460px; margin: 0 auto; }
    
    .brand-bar { text-align: center; margin-bottom: 12px; }
    .brand-title { font-size: 20px; font-weight: 800; color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 6px; }
    .dev-badge { display: inline-block; font-size: 11px; background: #eff6ff; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; margin-top: 4px; font-weight: 600; border: 1px solid #bfdbfe; }

    .ticket-card { background: var(--card); border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid var(--border); }
    
    .ticket-header { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; padding: 20px; text-align: center; }
    .ticket-type { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 6px; }
    .ticket-code { font-size: 26px; font-weight: 900; letter-spacing: 2px; }

    .ticket-divider { position: relative; height: 24px; background: var(--card); display: flex; align-items: center; }
    .ticket-divider::before { content: ''; position: absolute; left: -12px; width: 24px; height: 24px; border-radius: 50%; background: var(--bg); border: 1px solid var(--border); }
    .ticket-divider::after { content: ''; position: absolute; right: -12px; width: 24px; height: 24px; border-radius: 50%; background: var(--bg); border: 1px solid var(--border); }
    .ticket-divider .dashed-line { width: 100%; border-top: 2px dashed #cbd5e1; }

    .ticket-body { padding: 18px 20px; }
    
    .status-banner { padding: 14px; border-radius: 12px; text-align: center; margin-bottom: 16px; background: ${currentSt.bg}; color: ${currentSt.color}; border: 1.5px solid ${currentSt.color}33; }
    .status-title { font-size: 16px; font-weight: 800; }
    .status-desc { font-size: 12px; margin-top: 3px; opacity: 0.9; }

    .board-status { padding: 12px; border-radius: 10px; margin-bottom: 16px; text-align: center; }
    .board-status.boarded { background: var(--green-bg); color: #065f46; border: 2px solid var(--green); }
    .board-status.waiting { background: #fffbeb; color: #92400e; border: 2px solid #f59e0b; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .info-item { background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #f1f5f9; }
    .info-label { font-size: 11px; color: var(--muted); margin-bottom: 3px; }
    .info-val { font-size: 14px; font-weight: 700; color: var(--ink); }

    .route-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
    .route-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .route-row:last-child { margin-bottom: 0; }
    .route-pin { font-size: 16px; }
    .route-text { font-size: 14px; font-weight: 800; color: #1e3a8a; }

    .driver-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
    .driver-name { font-size: 15px; font-weight: bold; color: #14532d; }
    .driver-car { font-size: 12px; color: #166534; margin-top: 2px; }
    .driver-btns { display: flex; gap: 8px; margin-top: 10px; }
    .driver-btn { flex: 1; text-align: center; text-decoration: none; padding: 8px; border-radius: 6px; font-size: 13px; font-weight: bold; color: #fff; }

    .action-btn { width: 100%; padding: 14px; border: 0; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
    .btn-green { background: #10b981; color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
    .btn-wa { background: #16a34a; color: #fff; }

    .footer-dev { text-align: center; margin-top: 16px; font-size: 12px; color: var(--muted); line-height: 1.6; }
  </style>
</head>
<body>

<div class="ticket-wrapper">
  <div class="brand-bar">
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px;">
      <img src="/icon-192.png" alt="كابتن عز" style="width:40px;height:40px;border-radius:10px;box-shadow:0 3px 8px rgba(0,0,0,0.2);border:1.5px solid #f59e0b;object-fit:cover;">
      <div class="brand-title">كابتن عز — تذكرة المشوار الخاص</div>
    </div>
    <div class="dev-badge">برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
  </div>

  <div class="ticket-card">
    <div class="ticket-header">
      <div class="ticket-type">مشوار خاص / تاكسي العياط 🚗</div>
      <div class="ticket-code">${escHtml(ticketCode)}</div>
    </div>

    <div class="ticket-divider"><div class="dashed-line"></div></div>

    <div class="ticket-body">
      <!-- حالة المشوار والتفاوض -->
      <div class="status-banner">
        <div class="status-title">${currentSt.label}</div>
        <div class="status-desc">${currentSt.desc}</div>
      </div>

      <!-- حالة الحضور والركوب -->
      <div class="board-status ${isBoarded ? 'boarded' : 'waiting'}">
        <div style="font-weight:800;font-size:15px;">
          ${isBoarded ? '🟢 تم تأكيد الركوب (أنت داخل السيارة الآن)' : '⏳ لم تركب بعد (اضغط بالأسفل عند ركوبك)'}
        </div>
        ${ride.boarded_at ? `<div style="font-size:12px;margin-top:2px;">وقت الركوب: ${escHtml(ride.boarded_at)}</div>` : ''}
      </div>

      <!-- مسار المشوار -->
      <div class="route-box">
        <div class="route-row">
          <span class="route-pin">🟢</span>
          <div>
            <div style="font-size:10px;color:var(--muted);">نقطة الركوب (العياط):</div>
            <div class="route-text">${escHtml(ride.from_text || 'العياط')}</div>
          </div>
        </div>
        <div style="border-right: 2px dashed #93c5fd; margin: 4px 10px; height: 14px;"></div>
        <div class="route-row">
          <span class="route-pin">🏁</span>
          <div>
            <div style="font-size:10px;color:var(--muted);">مكان التوصيل / النزول:</div>
            <div class="route-text">${escHtml(ride.to_text || 'وجهة خاصة')}</div>
          </div>
        </div>
      </div>

      <!-- بيانات المشوار والعميل -->
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">👤 العميل:</div>
          <div class="info-val">${escHtml(ride.client_name || 'عميل')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">📱 رقم الواتساب:</div>
          <div class="info-val" dir="ltr">${escHtml(ride.client_phone || '')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">💰 الأجرة المقررة:</div>
          <div class="info-val" style="color:#059669;">${escHtml(priceDisplay)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">📅 وقت الطلب:</div>
          <div class="info-val">${escHtml((ride.created_at || '').slice(11, 16) || 'الآن')}</div>
        </div>
      </div>

      <!-- بيانات الكابتن إن وجد -->
      ${ride.driver_name ? `
      <div class="driver-box">
        <div class="driver-name">🚗 الكابتن: ${escHtml(ride.driver_name)}</div>
        <div class="driver-car">${escHtml(ride.driver_car || 'سيارة ملاكي')} ${ride.driver_plate ? `(${escHtml(ride.driver_plate)})` : ''}</div>
        <div class="driver-btns">
          ${ride.driver_phone ? `<a href="tel:${escHtml(ride.driver_phone)}" class="driver-btn" style="background:#2563eb;">📞 اتصال هاتفي</a>` : ''}
          ${ride.driver_phone ? `<a href="https://wa.me/20${escHtml(ride.driver_phone).replace(/^0/, '')}" target="_blank" class="driver-btn" style="background:#16a34a;">💬 محادثة واتساب</a>` : ''}
        </div>
      </div>
      ` : `
      <div style="background:#fef3c7;border:1px solid #fde68a;padding:10px;border-radius:10px;text-align:center;font-size:12px;color:#92400e;margin-bottom:16px;">
        🔍 جاري التنسيق مع أقرب كابتن متواجد بالعياط لطلبك، ستصلك رسالة باسمه ورقمه فوراً.
      </div>
      `}

      <!-- أزرار العمليات -->
      ${!isBoarded ? `
      <button id="boardBtn" class="action-btn btn-green" onclick="confirmRideBoarding('${escHtml(ticketCode)}')">
        <span>🟢 أنا ركبت الآن (تأكيد الركوب)</span>
      </button>
      ` : ''}

      <button class="action-btn btn-wa" onclick="shareRideTicket()">
        <span>💬 مشاركة التذكرة عبر WhatsApp</span>
      </button>

      <a href="/ride" style="display:block;text-align:center;font-size:13px;color:var(--primary);text-decoration:none;margin-top:10px;font-weight:bold;">
        ⬅️ طلب مشوار خاص جديد
      </a>
    </div>
  </div>

  <div class="footer-dev">
    <div>منظومة كابتن عز لخدمات النقل الذكي والمشاوير 🚕</div>
    <div>برمجة وتطوير: <strong>أسامة بسيوني لتطوير المواقع والتطبيقات</strong></div>
  </div>
</div>

<script>
async function confirmRideBoarding(code) {
  const btn = document.getElementById('boardBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ جاري التسجيل...';
  }
  try {
    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code })
    });
    const data = await res.json();
    if (data.ok) {
      alert('🎉 تم تأكيد ركوبك بنجاح! رحلة موفقة وآمنة.');
      location.reload();
    } else {
      alert(data.error || 'فشل تسجيل الحضور');
      if (btn) { btn.disabled = false; btn.innerText = '🟢 أنا ركبت الآن (تأكيد الركوب)'; }
    }
  } catch (err) {
    alert('تعذر الاتصال بالخادم، يرجى إبلاغ الكابتن');
    if (btn) { btn.disabled = false; btn.innerText = '🟢 أنا ركبت الآن (تأكيد الركوب)'; }
  }
}

function shareRideTicket() {
  const text = '🎫 *تذكرة مشوار خاص — كابتن عز*\\n' +
    '👤 العميل: ${escHtml(ride.client_name || 'عميل')}\\n' +
    '📍 من: ${escHtml(ride.from_text || 'العياط')}\\n' +
    '🏁 إلى: ${escHtml(ride.to_text || '—')}\\n' +
    '🔖 كود المشوار: ${escHtml(ticketCode)}\\n' +
    '🔗 رابط متابعة المشوار:\\n' + window.location.href;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}
</script>

</body>
</html>`;
}

export function renderDriverAttendanceHtml(
  vehicle: any | null,
  allVehicles: any[],
  bookings: any[],
  targetDate: string,
  hostUrl: string
): string {
  const vName = vehicle?.vehicle_name || 'باص كابتن عز';
  const driverName = vehicle?.driver_name || 'الكابتن';
  const driverPhone = vehicle?.driver_phone || '';
  const plate = vehicle?.plate_number || '';
  const lineName = vehicle?.line_name || 'خط الجامعة';
  const departure = vehicle?.departure_time || '06:15 ص';
  const capacity = vehicle?.seat_capacity || 14;

  const total = bookings.length;
  const boarded = bookings.filter((b) => b.boarded === 1).length;
  const waiting = total - boarded;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>كشف ركاب ${escHtml(driverName)} — كابتن عز</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0e7c66">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <style>
    :root {
      --primary: #0e7c66;
      --primary-dark: #095344;
      --accent: #f59e0b;
      --bg: #f8fafc;
      --card: #ffffff;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --green: #10b981;
      --green-bg: #ecfdf5;
      --red: #ef4444;
      --red-bg: #fef2f2;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', sans-serif; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--ink); padding: 12px; padding-bottom: 70px; min-height: 100vh; }
    .container { max-width: 520px; margin: 0 auto; }
    
    .top-header { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #fff; border-radius: 16px; padding: 16px 18px; margin-bottom: 14px; box-shadow: 0 4px 15px rgba(14,124,102,0.2); }
    .top-title { font-size: 18px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; }
    .sub-info { font-size: 13px; opacity: 0.9; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 6px; font-size: 12px; }

    .bus-selector { margin-bottom: 14px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
    .bus-selector select { flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); font-size: 14px; font-weight: bold; color: var(--ink); outline: none; background: #f8fafc; }

    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 10px; text-align: center; border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .stat-card .num { font-size: 22px; font-weight: 900; }
    .stat-card .lbl { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; }
    .stat-green { border-top: 3px solid var(--green); background: var(--green-bg); }
    .stat-green .num { color: #065f46; }
    .stat-red { border-top: 3px solid var(--red); background: var(--red-bg); }
    .stat-red .num { color: #991b1b; }
    .stat-all { border-top: 3px solid var(--primary); }

    .search-box { margin-bottom: 12px; }
    .search-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--line); font-size: 14px; outline: none; background: #fff; }
    .search-input:focus { border-color: var(--primary); }

    .card { background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px; border: 1.5px solid var(--line); box-shadow: 0 2px 6px rgba(0,0,0,0.03); position: relative; transition: all 0.2s; }
    .card.is-boarded { border-color: #6ee7b7; background: #f0fdf4; }
    .card.is-waiting { border-color: #fca5a5; background: #fff; }

    .card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .p-name { font-size: 16px; font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 6px; }
    .p-badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 700; }
    .badge-round { background: #e0e7ff; color: #3730a3; }
    .badge-sub { background: #dbeafe; color: #1e40af; }
    .badge-cash { background: #fef3c7; color: #92400e; }

    .p-detail { font-size: 13px; color: var(--muted); margin-bottom: 10px; display: flex; flex-direction: column; gap: 3px; }
    .p-loc { font-weight: 700; color: #047857; }

    .action-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .btn-board { flex: 1; padding: 10px; border-radius: 8px; font-size: 14px; font-weight: 800; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: 0.15s; }
    .btn-not-boarded { background: #10b981; color: #fff; box-shadow: 0 2px 6px rgba(16,185,129,0.3); }
    .btn-not-boarded:active { transform: scale(0.97); }
    .btn-boarded-tag { background: #dcfce7; color: #166534; border: 1.5px solid #86efac; font-weight: 800; }

    .btn-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 18px; border: 1px solid var(--line); background: #fff; }
    .btn-icon.wa { color: #10b981; border-color: #a7f3d0; background: #ecfdf5; }
    .btn-icon.tel { color: #0284c7; border-color: #bae6fd; background: #f0f9ff; }

    .bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid var(--line); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; z-index: 100; }
    .live-dot { width: 9px; height: 9px; border-radius: 50%; background: #10b981; display: inline-block; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</head>
<body>

<div class="container">
  <div class="top-header">
    <div class="top-title">
      <span>كابتن: ${escHtml(driverName)}</span>
      <span class="tag" style="background:#fbbf24;color:#78350f;font-weight:900;">🚌 ${escHtml(vName)}</span>
    </div>
    <div class="sub-info">
      <span>🎓 ${escHtml(lineName)}</span>
      <span>⏰ التحرك: ${escHtml(departure)}</span>
      ${plate ? `<span>🔢 ${escHtml(plate)}</span>` : ''}
    </div>
  </div>

  ${allVehicles && allVehicles.length > 1 ? `
  <div class="bus-selector">
    <label style="font-size:13px;font-weight:bold;">تبديل الباص:</label>
    <select onchange="location.href='/attendance?vehicle_id=' + this.value">
      ${allVehicles.map((v: any) => `<option value="${v.id}" ${vehicle && vehicle.id === v.id ? 'selected' : ''}>${v.vehicle_name} — كابتن ${v.driver_name} (${v.line_name})</option>`).join('')}
    </select>
  </div>` : ''}

  <div class="stats-grid">
    <div class="stat-card stat-all">
      <div class="num">${total}</div>
      <div class="lbl">ركاب الباص</div>
    </div>
    <div class="stat-card stat-green">
      <div class="num" id="boardedCount">${boarded}</div>
      <div class="lbl">ركبوا الباص 🟢</div>
    </div>
    <div class="stat-card stat-red">
      <div class="num" id="waitingCount">${waiting}</div>
      <div class="lbl">بالانتظار 🔴</div>
    </div>
  </div>

  <div class="search-box">
    <input type="search" class="search-input" id="searchFilter" placeholder="🔍 بحث باسم الطالب أو نقطة الركوب..." oninput="filterCards(this.value)">
  </div>

  <div id="cardsList">
    ${bookings.map((b: any, idx: number) => {
      const isB = b.boarded === 1;
      const cleanPhone = String(b.student_phone).replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/2${cleanPhone}?text=${encodeURIComponent('أهلاً بك يا ' + b.student_name + '، كابتن الباص في طريقه لنقطة الركوب (' + (b.pickup_location || 'العياط') + ')')}`;
      const telLink = `tel:${cleanPhone}`;
      const ticket = b.ticket_code || ('EZZ-' + (1000 + b.id));

      return `
      <div class="card ${isB ? 'is-boarded' : 'is-waiting'}" id="card-${b.id}" data-name="${escHtml(b.student_name)}" data-loc="${escHtml(b.pickup_location || '')}">
        <div class="card-head">
          <div class="p-name">
            <span>${idx + 1}. ${escHtml(b.student_name)}</span>
            <span style="font-size:12px;">${b.gender === 'بنات' ? '🌸' : '⚡'}</span>
          </div>
          <span class="p-badge ${b.direction === 'round' ? 'badge-round' : 'badge-sub'}">
            ${b.direction === 'round' ? 'ذهاب وعودة 🔄' : (b.direction === 'one_way_go' ? 'ذهاب فقط' : 'عودة فقط')}
          </span>
        </div>

        <div class="p-detail">
          <div>📍 نقطة الركوب: <span class="p-loc">${escHtml(b.pickup_location || 'موقف العياط')}</span></div>
          <div>🎫 التذكرة: <span style="font-family:monospace;font-weight:bold;">${escHtml(ticket)}</span> | المقعد: <b>#${b.id % capacity + 1}</b></div>
          <div>💰 الدفع: <b>${b.payment_method === 'subscription' ? 'اشتراك شهري ✅' : (b.paid_status === 'paid' ? 'مدفوع كاش 💵' : 'كاش بالباص 💵')}</b></div>
        </div>

        <div class="action-row">
          ${isB ? `
            <div class="btn-board btn-boarded-tag" id="status-${b.id}">
              ✅ ركب الباص ${b.boarded_at ? '(' + escHtml(b.boarded_at) + ')' : ''}
            </div>
          ` : `
            <button class="btn-board btn-not-boarded" id="btn-${b.id}" onclick="markBoarded(${b.id}, '${escHtml(ticket)}')">
              🟢 تأكيد الركوب الآن
            </button>
          `}
          <a href="${waLink}" target="_blank" class="btn-icon wa" title="مراسلة واتساب">💬</a>
          <a href="${telLink}" class="btn-icon tel" title="اتصال تليفوني">📞</a>
        </div>
      </div>`;
    }).join('') || '<div style="text-align:center;padding:40px;background:#fff;border-radius:12px;border:1px dashed var(--line);color:var(--muted);">لا يوجد ركاب محجوزين لهذا الباص اليوم حتى الآن.</div>'}
  </div>
</div>

<div class="bottom-bar">
  <div style="display:flex;align-items:center;gap:6px;font-weight:700;">
    <span class="live-dot"></span>
    <span>رادار الحضور اللحظي — كابتن عز</span>
  </div>
  <button onclick="location.reload()" style="background:#f1f5f9;border:1px solid var(--line);padding:5px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">
    🔄 تحديث
  </button>
</div>

<script>
async function markBoarded(id, code) {
  const btn = document.getElementById('btn-' + id);
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ جاري التسجيل...';
  }
  try {
    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code })
    });
    const d = await res.json();
    if (d.ok) {
      const card = document.getElementById('card-' + id);
      if (card) {
        card.className = 'card is-boarded';
        btn.outerHTML = '<div class="btn-board btn-boarded-tag">✅ ركب الباص (' + (d.time || 'الآن') + ')</div>';
      }
      const bEl = document.getElementById('boardedCount');
      const wEl = document.getElementById('waitingCount');
      if (bEl && wEl) {
        bEl.innerText = Number(bEl.innerText) + 1;
        wEl.innerText = Math.max(0, Number(wEl.innerText) - 1);
      }
    } else {
      alert(d.error || 'فشل التسجيل');
      if (btn) { btn.disabled = false; btn.innerText = '🟢 تأكيد الركوب الآن'; }
    }
  } catch (e) {
    alert('تعذر الاتصال بالخادم');
    if (btn) { btn.disabled = false; btn.innerText = '🟢 تأكيد الركوب الآن'; }
  }
}

function filterCards(query) {
  const q = query.trim().toLowerCase();
  const cards = document.querySelectorAll('#cardsList .card');
  cards.forEach(c => {
    const name = (c.getAttribute('data-name') || '').toLowerCase();
    const loc = (c.getAttribute('data-loc') || '').toLowerCase();
    if (!q || name.includes(q) || loc.includes(q)) {
      c.style.display = 'block';
    } else {
      c.style.display = 'none';
    }
  });
}
</script>

</body>
</html>`;
}

