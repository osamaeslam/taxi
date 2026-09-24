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
  getShuttleVehicles,
  getShuttleBookings,
  bookShuttleSeat,
  getBookingByTicket,
  markBoardedByCodeOrPhone,
  generateBookingsCsv,
  bookPrivateRide,
  getRideByTicket,
  generateRidesCsv,
} from './shuttle.js';
import {
  renderTicketHtml,
  renderPublicBookingPage,
  renderPrivateRideBookingPage,
  renderRideTicketHtml,
  renderDriverAttendanceHtml,
} from './ticket-page.js';
import {
  pushRowToGoogleSheets,
  syncAllBookingsAndRidesToSheets,
  testSheetsConnection,
} from './sheets.js';
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

    // ─── تسجيل رسالة مباشرة في جدول الرسائل messages ───
    if (request.method === 'POST' && path === '/api/internal/log-message') {
      if (!(await checkGatewayAuth(request, env))) return json({ error: 'unauthorized' }, 401);
      const body = await request.json<{
        direction?: 'in' | 'out';
        chat_id: string;
        sender_phone?: string;
        text: string;
        intent?: string;
      }>();
      if (!body?.chat_id || !body?.text) return json({ error: 'chat_id and text required' }, 400);
      await repo.logMessage(env.DB, {
        direction: body.direction || 'out',
        chat_id: body.chat_id,
        sender_phone: body.sender_phone || body.chat_id.split('@')[0],
        text: body.text,
        intent: body.intent || 'DIRECT_SEND',
      });
      return json({ ok: true });
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

    if (path === '/ride' || path === '/book-ride') {
      return new Response(renderPrivateRideBookingPage(), { status: 200, headers: html });
    }

    // ─── كشف رادار الحضور المخصص للسائقين (موبايل) ───
    if (path === '/attendance' || path === '/driver/attendance' || path === '/driver') {
      const targetDate = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      const vehicleId = url.searchParams.get('vehicle_id') ? Number(url.searchParams.get('vehicle_id')) : undefined;
      const allVehicles = await getShuttleVehicles(env.DB, targetDate);
      const vehicle = vehicleId ? (allVehicles.find(v => v.id === vehicleId) || allVehicles[0] || null) : (allVehicles[0] || null);
      const activeVehicleId = vehicle?.id;
      const bookings = await getShuttleBookings(env.DB, targetDate, undefined, activeVehicleId);
      return new Response(renderDriverAttendanceHtml(vehicle, allVehicles, bookings, targetDate, url.origin), {
        status: 200,
        headers: html,
      });
    }

    // ─── مسارات وسيط بوابة واتساب (WhatsApp Gateway Proxy) ───
    if (path.startsWith('/api/gateway/')) {
      const targetPath = path.slice('/api/gateway'.length);
      const baseGwUrl = (process.env.WHATSAPP_GATEWAY_URL || process.env.WHATSAPP_SERVER_URL || process.env.GATEWAY_URL || 'http://127.0.0.1:3010').replace(/\/+$/, '');
      const gwUrl = `${baseGwUrl}${targetPath}${url.search}`;
      try {
        const bodyText = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
        const gRes = await fetch(gwUrl, {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            'x-gateway-token': env.ADMIN_KEY,
          },
          body: bodyText,
          signal: AbortSignal.timeout(8000),
        });
        const respText = await gRes.text();
        return new Response(respText, {
          status: gRes.status,
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        });
      } catch (err: any) {
        return Response.json({
          ok: false,
          error: 'Gateway offline',
          details: err?.message,
          connection: 'disconnected',
          hint: 'إذا كنت تستخدم Vercel أو بيئة Serverless، يرجى تشغيل Gateway على خادم دائم (مثل Render أو Railway) وضبط متغير البيئة WHATSAPP_GATEWAY_URL'
        }, { status: 502 });
      }
    }

    if (path.startsWith('/ticket/')) {
      const code = decodeURIComponent(path.slice('/ticket/'.length));

      // 1) فحص المشاوير الخاصة أولاً إذا كان الكود RIDE-
      if (code.toUpperCase().startsWith('RIDE-')) {
        const ride = await getRideByTicket(env.DB, code);
        if (ride) {
          return new Response(renderRideTicketHtml(ride, url.origin), { status: 200, headers: html });
        }
      }

      // 2) فحص باصات الجامعات
      const booking = await getBookingByTicket(env.DB, code);
      if (booking) {
        return new Response(renderTicketHtml(booking, url.origin), { status: 200, headers: html });
      }

      // 3) فحص المشاوير الخاصة احتياطياً
      const fallbackRide = await getRideByTicket(env.DB, code);
      if (fallbackRide) {
        return new Response(renderRideTicketHtml(fallbackRide, url.origin), { status: 200, headers: html });
      }

      return new Response(
        '<div style="direction:rtl;padding:40px;text-align:center;font-family:sans-serif;"><h2>عذراً، التذكرة غير موجودة</h2><p>يرجى التأكد من كود التذكرة أو مراجعة إدارة كابتن عز.</p><br><a href="/book" style="color:#0e7c66;font-weight:bold;text-decoration:none;">حجز باص جامعة ⬅️</a> &nbsp;|&nbsp; <a href="/ride" style="color:#2563eb;font-weight:bold;text-decoration:none;">طلب مشوار خاص ⬅️</a></div>',
        { status: 404, headers: html }
      );
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

      // إرسال رسالة التذكرة التلقائية إلى رقم واتساب العميل فوراً
      if (bookRes.ok && bookRes.ticketCode) {
        try {
          let cleanPhone = String(body.studentPhone).replace(/[^0-9]/g, '');
          if (cleanPhone.startsWith('01')) cleanPhone = '20' + cleanPhone.slice(1);
          const chatId = `${cleanPhone}@s.whatsapp.net`;
          const ticketUrl = `${url.origin}/ticket/${bookRes.ticketCode}`;
          const waMsg = `🎫 مرحباً بك يا ${body.studentName}!\nتم تأكيد حجزك مع *كابتن عز لخدمات النقل الذكي والمشاوير* 🚕\n\n🔖 كود التذكرة: *${bookRes.ticketCode}*\n📍 نقطة الركوب: ${body.pickupLocation || 'العياط'}\n\n🔗 رابط تذكرتك الإلكترونية الذكية:\n${ticketUrl}\n\n(عند صعودك الباص، افتح الرابط واضغط "أنا ركبت الآن 🟢" أو أرسل كلمة "ركبت" هنا). رحلة موفقة! 🎓`;
          await repo.queueOutbox(env.DB, chatId, waMsg, 'BOT');
        } catch (e) {
          console.warn('[Booking] Could not queue ticket outbox message:', e);
        }

        // إرسال البيانات فوراً لـ Google Sheets في الخلفية
        pushRowToGoogleSheets(env.DB, {
          type: '🎓 باص جامعة',
          date: body.bookingDate || new Date().toISOString().slice(0, 10),
          ticketCode: bookRes.ticketCode,
          name: body.studentName,
          phone: body.studentPhone,
          from: body.pickupLocation || 'العياط',
          to: `جامعة (خط ${body.lineId})`,
          price: 60,
          status: '🔴 بالانتظار',
          notes: body.notes || ''
        }).catch(() => {});
      }

      return json(bookRes);
    }

    if (request.method === 'POST' && path === '/api/book-ride') {
      const body = await request.json<any>();
      if (!body.clientName || !body.clientPhone || !body.pickupLocation || !body.dropoffLocation) {
        return json({ error: 'الاسم ورقم الهاتف ومكان الركوب والنزول مطلوبة' }, 400);
      }
      const rideRes = await bookPrivateRide(env.DB, {
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        pickupLocation: body.pickupLocation,
        dropoffLocation: body.dropoffLocation,
        carType: body.carType,
        rideTime: body.rideTime,
        offeredPrice: body.offeredPrice,
        notes: body.notes,
      });

      if (rideRes.ok && rideRes.ticketCode) {
        // إرسال رسالة التذكرة للعميل بالواتساب
        try {
          let cleanPhone = String(body.clientPhone).replace(/[^0-9]/g, '');
          if (cleanPhone.startsWith('01')) cleanPhone = '20' + cleanPhone.slice(1);
          const chatId = `${cleanPhone}@s.whatsapp.net`;
          const ticketUrl = `${url.origin}/ticket/${rideRes.ticketCode}`;
          const waMsg = `🚗 مرحباً بك يا ${body.clientName}!\nتم استلام طلب مشوارك الخاص مع *كابتن عز لخدمات النقل الذكي والمشاوير* 🚕\n\n🔖 كود المشوار: *${rideRes.ticketCode}*\n📍 من: ${body.pickupLocation}\n🏁 إلى: ${body.dropoffLocation}\n\n🔗 رابط متابعة وتذكرة المشوار:\n${ticketUrl}\n\nجاري إبلاغ أقرب كابتن لك بالعياط للتحرك فوراً. رحلة سعيدة وآمنة! ✨`;
          await repo.queueOutbox(env.DB, chatId, waMsg, 'BOT');
        } catch (e) {
          console.warn('[RideBooking] Could not queue ticket outbox message:', e);
        }

        // إشعار مجموعة الكباتن فوراً مع حجب رقم العميل لحماية الخصوصية
        try {
          const groupRow = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'drivers_group_jid'`).first<{ value: string }>();
          if (groupRow?.value) {
            const rawP = String(body.clientPhone).replace(/[^0-9]/g, '');
            const maskP = rawP.length >= 7 ? rawP.slice(0, 4) + '****' + rawP.slice(-3) : 'محجوب 🔒';
            const priceText = body.offeredPrice ? `${body.offeredPrice} جنيه` : 'حسب التسعيرة';
            const carText = body.carType ? ` (${body.carType})` : '';
            const driverMsg = `📢 *طلب مشوار خاص جديد عبر الموقع (#${rideRes.rideId})* 🚕\n━━━━━━━━━━━━━━━━━━━━\n👤 العميل: *${body.clientName}*\n📍 مكان الركوب: *${body.pickupLocation}*\n🏁 مكان النزول: *${body.dropoffLocation}*${carText}\n💰 السعر المقترح: *${priceText}*\n🔒 هاتف العميل: *${maskP}* (يظهر لك بالكامل فور القبول)\n━━━━━━━━━━━━━━━━━━━━\n✅ للقبول فوراً: اكتب «*موافق #${rideRes.rideId}*»\n💬 لاقتراح سعر: اكتب «*عرض #${rideRes.rideId} [سعرك]*»`;
            await repo.queueOutbox(env.DB, groupRow.value, driverMsg, 'BOT');
          }
        } catch (e) {
          console.warn('[RideBooking] Could not broadcast to drivers group:', e);
        }

        // إرسال البيانات فوراً لـ Google Sheets في الخلفية
        pushRowToGoogleSheets(env.DB, {
          type: '🚗 مشوار خاص',
          date: new Date().toISOString().slice(0, 10),
          ticketCode: rideRes.ticketCode,
          name: body.clientName,
          phone: body.clientPhone,
          from: body.pickupLocation,
          to: body.dropoffLocation,
          price: body.offeredPrice || 0,
          status: '⏳ طلب جديد',
          notes: [body.carType, body.rideTime, body.notes].filter(Boolean).join(' | ')
        }).catch(() => {});
      }

      return json(rideRes);
    }

    if (request.method === 'POST' && path === '/api/board') {
      const body = await request.json<any>();
      const code = body.code || body.phone;
      if (!code) return json({ error: 'كود التذكرة أو الهاتف مطلوب' }, 400);

      // فحص إن كان مشواراً خاصاً (RIDE-XXXX)
      if (String(code).toUpperCase().startsWith('RIDE-')) {
        const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        await env.DB.prepare(`
          UPDATE rides
          SET boarded = 1, boarded_at = ?, status = CASE WHEN status = 'NEW' THEN 'IN_RIDE' ELSE status END
          WHERE ticket_code = ? OR ('RIDE-' || (2000 + id)) = ?
        `).bind(timeStr, code, code).run();
        return json({ ok: true, time: timeStr, type: 'ride' });
      }

      const boardRes = await markBoardedByCodeOrPhone(env.DB, code);
      if (!boardRes.ok) {
        // فحص احتياطي إذا كان في جدول المشاوير
        const ride = await getRideByTicket(env.DB, code);
        if (ride) {
          const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          await env.DB.prepare(`UPDATE rides SET boarded = 1, boarded_at = ? WHERE id = ?`).bind(timeStr, ride.id).run();
          return json({ ok: true, time: timeStr, type: 'ride' });
        }
        return json({ error: boardRes.error || 'فشل تسجيل الحضور' }, 400);
      }
      return json({ ok: true, time: boardRes.booking?.boarded_at, type: 'shuttle' });
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

    if (path === '/api/export/rides-csv') {
      const csv = await generateRidesCsv(env.DB);
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="Captain-Ezz-Private-Rides.csv"`,
          'cache-control': 'no-cache',
        },
      });
    }

    if (request.method === 'POST' && path === '/api/sheets/test') {
      const body = await request.json<any>();
      const res = await testSheetsConnection(body.url);
      return json(res);
    }

    if (request.method === 'POST' && path === '/api/sheets/sync-all') {
      const res = await syncAllBookingsAndRidesToSheets(env.DB);
      return json(res);
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
