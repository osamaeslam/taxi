export interface WhatsAppTabProps {
  connection: string;
  user: string | null;
  qr: string | null;
  pairingCode: string | null;
  pairingPhone: string | null;
  pairingExpiresInSec: number | null;
  pairingMode: string | null;
  pairingWindowSec: number | null;
  lastError: string | null;
}

export function whatsappTabHtml(props: WhatsAppTabProps): string {
  const isConnected = props.connection === 'connected' || props.connection === 'open';
  const isConnecting = props.connection === 'connecting' || props.connection === 'initializing' || props.connection === 'reconnecting';
  const statusColor = isConnected ? '#0e7c66' : (isConnecting ? '#d97706' : '#c0392b');
  const statusLabel = isConnected ? 'متصل بنجاح ✅' : (isConnecting ? 'جارٍ الاتصال... ⏳' : 'غير متصل ❌');

  return `
<div class="box" style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
    <h3 style="margin:0;display:flex;align-items:center;gap:10px;">
      <span>حالة اتصال واتساب:</span>
      <span id="liveStatusText" style="color:${statusColor};font-weight:bold;">${statusLabel}</span>
    </h3>
    <div style="display:flex;gap:8px;">
      <button type="button" class="small btn" onclick="stopGatewayPairing()" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171;font-weight:bold;cursor:pointer;">
        🛑 إيقاف الاقتران
      </button>
      <button type="button" class="small btn" onclick="checkGatewayStatus(true)" style="background:#f1f5f9;color:#334155;border:1px solid var(--line);font-weight:bold;cursor:pointer;">
        🔄 فحص فوري
      </button>
    </div>
  </div>
  
  <div id="userInfoBlock" style="${props.user ? 'display:block;' : 'display:none;'}margin-top:8px;">
    <p style="margin:4px 0;font-size:14px;"><strong>الرقم المتصل:</strong> <span id="connectedPhoneSpan">${props.user ?? ''}</span></p>
  </div>
  
  <div id="errorBlock" style="${props.lastError ? 'display:block;' : 'display:none;'}background:rgba(192,57,43,0.1);color:#c0392b;padding:10px 14px;border-radius:8px;margin:10px 0;font-size:13px;">
    ⚠️ <span id="errorSpan">${props.lastError ?? ''}</span>
  </div>

  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;">
    <!-- كود الاقتران السريع -->
    <div style="flex:1;min-width:280px;background:var(--tab-bg);border:1px solid var(--line);border-radius:12px;padding:16px;">
      <h4 style="margin-top:0;display:flex;align-items:center;gap:6px;">
        <span>📱 كود الاقتران السريع (Pairing Code)</span>
      </h4>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px;">أدخل رقم هاتف الشريحة (مع مفتاح الدولة، مثل 201XXXXXXXXX) واضغط "طلب الكود":</p>
      
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="tel" id="pair-phone" placeholder="مثال: 201030096490" style="flex:1;padding:10px 14px;border:1.5px solid var(--line);border-radius:8px;font-size:15px;font-weight:bold;" value="${props.pairingPhone ?? '201030096490'}">
        <button type="button" id="btnRequestCode" class="btn" onclick="requestPairCode()" style="background:var(--accent);color:#fff;font-weight:bold;padding:10px 18px;border-radius:8px;cursor:pointer;">
          طلب الكود
        </button>
      </div>

      <div id="pairingCodeContainer" style="${props.pairingCode ? 'display:block;' : 'display:none;'}background:#fff;border:2px dashed var(--accent);border-radius:10px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="font-size:13px;color:var(--muted);font-weight:bold;">كود الاقتران المباشر لتطبيق واتساب:</div>
        <div id="codeDisplay" style="font-size:32px;font-weight:900;letter-spacing:6px;color:var(--accent);margin:10px 0;font-family:monospace;user-select:all;">
          ${props.pairingCode ?? '----'}
        </div>
        <div style="font-size:12px;color:#0e7c66;font-weight:bold;margin-bottom:6px;">
          افتح واتساب ⬅️ الأجهزة المرتبطة ⬅️ ربط باستخدام رقم الهاتف ⬅️ أدخل الكود أعلاه
        </div>
        <div id="codeTimer" style="font-size:11px;color:var(--muted);">
          ينتهي خلال: <span id="codeTimerSec">${props.pairingExpiresInSec ?? 120}</span> ثانية
        </div>
      </div>
    </div>

    <!-- رمز الاستجابة السريعة QR -->
    <div style="flex:1;min-width:280px;background:var(--tab-bg);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center;">
      <h4 style="margin-top:0;text-align:right;">📷 رمز الاستجابة السريعة (QR Code)</h4>
      <p style="font-size:13px;color:var(--muted);text-align:right;margin-bottom:12px;">أو يمكنك مسح الرمز من داخل تطبيق واتساب: الأجهزة المرتبطة ⬅️ ربط جهاز</p>
      
      <div id="qrContainer" style="margin:10px auto;">
        ${props.qr ? `
          <div style="background:#fff;padding:12px;display:inline-block;border-radius:10px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <img id="qrImg" src="${props.qr}" alt="QR Code" style="width:190px;height:190px;display:block;">
          </div>
        ` : `
          <div id="noQrPlaceholder" style="border:1.5px dashed var(--line);border-radius:10px;padding:30px 16px;background:#fff;color:var(--muted);font-size:13px;">
            اضغط على الزر أدناه لتوليد رمز QR جديد للمسح بكاميرا واتساب
            <br><br>
            <button type="button" class="btn" onclick="requestQrCode()" style="background:#0284c7;color:#fff;font-weight:bold;padding:8px 16px;border-radius:6px;cursor:pointer;">
              📷 توليد رمز QR الآن
            </button>
          </div>
        `}
      </div>
    </div>
  </div>
</div>

<script>
let statusPollTimer = null;

function normalizePhone(input) {
  let p = input.replace(/[^0-9]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('01') && p.length === 11) {
    p = '2' + p; // مصر
  }
  return p;
}

async function requestPairCode() {
  const rawInput = document.getElementById('pair-phone').value.trim();
  const phone = normalizePhone(rawInput);
  if (!phone || phone.length < 8) {
    alert('يرجى كتابة رقم هاتف صحيح بمفتاح الدولة (مثال: 201030096490)');
    return;
  }

  const btn = document.getElementById('btnRequestCode');
  btn.disabled = true;
  btn.innerText = '⏳ جاري طلب الكود...';

  try {
    const res = await fetch('/api/gateway/pair/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, force: true })
    });
    const d = await res.json();
    if (res.ok) {
      alert('✅ تم إرسال الطلب للبوابة، جاري استخراج كود الاقتران الآن...');
      startStatusPolling();
    } else {
      alert('خطأ من البوابة: ' + (d.error || 'تعذر استخراج الكود'));
    }
  } catch(e) {
    alert('تعذر الاتصال بالبوابة على السيرفر: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'طلب الكود';
  }
}

async function requestQrCode() {
  try {
    const res = await fetch('/api/gateway/pair/qr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    const d = await res.json();
    if (res.ok) {
      alert('✅ جاري توليد رمز الـ QR، انتظر ثوانٍ معدودة...');
      startStatusPolling();
    } else {
      alert('خطأ: ' + (d.error || 'تعذر توليد QR'));
    }
  } catch(e) {
    alert('تعذر الاتصال بالبوابة: ' + e.message);
  }
}

async function stopGatewayPairing() {
  if (!confirm('هل تريد إيقاف محاولات الاقتران الحالية؟')) return;
  try {
    const res = await fetch('/api/gateway/pair/stop', { method: 'POST' });
    if (res.ok) {
      alert('تم إيقاف الاقتران.');
      checkGatewayStatus(true);
    }
  } catch(e) {
    alert('فشل الاتصال: ' + e.message);
  }
}

async function checkGatewayStatus(manual = false) {
  try {
    const res = await fetch('/api/gateway/status');
    if (!res.ok) {
      if (manual) alert('البوابة غير مستجيبة حالياً.');
      return;
    }
    const data = await res.json();
    updateUiWithStatus(data);
  } catch(e) {
    if (manual) alert('تعذر جلب حالة البوابة: ' + e.message);
  }
}

function updateUiWithStatus(data) {
  const isConn = data.connection === 'connected' || data.connection === 'open';
  const isConnecting = ['connecting', 'initializing', 'reconnecting'].includes(data.connection);
  
  const statusEl = document.getElementById('liveStatusText');
  if (statusEl) {
    if (isConn) {
      statusEl.style.color = '#0e7c66';
      statusEl.innerText = 'متصل بنجاح ✅';
    } else if (isConnecting) {
      statusEl.style.color = '#d97706';
      statusEl.innerText = 'جارٍ الاتصال... ⏳';
    } else {
      statusEl.style.color = '#c0392b';
      statusEl.innerText = 'غير متصل ❌ (' + (data.connection || 'مغلق') + ')';
    }
  }

  // user
  const userBlock = document.getElementById('userInfoBlock');
  const userSpan = document.getElementById('connectedPhoneSpan');
  if (userBlock && userSpan) {
    if (data.user) {
      userBlock.style.display = 'block';
      userSpan.innerText = data.user;
    } else {
      userBlock.style.display = 'none';
    }
  }

  // error
  const errBlock = document.getElementById('errorBlock');
  const errSpan = document.getElementById('errorSpan');
  if (errBlock && errSpan) {
    if (data.lastError) {
      errBlock.style.display = 'block';
      errSpan.innerText = data.lastError;
    } else {
      errBlock.style.display = 'none';
    }
  }

  // pairing code
  const codeBox = document.getElementById('pairingCodeContainer');
  const codeDisplay = document.getElementById('codeDisplay');
  const codeTimerSec = document.getElementById('codeTimerSec');
  if (codeBox && codeDisplay) {
    if (data.pairingCode) {
      codeBox.style.display = 'block';
      codeDisplay.innerText = data.pairingCode;
      if (codeTimerSec && data.pairingExpiresInSec) {
        codeTimerSec.innerText = data.pairingExpiresInSec;
      }
    }
  }

  // QR
  const qrBox = document.getElementById('qrContainer');
  if (qrBox && data.qr) {
    qrBox.innerHTML = '<div style="background:#fff;padding:12px;display:inline-block;border-radius:10px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.05);">' +
      '<img src="' + data.qr + '" alt="QR Code" style="width:190px;height:190px;display:block;">' +
      '</div>';
  }
}

function startStatusPolling() {
  if (statusPollTimer) clearInterval(statusPollTimer);
  checkGatewayStatus();
  statusPollTimer = setInterval(checkGatewayStatus, 2500);
}

// بدء الفحص الدوري فور تحميل الصفحة
startStatusPolling();
</script>
`;
}
