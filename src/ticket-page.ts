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
    alert('📱 لتثبيت التطبيق على هاتفك بدون علامة كروم:\\n1. اضغط على قائمة الثلاث نقاط (⋮) في أعلى المتصفح\\n2. اختر «تثبيت التطبيق» (Install App) أو «إضافة إلى الشاشة الرئيسية»');
  }
}
</script>

</body>
</html>`;
}
