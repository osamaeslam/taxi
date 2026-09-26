/**
 * لوحة الإدارة — عربية RTL، كل شغلة صفحة لحالها:
 *   /                الرئيسية (نظرة عامة + روابط)
 *   /admin/chats     المحادثات — دردشة كاملة من الموقع
 *   /admin/pricing   الأسعار — سعر الانتقال من مكان لمكان + المناطق
 *   /admin/drivers   السواقون
 *   /admin/rides     الرحلات
 *   /admin/settings  الإعدادات
 *   /admin/whatsapp  ربط واتساب
 */

import { todayStats, getConversations, getChatMessages, getPausedChats, setPaused, queueOutbox, listIssues, setIssueStatus } from './repo.js';
import { aiChat } from './ai.js';
import {
  formatEGP,
  getAllZonePricing,
  getDynamicZonePricing,
  updateZonePrice,
  addZonePriceCategory,
  deleteZonePriceCategory,
  resetDefaultZonePricing,
  formatZonePricingForWhatsApp,
} from './pricing.js';
import { whatsappTabHtml } from './whatsapp-tab.js';
import {
  getShuttleLines,
  getShuttleVehicles,
  getShuttleBookings,
  generateDriverManifest,
  toggleBoarding,
  getClientsDirectory,
  generateBookingsCsv,
} from './shuttle.js';
import type { Env } from './types.js';

/** توحيد صيغة الوجهة: رقم محلي/دولي → JID، أو JID كما هو */
function normToChat(to: string): string {
  to = to.trim();
  if (to.includes('@')) return to;
  let d = to.replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('01')) d = '20' + d.slice(1);
  return d + '@s.whatsapp.net';
}

const GATEWAY_URL = process.env.WHATSAPP_GATEWAY_URL || process.env.WHATSAPP_SERVER_URL || process.env.GATEWAY_URL || 'http://127.0.0.1:3010';

/** حالة البوابة من خادم البوت (QR/كود اقتران) — null إذا غير متاح */
async function gatewayStatus(adminKey: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/status`, {
      headers: { 'x-gateway-token': adminKey },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

// ─── التنقل المشترك ───
const NAV: Array<{ id: string; href: string; label: string }> = [
  { id: 'home', href: '/admin', label: '🏠 لوحة التحكم' },
  { id: 'attendance', href: '/admin/attendance', label: '🟢 رادار الحضور والركوب' },
  { id: 'portal', href: '/', label: '🌐 بوابة الركاب العامة' },
  { id: 'lines-react', href: '/lines', label: '🎓 خطوط الجامعات (React)' },
  { id: 'shuttle', href: '/admin/shuttle', label: '🚌 باصات وحجوزات اليوم' },
  { id: 'clients', href: '/admin/clients', label: '👥 دليل العملاء والركاب' },
  { id: 'rides', href: '/admin/rides', label: '🧾 المشاوير والتفاوض' },
  { id: 'drivers', href: '/admin/drivers', label: '🚗 كباتن وسيارات العياط' },
  { id: 'chats', href: '/admin/chats', label: '💬 المحادثات' },
  { id: 'pricing', href: '/admin/pricing', label: '💰 تسعير القرى والأحزمة' },
  { id: 'issues', href: '/admin/issues', label: '⚠️ المشاكل' },
  { id: 'settings', href: '/admin/settings', label: '⚙️ الإعدادات' },
  { id: 'whatsapp', href: '/admin/whatsapp', label: '📱 واتساب' },
];

const SHARED_CSS = `
  :root {
    --bg:#f6f4ef; --card:#fff; --ink:#2d2a24; --accent:#0e7c66; --line:#e4ded2; --danger:#c0392b;
    --muted:#6b6558; --tab-bg:#f1ede4; --th-bg:#efece4;
    --bubble-in:#f1ede4; --bubble-out:#d9efe7; --bubble-human:#d7e6fb;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg:#121417; --card:#1c1f24; --ink:#e8eaed; --accent:#17a387; --line:#2d333b; --danger:#e74c3c;
      --muted:#9ba1a6; --tab-bg:#22272e; --th-bg:#262c36;
      --bubble-in:#2a2e36; --bubble-out:#1b4332; --bubble-human:#1e3a5f;
    }
  }
  [data-theme="dark"] {
    --bg:#121417; --card:#1c1f24; --ink:#e8eaed; --accent:#17a387; --line:#2d333b; --danger:#e74c3c;
    --muted:#9ba1a6; --tab-bg:#22272e; --th-bg:#262c36;
    --bubble-in:#2a2e36; --bubble-out:#1b4332; --bubble-human:#1e3a5f;
  }
  [data-theme="light"] {
    --bg:#f6f4ef; --card:#fff; --ink:#2d2a24; --accent:#0e7c66; --line:#e4ded2; --danger:#c0392b;
    --muted:#6b6558; --tab-bg:#f1ede4; --th-bg:#efece4;
    --bubble-in:#f1ede4; --bubble-out:#d9efe7; --bubble-human:#d7e6fb;
  }
  * { box-sizing:border-box; font-family:'Segoe UI', Tahoma, 'Noto Naskh Arabic', sans-serif; transition:background-color 0.2s ease, border-color 0.2s ease; }
  body { margin:0; background:var(--bg); color:var(--ink); }
  header { background:var(--accent); color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; }
  header h1 { margin:0; font-size:20px; }
  .pwa-install-btn {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #fff;
    border: 0;
    padding: 6px 13px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(245,158,11,0.35);
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .pwa-install-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245,158,11,0.5);
  }
  .pwa-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 10000;
    display: none; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(4px);
  }
  .pwa-modal {
    background: var(--card); color: var(--ink); border-radius: 16px; max-width: 440px; width: 100%;
    padding: 24px; box-shadow: 0 15px 35px rgba(0,0,0,0.25); border: 1px solid var(--line);
    text-align: center; position: relative; animation: pwaFadeIn 0.25s ease;
  }
  @keyframes pwaFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .theme-btn { background:rgba(255,255,255,0.2); border:0; border-radius:50%; width:38px; height:38px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; font-size:19px; color:#fff; min-height:0; padding:0; }
  .theme-btn:hover { background:rgba(255,255,255,0.35); }
  nav.tabs { position:sticky; top:0; z-index:10; background:var(--card); border-bottom:1px solid var(--line);
    display:flex; gap:6px; overflow-x:auto; padding:8px 12px; }
  nav.tabs a { white-space:nowrap; text-decoration:none; color:var(--ink); background:var(--tab-bg);
    padding:10px 14px; border-radius:10px; font-size:14px; }
  nav.tabs a.active { background:var(--accent); color:#fff; font-weight:700; }
  main { padding:16px 20px 40px; max-width:1100px; margin:0 auto; }
  h1.page-title { font-size:20px; margin:6px 0 4px; }
  p.page-desc { color:var(--muted); font-size:14px; margin:0 0 16px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  a.card { display:block; background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:18px 14px; text-decoration:none; color:var(--ink); }
  a.card .e { font-size:30px; }
  a.card .t { font-weight:700; font-size:16px; margin:6px 0 2px; }
  a.card .d { color:var(--muted); font-size:13px; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:8px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; text-align:center; }
  .stat .n { font-size:26px; font-weight:700; color:var(--accent); }
  .pill-conn { display:inline-block; padding:6px 14px; border-radius:99px; font-size:14px; margin:4px 0 12px; }
  .pill-conn.on { background:#d4edda; color:#155724; } .pill-conn.off { background:#f5d0d0; color:#721c24; }
  h2 { font-size:17px; margin:26px 0 10px; border-bottom:2px solid var(--line); padding-bottom:6px; }
  table { width:100%; border-collapse:collapse; background:var(--card); border-radius:12px; overflow:hidden; font-size:14px; }
  th, td { padding:10px 12px; text-align:right; border-bottom:1px solid var(--line); color:var(--ink); }
  th { background:var(--th-bg); font-weight:700; }
  .st { display:inline-block; padding:2px 10px; border-radius:99px; font-size:12px; color:#222; }
  .st.NEW{background:#fff3cd} .st.DISPATCHING{background:#d1ecf1} .st.ASSIGNED{background:#d4edda}
  .st.ARRIVED{background:#e2d5f1} .st.IN_RIDE{background:#fde2c8} .st.DONE{background:#c9e7d3} .st.CANCELLED{background:#f5d0d0}
  .pill { display:inline-block; padding:2px 10px; border-radius:99px; background:var(--tab-bg); color:var(--accent); font-size:12px; margin-inline-end:6px; }
  button { cursor:pointer; border:0; border-radius:8px; padding:8px 14px; font-size:14px; background:var(--accent); color:#fff; }
  button.danger { background:var(--danger); }
  button.small { padding:4px 10px; font-size:12px; }
  input, select { background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:14px; }
  form.bar, .box { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:12px; }
  form.bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  form.bar label, .box label { font-size:13px; color:var(--muted); }
  .set-row { display:flex; gap:10px; align-items:center; padding:10px 2px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
  .set-row .lab { font-weight:700; min-width:150px; }
  .set-row .hint { color:var(--muted); font-size:12px; flex:1; min-width:200px; }
  .alias-chip { display:inline-block; background:var(--tab-bg); color:var(--ink); border-radius:99px; padding:2px 4px 2px 10px; margin:2px; font-size:13px; white-space:nowrap; }
  .alias-chip button { background:none; color:var(--danger); padding:0 6px; min-height:0; font-size:13px; }
  .alias-add { display:inline-flex; gap:4px; margin:2px; }
  .alias-add input { min-height:0 !important; padding:4px 8px !important; font-size:13px !important; }
  footer { color:var(--muted); font-size:12px; text-align:center; padding:20px; }
  .muted { color:var(--muted); font-size:13px; }
  /* الدردشة */
  .chat-layout { display:grid; grid-template-columns:280px 1fr; gap:12px; }
  .conv-pane { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; max-height:70vh; overflow-y:auto; }
  .conv { display:block; width:100%; text-align:right; background:none; color:var(--ink); border:0; border-bottom:1px solid var(--line); padding:10px 12px; font-size:13px; }
  .conv.active { background:var(--tab-bg); }
  .conv .ph { font-weight:700; }
  .conv .prev { color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; display:block; }
  .badge-paused { background:#f5d0d0; color:#721c24; border-radius:99px; font-size:11px; padding:1px 8px; }
  .badge-ai { background:#d1ecf1; color:#0c5460; border-radius:99px; font-size:11px; padding:1px 8px; }
  .thread-pane { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; display:flex; flex-direction:column; min-height:40vh; }
  #thread { flex:1; max-height:60vh; min-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
  .b { max-width:85%; padding:8px 12px; border-radius:12px; font-size:14px; white-space:pre-wrap; word-break:break-word; }
  .b-in { align-self:flex-start; background:var(--bubble-in); color:var(--ink); }
  .b-out { align-self:flex-end; background:var(--bubble-out); color:var(--ink); }
  .b-human { align-self:flex-end; background:var(--bubble-human); color:var(--ink); }
  .b-meta { font-size:11px; color:var(--muted); margin-top:2px; }
  .reply-bar { display:flex; gap:8px; }
  .reply-bar input { flex:1; }
  .thread-actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; align-items:center; }
  #ai-summary { background:var(--tab-bg); border:1px dashed var(--line); border-radius:8px; padding:10px; font-size:13px; white-space:pre-wrap; margin-bottom:10px; color:var(--ink); }
  #btn-back { display:none; }
  @media (max-width:640px) {
    #btn-back { display:inline-block; }
    header { padding:12px 14px; } header h1 { font-size:17px; }
    main { padding:12px 10px 30px; }
    .stats { grid-template-columns:repeat(2,1fr); gap:8px; }
    .stat .n { font-size:22px; }
    table { display:block; overflow-x:auto; white-space:nowrap; }
    button { min-height:44px; font-size:15px; }
    button.small { min-height:36px; }
    input, select { min-height:44px; font-size:16px; max-width:100%; }
    form.bar { flex-direction:column; align-items:stretch; }
    form.bar input, form.bar select { width:100% !important; }
    .qr-box img { width:100%; max-width:280px; height:auto; }
    .code-box .code { font-size:24px; }
    .chat-layout { grid-template-columns:1fr; }
    #thread-pane { display:none; }
    .chat-layout.chat-open #thread-pane { display:flex; }
    .chat-layout.chat-open #conv-pane { display:none; }
    #btn-back { display:''; }
  }
`;

const SHARED_JS = `
const K = new URLSearchParams(location.search).get('key');
const API = '/admin/api/';
const escJs = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(action, body) {
  try {
    const r = await fetch(API + action + '?key=' + K, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { alert('فشلت العملية: ' + (await r.text())); return false; }
    location.reload();
    return false;
  } catch (e) {
    alert('خطأ شبكة: ' + e);
    return false;
  }
}

async function postApi(action, body) {
  const r = await fetch(API + action + '?key=' + K, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { alert(j.error || ('فشلت العملية (' + r.status + ')')); return null; }
  return j;
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current ? current === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(!isDark);
}
// تهيئة أيقونة الزر
{
  const cur = document.documentElement.getAttribute('data-theme');
  const dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  updateThemeIcon(dark);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) updateThemeIcon(e.matches);
  });
}

// PWA Service Worker & Install flow
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('Captain Ezz Service Worker registered:', reg.scope);
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
  alert('🎉 تم تثبيت تطبيق كابتن عز بنجاح كأيقونة مستقلة على هاتفك!');
});

function triggerPWAInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        console.log('User installed Captain Ezz WebAPK');
      }
      deferredPwaPrompt = null;
    });
  } else {
    showPwaModal();
  }
}

function showPwaModal() {
  const m = document.getElementById('pwaModal');
  if (m) m.style.display = 'flex';
}

function closePwaModal() {
  const m = document.getElementById('pwaModal');
  if (m) m.style.display = 'none';
}
`;

/** الهيكل المشترك: ترويسة + تنقل + محتوى الصفحة */
function layout(page: string, key: string, title: string, body: string, extraCss = '', pageJs = ''): string {
  const esc = (s: unknown): string =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const nav = NAV.map((n) =>
    `<a href="${n.href}?key=${esc(key)}" class="${n.id === page ? 'active' : ''}">${n.label}</a>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${esc(title)} — منظومة كابتن عز لنقل الجامعات والمشاوير</title>
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
<script>
  (function(){
    var s = localStorage.getItem('theme');
    if (s) { document.documentElement.setAttribute('data-theme', s); }
  })();
</script>
<style>${SHARED_CSS}${extraCss}</style>
</head>
<body>
<header>
  <div style="display:flex;align-items:center;gap:10px;">
    <img src="/icon-192.png" alt="أيقونة كابتن عز" style="width:38px;height:38px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:1.5px solid rgba(255,255,255,0.45);object-fit:cover;flex-shrink:0;">
    <div>
      <div style="display:flex;align-items:center;gap:8px;">
        <h1 style="margin:0;font-size:18px;">كابتن عز — منظومة نقل الجامعات والمشاوير</h1>
        <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:12px;">العياط وقراها</span>
      </div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <button id="pwa-install-btn" class="pwa-install-btn" onclick="triggerPWAInstall()" title="تثبيت التطبيق كأيقونة على هاتفك">
      <img src="/icon-192.png" style="width:16px;height:16px;border-radius:4px;object-fit:cover;">
      <span>📲 تثبيت التطبيق</span>
    </button>
    <a href="https://docs.google.com/spreadsheets/d/1GvPC66HjIsy92ASJZ9l-2wIsUFUc4UnXsznqqXlSXv0/edit" target="_blank" style="background:#10b981;color:#fff;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:bold;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">📊 شيت جوجل كابتن عز ↗</a>
    <a href="/book" target="_blank" style="background:#fff;color:var(--accent);padding:5px 12px;border-radius:8px;font-size:12px;font-weight:bold;text-decoration:none;">🎫 رابط الحجز</a>
    <button id="theme-toggle" class="theme-btn" onclick="toggleTheme()" title="تبديل الوضع الليلي والنهاري">🌙</button>
    <a href="/admin/logout" style="background:rgba(239,68,68,0.25);color:#fff;border:1px solid rgba(255,255,255,0.4);padding:5px 11px;border-radius:8px;font-size:12px;font-weight:bold;text-decoration:none;" title="تسجيل الخروج">🚪 خروج</a>
  </div>
</header>
<nav class="tabs">${nav}</nav>
<main>
<h1 class="page-title">${esc(title)}</h1>
${body}
</main>
<!-- Modal تعليمات التثبيت كأيقونة بدون علامة كروم -->
<div id="pwaModal" class="pwa-modal-overlay" onclick="if(event.target===this)closePwaModal()">
  <div class="pwa-modal">
    <div style="display:flex;justify-content:center;margin-bottom:12px;">
      <img src="/icon-192.png" alt="كابتن عز" style="width:72px;height:72px;border-radius:18px;box-shadow:0 6px 18px rgba(14,124,102,0.35);border:2px solid #f59e0b;object-fit:cover;">
    </div>
    <h2 style="margin:0 0 6px;font-size:18px;color:var(--accent);">تثبيت تطبيق كابتن عز كأيقونة مستقلة</h2>
    <p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.5;">
      استمتع بتطبيق سريع يفتح من شاشة هاتفك مباشرة بدون شريط المتصفح وبدون علامة جوجل كروم!
    </p>
    <div style="background:var(--tab-bg);padding:14px;border-radius:12px;text-align:right;font-size:13px;line-height:1.6;margin-bottom:16px;border:1px solid var(--line);">
      <div style="font-weight:bold;color:#0e7c66;margin-bottom:4px;">📱 هواتف أندرويد (Google Chrome):</div>
      <div>اضغط على زر <b>«تثبيت التطبيق الآن»</b> بالأسفل، أو اضغط الثلاث نقاط <b>(⋮)</b> أعلى المتصفح واختر <b>«تثبيت التطبيق» (Install App)</b> لبناء حزمة WebAPK رسمية بأيقونة كابتن عز الذهبية بدون علامة كروم.</div>
      <div style="font-weight:bold;color:#2563eb;margin-top:10px;margin-bottom:4px;">🍏 هواتف آيفون (Apple Safari):</div>
      <div>اضغط زر المشاركة <b>Share (⎋)</b> بالأسفل ثم اختر <b>«إضافة إلى الصفحة الرئيسية» (Add to Home Screen)</b>.</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="if(deferredPwaPrompt){deferredPwaPrompt.prompt();}else{alert('اضغط على قائمة المتصفح (⋮) ثم اختر «تثبيت التطبيق» 📲');}" class="pwa-install-btn" style="flex:1;justify-content:center;padding:10px;font-size:14px;">
        📲 تثبيت التطبيق الآن
      </button>
      <button onclick="closePwaModal()" style="background:var(--card);border:1px solid var(--line);padding:10px 16px;border-radius:10px;cursor:pointer;font-weight:bold;color:var(--muted);">
        إغلاق
      </button>
    </div>
  </div>
</div>
<footer style="text-align:center;padding:16px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);margin-top:40px;">
  <div>منظومة <strong>كابتن عز</strong> لنقل الطلاب والمشاوير الخاصة — العياط والجيزة 🇪🇬</div>
  <div style="margin-top:4px;font-weight:bold;color:var(--ink);">برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات</div>
</footer>
<script>${SHARED_JS}${pageJs}</script>
</body></html>`;
}

function escHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export type AdminPageId = 'home' | 'chats' | 'pricing' | 'drivers' | 'rides' | 'shuttle' | 'attendance' | 'clients' | 'issues' | 'settings' | 'whatsapp' | 'simulator';

export async function adminPage(env: Env, page: AdminPageId, key: string, request?: Request): Promise<Response> {
  let body = '';
  let title = '';
  let pageJs = '';

  if (page === 'home') {
    title = 'لوحة التحكم والتحليلات الموحدة';

    const todayDate = new Date().toISOString().slice(0, 10);

    // إحصائيات باصات الجامعات اليوم
    const shuttleToday = await env.DB.prepare(`
      SELECT COUNT(*) as total,
             COALESCE(SUM(CASE WHEN boarded = 1 THEN 1 ELSE 0 END), 0) as boarded,
             COALESCE(SUM(fare_amount), 0) as revenue
      FROM shuttle_bookings
      WHERE booking_date = ? AND status != 'cancelled'
    `).bind(todayDate).first<{ total: number; boarded: number; revenue: number }>() ?? { total: 0, boarded: 0, revenue: 0 };

    // إحصائيات المشاوير الخاصة اليوم
    const ridesToday = await env.DB.prepare(`
      SELECT COUNT(*) as total,
             COALESCE(SUM(CASE WHEN boarded = 1 THEN 1 ELSE 0 END), 0) as boarded,
             COALESCE(SUM(COALESCE(final_price, price, client_offered_price, 0)), 0) as revenue
      FROM rides
      WHERE date(created_at) = date('now') AND status != 'CANCELLED'
    `).first<{ total: number; boarded: number; revenue: number }>() ?? { total: 0, boarded: 0, revenue: 0 };

    // إحصائيات كل الأوقات
    const shuttleAll = await env.DB.prepare(`
      SELECT COUNT(*) as total,
             COALESCE(SUM(CASE WHEN boarded = 1 THEN 1 ELSE 0 END), 0) as boarded,
             COALESCE(SUM(fare_amount), 0) as revenue
      FROM shuttle_bookings WHERE status != 'cancelled'
    `).first<{ total: number; boarded: number; revenue: number }>() ?? { total: 0, boarded: 0, revenue: 0 };

    const ridesAll = await env.DB.prepare(`
      SELECT COUNT(*) as total,
             COALESCE(SUM(CASE WHEN boarded = 1 THEN 1 ELSE 0 END), 0) as boarded,
             COALESCE(SUM(COALESCE(final_price, price, client_offered_price, 0)), 0) as revenue
      FROM rides WHERE status != 'CANCELLED'
    `).first<{ total: number; boarded: number; revenue: number }>() ?? { total: 0, boarded: 0, revenue: 0 };

    const driversCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM drivers WHERE active = 1`).first<{ c: number }>() ?? { c: 0 };

    // أعلى الجامعات إقبالاً
    const { results: topLines } = await env.DB.prepare(`
      SELECT l.name, l.destination, COUNT(b.id) as students,
             COALESCE(SUM(CASE WHEN b.boarded = 1 THEN 1 ELSE 0 END), 0) as boarded_count
      FROM shuttle_lines l
      LEFT JOIN shuttle_bookings b ON b.line_id = l.id AND b.status != 'cancelled'
      GROUP BY l.id
      ORDER BY students DESC
      LIMIT 5
    `).all();

    // توزيع القرى والمناطق بالعياط
    const { results: topVillages } = await env.DB.prepare(`
      SELECT loc, COUNT(*) as cnt FROM (
        SELECT pickup_location as loc FROM shuttle_bookings WHERE pickup_location IS NOT NULL AND pickup_location != ''
        UNION ALL
        SELECT from_text as loc FROM rides WHERE from_text IS NOT NULL AND from_text != ''
      ) GROUP BY loc ORDER BY cnt DESC LIMIT 5
    `).all();

    // استعلام أحدث العمليات المشتركة
    const { results: recentShuttles } = await env.DB.prepare(`
      SELECT b.id, b.ticket_code, b.student_name as name, b.student_phone as phone,
             b.pickup_location, b.boarded, b.fare_amount, b.created_at, 'shuttle' as kind,
             COALESCE(l.destination, l.name) as dest
      FROM shuttle_bookings b
      JOIN shuttle_lines l ON l.id = b.line_id
      ORDER BY b.id DESC LIMIT 4
    `).all();

    const { results: recentRides } = await env.DB.prepare(`
      SELECT r.id, r.ticket_code, r.client_name as name, r.client_phone as phone,
             r.from_text as pickup_location, r.to_text as dest, r.boarded,
             COALESCE(r.final_price, r.price, r.client_offered_price, 0) as fare_amount,
             r.created_at, 'ride' as kind
      FROM rides r
      ORDER BY r.id DESC LIMIT 4
    `).all();

    const combinedActivity = [...(recentShuttles || []), ...(recentRides || [])].sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ).slice(0, 6);

    // إعدادات Google Sheets
    const sheetsRow = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'google_sheets_webhook_url'`).first<{ value: string }>();
    const sheetsWebhookUrl = sheetsRow?.value || '';

    const gw = await gatewayStatus(env.ADMIN_KEY);
    const connected = gw?.connection === 'open' || gw?.connection === 'connected';

    const totalTodayTrips = shuttleToday.total + ridesToday.total;
    const totalTodayRev = shuttleToday.revenue + ridesToday.revenue;
    const totalTodayBoarded = shuttleToday.boarded + ridesToday.boarded;
    const todayBoardingRate = totalTodayTrips > 0 ? Math.round((totalTodayBoarded / totalTodayTrips) * 100) : 0;

    body = `
<p class="page-desc">لوحة القيادة المركزية لمنظومة كابتن عز — إدارة متكاملة لباصات الجامعات، المشاوير الخاصة، رادار الحضور الحي، والمزامنة مع Google Sheets و Excel.</p>

<!-- إحصائيات مدمجة وشاملة اليوم -->
<div class="stats" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
  <div class="stat" style="border-top: 3px solid #0e7c66;">
    <div class="n" style="color:#0e7c66;">${totalTodayTrips}</div>
    <div style="font-weight:bold;margin-bottom:2px;">إجمالي ركاب اليوم</div>
    <div style="font-size:11px;color:var(--muted);">🎓 ${shuttleToday.total} باصات + 🚗 ${ridesToday.total} مشاوير</div>
  </div>

  <div class="stat" style="border-top: 3px solid #10b981;">
    <div class="n" style="color:#10b981;">${totalTodayBoarded} <span style="font-size:14px;color:var(--muted);">(${todayBoardingRate}%)</span></div>
    <div style="font-weight:bold;margin-bottom:2px;">ركبوا الباص / السيارة 🟢</div>
    <div style="font-size:11px;color:var(--muted);">حضور مؤكد بالرادار الحي</div>
  </div>

  <div class="stat" style="border-top: 3px solid #f59e0b;">
    <div class="n" style="color:#b45309;">${formatEGP(totalTodayRev)}</div>
    <div style="font-weight:bold;margin-bottom:2px;">إيراد اليوم الإجمالي</div>
    <div style="font-size:11px;color:var(--muted);">باصات: ${shuttleToday.revenue} ج | مشاوير: ${ridesToday.revenue} ج</div>
  </div>

  <div class="stat" style="border-top: 3px solid #2563eb;">
    <div class="n" style="color:#2563eb;">${driversCount.c}</div>
    <div style="font-weight:bold;margin-bottom:2px;">كباتن نشطين بالعياط</div>
    <div style="font-size:11px;color:var(--muted);">أسطول 14 راكب وسيارات خاصة</div>
  </div>

  <div class="stat" style="border-top: 3px solid #8b5cf6;">
    <div class="n" style="color:#8b5cf6;">${shuttleAll.total + ridesAll.total}</div>
    <div style="font-weight:bold;margin-bottom:2px;">إجمالي الرحلات الكلي</div>
    <div style="font-size:11px;color:var(--muted);">إيراد كلي: ${formatEGP(shuttleAll.revenue + ridesAll.revenue)}</div>
  </div>
</div>

<!-- شريط المزامنة الذكية مع Google Sheets وإكسل -->
<div style="background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.03);">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:26px;">📊</div>
      <div>
        <div style="font-weight:bold;font-size:15px;display:flex;align-items:center;gap:8px;">
          <span>مزامنة قاعدة البيانات مع Google Sheets & Excel</span>
          ${sheetsWebhookUrl ? '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">🟢 متصل تلقائياً</span>' : '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">⚠️ لم يتم ربط الـ Webhook بعد</span>'}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">
          يتم تسجيل كل حجز جديد لباص جامعة أو مشوار خاص تلقائياً في شيت جوجل بدون أي تدخل يدوي.
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <a href="/api/export/csv?date=${todayDate}" class="small" style="background:#10b981;color:#fff;text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:bold;display:flex;align-items:center;gap:6px;">
        <span>📥</span>
        <span>تصدير باصات اليوم Excel</span>
      </a>
      <a href="/api/export/rides-csv" class="small" style="background:#2563eb;color:#fff;text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:bold;display:flex;align-items:center;gap:6px;">
        <span>📥</span>
        <span>تصدير المشاوير الخاصة Excel</span>
      </a>
      <button onclick="syncAllToSheets()" class="small" style="background:#0e7c66;color:#fff;padding:8px 14px;border-radius:8px;font-weight:bold;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;">
        <span>🔄</span>
        <span>مزامنة كل البيانات لـ Google Sheets</span>
      </button>
      <button onclick="toggleSheetsModal()" class="small" style="background:var(--tab-bg);border:1px solid var(--line);padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:bold;">
        ⚙️ إعدادات الربط
      </button>
    </div>
  </div>

  <!-- صندوق منسدل سريع لإعداد Webhook جوجل شيت -->
  <div id="sheetsSetupBox" style="display:none;background:#f8fafc;padding:14px;border-radius:10px;border:1px dashed #cbd5e1;margin-top:12px;">
    <h3 style="margin:0 0 8px;font-size:14px;color:#1e40af;">🔗 رابط Google Apps Script Webhook المباشر:</h3>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <input id="sheetsWebhookInput" value="${escHtml(sheetsWebhookUrl)}" placeholder="https://script.google.com/macros/s/AKfycb.../exec" dir="ltr" style="flex:1;min-width:280px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">
      <button onclick="saveSheetsUrl()" style="background:#0e7c66;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">حفظ الرابط</button>
      <button onclick="testSheetsUrl()" style="background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">فحص الاتصال 📡</button>
    </div>
    <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#334155;">
      <b>📋 طريقة ربط Google Sheets في 60 ثانية:</b><br>
      1. افتح شيت جوجل جديد على حسابك في Google Drive.<br>
      2. من القائمة العلوية اختر <b>Extensions (الإضافات)</b> ثم <b>Apps Script</b>.<br>
      3. احذف الكود الموجود والصق كود الاستقبال الجاهز (اضغط زر النسخ بالأسفل).<br>
      4. اضغط <b>Deploy (نشر)</b> ثم <b>New deployment</b> واختر نوع <b>Web app</b>.<br>
      5. اجعل الخيار: <b>Who has access: Anyone</b> (أي شخص) ثم اضغط Deploy وانسخ رابط Web App وضعه في الصندوق أعلاه!<br>
      <button onclick="copyGasScript()" class="small" style="margin-top:8px;background:#3b82f6;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">📋 نسخ كود Google Apps Script الجاهز</button>
    </div>
  </div>
</div>

<!-- بطاقة توضيحية شاملة لدورة العمل ونظام الشغل بين الثلاثة (العميل - السائق - الإدارة) -->
<div style="background:linear-gradient(135deg, #f0fdf4, #eff6ff);border:1.5px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:16px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <span style="font-size:22px;">💡</span>
    <h3 style="margin:0;font-size:15px;color:#065f46;">كيف تعمل المنظومة بين الأطراف الثلاثة (العميل 👤 — الكابتن 🚗 — الإدارة 👔)؟</h3>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;font-size:13px;color:#1e293b;line-height:1.6;">
    <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-weight:bold;color:#0e7c66;margin-bottom:4px;">1. العميل / الطالب 👤:</div>
      <div>• يدخل رابط الحجز <a href="/book" target="_blank" style="font-weight:bold;color:#0e7c66;">(/book للجامعات)</a> أو <a href="/ride" target="_blank" style="font-weight:bold;color:#2563eb;">(/ride للمشاوير الخاصة)</a>، أو يرسل رسالة عادية للبوت بالواتساب.<br>• <b>لا يحتاج تسجيل دخول إطلاقاً!</b> فقط اسمه ورقم واتساب ومكان الركوب.<br>• يستلم فوراً رسالة واتساب برابط تذكرته الذكية، وعند ركوبه يضغط زر <b>«أنا ركبت الآن 🟢»</b>.</div>
    </div>
    <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-weight:bold;color:#2563eb;margin-bottom:4px;">2. الكابتن / السائق 🚗:</div>
      <div>• يفتح رابط <b>«رادار الحضور والركوب»</b> من هاتفه بدون برامج معقدة، أو يصله كشف الركاب برسالة واتساب.<br>• يرى قائمة الطلاب بالألوان: <b style="color:#10b981;">الأخضر 🟢</b> ركب بالفعل، و<b style="color:#ef4444;">الأحمر 🔴</b> بالانتظار.<br>• بنقرة واحدة على اسم أي راكب يمكنه تحويله لأخضر، ومعه زر اتصال واتصال هاتفي مباشر بكل راكب.</div>
    </div>
    <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-weight:bold;color:#8b5cf6;margin-bottom:4px;">3. الإدارة وصاحب العمل 👔:</div>
      <div>• متابعة حية لجميع خطوط الجامعات الـ 16 والمشاوير الخاصة في مكان واحد.<br>• تنزيل شيت Excel يومي بنقرة زر في أي وقت أو كل يوم صباحاً.<br>• مزامنة آلية كاملة مع Google Sheets الخاص بك مع كل حجز جديد!</div>
    </div>
  </div>
</div>

<!-- قسم التحليلات والرسوم البيانية المصغرة -->
<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:14px;margin-bottom:16px;">
  <!-- تحليل خطوط الجامعات -->
  <div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="margin:0;font-size:14px;display:flex;align-items:center;gap:6px;">
        <span>🎓</span>
        <span>أعلى الجامعات إقبالاً وعدد الطلاب</span>
      </h3>
      <a href="/admin/shuttle?key=${escHtml(key)}" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:bold;">كل الخطوط الـ 16 ⬅️</a>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(topLines ?? []).map((l: any) => {
        const max = Math.max(...(topLines.map((x: any) => Number(x.students) || 1)), 1);
        const pct = Math.round(((Number(l.students) || 0) / max) * 100);
        return `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;font-weight:bold;">
            <span>${escHtml(l.destination || l.name)}</span>
            <span>${l.students} طالب (${l.boarded_count || 0} ركبوا 🟢)</span>
          </div>
          <div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden;">
            <div style="background:linear-gradient(90deg, #0e7c66, #10b981);height:100%;width:${Math.max(pct, 8)}%;border-radius:6px;"></div>
          </div>
        </div>`;
      }).join('') || '<div class="muted" style="font-size:12px;text-align:center;padding:10px;">لا حجوزات مسجلة بعد.</div>'}
    </div>
  </div>

  <!-- تحليل مناطق وقرى العياط الأكثر نشاطاً -->
  <div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="margin:0;font-size:14px;display:flex;align-items:center;gap:6px;">
        <span>📍</span>
        <span>توزيع نقاط الركوب والقرى بالعياط</span>
      </h3>
      <a href="/admin/pricing?key=${escHtml(key)}" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:bold;">تسعير القرى ⬅️</a>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(topVillages ?? []).map((v: any) => {
        const max = Math.max(...(topVillages.map((x: any) => Number(x.cnt) || 1)), 1);
        const pct = Math.round(((Number(v.cnt) || 0) / max) * 100);
        return `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;font-weight:bold;">
            <span>${escHtml(v.loc || 'العياط')}</span>
            <span>${v.cnt} راكب</span>
          </div>
          <div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden;">
            <div style="background:linear-gradient(90deg, #2563eb, #3b82f6);height:100%;width:${Math.max(pct, 8)}%;border-radius:6px;"></div>
          </div>
        </div>`;
      }).join('') || '<div class="muted" style="font-size:12px;text-align:center;padding:10px;">لا بيانات قرى كافية بعد.</div>'}
    </div>
  </div>
</div>

<!-- جدول أحدث الحجوزات والمشاوير المباشرة -->
<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:20px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
    <h3 style="margin:0;font-size:15px;font-weight:bold;">⚡ شريط أحدث الحجوزات والمشاوير الحية</h3>
    <div style="display:flex;gap:8px;">
      <a href="/book" target="_blank" style="background:#eff6ff;color:#1d4ed8;padding:5px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;border:1px solid #bfdbfe;">+ حجز باص جامعة 🎓</a>
      <a href="/ride" target="_blank" style="background:#ecfdf5;color:#047857;padding:5px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;border:1px solid #a7f3d0;">+ طلب مشوار خاص 🚗</a>
    </div>
  </div>

  <table>
    <tr>
      <th>النوع</th>
      <th>كود التذكرة</th>
      <th>الاسم والراكب</th>
      <th>مكان الركوب</th>
      <th>الوجهة</th>
      <th>الأجرة</th>
      <th>الحالة</th>
      <th>إجراء</th>
    </tr>
    ${combinedActivity.map((act: any) => `
    <tr>
      <td>${act.kind === 'shuttle' ? '<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">🎓 باص جامعة</span>' : '<span style="background:#ecfdf5;color:#047857;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">🚗 مشوار خاص</span>'}</td>
      <td style="font-weight:bold;font-family:monospace;letter-spacing:1px;">${escHtml(act.ticket_code || ('#' + act.id))}</td>
      <td>
        <div style="font-weight:bold;">${escHtml(act.name || 'عميل')}</div>
        <div style="font-size:11px;color:var(--muted);" dir="ltr">${escHtml(act.phone || '')}</div>
      </td>
      <td>${escHtml(act.pickup_location || 'العياط')}</td>
      <td>${escHtml(act.dest || 'وجهة خاصة')}</td>
      <td style="font-weight:bold;color:#047857;">${act.fare_amount ? `${act.fare_amount} ج` : 'قيد التفاوض'}</td>
      <td>${act.boarded === 1 ? '<span style="color:#10b981;font-weight:bold;">🟢 ركب الباص</span>' : '<span style="color:#ef4444;font-weight:bold;">🔴 بالانتظار</span>'}</td>
      <td>
        <a href="/ticket/${escHtml(act.ticket_code || act.id)}" target="_blank" class="small" style="text-decoration:none;display:inline-block;padding:4px 8px;">تذكرة ↗</a>
      </td>
    </tr>
    `).join('') || '<tr><td colspan="8" class="muted" style="text-align:center;">لا عمليات حديثة بعد.</td></tr>'}
  </table>
</div>

<span class="pill-conn ${connected ? 'on' : 'off'}">${connected ? '🟢 واتساب متصل' + (gw?.user ? ' — ' + escHtml(gw.user) : '') : '🔴 واتساب غير متصل — ادخل على صفحة واتساب للربط'}</span>

<div class="cards">
  <a class="card" href="/admin/attendance?key=${escHtml(key)}" style="border: 2px solid #10b981; background: #f0fdf4;"><div class="e">🟢</div><div class="t">رادار الحضور والركوب الحي</div><div class="d">شيت حي تفاعلي للسائق والمدير: الأخضر ركب، والأحمر بالانتظار، مع نقرة لتسجيل الصعود</div></a>
  <a class="card" href="/admin/shuttle?key=${escHtml(key)}" style="border: 2px solid #2980b9;"><div class="e">🎓</div><div class="t">خطوط وباصات الجامعات</div><div class="d">16 خط لجامعات مصر (القاهرة، 6 أكتوبر، MUST، حلوان، بدر...)، أسطول 14 راكب، وكشوف الركاب</div></a>
  <a class="card" href="/admin/clients?key=${escHtml(key)}" style="border: 2px solid #8b5cf6;"><div class="e">👥</div><div class="t">دليل العملاء والركاب</div><div class="d">سجل كامل ببيانات الطلاب والعملاء، القرى، الوجهات المفضلة، وسجل المشاوير</div></a>
  <a class="card" href="/admin/rides?key=${escHtml(key)}"><div class="e">🧾</div><div class="t">المشاوير والتفاوض</div><div class="d">طلبات العملاء، عروض أسعار السائقين، والاتفاق النهائي بالسعر المقبول</div></a>
  <a class="card" href="/admin/drivers?key=${escHtml(key)}"><div class="e">🚗</div><div class="t">كباتن وسيارات العياط</div><div class="d">إدارة سيارات الـ 14 راكب والسيارات الخاصة، عمولة المشاوير وحالة التوفر</div></a>
  <a class="card" href="/admin/chats?key=${escHtml(key)}"><div class="e">💬</div><div class="t">المحادثات</div><div class="d">دردش مع العملاء والطلاب من الموقع — رد كبشر أو تابع ردود البوت</div></a>
  <a class="card" href="/admin/pricing?key=${escHtml(key)}"><div class="e">💰</div><div class="t">تسعير القرى والأحزمة</div><div class="d">أسعار الانتقال من العياط وقراها لمناطق الجيزة والقاهرة والمحافظات بالجنيه المصري</div></a>
  <a class="card" href="/admin/whatsapp?key=${escHtml(key)}"><div class="e">📱</div><div class="t">واتساب</div><div class="d">ربط رقم الشركة وبوت الواتساب</div></a>
  <a class="card" href="/admin/settings?key=${escHtml(key)}"><div class="e">⚙️</div><div class="t">الإعدادات</div><div class="d">تشغيل البوت والـ AI وإعدادات مجموعة كباتن العياط وربط Google Sheets</div></a>
</div>`;

    pageJs = `
function toggleSheetsModal() {
  const box = document.getElementById('sheetsSetupBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function saveSheetsUrl() {
  const url = document.getElementById('sheetsWebhookInput').value.trim();
  const res = await postApi('settings.set', { google_sheets_webhook_url: url });
  if (res) {
    alert('✅ تم حفظ رابط Google Sheets Webhook بنجاح!');
    location.reload();
  }
}

async function testSheetsUrl() {
  const url = document.getElementById('sheetsWebhookInput').value.trim();
  if (!url) { alert('يرجى كتابة رابط Webhook أولاً'); return; }
  alert('⏳ جاري فحص الاتصال بشيت جوجل...');
  try {
    const res = await fetch('/api/sheets/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (data.ok) {
      alert('🎉 الاتصال ناجح 100%! شيت جوجل استلم إشارة الاختبار بنجاح.');
    } else {
      alert('⚠️ لم ينجح الاتصال: ' + (data.error || 'تأكد من نشر Web App وجعل الصلاحية Anyone'));
    }
  } catch (err) {
    alert('خطأ شبكة أثناء الفحص: ' + err);
  }
}

async function syncAllToSheets() {
  if (!confirm('هل تريد مزامنة كافة بيانات باصات الجامعات والمشاوير الخاصة الحالية إلى Google Sheets الآن؟')) return;
  alert('⏳ جاري إرسال كافة السجلات إلى شيت جوجل...');
  try {
    const res = await fetch('/api/sheets/sync-all', {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    });
    const data = await res.json();
    if (data.ok) {
      alert('🎉 تمت المزامنة بنجاح! تم تصدير ' + data.syncedCount + ' سجل إلى Google Sheets.');
    } else {
      alert('⚠️ تعذر المزامنة: ' + (data.error || 'يرجى التأكد من ضبط رابط Google Sheets أولاً'));
    }
  } catch (err) {
    alert('خطأ شبكة أثناء المزامنة: ' + err);
  }
}

function copyGasScript() {
  const script = \`function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["النوع", "التاريخ", "كود التذكرة", "الاسم", "رقم الهاتف", "مكان الركوب", "مكان النزول", "الأجرة", "حالة الحضور", "ملاحظات", "وقت التسجيل"]);
      sheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#e2e8f0");
    }
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.type || "حجز",
      data.date || "",
      data.ticketCode || "",
      data.name || "",
      data.phone || "",
      data.from || "",
      data.to || "",
      data.price || 0,
      data.status || "",
      data.notes || "",
      new Date().toLocaleString("ar-EG")
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: "Captain Ezz Sheets Webhook is active" })).setMimeType(ContentService.MimeType.JSON);
}\`;
  navigator.clipboard.writeText(script).then(() => {
    alert('📋 تم نسخ كود Google Apps Script إلى الحافظة! الصقه الآن في Apps Script في شيت جوجل.');
  }).catch(() => {
    prompt('انسخ الكود التالي:', script);
  });
}
`;

  } else if (page === 'chats') {
    const convs = await getConversations(env.DB, 30);
    title = 'المحادثات';
    body = `<p class="page-desc">دردش مع العملاء من هنا مباشرة. رسالتك بتتبعت باسم كابتن عز فوراً. تقدر تدوس «إيقاف البوت» عشان تتكلم بنفسك والعميل ما يوصلوش رد آلي.</p>
<div class="box">
  <form onsubmit="return newChat(event)" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <label>📩 محادثة جديدة لرقم:</label>
    <input id="newchat-phone" dir="ltr" placeholder="010XXXXXXXX" style="width:170px">
    <button class="small">فتح</button>
  </form>
</div>
<div class="chat-layout" id="chat-layout">
  <div class="conv-pane" id="conv-pane"><div id="conv-list">
    ${convs.length ? convs.map((c) => `
    <button class="conv" data-chat="${escHtml(c.chat_id)}" onclick="openChat('${escHtml(c.chat_id)}', this)">
      <span class="ph" dir="ltr">${escHtml(c.is_group ? 'مجموعة السواقين' : '+' + c.phone)}</span>
      ${c.paused ? '<span class="badge-paused">⏸ بشري فقط</span>' : '<span class="badge-ai">بوت</span>'}
      <span class="prev">${escHtml((c.last_text ?? '').slice(0, 60))}</span>
    </button>`).join('') : '<p class="muted" style="padding:12px">ما فيش رسائل لسه — الرسائل والمحادثات هتظهر هنا أول ما يوصل أي حجز أو استفسار.</p>'}
  </div></div>
  <div class="thread-pane" id="thread-pane">
    <div class="thread-actions">
      <button class="small" id="btn-back" onclick="closeChat()">← رجوع</button>
      <span class="muted" id="thread-title">اختر محادثة 👆</span>
      <span style="flex:1"></span>
      <button class="small" id="btn-pause" style="display:none" onclick="togglePause()">⏸ إيقاف البوت</button>
      <button class="small" id="btn-summary" style="display:none" onclick="aiSummary()">✨ تلخيص AI</button>
    </div>
    <div id="ai-summary" style="display:none"></div>
    <div id="thread"></div>
    <div id="quick-replies" style="display:none;gap:6px;flex-wrap:wrap;padding:6px 0;font-size:12px;">
      <button type="button" class="small" onclick="quickFillReply('اسعار المناطق والمشاوير')">💰 تسعيرة المناطق</button>
      <button type="button" class="small" onclick="quickFillReply('مواعيد باصات الجامعات')">🎓 مواعيد باصات الجامعات</button>
      <button type="button" class="small" onclick="quickFillReply('تذكرتي')">🎫 التذكرة الذكية</button>
      <button type="button" class="small" onclick="quickFillReply('تم تأكيد حجزك، الكابتن في الطريق')">🚗 تأكيد الكابتن</button>
    </div>
    <form class="reply-bar" id="reply-form" style="display:none" onsubmit="return sendHuman(event)">
      <input id="reply-text" placeholder="اكتب ردك كبشر…" autocomplete="off">
      <button>📨 إرسال</button>
    </form>
  </div>
</div>`;
    pageJs = `
let curChat = null, curPaused = false;

function convBtn(c) {
  const name = c.is_group ? 'مجموعة السواقين' : '+' + escJs(c.phone);
  const badge = c.paused ? '<span class="badge-paused">⏸ بشر فقط</span>' : '<span class="badge-ai">بوت</span>';
  return '<button class="conv' + (c.chat_id === curChat ? ' active' : '') + '" data-chat="' + escJs(c.chat_id) +
    '" onclick="openChat(\\'' + escJs(c.chat_id) + '\\', this)">' +
    '<span class="ph" dir="ltr">' + escJs(name) + '</span> ' + badge +
    '<span class="prev">' + escJs((c.last_text || '').slice(0, 60)) + '</span></button>';
}

async function refreshList() {
  try {
    const r = await fetch(API + 'conv.list?key=' + K);
    const j = await r.json();
    if (!r.ok || !j.conversations) return;
    const list = document.getElementById('conv-list');
    list.innerHTML = j.conversations.length ? j.conversations.map(convBtn).join('')
      : '<p class="muted" style="padding:12px">لا رسائل بعد.</p>';
  } catch (e) {}
}

async function loadThread(silent) {
  if (!curChat) return;
  try {
    const r = await fetch(API + 'chat.get?key=' + K + '&chat_id=' + encodeURIComponent(curChat));
    const j = await r.json();
    if (!r.ok) { if (!silent) alert(j.error || 'فشل التحميل'); return; }
    curPaused = !!j.paused;
    paintPauseBtn();
    const t = document.getElementById('thread');
    t.innerHTML = (j.messages || []).map((m) => {
      const cls = m.direction === 'in' ? 'b-in' : (m.sender_phone === 'BOT' ? 'b-out' : 'b-human');
      const who = m.direction === 'in' ? '+' + escJs(m.sender_phone) : (m.sender_phone === 'BOT' ? '🤖 البوت' : '🧑 الموظف');
      return '<div class="b ' + cls + '">' + escJs(m.text) +
        '<div class="b-meta">' + who + ' • ' + escJs((m.created_at || '').slice(5, 16)) + '</div></div>';
    }).join('') || '<p class="muted">لا رسائل.</p>';
    t.scrollTop = t.scrollHeight;
  } catch (e) { if (!silent) alert('خطأ شبكة: ' + e); }
}

async function openChat(chat, btn) {
  curChat = chat;
  document.querySelectorAll('.conv').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('chat-layout').classList.add('chat-open');
  document.getElementById('thread-title').textContent = chat;
  document.getElementById('thread-title').dir = 'ltr';
  document.getElementById('ai-summary').style.display = 'none';
  document.getElementById('reply-form').style.display = 'flex';
  const qr = document.getElementById('quick-replies');
  if (qr) qr.style.display = 'flex';
  document.getElementById('btn-summary').style.display = '';
  await loadThread(false);
}

function quickFillReply(txt) {
  const inp = document.getElementById('reply-text');
  if (inp) {
    inp.value = txt;
    inp.focus();
  }
}

function closeChat() {
  curChat = null;
  document.getElementById('chat-layout').classList.remove('chat-open');
}

function paintPauseBtn() {
  const b = document.getElementById('btn-pause');
  b.style.display = '';
  b.textContent = curPaused ? '▶ تشغيل البوت' : '⏸ إيقاف البوت';
}

function normChat(v) {
  v = v.trim();
  if (v.includes('@')) return v;
  let d = v.replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '963' + d.slice(1);
  return d + '@s.whatsapp.net';
}

function newChat(ev) {
  ev.preventDefault();
  const v = document.getElementById('newchat-phone').value.trim();
  if (!v) return false;
  openChat(normChat(v), null);
  refreshList();
  return false;
}

async function sendHuman(ev) {
  ev.preventDefault();
  const inp = document.getElementById('reply-text');
  const text = inp.value.trim();
  if (!text || !curChat) return false;
  const j = await postApi('msg.send', { to: curChat, text });
  if (j) { inp.value = ''; await loadThread(true); refreshList(); }
  return false;
}

async function togglePause() {
  if (!curChat) return;
  const phone = curChat.includes('@') ? curChat.split('@')[0].split(':')[0] : curChat;
  const j = await postApi('chat.pause', { phone, paused: !curPaused });
  if (j) { curPaused = !curPaused; paintPauseBtn(); refreshList(); }
}

async function aiSummary() {
  if (!curChat) return;
  const box = document.getElementById('ai-summary');
  box.style.display = 'block';
  box.textContent = '⏳ جاري التلخيص بواسطة AI…';
  const j = await postApi('ai.summarize', { chat_id: curChat });
  box.textContent = j ? j.summary : 'فشل التلخيص.';
}

setInterval(refreshList, 15000);
setInterval(() => {
  const inp = document.getElementById('reply-text');
  if (curChat && inp && !inp.value.trim()) loadThread(true);
}, 10000);
`;
  } else if (page === 'pricing') {
    const zonePricing = await getAllZonePricing(env.DB);
    const { results: zones } = await env.DB.prepare(`SELECT id, name, aliases, belt FROM zones ORDER BY belt, id`).all();
    const { results: fares } = await env.DB.prepare(
      `SELECT f.id, f.price, f.note, f.from_zone_id, f.to_zone_id, fz.name AS from_name, tz.name AS to_name
       FROM fixed_fares f
       JOIN zones fz ON fz.id = f.from_zone_id
       JOIN zones tz ON tz.id = f.to_zone_id
       ORDER BY f.id`
    ).all();
    title = 'تسعيرة المناطق والقرى';
    const zoneOptions = (zones ?? [])
      .map((z: any) => `<option value="${z.id}">${escHtml(z.name)} (حزام ${z.belt})</option>`)
      .join('');
    const aliasesOf = (z: any): string[] => {
      try { const a = JSON.parse(z.aliases || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
    };
    const aliasesCell = (z: any): string => {
      const chips = aliasesOf(z).map((a: string, i: number) =>
        `<span class="alias-chip">${escHtml(a)}<button title="مسح الاسم" onclick="delAlias(${z.id},${i})">×</button></span>`
      ).join('');
      return `${chips || '<span class="muted">—</span>'}
        <form class="alias-add" onsubmit="return addAlias(event, ${z.id}, this)">
          <input name="alias" placeholder="+ اسم بديل / نطق تاني" style="width:120px" maxlength="60">
          <button class="small">+</button>
        </form>`;
    };
    body = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
  <div>
    <h2 style="margin:0 0 4px 0;">🏷️ تسعيرة المناطق والمشاوير — كابتن عز بالعياط</h2>
    <p class="page-desc" style="margin:0;">إدارة تسعيرة فئات المناطق الرئيسية (داخل العياط، ريفية، مدينة، مطار القاهرة، مشوار خاص). أي تعديل هنا ينعكس <b>فورياً في بوت واتساب</b> للعملاء.</p>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <button type="button" onclick="previewWhatsAppPricing()" style="background:#075e54;color:#fff;border:0;padding:9px 15px;border-radius:8px;font-weight:bold;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
      💬 معاينة رد بوت واتساب
    </button>
    <button type="button" onclick="toggleAddCategoryModal()" style="background:#0e7c66;color:#fff;border:0;padding:9px 15px;border-radius:8px;font-weight:bold;cursor:pointer;">
      ➕ إضافة فئة منطقة
    </button>
    <button type="button" class="small" onclick="resetDefaultPricing()" style="padding:9px 12px;border-radius:8px;font-weight:bold;cursor:pointer;">
      🔄 استعادة الفئات الـ 5
    </button>
  </div>
</div>

<!-- Modal معاينة رسالة الواتساب -->
<div id="waPreviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div style="background:#efeae2;max-width:550px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.3);border:1px solid #c2b9a7;margin:auto;">
    <div style="background:#075e54;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;display:flex;align-items:center;gap:8px;">📱 معاينة رسالة تسعيرة المناطق في واتساب</b>
      <button onclick="document.getElementById('waPreviewModal').style.display='none'" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
    </div>
    <div style="padding:16px;max-height:70vh;overflow-y:auto;">
      <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.12);border-top-right-radius:2px;font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap;color:#111;" id="waPreviewContent">جاري التحميل...</div>
    </div>
    <div style="background:#e3ded5;padding:10px 16px;text-align:left;">
      <button onclick="document.getElementById('waPreviewModal').style.display='none'" style="padding:6px 16px;border-radius:6px;border:1px solid #999;cursor:pointer;">إغلاق</button>
    </div>
  </div>
</div>

<!-- Modal تعديل فئة تسعير -->
<div id="editZoneModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div style="background:var(--card);max-width:520px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.3);border:1px solid var(--line);margin:auto;">
    <div style="background:var(--accent);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;" id="editModalTitle">✏️ تعديل تسعيرة الفئة</b>
      <button onclick="document.getElementById('editZoneModal').style.display='none'" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
    </div>
    <form onsubmit="return submitEditZone(event)" style="padding:20px;">
      <input type="hidden" id="edit_zone_id" name="id">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">اسم فئة المنطقة</label>
          <input id="edit_zone_name" name="name" required style="width:100%;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">الأيقونة / الرمز</label>
          <input id="edit_zone_icon" name="icon" style="width:100%;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">السعر الأساسي (ذهاب) 💰</label>
          <input id="edit_zone_base_price" name="base_price" type="number" min="0" required style="width:100%;font-weight:bold;font-size:16px;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">ذهاب وعودة / انتظار 🔄</label>
          <input id="edit_zone_return_price" name="return_price" type="number" min="0" style="width:100%;font-weight:bold;">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">الشرح والقرى والمناطق المشمولة</label>
        <textarea id="edit_zone_description" name="description" rows="3" style="width:100%;resize:vertical;"></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" onclick="document.getElementById('editZoneModal').style.display='none'" style="padding:8px 16px;">إلغاء</button>
        <button type="submit" style="padding:8px 20px;font-weight:bold;">💾 حفظ التعديلات</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal إضافة فئة جديدة -->
<div id="addZoneModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div style="background:var(--card);max-width:520px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.3);border:1px solid var(--line);margin:auto;">
    <div style="background:#0e7c66;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:15px;">➕ إضافة فئة تسعير منطقة جديدة</b>
      <button onclick="document.getElementById('addZoneModal').style.display='none'" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
    </div>
    <form onsubmit="return submitAddZone(event)" style="padding:20px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">اسم الفئة</label>
          <input name="name" required placeholder="مثال: مطار سفنكس" style="width:100%;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">الأيقونة (Emoji)</label>
          <input name="icon" value="📍" style="width:100%;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">السعر الأساسي (ذهاب) 💰</label>
          <input name="base_price" type="number" min="0" required placeholder="300" style="width:100%;font-weight:bold;">
        </div>
        <div>
          <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">ذهاب وعودة (اختياري)</label>
          <input name="return_price" type="number" min="0" placeholder="500" style="width:100%;">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">الشرح والقرى والمناطق المشمولة</label>
        <textarea name="description" rows="2" placeholder="تفاصيل النطاق الجغرافي المشمول..." style="width:100%;"></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" onclick="document.getElementById('addZoneModal').style.display='none'" style="padding:8px 16px;">إلغاء</button>
        <button type="submit" style="padding:8px 20px;font-weight:bold;">➕ إضافة الفئة</button>
      </div>
    </form>
  </div>
</div>

<!-- 1. جدول تسعيرة فئات المناطق الرئيسية المعتمدة -->
<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:28px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
    <h3 style="margin:0;font-size:17px;display:flex;align-items:center;gap:8px;">
      🏷️ 1. جدول تسعيرة فئات المناطق المعتمدة (تظهر ديناميكياً بواتساب)
    </h3>
    <span style="font-size:13px;color:var(--muted);">عدد الفئات النشطة: <b>${zonePricing.filter(z => z.is_active === 1).length}</b> من ${zonePricing.length}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th style="min-width:140px;">فئة المنطقة</th>
        <th style="min-width:120px;">السعر الأساسي (ذهاب)</th>
        <th style="min-width:130px;">ذهاب وعودة / انتظار</th>
        <th>الشرح والقرى المشمولة</th>
        <th style="width:110px;">الحالة في البوت</th>
        <th style="min-width:170px;">إجراءات التسعير</th>
      </tr>
    </thead>
    <tbody>
      ${zonePricing.map((item) => `
      <tr style="${item.is_active === 0 ? 'opacity:0.6;background:var(--tab-bg);' : ''}">
        <td><b>${item.id}</b></td>
        <td>
          <span style="font-size:18px;margin-left:4px;">${item.icon || '📍'}</span>
          <b>${escHtml(item.name)}</b>
        </td>
        <td>
          <span style="font-size:16px;font-weight:bold;color:#0e7c66;">${formatEGP(item.base_price)}</span>
        </td>
        <td>
          ${item.return_price > 0 ? `<span style="font-weight:bold;">${formatEGP(item.return_price)}</span>` : '<span class="muted">—</span>'}
        </td>
        <td style="font-size:13px;color:var(--ink);">${escHtml(item.description || '—')}</td>
        <td>
          ${item.is_active === 1 ? '<span class="pill" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;">🟢 نشط بالبوت</span>' : '<span class="pill" style="background:#f1f5f9;color:#64748b;">⚪ معطل</span>'}
        </td>
        <td>
          <button class="small" onclick='openEditZoneModal(${JSON.stringify(item)})' style="font-weight:bold;">✏️ تعديل السعر</button>
          <button class="small" onclick="toggleZoneActive(${item.id}, ${item.is_active})" title="${item.is_active === 1 ? 'تعطيل من البوت' : 'تفعيل بالبوت'}">
            ${item.is_active === 1 ? 'إيقاف' : 'تفعيل'}
          </button>
          <button class="small danger" onclick="delZoneCategory(${item.id}, '${escHtml(item.name)}')">حذف</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div style="font-size:12px;color:var(--muted);margin-top:10px;">
    💡 <b>ملاحظة ذكية:</b> عند إرسال العميل أي كلمة مثل «<b>الأسعار</b>» أو «<b>تسعيرة المناطق</b>» في واتساب، يرسل البوت جدول الأسعار الحالي أعلاه بشكل فوري ومحدث.
  </div>
</div>

<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
  <div>
    <h3 style="margin:0 0 4px 0;">📍 2. إضافة وتوزيع القرى الفردية على الأحزمة الجغرافية</h3>
    <p class="page-desc" style="margin:0;">لربط كل قرية أو منطقة بحزام جغرافي محدد لحساب المسافات التقديرية.</p>
  </div>
  ${(zones && zones.length > 0) || (fares && fares.length > 0) ? `
  <button class="small danger" onclick="clearAllPricingData()" style="padding:6px 12px;font-weight:bold;">
    🗑️ مسح كل القرى الفردية
  </button>` : ''}
</div>

<form class="bar" onsubmit="return addZone(event, this)">
  <label>اسم القرية / المنطقة</label><input name="name" required placeholder="مثال: برنشت، المتانيا، العياط المحطة" style="width:200px">
  <label>أسماء بديلة (افصل بفاصلة)</label><input name="aliases" placeholder="مثال: المحطة, الموقف, السكة" style="width:220px">
  <label>الحزام الجغرافي</label>
  <select name="belt">
    <option value="1">حزام 1 — داخل العياط والمدينة</option>
    <option value="2">حزام 2 — قرى قريبة ومداخل</option>
    <option value="3">حزام 3 — قرى بعيدة وريف</option>
  </select>
  <button>➕ إضافة قرية / منطقة</button>
</form>
<table>
<tr><th>#</th><th>اسم المنطقة أو القرية</th><th>أسماء بديلة يتعرف عليها السيستم</th><th>الحزام</th><th>إجراءات</th></tr>
${(zones ?? []).map((z: any) => `<tr>
  <td>${z.id}</td><td><b>${escHtml(z.name)}</b></td><td>${aliasesCell(z)}</td>
  <td><span class="pill">${z.belt === 1 ? 'حزام 1 (مدينة)' : z.belt === 2 ? 'حزام 2 (ضواحي)' : 'حزام 3 (ريف)'}</span></td>
  <td>
    <button class="small" onclick="zoneBelt(${z.id},${z.belt >= 3 ? 1 : z.belt + 1})">تغيير الحزام ← ${z.belt >= 3 ? 1 : z.belt + 1}</button>
    <button class="small danger" onclick="delZone(${z.id})">حذف</button>
  </td>
</tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">لسه ما ضفتش أي قرية أو منطقة — ضيف أول قرية أو منطقة من الفورم فوق 👆</td></tr>'}
</table>

<h3 style="margin-top:28px;margin-bottom:8px;">💰 3. تسعير المشوار الثابت (بين قريتين محددتين)</h3>
<p class="page-desc" style="margin-top:0;">تحديد سعر ثابت لمسار مخصص بين نقطتين محددتين (يلغي التسعيرة العامة للحزام إذا وُجد).</p>
${zones && zones.length >= 2 ? `
<form class="bar" onsubmit="return addFare(event, this)">
  <label>من</label><select name="from_zone_id" required>${zoneOptions}</select>
  <label>إلى</label><select name="to_zone_id" required>${zoneOptions}</select>
  <label>السعر (جنيه مصري)</label><input name="price" type="number" min="0" placeholder="مثال: 50" required style="width:130px">
  <label>ملاحظة اختيارية</label><input name="note" placeholder="مثال: تسعيرة رسمية معتمدة" style="width:160px">
  <button>➕ حفظ التسعيرة</button>
</form>
` : `
<div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:14px;border-radius:10px;margin-bottom:16px;color:#64748b;font-size:13px;">
  💡 لازم تضيف منطقتين أو قريتين على الأقل فوق عشان تقدر تحدد سعر المشوار المباشر بينهم.
</div>
`}
<table>
<tr><th>من</th><th>إلى</th><th>سعر المشوار (جنيه)</th><th>ملاحظة</th><th>إجراءات</th></tr>
${(fares ?? []).map((f: any) => `<tr>
  <td><b>${escHtml(f.from_name)}</b></td><td><b>${escHtml(f.to_name)}</b></td><td>${formatEGP(f.price)}</td><td>${escHtml(f.note ?? '')}</td>
  <td>
    <button class="small" onclick="editFare(${f.id}, ${f.price})">تعديل السعر</button>
    <button class="small danger" onclick="delFare(${f.id})">حذف</button>
  </td>
</tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">ما فيش أسعار مسجلة لسه — بمجرد إضافة قريتين هتقدر تثبت سعر المشوار بينهم.</td></tr>'}
</table>`;
    pageJs = `
function openEditZoneModal(item) {
  document.getElementById('edit_zone_id').value = item.id;
  document.getElementById('edit_zone_name').value = item.name || '';
  document.getElementById('edit_zone_icon').value = item.icon || '📍';
  document.getElementById('edit_zone_base_price').value = item.base_price || 0;
  document.getElementById('edit_zone_return_price').value = item.return_price || 0;
  document.getElementById('edit_zone_description').value = item.description || '';
  document.getElementById('editModalTitle').textContent = '✏️ تعديل تسعيرة: ' + (item.name || '');
  document.getElementById('editZoneModal').style.display = 'flex';
}

function toggleAddCategoryModal() {
  const m = document.getElementById('addZoneModal');
  m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

async function submitEditZone(ev) {
  ev.preventDefault();
  const f = ev.target;
  const id = +f.id.value;
  const base_price = +f.base_price.value;
  const return_price = +f.return_price.value;
  const description = f.description.value;
  const name = f.name.value;
  const icon = f.icon.value;
  await api('zone_pricing.edit', { id, base_price, return_price, description, name, icon });
  document.getElementById('editZoneModal').style.display = 'none';
  return false;
}

async function submitAddZone(ev) {
  ev.preventDefault();
  const f = ev.target;
  await api('zone_pricing.add', {
    name: f.name.value,
    icon: f.icon.value || '📍',
    base_price: +f.base_price.value,
    return_price: +f.return_price.value || 0,
    description: f.description.value || ''
  });
  document.getElementById('addZoneModal').style.display = 'none';
  return false;
}

function toggleZoneActive(id, curState) {
  const newState = curState === 1 ? 0 : 1;
  api('zone_pricing.toggle', { id, is_active: newState });
}

function delZoneCategory(id, name) {
  if (confirm('هل أنت متأكد من حذف فئة "' + name + '" من تسعيرة المناطق؟')) {
    api('zone_pricing.del', { id });
  }
}

function resetDefaultPricing() {
  if (confirm('هل تريد إعادة ضبط تسعيرة المناطق إلى الفئات الـ 5 المعتمدة (داخل العياط 40، ريفية 70، مدينة 240، مطار القاهرة 550، مشوار خاص 450)؟')) {
    api('zone_pricing.reset', {});
  }
}

async function previewWhatsAppPricing() {
  const modal = document.getElementById('waPreviewModal');
  const box = document.getElementById('waPreviewContent');
  modal.style.display = 'flex';
  box.textContent = '⏳ جاري استخراج معاينة رسالة الواتساب...';
  const res = await postApi('zone_pricing.preview', {});
  if (res && res.preview) {
    box.textContent = res.preview;
  } else {
    box.textContent = 'تعذر تحميل المعاينة.';
  }
}

function addFare(ev, f) {
  ev.preventDefault();
  return api('fare.add', { from_zone_id: +f.from_zone_id.value, to_zone_id: +f.to_zone_id.value, price: +f.price.value, note: f.note.value });
}
function editFare(id, oldPrice) {
  const p = prompt('اكتب السعر الجديد بالجنيه المصري:', oldPrice);
  if (p && !isNaN(+p)) api('fare.edit', { id, price: +p });
}
function delFare(id) { if (confirm('متأكد إنك عايز تحذف السعر ده؟')) api('fare.del', { id }); }
function addZone(ev, f) {
  ev.preventDefault();
  return api('zone.add', { name: f.name.value, aliases: f.aliases.value.split(',').map(s => s.trim()).filter(Boolean), belt: +f.belt.value });
}
function zoneBelt(id, belt) { api('zone.belt', { id, belt }); }
function delZone(id) { if (confirm('متأكد إنك عايز تحذف المنطقة دي؟')) api('zone.del', { id }); }
function addAlias(ev, id, f) {
  ev.preventDefault();
  const v = f.alias.value.trim();
  if (v) api('zone.alias.add', { id, alias: v });
  return false;
}
function delAlias(id, index) { api('zone.alias.del', { id, index }); }
function clearAllPricingData() {
  if (confirm('تحذير: هل أنت متأكد تماماً من مسح كل القرى والتسعيرات للبدء من الصفر؟')) {
    api('pricing.clearAll', {});
  }
}

`;
  } else if (page === 'drivers') {
    const { results: drivers } = await env.DB.prepare(
      `SELECT id, name, phone, car, plate, status, commission_pct, active FROM drivers ORDER BY active DESC, id DESC`
    ).all();
    title = 'إدارة وتفعيل حسابات السائقين والكباتن';
    body = `
<div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:14px 16px;margin-bottom:18px;line-height:1.6;font-size:13px;color:#9a3412;">
  💡 <b>كيف يعمل نظام السائقين؟</b><br>
  بمجرد إضافة وتفعيل رقم موبايل السائق في هذا الجدول، يستطيع السائق الدخول فوراً عبر الرابط المخصص:
  <a href="/driver" target="_blank" style="font-weight:bold;color:#ea580c;text-decoration:underline;">/driver</a>
  بمجرد كتابة رقم هاتفه فقط (بدون أي كلمة سر معقدة)، ويفتح له كشف ركاب باصه اليومي وتأكيد ركوبهم 🟢، ويثبت التطبيق على هاتفه بشكل دائم!
</div>

<form class="bar" onsubmit="return addDriver(event, this)" style="background:var(--card);border:1px solid var(--line);padding:16px;border-radius:12px;margin-bottom:20px;">
  <div style="display:flex;flex-direction:column;gap:4px;">
    <label style="font-weight:bold;">اسم الكابتن *</label>
    <input name="name" required placeholder="مثال: كابتن محمد العياطي" style="width:180px;">
  </div>
  <div style="display:flex;flex-direction:column;gap:4px;">
    <label style="font-weight:bold;">رقم الموبايل (واتساب) *</label>
    <input name="phone" dir="ltr" required placeholder="010XXXXXXXX" style="width:160px;font-family:monospace;font-weight:bold;">
  </div>
  <div style="display:flex;flex-direction:column;gap:4px;">
    <label style="font-weight:bold;">السيارة / خط الباص</label>
    <input name="car" placeholder="مثال: تويوتا هايس 14 راكب - خط حلوان" style="width:220px;">
  </div>
  <div style="display:flex;flex-direction:column;gap:4px;">
    <label style="font-weight:bold;">رقم اللوحة</label>
    <input name="plate" placeholder="ب ع د 123" style="width:110px;">
  </div>
  <div style="display:flex;flex-direction:column;gap:4px;">
    <label style="font-weight:bold;">العمولة %</label>
    <input name="commission_pct" type="number" value="10" min="0" max="50" style="width:80px;">
  </div>
  <div style="display:flex;align-items:flex-end;margin-top:16px;">
    <button style="background:#ea580c;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">➕ تفعيل وإضافة كابتن</button>
  </div>
</form>

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
  <h3 style="margin:0;font-size:15px;font-weight:bold;">📋 قائمة السائقين والكباتن المسجلين (${(drivers ?? []).length} سائق)</h3>
  <span style="font-size:12px;color:var(--muted);">المفعلون يتاح لهم الدخول عبر /driver برقم الهاتف</span>
</div>

<table>
<tr>
  <th>#</th>
  <th>اسم الكابتن</th>
  <th>رقم الموبايل</th>
  <th>السيارة / الخط</th>
  <th>اللوحة</th>
  <th>حالة الدخول بالهاتف</th>
  <th>الحالة الميدانية</th>
  <th>شاشة كشف الركاب</th>
  <th>إجراءات الإدارة</th>
</tr>
${(drivers ?? []).map((d: any) => `<tr>
  <td>${d.id}</td>
  <td><b>${escHtml(d.name)}</b></td>
  <td dir="ltr" style="font-family:monospace;font-weight:bold;">
    ${escHtml(d.phone)}
    <a href="https://wa.me/2${escHtml(d.phone.replace(/^2/, ''))}" target="_blank" style="text-decoration:none;margin-right:4px;" title="واتساب">💬</a>
  </td>
  <td>${escHtml(d.car || '—')}</td>
  <td>${escHtml(d.plate || '—')}</td>
  <td>
    ${d.active === 1 ? '<span class="pill" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-weight:bold;">🟢 مفعل للدخول</span>' : '<span class="pill" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font-weight:bold;">🔴 معطل</span>'}
  </td>
  <td>
    <button class="small" onclick="driverStatus(${d.id},'${d.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE'}')" style="padding:4px 8px;font-size:11px;">
      ${d.status === 'AVAILABLE' ? '🟢 متاح' : '⚪ غير متاح'}
    </button>
  </td>
  <td>
    <a href="/driver?phone=${encodeURIComponent(d.phone)}" target="_blank" class="small" style="text-decoration:none;display:inline-block;padding:5px 10px;background:#f1f5f9;color:#0e7c66;font-weight:bold;border-radius:6px;border:1px solid #cbd5e1;">
      📋 فتح كشف الركاب ↗
    </a>
  </td>
  <td>
    <button class="small" onclick="driverToggleActive(${d.id}, ${d.active})" style="padding:4px 8px;">
      ${d.active === 1 ? 'تعطيل الحساب' : 'تفعيل الحساب'}
    </button>
    <button class="small danger" onclick="delDriver(${d.id})" style="padding:4px 8px;">حذف</button>
  </td>
</tr>`).join('') || '<tr><td colspan="9" class="muted" style="text-align:center;padding:24px;">لا يوجد سائقين مسجلين بعد. أضف أول كابتن من النموذج أعلاه 👆</td></tr>'}
</table>`;
    pageJs = `
function addDriver(ev, f) {
  ev.preventDefault();
  const phone = f.phone.value.replace(/[^0-9]/g, '');
  if (!phone) {
    alert('يرجى إدخال رقم الهاتف بشكل صحيح');
    return false;
  }
  return api('driver.add', {
    name: f.name.value,
    phone: phone,
    car: f.car.value,
    plate: f.plate.value,
    commission_pct: +f.commission_pct.value,
  });
}
function driverStatus(id, status) { api('driver.status', { id, status }); }
function driverToggleActive(id, curActive) {
  const newActive = curActive === 1 ? 0 : 1;
  api('driver.toggle_active', { id, active: newActive });
}
function delDriver(id) { if (confirm('هل أنت متأكد من حذف السائق رقم ' + id + ' نهائياً؟')) api('driver.del', { id }); }
`;
  } else if (page === 'rides') {
    const { results: rides } = await env.DB.prepare(
      `SELECT r.id, r.client_phone, r.client_name, r.from_text, r.to_text, 
              r.status, r.price, r.client_offered_price, r.final_price, 
              r.negotiation_state, r.created_at,
              fz.name AS from_name, tz.name AS to_name, d.name AS driver_name, d.phone AS driver_phone
       FROM rides r
       LEFT JOIN zones fz ON fz.id = r.from_zone_id
       LEFT JOIN zones tz ON tz.id = r.to_zone_id
       LEFT JOIN drivers d ON d.id = r.driver_id
       ORDER BY r.id DESC LIMIT 50`
    ).all();

    // Fetch recent bids for these rides
    const { results: bids } = await env.DB.prepare(
      `SELECT * FROM ride_bids ORDER BY id DESC LIMIT 100`
    ).all();

    const bidsByRide = new Map<number, any[]>();
    for (const b of (bids || [])) {
      const list = bidsByRide.get((b as any).ride_id) || [];
      list.push(b);
      bidsByRide.set((b as any).ride_id, list);
    }

    title = 'المشاوير الخاصة والعادية والتفاوض';
    body = `<p class="page-desc">متابعة حية لطلبات المشاوير من العياط وقراها، المبالغ المقدرة من العملاء، وعروض الأسعار والتفاوض من الكباتن.</p>
<table>
<tr>
  <th>#</th>
  <th>العميل</th>
  <th>مكان الركوب</th>
  <th>مكان النزول</th>
  <th>السعر المقدر</th>
  <th>عروض وتفاوض الكباتن</th>
  <th>السعر النهائي / الكابتن</th>
  <th>حالة التفاوض</th>
  <th>حالة المشوار</th>
  <th>الوقت</th>
  <th></th>
</tr>
${(rides ?? []).map((r: any) => {
  const rideBids = bidsByRide.get(r.id) || [];
  let bidsHtml = '—';
  if (rideBids.length > 0) {
    bidsHtml = rideBids.map((b: any) => 
      `<div style="font-size:12px;margin-bottom:2px;background:var(--tab-bg);padding:2px 6px;border-radius:4px;">
        🚗 <b>${escHtml(b.driver_name)}</b>: <span style="color:var(--accent);font-weight:bold;">${formatEGP(b.offered_price)}</span> 
        <span class="muted">(${b.status})</span>
      </div>`
    ).join('');
  }

  let negoBadge = '<span class="pill">مفتوح للتقديم</span>';
  if (r.negotiation_state === 'driver_offered') negoBadge = '<span class="pill" style="background:#fff3cd;color:#856404;">وصل عرض كابتن</span>';
  else if (r.negotiation_state === 'client_countered') negoBadge = '<span class="pill" style="background:#d1ecf1;color:#0c5460;">تفاوض من العميل</span>';
  else if (r.negotiation_state === 'agreed') negoBadge = '<span class="pill" style="background:#d4edda;color:#155724;">✅ تم الاتفاق</span>';
  else if (r.negotiation_state === 'rejected') negoBadge = '<span class="pill" style="background:#f8d7da;color:#721c24;">مرفوض</span>';

  return `<tr>
  <td><b>#${r.id}</b></td>
  <td>
    <b>${escHtml(r.client_name || 'عميل')}</b><br>
    <span dir="ltr" style="font-size:12px;color:var(--muted);">${escHtml(r.client_phone)}</span>
  </td>
  <td>${escHtml(r.from_text || r.from_name || '—')}</td>
  <td>${escHtml(r.to_text || r.to_name || '—')}</td>
  <td><b style="color:#d35400;">${r.client_offered_price ? formatEGP(r.client_offered_price) : (r.price ? formatEGP(r.price) : '—')}</b></td>
  <td>${bidsHtml}</td>
  <td>
    ${r.driver_name ? `<b>${escHtml(r.driver_name)}</b><br><span style="color:var(--accent);font-weight:bold;">${formatEGP(r.final_price || r.price)}</span>` : '<span class="muted">بانتظار كابتن</span>'}
  </td>
  <td>${negoBadge}</td>
  <td><span class="st ${r.status}">${r.status}</span></td>
  <td style="font-size:12px;">${escHtml((r.created_at ?? '').slice(11, 16))}</td>
  <td>${['NEW', 'DISPATCHING', 'ASSIGNED', 'ARRIVED', 'IN_RIDE'].includes(r.status)
    ? `<button class="small danger" onclick="cancelRide(${r.id})">إلغاء</button>` : ''}</td>
</tr>`;
}).join('') || '<tr><td colspan="11" class="muted">لا توجد مشاوير مسجلة بعد.</td></tr>'}
</table>`;
    pageJs = `
function cancelRide(id) {
  if (confirm('إلغاء الرحلة ' + id + '؟')) api('ride.cancel', { id });
}
`;
  } else if (page === 'shuttle') {
    const lines = await getShuttleLines(env.DB);
    const vehicles = await getShuttleVehicles(env.DB);
    const bookings = await getShuttleBookings(env.DB);

    title = 'خطوط وجروبات باصات وسيارات الجامعات المصرية (انطلاق العياط)';
    body = `<p class="page-desc">إدارة شبكة خطوط وجروبات الجامعات المصرية (16 جامعة) لخدمة طلاب العياط وقراها. أسطول باصات 14 راكب وسيارات خاصة وتنسيق الحجوزات اليومية.</p>

<div class="stats" style="margin-bottom:16px;">
  <div class="stat"><div class="n">${lines.length}</div>خطوط الجامعات المعتمدة</div>
  <div class="stat"><div class="n">${vehicles.length}</div>سيارة وباص بالخدمة</div>
  <div class="stat"><div class="n">${bookings.length}</div>مقاعد محجوزة لرحلات اليوم</div>
</div>

<h2>🎓 جدول خطوط الجامعات الـ 16</h2>
<table>
<tr>
  <th>#</th>
  <th>اسم الجامعة والخط</th>
  <th>نقطة الانطلاق (العياط وقراها)</th>
  <th>موعد التحرك</th>
  <th>موعد العودة</th>
  <th>تسعيرة المقعد</th>
  <th>السيارات المخصصة</th>
  <th>الطلاب المحجوزين</th>
</tr>
${lines.map((l: any, idx: number) => {
  const lineVehicles = vehicles.filter((v: any) => v.line_id === l.id);
  const lineBookings = bookings.filter((b: any) => b.line_id === l.id);
  const totalCap = lineVehicles.reduce((sum: number, v: any) => sum + v.seat_capacity, 0);

  return `<tr>
    <td><b>${idx + 1}</b></td>
    <td><b>${escHtml(l.name)}</b></td>
    <td>${escHtml(l.pickup_point)}</td>
    <td>⏰ ${escHtml(l.departure_time)}</td>
    <td>⏰ ${escHtml(l.return_time)}</td>
    <td><b>${l.round_trip_price} ج</b> ذهاب وعودة<br><span style="font-size:12px;color:var(--muted);">(${l.one_way_price} ج ذهاب فقط)</span></td>
    <td>
      ${lineVehicles.map((v: any) => `<span class="pill" style="margin-bottom:2px;display:inline-block;">🚗 ${escHtml(v.vehicle_name)} (${v.seat_capacity} راكب)</span>`).join('<br>') || '<span class="muted">قيد التخصيص</span>'}
    </td>
    <td>
      <b>${lineBookings.length}</b> / ${totalCap > 0 ? totalCap : '14'} مقعد
    </td>
  </tr>`;
}).join('')}
</table>

<h2>🚗 أسطول سيارات الـ 14 راكب والكباتن</h2>
<table>
<tr>
  <th>#</th>
  <th>السيارة</th>
  <th>الخط / الجامعة</th>
  <th>الكابتن المسؤول</th>
  <th>رقم الهاتف</th>
  <th>السعة</th>
  <th>المقاعد المحجوزة</th>
  <th>كشف الركاب للطباعة / النسخ</th>
</tr>
${vehicles.map((v: any) => `<tr>
  <td>${v.id}</td>
  <td><b>${escHtml(v.vehicle_name)}</b><br><span style="font-size:12px;color:var(--muted);">${escHtml(v.plate_number)}</span></td>
  <td>${escHtml(v.line_name || 'جامعة القاهرة')}</td>
  <td><b>${escHtml(v.driver_name)}</b></td>
  <td dir="ltr">${escHtml(v.driver_phone)}</td>
  <td>${v.seat_capacity} راكب</td>
  <td><span class="st ${v.booked_seats >= v.seat_capacity ? 'IN_RIDE' : 'ASSIGNED'}">${v.booked_seats || 0} من ${v.seat_capacity}</span></td>
  <td>
    <button class="small" onclick="viewManifest(${v.id}, '${escHtml(v.vehicle_name)}')">📋 كشف الطباعة</button>
    <a href="/attendance?vehicle_id=${v.id}" target="_blank" class="small" style="background:#10b981;color:#fff;text-decoration:none;padding:5px 9px;border-radius:6px;font-weight:bold;margin-inline-start:4px;display:inline-block;">📱 رادار السائق</a>
  </td>
</tr>`).join('') || '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px;">لا توجد سيارات أو باصات مسجلة بعد.</td></tr>'}
</table>

<h2>📋 حجوزات طلاب اليوم</h2>
<table>
<tr>
  <th>#</th>
  <th>اسم الطالب</th>
  <th>رقم الهاتف</th>
  <th>الجامعة</th>
  <th>السيارة</th>
  <th>نوع الحجز</th>
  <th>نقطة الركوب</th>
  <th>المبلغ</th>
  <th>الحالة</th>
</tr>
${bookings.map((b: any) => `<tr>
  <td>${b.id}</td>
  <td><b>${escHtml(b.student_name)}</b> (${b.gender === 'بنات' ? '🌸 بنات' : (b.gender === 'شباب' ? '⚡ شباب' : 'عام')})</td>
  <td dir="ltr">${escHtml(b.student_phone)}</td>
  <td>${escHtml(b.line_name)}</td>
  <td>${escHtml(b.vehicle_name)}</td>
  <td>${b.direction === 'round' ? 'ذهاب وعودة' : (b.direction === 'one_way_go' ? 'ذهاب فقط' : 'عودة فقط')}</td>
  <td>${escHtml(b.pickup_location || 'العياط')}</td>
  <td><b>${formatEGP(b.fare_amount)}</b></td>
  <td><span class="st ASSIGNED">${escHtml(b.status)}</span></td>
</tr>`).join('') || '<tr><td colspan="9" class="muted">لا توجد حجوزات جامعية مسجلة لليوم بعد.</td></tr>'}
</table>`;

    pageJs = `
async function viewManifest(vehicleId, vName) {
  const r = await fetch('/admin/api?key=' + encodeURIComponent(K), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'shuttle.manifest', vehicleId })
  });
  const data = await r.json();
  if (data.ok && data.manifest) {
    alert('📋 كشف ركاب ' + vName + ':\\n\\n' + data.manifest);
  } else {
    alert('فشل جلب الكشف: ' + (data.error || 'لا توجد بيانات'));
  }
}
`;
  } else if (page === 'attendance') {
    const url = request ? new URL(request.url) : null;
    const targetDate = url?.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const vehicleFilter = url?.searchParams.get('vehicle_id') ? Number(url.searchParams.get('vehicle_id')) : undefined;

    const bookings = await getShuttleBookings(env.DB, targetDate, undefined, vehicleFilter);
    const vehicles = await getShuttleVehicles(env.DB);
    const lines = await getShuttleLines(env.DB);

    const totalSeats = bookings.reduce((sum: number, b: any) => sum + (b.seats_count || 1), 0);
    const boardedSeats = bookings.filter((b: any) => b.boarded === 1).reduce((sum: number, b: any) => sum + (b.seats_count || 1), 0);
    const waitingSeats = totalSeats - boardedSeats;
    const totalCapacity = vehicles.reduce((sum: number, v: any) => sum + v.seat_capacity, 0);

    const hostUrl = url ? `${url.protocol}//${url.host}` : '';
    const sheetsFormula = `=IMPORTDATA("${hostUrl}/api/export/csv?date=${targetDate}")`;
    const currentVehicle = vehicles.find((v: any) => v.id === vehicleFilter);
    const driverDirectUrl = vehicleFilter ? `${hostUrl}/attendance?vehicle_id=${vehicleFilter}&date=${targetDate}` : '';
    const driverWaText = currentVehicle ? encodeURIComponent(`يا مرحب كابتن ${currentVehicle.driver_name} 🚕\nده رابط كشف حضور وركاب باصك (${currentVehicle.vehicle_name}) لليوم:\n${driverDirectUrl}\nافتحه من موبايلك واضغط «تأكيد الركوب 🟢» أمام كل طالب يركب معاك. بالتوفيق!`) : '';

    title = 'رادار الحضور والركوب الحي — شيت السائق والإدارة';
    body = `<p class="page-desc">متابعة لحظية ومباشرة لحضور ركاب باصات العياط والجامعات. الركاب الذين أكدوا ركوبهم عبر الواتساب أو التذكرة ينورون <b style="color:#10b981;">بالأخضر 🟢</b>، ومن هم بالانتظار <b style="color:#ef4444;">بالأحمر 🔴</b>.</p>

<div class="stats" style="margin-bottom:16px;">
  <div class="stat" style="border-top: 4px solid var(--accent);"><div class="n">${totalSeats}</div>إجمالي ركاب اليوم</div>
  <div class="stat" style="border-top: 4px solid #10b981; background: #ecfdf5;"><div class="n" style="color:#065f46;">${boardedSeats}</div>🟢 ركبوا الباص (حاضرين)</div>
  <div class="stat" style="border-top: 4px solid #ef4444; background: #fef2f2;"><div class="n" style="color:#991b1b;">${waitingSeats}</div>🔴 في الانتظار (لم يركبوا)</div>
  <div class="stat" style="border-top: 4px solid #3b82f6;"><div class="n">${totalCapacity}</div>إجمالي السعة المتاحة (${vehicles.length} باص)</div>
</div>

<div class="box" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px;background:#f0fdf4;padding:12px 16px;border-radius:12px;border:1.5px solid #10b981;">
  <div style="font-weight:bold;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <span>🚌 تخصيص باص / سائق معين:</span>
    <select id="vehicleSelector" onchange="changeVehicle(this.value)" style="padding:8px 12px;border-radius:8px;border:1.5px solid #10b981;font-size:14px;font-weight:bold;background:#fff;cursor:pointer;">
      <option value="">-- 🚌 عرض كل الباصات والخطوط معاً --</option>
      ${vehicles.map((v: any) => `<option value="${v.id}" ${vehicleFilter === v.id ? 'selected' : ''}>${escHtml(v.vehicle_name)} — كابتن ${escHtml(v.driver_name)} (${escHtml(v.line_name || 'جامعة')})</option>`).join('')}
    </select>
  </div>
  ${vehicleFilter ? `
    <button onclick="copyDriverLink('${escHtml(driverDirectUrl)}')" class="btn" style="background:#0e7c66;color:#fff;border:0;padding:8px 14px;border-radius:8px;font-weight:bold;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
      🔗 نسخ رابط الموبايل لهذا السائق
    </button>
    <a href="https://wa.me/2${escHtml(String(currentVehicle?.driver_phone || '').replace(/[^0-9]/g, ''))}?text=${driverWaText}" target="_blank" class="btn" style="background:#10b981;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:bold;font-size:13px;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(16,185,129,0.3);">
      💬 إرسال الرابط للسائق واتساب
    </a>
    <a href="${escHtml(driverDirectUrl)}" target="_blank" style="font-size:13px;font-weight:bold;color:#0e7c66;text-decoration:underline;">
      📱 فتح شاشة السائق للمعاينة
    </a>
  ` : `
    <span style="font-size:13px;color:#065f46;font-weight:600;">💡 اختر باصاً محدداً لنسخ أو إرسال رابطه الخاص للسائق ليرى ركابه فقط دون باقي الباصات!</span>
  `}
</div>

<div class="box" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:18px;background:var(--card);padding:14px;border-radius:12px;border:1px solid var(--line);">
  <a href="/api/export/csv?date=${targetDate}" class="btn" style="background:#10b981;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
    📥 تحميل شيت إكسل كامل (Excel .CSV)
  </a>
  <button onclick="copySheetsFormula()" style="background:#0284c7;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer;">
    📊 ربط مباشر مع Google Sheets
  </button>
  <button onclick="window.print()" style="background:#fff;border:1.5px solid var(--line);padding:10px 16px;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer;">
    🖨️ طباعة شيت الكباتن
  </button>
  <a href="/book" target="_blank" style="background:var(--accent);color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold;font-size:14px;">
    🎫 فتح صفحة الحجز العامة
  </a>

  <div style="margin-inline-start:auto;display:flex;align-items:center;gap:8px;">
    <label style="font-size:13px;font-weight:bold;">📅 التاريخ:</label>
    <input type="date" id="attendanceDate" value="${targetDate}" onchange="changeDate(this.value)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--line);">
    <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:bold;background:var(--tab-bg);padding:6px 12px;border-radius:8px;cursor:pointer;">
      <input type="checkbox" id="autoRefreshCheck" checked onchange="toggleAutoRefresh(this.checked)">
      <span>📡 بث مباشر</span>
      <span id="liveIndicator" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
    </label>
  </div>
</div>

<div class="box" style="padding:0;overflow-x:auto;">
<table>
<thead>
<tr>
  <th>#</th>
  <th>كود التذكرة</th>
  <th>اسم الطالب / الراكب</th>
  <th>رقم الموبايل</th>
  <th>نقطة الركوب (العياط وقراها)</th>
  <th>الجامعة / الخط</th>
  <th>السائق والسيارة</th>
  <th>المقعد</th>
  <th>الأجرة والدفع</th>
  <th>🚦 حالة الحضور والركوب</th>
  <th>إجراءات الكابتن والإدارة</th>
</tr>
</thead>
<tbody>
${bookings.map((b: any, idx: number) => {
  const isBoarded = b.boarded === 1;
  const ticket = b.ticket_code || ('EZZ-' + (1000 + b.id));
  const payBadge = b.payment_method === 'subscription' ? '<span class="pill" style="background:#e0e7ff;color:#3730a3;">اشتراك شهري</span>' : (b.paid_status === 'paid' ? '<span class="pill" style="background:#dcfce7;color:#166534;">مدفوع كاش</span>' : '<span class="pill" style="background:#fef3c7;color:#92400e;">كاش بالباص</span>');

  return `<tr id="row-${b.id}" style="${isBoarded ? 'background:rgba(16,185,129,0.06);' : 'background:rgba(239,68,68,0.03);'}">
    <td><b>${idx + 1}</b></td>
    <td>
      <a href="/ticket/${escHtml(ticket)}" target="_blank" style="color:var(--accent);font-weight:bold;font-family:monospace;font-size:14px;text-decoration:underline;">
        ${escHtml(ticket)}
      </a>
    </td>
    <td>
      <b>${escHtml(b.student_name)}</b>
      <div style="font-size:11px;color:var(--muted);">${b.direction === 'round' ? 'ذهاب وعودة 🔄' : (b.direction === 'one_way_go' ? 'ذهاب فقط ➡️' : 'عودة فقط ⬅️')}</div>
    </td>
    <td>
      <span dir="ltr" style="font-weight:600;">${escHtml(b.student_phone)}</span>
      <div style="margin-top:2px;display:flex;gap:4px;">
        <a href="https://wa.me/2${escHtml(b.student_phone)}?text=أهلاً+بك+مع+كابتن+عز+🚕،+رابط+تذكرتك:+${encodeURIComponent(hostUrl + '/ticket/' + ticket)}" target="_blank" style="text-decoration:none;" title="واتساب">💬 واتساب</a>
        <a href="tel:${escHtml(b.student_phone)}" style="text-decoration:none;" title="اتصال">📞 اتصال</a>
      </div>
    </td>
    <td><b>${escHtml(b.pickup_location || 'موقف العياط')}</b></td>
    <td>
      <b>${escHtml(b.line_name)}</b>
      <div style="font-size:11px;color:var(--muted);">تحرك: ${escHtml(b.departure_time || '06:15 ص')}</div>
    </td>
    <td>
      <b>${escHtml(b.driver_name || 'كابتن الخط')}</b>
      <div style="font-size:11px;color:var(--muted);">${escHtml(b.vehicle_name || '14 راكب')} ${b.plate_number ? ('(' + escHtml(b.plate_number) + ')') : ''}</div>
    </td>
    <td><span class="pill" style="font-weight:bold;">مقعد #${b.seat_no || 1}</span></td>
    <td>
      <b>${b.fare_amount} ج</b><br>
      ${payBadge}
    </td>
    <td>
      ${isBoarded ? `
        <span style="display:inline-flex;align-items:center;gap:6px;background:#d1fae5;color:#065f46;font-weight:800;font-size:13px;padding:6px 14px;border-radius:20px;border:2px solid #10b981;">
          🟢 ركب وحضر (${escHtml(b.boarded_at || 'الآن')})
        </span>
      ` : `
        <span style="display:inline-flex;align-items:center;gap:6px;background:#fee2e2;color:#991b1b;font-weight:800;font-size:13px;padding:6px 14px;border-radius:20px;border:2px solid #ef4444;">
          🔴 في الانتظار (لم يركب)
        </span>
      `}
    </td>
    <td>
      <button onclick="toggleBoard(${b.id}, ${isBoarded ? 0 : 1})" class="small" style="background:${isBoarded ? '#ef4444' : '#10b981'};color:#fff;border:0;border-radius:6px;font-weight:bold;cursor:pointer;padding:6px 12px;">
        ${isBoarded ? 'إعادة للانتظار 🔴' : 'تأكيد الحضور 🟢'}
      </button>
      <a href="/ticket/${escHtml(ticket)}" target="_blank" class="small" style="display:inline-block;padding:6px 10px;border-radius:6px;background:var(--tab-bg);color:var(--ink);text-decoration:none;font-size:12px;margin-inline-start:4px;">
        🎫 كارت الركوب
      </a>
    </td>
  </tr>`;
}).join('') || '<tr><td colspan="11" class="muted" style="text-align:center;padding:30px;">لا توجد حجوزات مسجلة لهذا التاريخ بعد. <a href="/book" target="_blank">اضغط هنا لإضافة حجز جديد</a></td></tr>'}
</tbody>
</table>
</div>`;

    pageJs = `
let refreshInterval = null;

function startPolling() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    try {
      const dot = document.getElementById('liveIndicator');
      if (dot) dot.style.opacity = '0.3';
      const r = await fetch(location.href, { headers: { 'Accept': 'text/html' } });
      if (r.ok) {
        const text = await r.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const newTable = doc.querySelector('table tbody');
        const oldTable = document.querySelector('table tbody');
        if (newTable && oldTable) oldTable.innerHTML = newTable.innerHTML;
        const newStats = doc.querySelector('.stats');
        const oldStats = document.querySelector('.stats');
        if (newStats && oldStats) oldStats.innerHTML = newStats.innerHTML;
      }
      if (dot) dot.style.opacity = '1';
    } catch (e) {
      console.error('Polling error', e);
    }
  }, 4000);
}

function toggleAutoRefresh(enabled) {
  if (enabled) startPolling();
  else if (refreshInterval) clearInterval(refreshInterval);
}
startPolling();

function changeDate(d) {
  const u = new URL(location.href);
  u.searchParams.set('date', d);
  location.href = u.toString();
}

function changeVehicle(vId) {
  const u = new URL(location.href);
  if (vId) {
    u.searchParams.set('vehicle_id', vId);
  } else {
    u.searchParams.delete('vehicle_id');
  }
  location.href = u.toString();
}

function copyDriverLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('✅ تم نسخ رابط كشف السائق إلى الحافظة!\\n\\nيمكنك إرساله للكابتن الآن على الواتساب:\\n' + url);
  }).catch(() => {
    prompt('انسخ رابط السائق التالي:', url);
  });
}

async function toggleBoard(bookingId, targetState) {
  const res = await postApi('shuttle.board.toggle', { bookingId, boarded: targetState });
  if (res && res.ok) {
    location.reload();
  }
}

function copySheetsFormula() {
  const formula = '${sheetsFormula}';
  navigator.clipboard.writeText(formula).then(() => {
    alert('✅ تم نسخ معادلة Google Sheets إلى الحافظة!\\n\\nالصقها في أي خلية داخل Google Sheets:\\n' + formula);
  }).catch(() => {
    prompt('انسخ المعادلة التالية والصقها في Google Sheets:', formula);
  });
}
`;
  } else if (page === 'clients') {
    const clients = await getClientsDirectory(env.DB);
    title = 'دليل العملاء والركاب المسجلين بالعياط';
    body = `<p class="page-desc">سجل شامل بالعملاء والطلاب الذين حجزوا باصات الجامعات أو طلبوا مشاوير خاصة من العياط وقراها.</p>

<div class="box" style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
  <button onclick="document.getElementById('addClientModal').style.display='block'" class="small" style="background:var(--accent);color:#fff;border:0;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">
    ➕ إضافة عميل جديد يدوي
  </button>
  <a href="/api/export/csv" class="small" style="background:#10b981;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-weight:bold;">
    📥 تصدير الدليل كشيت Excel
  </a>
</div>

<div id="addClientModal" class="box" style="display:none;margin-bottom:20px;border:2px solid var(--accent);background:var(--card);padding:18px;border-radius:12px;">
  <h3 style="margin-top:0;">إضافة عميل / طالب جديد</h3>
  <form onsubmit="return submitNewClient(event)" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
    <div>
      <label>👤 اسم العميل / الطالب *</label>
      <input id="c_name" required placeholder="مثال: حسام طارق">
    </div>
    <div>
      <label>📱 رقم الموبايل *</label>
      <input id="c_phone" required dir="ltr" placeholder="010XXXXXXXX">
    </div>
    <div>
      <label>📍 القرية / مكان الانطلاق بالعياط</label>
      <input id="c_village" placeholder="العياط / المتانيا / البليدة">
    </div>
    <div>
      <label>🎓 الجامعة / الوجهة المعتادة</label>
      <input id="c_dest" placeholder="جامعة القاهرة">
    </div>
    <div style="grid-column:1/-1;display:flex;gap:8px;margin-top:10px;">
      <button class="small" type="submit" style="background:var(--accent);color:#fff;font-weight:bold;">حفظ العميل</button>
      <button class="small" type="button" onclick="document.getElementById('addClientModal').style.display='none'">إلغاء</button>
    </div>
  </form>
</div>

<div class="box" style="padding:0;overflow-x:auto;">
<table>
<thead>
<tr>
  <th>#</th>
  <th>اسم العميل</th>
  <th>رقم الموبايل</th>
  <th>القرية / المحطة</th>
  <th>الوجهة المعتادة</th>
  <th>مشاوير الباصات</th>
  <th>المشاوير الخاصة</th>
  <th>إجمالي المشاوير</th>
  <th>تاريخ الانضمام</th>
  <th>تواصل مباشر</th>
</tr>
</thead>
<tbody>
${clients.map((c: any, idx: number) => `<tr>
  <td>${idx + 1}</td>
  <td><b>${escHtml(c.name || 'عميل')}</b></td>
  <td dir="ltr"><b>${escHtml(c.phone)}</b></td>
  <td>${escHtml(c.village || 'العياط')}</td>
  <td>${escHtml(c.destination_fav || '—')}</td>
  <td><span class="pill">${c.shuttle_trips || 0}</span></td>
  <td><span class="pill">${c.private_trips || 0}</span></td>
  <td><b style="color:var(--accent);font-size:15px;">${c.trips_count || 1}</b></td>
  <td style="font-size:12px;color:var(--muted);">${escHtml((c.created_at || '').slice(0, 10))}</td>
  <td>
    <a href="https://wa.me/2${escHtml(c.phone)}?text=أهلاً+بك+مع+كابتن+عز+🚕" target="_blank" style="text-decoration:none;font-weight:bold;color:#16a34a;">💬 واتساب</a>
    <a href="tel:${escHtml(c.phone)}" style="text-decoration:none;font-weight:bold;color:#2563eb;margin-inline-start:6px;">📞 اتصال</a>
  </td>
</tr>`).join('') || '<tr><td colspan="10" class="muted" style="text-align:center;padding:24px;">لا يوجد عملاء مسجلين بعد.</td></tr>'}
</tbody>
</table>
</div>`;

    pageJs = `
async function submitNewClient(e) {
  e.preventDefault();
  const name = document.getElementById('c_name').value.trim();
  const phone = document.getElementById('c_phone').value.trim();
  const village = document.getElementById('c_village').value.trim();
  const dest = document.getElementById('c_dest').value.trim();

  const res = await postApi('client.add', { name, phone, village, dest });
  if (res && res.ok) {
    alert('✅ تم حفظ بيانات العميل بنجاح');
    location.reload();
  }
  return false;
}
`;
  } else if (page === 'issues') {
    const issues = await listIssues(env.DB, 50);
    const newCount = issues.filter((i: { status: string }) => i.status === 'new').length;
    title = 'المشاكل والمتابعة';
    body = `<p class="page-desc">فحص آلي كل 30 دقيقة — الطلبات المعلقة، الإرسال الفاشل، أو أي انقطاع في الردود. عندك <b>${newCount}</b> ملاحظات جديدة.</p>
<div class="box"><button onclick="runSupervisorNow()" class="small">🔍 فحص فوري دلوقتي</button> <span id="sup-result" style="margin-inline-start:8px"></span></div>
<div class="box" style="padding:0;overflow-x:auto">
<table>
  <tr><th>الوقت</th><th>النوع</th><th>الخطورة</th><th>التفاصيل</th><th>الحالة</th><th></th></tr>
  ${issues.length ? issues.map((i) => `<tr>
    <td dir="ltr" style="white-space:nowrap">${escHtml((i.created_at ?? '').slice(5, 16))}</td>
    <td>${escHtml(i.kind)}</td>
    <td>${i.severity === 'high' ? '🔴' : i.severity === 'med' ? '🟡' : '⚪'} ${escHtml(i.severity)}</td>
    <td style="max-width:420px">${escHtml(i.detail)}</td>
    <td>${i.status === 'new' ? '<b style="color:var(--danger)">جديد</b>' : i.status === 'acked' ? 'تمت الرؤية' : '✅ اتحلت'}</td>
    <td style="white-space:nowrap">${i.status !== 'fixed' ? `<button class="small" onclick="api('issue.ack', {id:${i.id}})">شفتها</button> <button class="small" onclick="api('issue.fix', {id:${i.id}})">اتحلت</button>` : ''}</td>
  </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px">ما فيش أي مشاكل مسجلة الحمد لله 🎉</td></tr>'}
</table>
</div>`;
    pageJs = `
async function runSupervisorNow() {
  const el = document.getElementById('sup-result');
  el.textContent = '… جاري الفحص';
  try {
    const r = await fetch('/admin/api?key=' + encodeURIComponent(K), { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ action: 'supervisor.run' }) });
    const d = await r.json();
    el.textContent = d.ok ? '✅ اكتمل الفحص — جاري تحديث الصفحة' : 'فشل: ' + (d.error || '');
    if (d.ok) setTimeout(() => location.reload(), 800);
  } catch (e) { el.textContent = 'خطأ شبكة'; }
}
`;
  } else if (page === 'settings') {
    const { results: settings } = await env.DB.prepare(`SELECT key, value FROM settings ORDER BY key`).all();
    title = 'الإعدادات';
    const sm: Record<string, string> = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));
    const boolRow = (k: string, label: string, hint: string): string => {
      const v = sm[k] !== '0';
      return `<div class="set-row"><span class="lab">${label}</span>
        <select name="${k}"><option value="1"${v ? ' selected' : ''}>✅ شغال</option><option value="0"${v ? '' : ' selected'}>⛔ مطفي</option></select>
        <span class="hint">${hint}</span></div>`;
    };
    const textRow = (k: string, label: string, hint: string): string =>
      `<div class="set-row"><span class="lab">${label}</span>
        <input name="${k}" value="${escHtml(sm[k] ?? '')}" dir="ltr" style="width:260px">
        <span class="hint">${hint}</span></div>`;
    const known = new Set(['bot_enabled', 'ai_enabled', 'ai_chat', 'admin_phone', 'manager_phone', 'drivers_group_jid', 'drivers_group_invite', 'paused_chats']);
    const others = (settings ?? []).filter((s: any) => !known.has(s.key));
    body = `<p class="page-desc">مفاتيح التشغيل — غيّر واحفظ بزر واحد.</p>
<form class="box" onsubmit="return saveSettings(event, this)">
  ${boolRow('bot_enabled', '🤖 البوت', 'شغال = بيرد على العملاء — مطفي = رسالة صيانة فقط')}
  ${boolRow('ai_enabled', '🧠 مساعد AI للفهم', 'بيساعد البوت يفهم رسائل وطلبات العملاء المختلفة')}
  ${boolRow('ai_chat', '💬 رد AI حر', 'لو العميل بعت استفسار عام بيرد عليه بالعامية المصرية')}
  ${textRow('manager_phone', '👔 رقم المدير', 'الموافقات — تنبيهات وطلبات السائقين الجدد توصله')}
  ${textRow('admin_phone', '🛠 رقم الدعم الفني', 'المشاكل التقنية والتنبيهات الهامة توصله')}
  ${textRow('drivers_group_jid', '👥 جروب السواقين', 'بيتحدد تلقائياً — ما تغيروش إلا لو غيرت الجروب')}
  <div class="set-row"><span class="lab">⏸ المحادثات الموقوفة</span>
    <span dir="ltr">${escHtml(sm['paused_chats'] ?? '[]')}</span>
    <span class="hint">تُدار من صفحة المحادثات بزر إيقاف البوت — مش من هنا</span></div>
  ${others.map((s: any) => `<div class="set-row"><span class="lab">${escHtml(s.key)}</span>
    <input name="${escHtml(s.key)}" value="${escHtml(s.value)}" dir="ltr" style="width:260px"><span class="hint"></span></div>`).join('')}
  <div style="margin-top:12px"><button>💾 حفظ الإعدادات</button></div>
</form>`;
    pageJs = `
function saveSettings(ev, f) {
  ev.preventDefault();
  const body = {};
  for (const el of f.elements) { if (el.name) body[el.name] = el.value; }
  return api('settings.set', body);
}
`;
  } else if (page === 'simulator') {
    title = 'محاكي واتساب والتفاوض الحي';
    body = `<p class="page-desc">مُحاكي واتساب مباشر لاختبار طلبات المشاوير بالاسم ورقم الموبايل والمكان والسعر، تجربة موافقة السائق أو اقتراح سعر تفاوض، ردود العميل، وحجز باصات الجامعات الـ 16.</p>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
  <div style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;flex:1;min-width:260px;">
    <label style="font-weight:bold;margin-bottom:8px;display:block;">اختر دور المُرسل:</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" class="small" id="role-client" onclick="setRole('client')" style="background:var(--accent);color:#fff;">👤 العميل / الطالب</button>
      <button type="button" class="small" id="role-driver" onclick="setRole('driver')">🚗 كابتن العياط (محمود)</button>
      <button type="button" class="small" id="role-group" onclick="setRole('group')">👥 جروب كباتن العياط</button>
    </div>
    <div style="margin-top:10px;font-size:13px;color:var(--muted);" id="role-info">المرسل: عميل العياط (01012345678)</div>
  </div>
  <div style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;flex:2;min-width:320px;">
    <label style="font-weight:bold;margin-bottom:8px;display:block;">سيناريوهات جاهزة للتجربة الفورية:</label>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('الاسم: محمد إبراهيم\\nالموبايل: 01012345678\\nمكان الركوب: موقف العياط\\nمكان النزول: جامعة القاهرة\\nالمبلغ المقدر: 250 جنيه', 'client')">📝 طلب مشوار تفصيلي بالاسم والسعر</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('مشوار من قرية البليدة لجامعة 6 أكتوبر بـ 200 جنيه', 'client')">🚕 طلب سريع بالقرية والسعر</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('موافق #1', 'driver')">✅ كابتن يوافق على السعر (موافق #1)</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('عرض #1 280', 'driver')">💬 كابتن يقترح سعر تفاوض (عرض #1 280)</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('موافق', 'client')">👍 العميل يقبل عرض الكابتن (موافق)</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('تفاوض 260', 'client')">🔄 العميل يقترح تفاوض جديد (تفاوض 260)</button>
      <button type="button" class="small danger" style="font-size:12px;" onclick="sendPreset('رفض', 'client')">❌ العميل يرفض عرض الكابتن</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('مواعيد الجامعات', 'client')">🎓 مواعيد وجروبات الجامعات الـ 16</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('حجز مقعد لجامعة القاهرة', 'client')">💺 حجز باص 14 راكب للقاهرة</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('وصلت 1', 'driver')">📍 الكابتن وصل (وصلت 1)</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('خلصت 1', 'driver')">🏁 إنهاء المشوار (خلصت 1)</button>
      <button type="button" class="small" style="font-size:12px;" onclick="sendPreset('كشف الركاب', 'driver')">📋 كشف الطلاب للكابتن</button>
    </div>
  </div>
</div>

<div class="box" style="padding:0;overflow:hidden;max-width:760px;margin:0 auto;border-radius:12px;border:1px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,0.06);">
  <div style="background:#075e54;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">
    <div style="width:40px;height:40px;border-radius:50%;background:#128c7e;display:flex;align-items:center;justify-content:center;font-size:22px;">🚕</div>
    <div style="flex:1;">
      <div style="font-weight:bold;font-size:15px;">كابتن عز لخدمات النقل الذكي والمشاوير 🟢</div>
      <div style="font-size:12px;opacity:0.85;" id="sim-online-status">بوت متصل — محرك الحجز والتفاوض الذكي نشط 24/7 ⚡</div>
    </div>
    <a href="/admin/rides?key=${escHtml(key)}" style="color:#dcf8c6;font-size:13px;text-decoration:none;background:rgba(255,255,255,0.15);padding:6px 12px;border-radius:6px;">🧾 المشاوير والتفاوض ↗</a>
  </div>
  <div id="sim-messages" style="background:#efeae2;height:420px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;">
    <div style="text-align:center;margin-bottom:8px;"><span style="background:rgba(225,245,254,0.95);color:#0288d1;font-size:12px;padding:4px 12px;border-radius:12px;border:1px solid #b3e5fc;">🔒 محاكي واتساب كابتن عز — متصل مباشرة برادار الحضور وقاعدة البيانات الحية</span></div>
    <div style="align-self:flex-start;max-width:80%;background:#fff;color:#111;padding:10px 14px;border-radius:8px 8px 8px 0;box-shadow:0 1px 2px rgba(0,0,0,0.1);font-size:14px;line-height:1.5;">
      أهلاً بك في بوت <b>كابتن عز لخدمات النقل الذكي والمشاوير</b> بالعياط وقراها! 🚕🇪🇬<br>
      • لحجز باصات الجامعات أو الاستفسار: اكتب <b>«مواعيد الجامعات»</b> أو <b>«حجز جامعة القاهرة»</b>.<br>
      • عند صعودك الباص لتسجيل حضورك: اكتب فقط كلمة <b>«ركبت»</b>.<br>
      • لطلب سيارة خاصة بالتفاوض المباشر: اكتب <b>«مشوار من العياط لجامعة القاهرة بـ 250 جنيه»</b>.
      <div style="font-size:10px;color:#999;text-align:left;margin-top:4px;">الآن ✓✓</div>
    </div>
  </div>
  <form id="sim-form" onsubmit="return sendSimMsg(event)" style="display:flex;gap:8px;padding:12px;background:#f0f2f5;border-top:1px solid #ddd;align-items:center;">
    <input id="sim-input" type="text" placeholder="اكتب رسالة واتساب (طلب مشوار، عرض سعر، تفاوض، أو حجز جامعة)..." style="flex:1;padding:10px 14px;border-radius:24px;border:1px solid #ccc;font-size:14px;outline:none;" autocomplete="off" />
    <button type="submit" style="background:#075e54;color:#fff;border:none;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;">➤</button>
  </form>
</div>`;

    pageJs = `
let currentRole = 'client';
let clientPhone = '01012345678';
let driverPhone = '01011223344';
let groupJid = '120363000000000000@g.us';

function setRole(role) {
  currentRole = role;
  document.getElementById('role-client').style.background = role === 'client' ? 'var(--accent)' : '';
  document.getElementById('role-client').style.color = role === 'client' ? '#fff' : '';
  document.getElementById('role-driver').style.background = role === 'driver' ? 'var(--accent)' : '';
  document.getElementById('role-driver').style.color = role === 'driver' ? '#fff' : '';
  document.getElementById('role-group').style.background = role === 'group' ? 'var(--accent)' : '';
  document.getElementById('role-group').style.color = role === 'group' ? '#fff' : '';
  
  const info = document.getElementById('role-info');
  if (role === 'client') info.textContent = 'المرسل: العميل / الطالب (' + clientPhone + ')';
  else if (role === 'driver') info.textContent = 'المرسل: كابتن معتمد محمود الهواري (' + driverPhone + ')';
  else info.textContent = 'المرسل: جروب كباتن العياط (' + groupJid + ')';
}

function sendPreset(text, forcedRole) {
  if (forcedRole) setRole(forcedRole);
  document.getElementById('sim-input').value = text;
  document.getElementById('sim-form').dispatchEvent(new Event('submit', { cancelable: true }));
}

async function sendSimMsg(ev) {
  ev.preventDefault();
  const input = document.getElementById('sim-input');
  const text = input.value.trim();
  if (!text) return false;
  input.value = '';

  const box = document.getElementById('sim-messages');
  const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  
  let senderPhone = currentRole === 'driver' ? driverPhone : clientPhone;
  let chatId = currentRole === 'group' ? groupJid : (senderPhone + '@s.whatsapp.net');
  let senderRoleLabel = currentRole === 'client' ? 'أنت (العميل/الطالب)' : (currentRole === 'driver' ? 'الكابتن محمود' : 'جروب السواقين');

  const userDiv = document.createElement('div');
  userDiv.style.cssText = 'align-self:flex-end;max-width:80%;background:#dcf8c6;color:#111;padding:10px 14px;border-radius:8px 8px 0 8px;box-shadow:0 1px 2px rgba(0,0,0,0.1);font-size:14px;line-height:1.5;';
  userDiv.innerHTML = '<div style="font-size:11px;color:#075e54;font-weight:bold;margin-bottom:2px;">' + senderRoleLabel + '</div>' + 
    escHtml(text).replace(/\\n/g, '<br>') + 
    '<div style="font-size:10px;color:#555;text-align:right;margin-top:4px;">' + now + ' ✓✓</div>';
  box.appendChild(userDiv);
  box.scrollTop = box.scrollHeight;

  try {
    await fetch('/webhook/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify({
        chatId: chatId,
        senderPhone: senderPhone,
        text: text,
        msgId: 'SIM_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        ts: Math.floor(Date.now() / 1000)
      })
    });
    
    // Poll for immediate outbox replies
    setTimeout(async () => {
      try {
        const res = await fetch('/admin/api?key=' + encodeURIComponent(KEY), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'sim.poll', chatId: chatId, senderPhone: senderPhone })
        });
        const data = await res.json();
        if (data.replies && data.replies.length > 0) {
          data.replies.forEach(function(rep) {
            const botDiv = document.createElement('div');
            botDiv.style.cssText = 'align-self:flex-start;max-width:80%;background:#fff;color:#111;padding:10px 14px;border-radius:8px 8px 8px 0;box-shadow:0 1px 2px rgba(0,0,0,0.1);font-size:14px;line-height:1.5;';
            botDiv.innerHTML = '<div style="font-size:11px;color:#075e54;font-weight:bold;margin-bottom:2px;">🤖 كابتن عز لخدمات النقل الذكي والمشاوير (' + (rep.chat_id.includes('@g.us') ? 'إشعار للجروب' : 'رسالة خاصة') + ')</div>' + 
              escHtml(rep.text).replace(/\\n/g, '<br>') + 
              '<div style="font-size:10px;color:#999;text-align:left;margin-top:4px;">الآن ✓✓</div>';
            box.appendChild(botDiv);
          });
          box.scrollTop = box.scrollHeight;
        }
      } catch (err) {
        console.error('Poll error', err);
      }
    }, 600);
  } catch (err) {
    alert('فشل إرسال رسالة المحاكي: ' + err);
  }
  return false;
}
`;
  } else {
    // whatsapp
    const gw = await gatewayStatus(env.ADMIN_KEY);
    title = 'ربط واتساب';
    body = `<p class="page-desc">من هنا تقدر تربط رقم واتساب الشغل بالبوت — مرة واحدة وخلاص.</p>
${whatsappTabHtml({
  connection: gw?.connection ?? 'closed',
  user: gw?.user ?? null,
  qr: gw?.qr ?? null,
  pairingCode: gw?.pairingCode ?? null,
  pairingPhone: gw?.pairingPhone ?? null,
  pairingExpiresInSec: gw?.pairingExpiresInSec ?? null,
  pairingMode: gw?.pairingMode ?? null,
  pairingWindowSec: gw?.pairingWindowSec ?? null,
  lastError: gw?.lastError ?? (gw === null ? 'البوابة غير متاحة — شغّل gateway.mjs على السيرفر' : null),
})}`;
  }

  const html = layout(page, key, title, body, '', pageJs);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** واجهة API إدارية كاملة CRUD + الواجهة الموحدة للرسائل */
export async function adminApi(request: Request, env: Env, action: string): Promise<Response> {
  const url = new URL(request.url);
  // قراءات GET (سجل المحادثات) — كتابة POST فقط
  if (request.method === 'GET') {
    if (action === 'conv.list') {
      return Response.json({ conversations: await getConversations(env.DB, 30) });
    }
    if (action === 'chat.get') {
      const chatId = url.searchParams.get('chat_id') ?? '';
      if (!chatId) return Response.json({ error: 'chat_id مطلوب' }, { status: 400 });
      const phone = chatId.includes('@') ? chatId.split('@')[0].split(':')[0] : chatId;
      const paused = (await getPausedChats(env.DB)).includes(phone);
      return Response.json({ messages: await getChatMessages(env.DB, chatId, 60), paused });
    }
    return Response.json({ error: 'GET غير مدعوم لهذا الإجراء' }, { status: 405 });
  }
  if (request.method !== 'POST') return new Response('POST فقط', { status: 405 });
  const body = await request.json<Record<string, any>>();
  try {
    switch (action) {
      // ─── الواجهة الموحدة: إرسال بشر + إيقاف + تلخيص ───
      case 'msg.send': {
        const text = String(body.text ?? '').trim().slice(0, 2000);
        if (!text || !body.to) return Response.json({ error: 'to و text مطلوبان' }, { status: 400 });
        const chatId = normToChat(String(body.to));
        await queueOutbox(env.DB, chatId, text, 'HUMAN');
        return Response.json({ ok: true, to: chatId });
      }
      case 'chat.pause': {
        const phone = String(body.phone ?? '').replace(/[^0-9]/g, '');
        if (!phone) return Response.json({ error: 'phone مطلوب' }, { status: 400 });
        const list = await setPaused(env.DB, phone, body.paused !== false);
        return Response.json({ ok: true, paused_chats: list });
      }
      case 'ai.summarize': {
        const chatId = String(body.chat_id ?? '');
        if (!chatId) return Response.json({ error: 'chat_id مطلوب' }, { status: 400 });
        const msgs = await getChatMessages(env.DB, chatId, 30);
        if (!msgs.length) return Response.json({ summary: 'ما فيش رسائل في المحادثة دي لسه.' });
        const transcript = msgs.map((m) =>
          m.direction === 'in' ? `العميل (+${m.sender_phone}): ${m.text}`
            : m.sender_phone === 'BOT' ? `البوت: ${m.text}` : `الموظف: ${m.text}`
        ).join('\n');
        const summary = await aiChat(
          env,
          'أنت محلل محادثات شركة تاكسي. لخص باختصار بالعربية: طلب الزبون (من/إلى)، حالة الطلب، آخر شي صار، وشو الخطوة الجاية المقترحة للموظف. 6 أسطر max.',
          transcript,
          600
        );
        if (!summary) return Response.json({ error: 'AI غير مفعّل — اضبط AI_API_KEY ثم جرّب' }, { status: 400 });
        return Response.json({ summary });
      }
      // ─── سواقين ───
      case 'driver.add': {
        const rawPhone = String(body.phone ?? '').replace(/[^0-9]/g, '');
        if (!rawPhone || !body.name) {
          return Response.json({ ok: false, error: 'الاسم ورقم الهاتف مطلوبين' }, { status: 400 });
        }
        await env.DB.prepare(
          `INSERT INTO drivers (phone, name, car, plate, commission_pct, group_jid, active, status) 
           VALUES (?, ?, ?, ?, ?, ?, 1, 'AVAILABLE')
           ON CONFLICT(phone) DO UPDATE SET 
             name = excluded.name, 
             car = excluded.car, 
             plate = excluded.plate, 
             commission_pct = excluded.commission_pct,
             active = 1,
             status = 'AVAILABLE'`
        )
          .bind(rawPhone, String(body.name), String(body.car ?? ''), String(body.plate ?? ''), Number(body.commission_pct ?? 10), String(body.group_jid ?? ''))
          .run();
        return Response.json({ ok: true });
      }
      case 'driver.status': {
        await env.DB.prepare(`UPDATE drivers SET status = ? WHERE id = ?`).bind(String(body.status), Number(body.id)).run();
        return Response.json({ ok: true });
      }
      case 'driver.toggle_active': {
        await env.DB.prepare(`UPDATE drivers SET active = ? WHERE id = ?`).bind(Number(body.active), Number(body.id)).run();
        return Response.json({ ok: true });
      }
      case 'driver.del': {
        await env.DB.prepare(`DELETE FROM drivers WHERE id = ?`).bind(Number(body.id)).run();
        return Response.json({ ok: true });
      }

      // ─── مناطق ───
      case 'zone.add': {
        await env.DB.prepare(`INSERT INTO zones (name, aliases, belt) VALUES (?, ?, ?)`)
          .bind(String(body.name), JSON.stringify(body.aliases ?? []), Number(body.belt ?? 1))
          .run();
        return Response.json({ ok: true });
      }
      case 'zone.belt': {
        await env.DB.prepare(`UPDATE zones SET belt = ? WHERE id = ?`).bind(Number(body.belt), Number(body.id)).run();
        return Response.json({ ok: true });
      }
      case 'zone.del': {
        await env.DB.prepare(`DELETE FROM zones WHERE id = ?`).bind(Number(body.id)).run();
        return Response.json({ ok: true });
      }
      case 'zone.alias.add': {
        const row = await env.DB.prepare(`SELECT aliases FROM zones WHERE id = ?`).bind(Number(body.id)).first<{ aliases: string | null }>();
        let arr: string[] = [];
        try { const a = JSON.parse(row?.aliases || '[]'); if (Array.isArray(a)) arr = a; } catch { arr = []; }
        const name = String(body.alias ?? '').trim().slice(0, 60);
        if (!name) return Response.json({ ok: false, error: 'empty' }, { status: 400 });
        if (!arr.includes(name)) arr.push(name);
        await env.DB.prepare(`UPDATE zones SET aliases = ? WHERE id = ?`).bind(JSON.stringify(arr), Number(body.id)).run();
        return Response.json({ ok: true, aliases: arr });
      }
      case 'zone.alias.del': {
        const row = await env.DB.prepare(`SELECT aliases FROM zones WHERE id = ?`).bind(Number(body.id)).first<{ aliases: string | null }>();
        let arr: string[] = [];
        try { const a = JSON.parse(row?.aliases || '[]'); if (Array.isArray(a)) arr = a; } catch { arr = []; }
        arr.splice(Number(body.index), 1);
        await env.DB.prepare(`UPDATE zones SET aliases = ? WHERE id = ?`).bind(JSON.stringify(arr), Number(body.id)).run();
        return Response.json({ ok: true, aliases: arr });
      }

      // ─── المشاكل (المشرف الخلفي) ───
      case 'issue.ack': {
        await setIssueStatus(env.DB, Number(body.id), 'acked');
        return Response.json({ ok: true });
      }
      case 'issue.fix': {
        await setIssueStatus(env.DB, Number(body.id), 'fixed');
        return Response.json({ ok: true });
      }
      case 'supervisor.run': {
        const { runSupervisor } = await import('./supervisor.js');
        await runSupervisor(env);
        return Response.json({ ok: true });
      }

      // ─── تعاريف ───
      case 'fare.add': {
        await env.DB.prepare(
          `INSERT INTO fixed_fares (from_zone_id, to_zone_id, price, note) VALUES (?, ?, ?, ?)`
        )
          .bind(Number(body.from_zone_id), Number(body.to_zone_id), Number(body.price), String(body.note ?? ''))
          .run();
        return Response.json({ ok: true });
      }
      case 'fare.edit': {
        await env.DB.prepare(`UPDATE fixed_fares SET price = ? WHERE id = ?`).bind(Number(body.price), Number(body.id)).run();
        return Response.json({ ok: true });
      }
      case 'fare.del': {
        await env.DB.prepare(`DELETE FROM fixed_fares WHERE id = ?`).bind(Number(body.id)).run();
        return Response.json({ ok: true });
      }
      case 'pricing.clearAll': {
        await env.DB.prepare(`DELETE FROM fixed_fares`).run();
        await env.DB.prepare(`DELETE FROM zones`).run();
        return Response.json({ ok: true });
      }

      // ─── جدول تسعيرة فئات المناطق الديناميكية ───
      case 'zone_pricing.edit': {
        const id = Number(body.id);
        const basePrice = Number(body.base_price);
        const returnPrice = body.return_price !== undefined ? Number(body.return_price) : undefined;
        const desc = body.description !== undefined ? String(body.description) : undefined;
        const name = body.name !== undefined ? String(body.name) : undefined;
        const icon = body.icon !== undefined ? String(body.icon) : undefined;
        const isActive = body.is_active !== undefined ? Number(body.is_active) : undefined;
        const ok = await updateZonePrice(env.DB, id, basePrice, returnPrice, desc, name, icon, isActive);
        return Response.json({ ok });
      }
      case 'zone_pricing.toggle': {
        const id = Number(body.id);
        const isActive = Number(body.is_active);
        await env.DB.prepare(`UPDATE zone_pricing SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).bind(isActive, id).run();
        return Response.json({ ok: true });
      }
      case 'zone_pricing.add': {
        const id = await addZonePriceCategory(env.DB, {
          category_key: String(body.category_key || `custom_${Date.now()}`),
          name: String(body.name || 'فئة جديدة'),
          icon: String(body.icon || '📍'),
          base_price: Number(body.base_price || 50),
          return_price: Number(body.return_price || 0),
          description: String(body.description || ''),
        });
        return Response.json({ ok: Boolean(id), id });
      }
      case 'zone_pricing.del': {
        const id = Number(body.id);
        const ok = await deleteZonePriceCategory(env.DB, id);
        return Response.json({ ok });
      }
      case 'zone_pricing.reset': {
        const ok = await resetDefaultZonePricing(env.DB);
        return Response.json({ ok });
      }
      case 'zone_pricing.preview': {
        const items = await getDynamicZonePricing(env.DB);
        const text = formatZonePricingForWhatsApp(items);
        return Response.json({ ok: true, preview: text });
      }

      // ─── إعدادات ───
      case 'settings.set': {
        for (const [k, v] of Object.entries(body)) {
          if (!/^[a-z_]{1,40}$/.test(k)) continue;
          await env.DB.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
            .bind(k, String(v ?? '')).run();
        }
        return Response.json({ ok: true });
      }

      // ─── رحلات ───
      case 'ride.cancel': {
        const ride = await env.DB.prepare(`SELECT status FROM rides WHERE id = ?`).bind(Number(body.id)).first<{ status: string }>();
        if (!ride) return Response.json({ error: 'الرحلة غير موجودة' }, { status: 404 });
        if (!['NEW', 'DISPATCHING', 'ASSIGNED', 'ARRIVED', 'IN_RIDE'].includes(ride.status)) {
          return Response.json({ error: 'الرحلة مقفلة — ما ينفعش تتلغي دلوقتي' }, { status: 400 });
        }
        await env.DB.prepare(`UPDATE rides SET status = 'CANCELLED' WHERE id = ?`).bind(Number(body.id)).run();
        return Response.json({ ok: true });
      }

      // ─── كشف ركاب باصات الجامعات ───
      case 'shuttle.manifest': {
        const vehicleId = Number(body.vehicleId);
        const manifest = await generateDriverManifest(env.DB, vehicleId);
        return Response.json({ ok: true, manifest });
      }

      // ─── تغيير حالة ركوب وحضور الطالب (أخضر / أحمر) ───
      case 'shuttle.board.toggle': {
        const bookingId = Number(body.bookingId);
        const boarded = Number(body.boarded);
        const updated = await toggleBoarding(env.DB, bookingId, boarded);
        return Response.json({ ok: true, updated });
      }

      // ─── إضافة عميل جديد ───
      case 'client.add': {
        const phone = String(body.phone ?? '').trim();
        const name = String(body.name ?? '').trim();
        const village = String(body.village ?? '').trim();
        const dest = String(body.dest ?? '').trim();
        if (!phone) return Response.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });
        await env.DB.prepare(
          `INSERT INTO clients (phone, name, village, destination_fav, trips_count)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(phone) DO UPDATE SET
             name = excluded.name,
             village = excluded.village,
             destination_fav = excluded.destination_fav`
        ).bind(phone, name, village, dest).run();
        return Response.json({ ok: true });
      }

      // ─── استرجاع ردود المحاكي الفورية ───
      case 'sim.poll': {
        const { results } = await env.DB.prepare(
          `SELECT id, chat_id, text, created_at FROM outbox WHERE status = 'pending' ORDER BY id ASC LIMIT 5`
        ).all();
        if (results && results.length > 0) {
          const ids = results.map((r: any) => r.id);
          for (const id of ids) {
            await env.DB.prepare(`UPDATE outbox SET status = 'sent' WHERE id = ?`).bind(id).run();
          }
        }
        return Response.json({ ok: true, replies: results || [] });
      }

      // ─── مزامنة Google Sheets ───
      case 'sheets.sync': {
        const { syncAllBookingsAndRidesToSheets } = await import('./sheets.js');
        const res = await syncAllBookingsAndRidesToSheets(env.DB);
        return Response.json(res);
      }

      case 'sheets.test': {
        const { testSheetsConnection } = await import('./sheets.js');
        const res = await testSheetsConnection(String(body.url ?? ''));
        return Response.json(res);
      }

      default:
        return Response.json({ error: 'unknown action: ' + action }, { status: 404 });
    }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
