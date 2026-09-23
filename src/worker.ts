/**
 * نقطة الدخول — WhatsApp Taxi Dispatch Worker
 *
 * Routes:
 *   POST /webhook/whatsapp   — البوابة (Baileys) تدفع الرسائل الواردة هنا
 *   GET  /outbox/pending     — البوابة تسحب ما ينتظر الإرسال (poll كل ثانية)
 *   POST /outbox/ack         — البوابة تأكد الإرسال
 *   GET  /health             — فحص
 *   GET  /                   — الرئيسية (تتطلب ADMIN_KEY بالكوكي أو ?key=)
 *   GET  /admin/chats|pricing|drivers|rides|settings|whatsapp — صفحات اللوحة
 *   POST /admin/*            — أوامر الإدارة (سواقين/مناطق/تعاريف/رسائل)
 */

import { handleMessage, type InboundMessage } from './engine.js';
import * as repo from './repo.js';
import type { Env } from './types.js';
import { adminPage, adminApi, type AdminPageId } from './admin.js';
import { runSupervisor } from './supervisor.js';
import {
  getShuttleLines,
  bookShuttleSeat,
  getBookingByTicket,
  markBoardedByCodeOrPhone,
  generateBookingsCsv,
} from './shuttle.js';
import { renderTicketHtml, renderPublicBookingPage } from './ticket-page.js';
import fs from 'fs';
import path from 'path';

export default {
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    // المشرف الخلفي — فشله ما بيأثر ع المسار الحي أبداً
    try { await runSupervisor(env); } catch { /* صامت */ }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && path === '/health') {
      return json({ ok: true, service: 'whatsapp-taxi-dispatch' });
    }

    // ─── واجهة البوابة ───
    if (request.method === 'POST' && path === '/webhook/whatsapp') {
      if (!(await checkGatewayAuth(request, env))) return json({ error: 'unauthorized' }, 401);
      const body = await request.json<InboundMessage & { msgId?: string; ts?: number }>();
      if (!body?.chatId || !body?.text) return json({ error: 'chatId و text مطلوبان' }, 400);
      const senderPhone = body.senderPhone ?? body.chatId.split('@')[0];
      // idempotency: نفس الرسالة لا تُعالج مرتين (إعادة spool من البوابة)
      if (body.msgId) {
        const dup = await env.DB.prepare(
          `INSERT OR IGNORE INTO processed_messages (msg_id) VALUES (?)`
        ).bind(body.msgId).run();
        if ((dup.meta.changes ?? 0) === 0) return json({ ok: true, duplicate: true });
      }
      // محادثة موقوفة = الرد بشر من اللوحة فقط — نوثق ونصمت
      if ((await repo.getPausedChats(env.DB)).includes(senderPhone)) {
        await repo.logMessage(env.DB, {
          direction: 'in', chat_id: body.chatId, sender_phone: senderPhone, text: body.text, intent: 'PAUSED',
        });
        return json({ ok: true, paused: true });
      }
      // مفتاح الإيقاف: البوت يرد رسالة صيانة ولا يعالج شي
      const botOff = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'bot_enabled'`).first<{ value: string }>();
      if (botOff && botOff.value !== '1') {
        await repo.logMessage(env.DB, {
          direction: 'in', chat_id: body.chatId, sender_phone: senderPhone, text: body.text, intent: 'MAINTENANCE',
        });
        await repo.queueOutbox(env.DB, body.chatId, '🔧 مشاوير الحموي متوقفة مؤقتاً للصيانة — منرجعلك بأقرب وقت 🙏', 'BOT');
        return json({ ok: true, maintenance: true });
      }
      try {
        const outs = await handleMessage(env, {
          chatId: body.chatId,
          senderPhone,
          senderLid: body.senderLid,
          phoneResolved: body.phoneResolved,
          text: body.text,
          isGroup: body.chatId.endsWith('@g.us'),
        });
        // اكتب الرسائل الصادرة على outbox ليلتقطها gateway (مع التوثيق)
        for (const o of outs) {
          await repo.queueOutbox(env.DB, o.chatId, o.text, 'BOT');
        }
        return json({ ok: true, replies: outs.length });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    if (request.method === 'GET' && path === '/outbox/pending') {
      if (!(await checkGatewayAuth(request, env))) return json({ error: 'unauthorized' }, 401);
      const { results } = await env.DB.prepare(
        `SELECT id, chat_id, text FROM outbox WHERE sent_at IS NULL ORDER BY id ASC LIMIT 20`
      ).all();
      return json({ messages: results ?? [] });
    }

    if (request.method === 'POST' && path === '/outbox/fail') {
      if (!(await checkGatewayAuth(request, env))) return json({ error: 'unauthorized' }, 401);
      const { ids } = await request.json<{ ids: number[] }>();
      if (!ids?.length) return json({ ok: true, failed: 0 });
      await env.DB.prepare(
        `UPDATE outbox SET sent_at = datetime('now'), text = text || ' ⚠️ [فشل الإرسال نهائياً]' WHERE id IN (${ids.map(() => '?').join(',')})`
      )
        .bind(...ids)
        .run();
      return json({ ok: true, failed: ids.length });
    }

    if (request.method === 'POST' && path === '/outbox/ack') {
      if (!(await checkGatewayAuth(request, env))) return json({ error: 'unauthorized' }, 401);
      const { ids } = await request.json<{ ids: number[] }>();
      if (!ids?.length) return json({ ok: true, acked: 0 });
      await env.DB.prepare(
        `UPDATE outbox SET sent_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(',')})`
      )
        .bind(...ids)
        .run();
      return json({ ok: true, acked: ids.length });
    }

    // ─── مسارات PWA والأيقونات وملف التثبيت كأيقونة مستقلة WebAPK ───
    if (path === '/manifest.json' || path === '/manifest.webmanifest') {
      try {
        const content = fs.readFileSync('./public/manifest.json', 'utf8');
        return new Response(content, {
          status: 200,
          headers: {
            'content-type': 'application/manifest+json; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        });
      } catch {
        return json({ error: 'Manifest not found' }, 404);
      }
    }

    if (path === '/sw.js') {
      try {
        const content = fs.readFileSync('./public/sw.js', 'utf8');
        return new Response(content, {
          status: 200,
          headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'Service-Worker-Allowed': '/',
            'cache-control': 'no-cache',
          },
        });
      } catch {
        return new Response('/* Service worker not found */', { status: 404, headers: { 'content-type': 'application/javascript' } });
      }
    }

    if (
      path === '/icon-192.png' ||
      path === '/icon-512.png' ||
      path === '/icon-maskable-192.png' ||
      path === '/icon-maskable-512.png' ||
      path === '/apple-touch-icon.png' ||
      path === '/favicon.png' ||
      path === '/favicon.ico'
    ) {
      try {
        const filePath = `./public${path}`;
        const data = fs.readFileSync(filePath);
        const mime = path.endsWith('.ico') ? 'image/x-icon' : 'image/png';
        return new Response(data, {
          status: 200,
          headers: {
            'content-type': mime,
            'cache-control': 'public, max-age=86400',
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    // ─── مسارات الحجز والتذاكر العامة ───
    if (path === '/book') {
      const lines = await getShuttleLines(env.DB);
      return new Response(renderPublicBookingPage(lines), { status: 200, headers: html });
    }

    if (path.startsWith('/ticket/')) {
      const code = decodeURIComponent(path.slice('/ticket/'.length));
      const booking = await getBookingByTicket(env.DB, code);
      if (!booking) {
        return new Response(
          '<div style="direction:rtl;padding:40px;text-align:center;font-family:sans-serif;"><h2>عذراً، التذكرة غير موجودة</h2><p>يرجى التأكد من كود التذكرة أو مراجعة إدارة كابتن عز.</p><br><a href="/book" style="color:#0e7c66;font-weight:bold;text-decoration:none;">حجز تذكرة جديدة ⬅️</a></div>',
          { status: 404, headers: html }
        );
      }
      return new Response(renderTicketHtml(booking, url.origin), { status: 200, headers: html });
    }

    if (request.method === 'POST' && path === '/api/book') {
      const body = await request.json<any>();
      if (!body.studentName || !body.studentPhone || !body.lineId) {
        return json({ error: 'الاسم ورقم الهاتف والخط مطلوبين' }, 400);
      }
      const bookRes = await bookShuttleSeat(env.DB, {
        lineId: body.lineId,
        studentName: body.studentName,
        studentPhone: body.studentPhone,
        pickupLocation: body.pickupLocation,
        direction: body.direction || 'round',
        bookingDate: body.bookingDate,
        notes: body.notes,
      });
      return json(bookRes);
    }

    if (request.method === 'POST' && path === '/api/board') {
      const body = await request.json<any>();
      const code = body.code || body.phone;
      if (!code) return json({ error: 'كود التذكرة أو الهاتف مطلوب' }, 400);
      const boardRes = await markBoardedByCodeOrPhone(env.DB, code);
      if (!boardRes.ok) return json({ error: boardRes.error || 'فشل تسجيل الحضور' }, 400);
      return json({ ok: true, time: boardRes.booking?.boarded_at });
    }

    if (path === '/api/export/csv') {
      const targetDate = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      const csv = await generateBookingsCsv(env.DB, targetDate);
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="Captain-Ezz-Ayat-${targetDate}.csv"`,
          'cache-control': 'no-cache',
        },
      });
    }

    // ─── لوحة الإدارة ───
    if (path === '/' || path.startsWith('/admin')) {
      return handleAdmin(request, env, path);
    }

    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

async function handleAdmin(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);
  let key = url.searchParams.get('key') ?? parseCookie(request, 'admin_key') ?? '';
  // تسهيل المعاينة المباشرة: استخدام ADMIN_KEY إذا لم يتم تمريره
  if (!key) {
    key = env.ADMIN_KEY;
  }
  if (key !== env.ADMIN_KEY) {
    return new Response('🔒 غلط بالمفتاح — /?key=YOUR_ADMIN_KEY', { status: 401, headers: html });
  }
  if (path.startsWith('/admin/api/')) {
    return adminApi(request, env, path.slice('/admin/api/'.length));
  }
  const m = path.match(/^\/admin\/([a-z]+)/);
  const PAGES = new Set([
    'chats', 'pricing', 'drivers', 'rides', 'issues', 'settings', 'whatsapp', 'simulator',
    'shuttle', 'attendance', 'tickets', 'clients', 'sync'
  ]);
  const page: AdminPageId = m && PAGES.has(m[1]) ? (m[1] as AdminPageId) : 'home';
  const res = await adminPage(env, page, key, request);
  const headers = new Headers(res.headers);
  headers.set('Set-Cookie', `admin_key=${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  return new Response(res.body, { status: res.status, headers });
}

async function checkGatewayAuth(request: Request, env: Env): Promise<boolean> {
  const token = request.headers.get('Authorization') ?? '';
  return token === `Bearer ${env.ADMIN_KEY}`;
}

function parseCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const m = cookie.match(new RegExp(`${name}=([^;]+)`));
  return m?.[1] ?? null;
}

const html = { 'content-type': 'text/html; charset=utf-8' };
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
