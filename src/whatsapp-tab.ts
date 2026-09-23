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
  const isConnected = props.connection === 'open';
  const statusColor = isConnected ? '#0e7c66' : (props.connection === 'connecting' ? '#d97706' : '#c0392b');
  const statusLabel = isConnected ? 'متصل بنجاح ✅' : (props.connection === 'connecting' ? 'جارٍ الاتصال... ⏳' : 'غير متصل ❌');

  return `
<div class="box" style="margin-bottom:16px;">
  <h3 style="margin-top:0;display:flex;align-items:center;gap:10px;">
    <span>حالة اتصال واتساب:</span>
    <span style="color:${statusColor};font-weight:bold;">${statusLabel}</span>
  </h3>
  
  ${props.user ? `<p style="margin:4px 0;font-size:14px;"><strong>الرقم المتصل:</strong> ${props.user}</p>` : ''}
  ${props.lastError ? `<div style="background:rgba(192,57,43,0.1);color:#c0392b;padding:10px 14px;border-radius:8px;margin:10px 0;font-size:13px;">⚠️ ${props.lastError}</div>` : ''}

  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;">
    <div style="flex:1;min-width:280px;background:var(--tab-bg);border:1px solid var(--line);border-radius:8px;padding:16px;">
      <h4 style="margin-top:0;">📱 كود الاقتران السريع (Pairing Code)</h4>
      <p style="font-size:13px;color:var(--muted);">أدخل رقم هاتف الشريحة (مع مفتاح الدولة، مثل 201XXXXXXXXX) واضغط "طلب الكود":</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" id="pair-phone" placeholder="مثال: 01012345678 أو 201012345678" style="flex:1;padding:8px 12px;border:1px solid var(--line);border-radius:6px;font-size:14px;" value="${props.pairingPhone ?? ''}">
        <button type="button" class="btn" onclick="requestPairCode()" style="background:var(--accent);color:#fff;">طلب الكود</button>
      </div>
      ${props.pairingCode ? `
        <div style="background:#fff;border:2px dashed var(--accent);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:12px;color:var(--muted);">كود الربط المباشر:</div>
          <div style="font-size:26px;font-weight:bold;letter-spacing:4px;color:var(--accent);margin:6px 0;">${props.pairingCode}</div>
          <div style="font-size:11px;color:var(--muted);">ينتهي خلال: ${props.pairingExpiresInSec ?? 60} ثانية</div>
        </div>
      ` : ''}
    </div>

    <div style="flex:1;min-width:280px;background:var(--tab-bg);border:1px solid var(--line);border-radius:8px;padding:16px;">
      <h4 style="margin-top:0;">📷 رمز الاستجابة السريعة (QR Code)</h4>
      <p style="font-size:13px;color:var(--muted);">امسح الرمز من داخل تطبيق واتساب: الأجهزة المرتبطة ⬅️ ربط جهاز</p>
      ${props.qr ? `
        <div style="background:#fff;padding:12px;display:inline-block;border-radius:8px;border:1px solid var(--line);">
          <img src="${props.qr}" alt="QR Code" style="width:180px;height:180px;display:block;">
        </div>
      ` : `
        <div style="border:1px dashed var(--line);border-radius:8px;padding:30px;text-align:center;color:var(--muted);font-size:13px;">
          يظهر الرمز تلقائياً عند تشغيل بوابة الربط على السيرفر <code>npm run gateway</code>
        </div>
      `}
    </div>
  </div>
</div>

<script>
async function requestPairCode() {
  const phone = document.getElementById('pair-phone').value.trim();
  if (!phone) return alert('الرجاء إدخال رقم الهاتف أولاً');
  try {
    const res = await fetch('https://almaih.cloud/g/pair/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gateway-token': KEY },
      body: JSON.stringify({ phone })
    });
    if (res.ok) {
      alert('تم طلب كود الاقتران، جاري تحديث الصفحة...');
      location.reload();
    } else {
      alert('فشل طلب كود الاقتران من البوابة');
    }
  } catch(e) {
    alert('البوابة غير متاحة حالياً على السيرفر: ' + e.message);
  }
}
</script>
`;
}
