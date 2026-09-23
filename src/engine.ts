import type { D1Database } from '@cloudflare/workers-types';
import type { Env, Ride, Zone, RideBid } from './types.js';
import { computeFare, formatEGP } from './pricing.js';
import {
  getShuttleLines,
  getShuttleVehicles,
  bookShuttleSeat,
  cancelShuttleBooking,
  generateDriverManifest,
  markBoardedByCodeOrPhone,
  getBookingByTicket,
} from './shuttle.js';

export interface InboundMessage {
  chatId: string;
  senderPhone: string;
  senderLid?: string;
  phoneResolved?: boolean;
  text: string;
  isGroup?: boolean;
}

export interface OutboundReply {
  chatId: string;
  text: string;
}

export async function handleMessage(env: Env, msg: InboundMessage): Promise<OutboundReply[]> {
  const db = env.DB;
  const rawText = (msg.text || '').trim();
  const lowerText = rawText.toLowerCase();

  // 1. Group Messages (Driver Dispatch Groups / University Groups)
  if (msg.isGroup) {
    return handleGroupMessage(env, msg);
  }

  // 2. Check if the sender is an authorized driver
  const driver = await db.prepare(`SELECT * FROM drivers WHERE phone = ? AND active = 1`).bind(msg.senderPhone).first<any>();
  if (driver) {
    const driverReply = await handleDriverCommand(env, driver, rawText, msg);
    if (driverReply) return driverReply;
  }

  // 3. Client negotiation replies (موافق على العرض / رفض العرض / تفاوض جديد)
  const clientNegoReply = await handleClientNegotiation(env, msg, rawText);
  if (clientNegoReply) {
    return clientNegoReply;
  }

  // 4. Student / University Shuttle Commands (باصات وخطوط جامعات مصر من العياط وقراها)
  if (
    lowerText.includes('جامع') ||
    lowerText.includes('باص') ||
    lowerText.includes('طالب') ||
    lowerText.includes('طالبة') ||
    lowerText.includes('بنات') ||
    lowerText.includes('شباب') ||
    lowerText.includes('ميكروباص') ||
    lowerText.includes('اشتراك') ||
    lowerText.includes('مقعد') ||
    lowerText.includes('كراسي') ||
    lowerText.includes('مواعيد') ||
    lowerText.includes('جروب') ||
    lowerText.includes('جروبات')
  ) {
    return handleShuttleMessage(env, msg);
  }

  // 4b. Passenger Attendance & Boarding via WhatsApp (ركبت / تم الركوب / حاضر / ركبت كود EZZ-...)
  if (
    lowerText.startsWith('ركبت') ||
    lowerText.includes('تم الركوب') ||
    lowerText.includes('أنا ركبت') ||
    lowerText.includes('ركبت الباص') ||
    lowerText.includes('حاضر') ||
    lowerText.startsWith('تأكيد الركوب')
  ) {
    const ticketMatch = rawText.match(/EZZ-\d+/i) || rawText.match(/\d{4,}/);
    const identifier = ticketMatch ? ticketMatch[0] : msg.senderPhone;
    const boardRes = await markBoardedByCodeOrPhone(db, identifier);
    if (boardRes.ok && boardRes.booking) {
      const b = boardRes.booking;
      return [{
        chatId: msg.chatId,
        text: `🟢 *تم تأكيد حضورك وركوبك بنجاح!*\n` +
          `👤 مرحباً بك يا *${b.student_name}*\n` +
          `🚐 السيارة: *${b.vehicle_name || 'باص 14 راكب'}*\n` +
          `🛣️ الخط: *${b.line_name || 'باصات الجامعات'}*\n` +
          `⏰ موعد التحرك: ${b.departure_time || '06:15 ص'} | كود التذكرة: *${b.ticket_code || ('EZZ-' + (1000 + b.id))}*\n` +
          `نورت باص *كابتن عز* 🚕✨، نتمنى لك رحلة آمنة وموفقة بإذن الله!`,
      }];
    } else {
      return [{
        chatId: msg.chatId,
        text: `⚠️ عذراً، لم نتمكن من مطابقة الحجز بالرقم الحالي (${msg.senderPhone}).\nيرجى إرسال الكود هكذا: *ركبت EZZ-1001* أو إبراز تذكرتك للكابتن.`,
      }];
    }
  }

  // 4c. Passenger asks for their Smart Ticket link
  if (lowerText.includes('تذكرتي') || lowerText.includes('التذكرة') || lowerText.includes('تذكره') || lowerText.includes('كارت الركوب')) {
    const booking = await getBookingByTicket(db, msg.senderPhone);
    if (booking) {
      const tCode = booking.ticket_code || ('EZZ-' + (1000 + booking.id));
      return [{
        chatId: msg.chatId,
        text: `🎫 *تذكرتك الذكية مع كابتن عز:*\n` +
          `👤 الراكب: *${booking.student_name}*\n` +
          `🎓 الخط: *${booking.line_name || ''}*\n` +
          `⏰ التحرك: *${booking.departure_time || '06:15 ص'}* | العودة: *${booking.return_time || '03:30 م'}*\n` +
          `📍 نقطة الركوب: *${booking.pickup_location || 'موقف العياط'}*\n` +
          `💵 الأجرة: *${booking.fare_amount} جنيه*\n` +
          `🚦 حالة الركوب: *${booking.boarded === 1 ? '🟢 ركب وحضر' : '🔴 في الانتظار (لم تركب بعد)'}*\n` +
          `🔗 *رابط كارت الركوب الذكي وتأكيد الحضور:*\n` +
          `/ticket/${tCode}`,
      }];
    } else {
      return [{
        chatId: msg.chatId,
        text: `لا يوجد حجز مسجل لرقمك اليوم.\nلحجز مقعدك فوراً في باصات الجامعات: اكتب *حجز جامعة القاهرة* أو تفضل بزيارة رابط الحجز: /book`,
      }];
    }
  }

  // 5. Ride Cancellation (إلغاء / اعتذار)
  if (
    lowerText.includes('الغي') ||
    lowerText.includes('إلغاء') ||
    lowerText.includes('اعتذر') ||
    lowerText.includes('الغاء') ||
    lowerText.includes('لغيت')
  ) {
    // Check shuttle booking first
    const shuttleCancelled = await cancelShuttleBooking(db, msg.senderPhone);
    if (shuttleCancelled) {
      return [{
        chatId: msg.chatId,
        text: '✅ تم إلغاء حجز مقعدك في باص الجامعة اليوم بنجاح وتم إتاحة المقعد لطالب آخر. نتشرف بخدمتك دائماً! 🌸',
      }];
    }

    // Check individual ride
    const activeRide = await db.prepare(`
      SELECT * FROM rides 
      WHERE client_phone = ? AND status IN ('NEW', 'DISPATCHING', 'ASSIGNED')
      ORDER BY id DESC LIMIT 1
    `).bind(msg.senderPhone).first<Ride>();

    if (activeRide) {
      await db.prepare(`UPDATE rides SET status = 'CANCELLED' WHERE id = ?`).bind(activeRide.id).run();
      if (activeRide.driver_id) {
        await db.prepare(`UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?`).bind(activeRide.driver_id).run();
      }
      return [{
        chatId: msg.chatId,
        text: '❌ تم إلغاء طلب المشوار بناءً على طلبك. نتشرف بخدمتك في أي وقت!',
      }];
    }
  }

  // 6. Ride Status Check (السائق فين / وين صار)
  if (lowerText.includes('وين') || lowerText.includes('فين') || lowerText.includes('تأخر') || lowerText.includes('السائق')) {
    const active = await db.prepare(`
      SELECT r.*, d.name as driver_name, d.phone as driver_phone, d.car, d.plate
      FROM rides r
      LEFT JOIN drivers d ON r.driver_id = d.id
      WHERE r.client_phone = ? AND r.status IN ('ASSIGNED', 'ARRIVED', 'IN_RIDE')
      ORDER BY r.id DESC LIMIT 1
    `).bind(msg.senderPhone).first<any>();

    if (active) {
      if (active.status === 'ARRIVED') {
        return [{
          chatId: msg.chatId,
          text: `🚕 الكابتن *${active.driver_name}* وصل وينتظرك الآن في موقع الانطلاق!\n📞 هاتف الكابتن: ${active.driver_phone}\n🚗 سيارة: ${active.car} (${active.plate})`,
        }];
      }
      return [{
        chatId: msg.chatId,
        text: `🚕 الكابتن *${active.driver_name}* في طريقه إليك!\n📞 هاتف الكابتن: ${active.driver_phone}\n🚗 سيارة: ${active.car} (${active.plate})`,
      }];
    }
  }

  // 7. Human Support Request (خدمة عملاء / شكوى)
  if (lowerText.includes('مهندس') || lowerText.includes('موظف') || lowerText.includes('إنسان') || lowerText.includes('خدمة عملاء') || lowerText.includes('شكوى')) {
    return [{
      chatId: msg.chatId,
      text: '👨‍💼 أهلاً بك، تم تحويل محادثتك لمسؤول التشغيل والدعم الفني في مركز تحكم العياط. سيتواصل معك أحد الزملاء خلال دقائق.',
    }];
  }

  // 8. Full Ride Request with Name, Phone, Pickup, Dropoff, and Offered Price
  const parsedReq = parseDetailedRideRequest(rawText, msg.senderPhone);
  if (parsedReq) {
    const fromZone = await matchZone(db, parsedReq.from);
    const toZone = await matchZone(db, parsedReq.to);
    
    // Estimate fair reference price
    const fare = computeFare(fromZone?.belt || 1, toZone?.belt || 3);
    const estimatedPrice = parsedReq.offeredPrice > 0 ? parsedReq.offeredPrice : fare.price;

    const res = await db.prepare(`
      INSERT INTO rides (
        client_phone, client_name, from_text, to_text, 
        from_zone_id, to_zone_id, price, client_offered_price, 
        negotiation_state, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'DISPATCHING', datetime('now'))
    `).bind(
      parsedReq.phone,
      parsedReq.name,
      parsedReq.from,
      parsedReq.to,
      fromZone?.id || null,
      toZone?.id || null,
      estimatedPrice,
      parsedReq.offeredPrice
    ).run();

    const rideId = res.meta.last_row_id;

    // Fetch drivers dispatch group JID
    const groupRow = await db.prepare(`SELECT value FROM settings WHERE key = 'drivers_group_jid'`).first<{ value: string }>();
    const groupJid = groupRow?.value || '120363000000000000@g.us';

    const replies: OutboundReply[] = [];

    // Reply to client
    let clientMsg = `✅ *تم استلام ونشر طلب مشوارك (#${rideId}) بنجاح!* 🚕\n`;
    clientMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    clientMsg += `👤 الاسم: *${parsedReq.name}*\n`;
    clientMsg += `📞 رقم التواصل: *${parsedReq.phone}*\n`;
    clientMsg += `📍 مكان الركوب: *${parsedReq.from}*\n`;
    clientMsg += `🏁 مكان النزول: *${parsedReq.to}*\n`;
    if (parsedReq.offeredPrice > 0) {
      clientMsg += `💰 المبلغ المقدر من طرفك: *${formatEGP(parsedReq.offeredPrice)}*\n`;
    } else {
      clientMsg += `💰 التسعيرة التقديرية: *${formatEGP(estimatedPrice)}*\n`;
    }
    clientMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    clientMsg += `⏳ *جاري عرض طلبك الآن على كباتن وسيارات العياط وقراها...*\n`;
    clientMsg += `• إذا وافق السائق على سعرك سيصلك تأكيد فوري ببياناته.\n`;
    clientMsg += `• إذا اقترح السائق سعراً آخر، ستصلك رسالة بالعرض لاختيار الموافقة أو الرفض أو التفاوض!`;

    replies.push({
      chatId: msg.chatId,
      text: clientMsg,
    });

    // Broadcast to drivers
    let driverNotice = `📢 *طلب مشوار جديد من العياط ومحيطها (#${rideId})*\n`;
    driverNotice += `━━━━━━━━━━━━━━━━━━━━\n`;
    driverNotice += `👤 العميل: *${parsedReq.name}*\n`;
    driverNotice += `📞 الموبايل: *${parsedReq.phone}*\n`;
    driverNotice += `📍 مكان الركوب: *${parsedReq.from}*\n`;
    driverNotice += `🏁 مكان النزول: *${parsedReq.to}*\n`;
    if (parsedReq.offeredPrice > 0) {
      driverNotice += `💰 السعر المقدر من العميل: *${formatEGP(parsedReq.offeredPrice)}*\n`;
    } else {
      driverNotice += `💰 السعر المقترح: *${formatEGP(estimatedPrice)}*\n`;
    }
    driverNotice += `━━━━━━━━━━━━━━━━━━━━\n`;
    driverNotice += `🚕 *خيارات الكباتن للرد:*\n`;
    driverNotice += `✅ للموافقة بنفس السعر: اكتب «*موافق #${rideId}*»\n`;
    driverNotice += `💬 لاقتراح سعر مختلف (تفاوض): اكتب «*عرض #${rideId} [سعرك]*»\n`;
    driverNotice += `(مثال: *عرض #${rideId} 300*)`;

    replies.push({
      chatId: groupJid,
      text: driverNotice,
    });

    return replies;
  }

  // 9. Main Menu & Guide
  let menu = `🚕 أهلاً بك في *منظومة كابتن عز* لنقل الجامعات والمشاوير بالعياط وقراها 🇪🇬\n`;
  menu += `👨‍💻 *برمجة وتطوير: أسامة بسيوني لتطوير المواقع والتطبيقات*\n`;
  menu += `نخدم مركز العياط وكافة القرى المجاورة (البليدة، المتانيا، برنشت، كفر شحاتة، ميت القائد، العطف، جرزا، طهما، بهبيت، مزغونة...)\n\n`;
  menu += `1️⃣ *باصات واشتراكات جامعات مصر (14 راكب)* 🎓:\n`;
  menu += `• خطوط يومية منتظمة لأكثر من 16 جامعة (القاهرة، 6 أكتوبر، MUST، MSA، حلوان، عين شمس، GUC، AUC، بني سويف، الفيوم، بدر...).\n`;
  menu += `👉 اكتب: «*مواعيد الجامعات*» أو «*جروبات الجامعات*» أو «*حجز القاهرة*».\n\n`;
  menu += `2️⃣ *تأكيد الحضور والركوب بالباص لحظياً* 🟢:\n`;
  menu += `• فور صعودك الباص اكتب: «*ركبت*» أو «*تم الركوب*» لتسجيل حضورك للسائق والإدارة فوراً.\n\n`;
  menu += `3️⃣ *عرض التذكرة الذكية* 🎫:\n`;
  menu += `• اكتب: «*تذكرتي*» لعرض كارت الركوب الذكي الخاص بك.\n\n`;
  menu += `4️⃣ *المشاوير الخاصة والعادية بنظام التفاوض* 🚗:\n`;
  menu += `• اطلب عربية خاصة بسعرك المقدر، ونتفاوض مع الكباتن مباشرة!\n`;
  menu += `👉 أرسل تفاصيل مشوارك بهذا الشكل:\n`;
  menu += `*الاسم*: فلان الفلاني\n`;
  menu += `*الموبايل*: 010xxxxxxxx\n`;
  menu += `*مكان الركوب*: العياط المحطة (أو قريتك)\n`;
  menu += `*مكان النزول*: جامعة القاهرة (أو وجهتك)\n`;
  menu += `*المبلغ المقدر*: 250 جنيه\n\n`;
  menu += `🌐 رابط الحجز الإلكتروني المباشر: /book`;

  return [{
    chatId: msg.chatId,
    text: menu,
  }];
}

// معالجة ردود العميل على العروض والتفاوض (موافق / رفض / تفاوض)
async function handleClientNegotiation(env: Env, msg: InboundMessage, text: string): Promise<OutboundReply[] | null> {
  const db = env.DB;
  const lower = text.toLowerCase();

  // Find latest active ride for this client with pending bids
  const ride = await db.prepare(`
    SELECT * FROM rides 
    WHERE client_phone = ? AND status IN ('NEW', 'DISPATCHING')
    ORDER BY id DESC LIMIT 1
  `).bind(msg.senderPhone).first<Ride>();

  if (!ride) return null;

  // 1. Client Accepts Driver Bid: موافق / نعم / تمام / موافق #123
  if (lower === 'موافق' || lower === 'نعم' || lower.startsWith('موافق') || lower === 'تمام' || lower === 'تم' || lower === 'قبلت') {
    // Find latest pending bid
    const bid = await db.prepare(`
      SELECT * FROM ride_bids 
      WHERE ride_id = ? AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    `).bind(ride.id).first<RideBid>();

    if (bid) {
      // Mark bid accepted
      await db.prepare(`UPDATE ride_bids SET status = 'accepted' WHERE id = ?`).bind(bid.id).run();
      // Assign ride
      await db.prepare(`
        UPDATE rides 
        SET status = 'ASSIGNED', driver_id = ?, final_price = ?, price = ?, 
            negotiation_state = 'agreed', assigned_at = datetime('now')
        WHERE id = ?
      `).bind(bid.driver_id, bid.offered_price, bid.offered_price, ride.id).run();

      await db.prepare(`UPDATE drivers SET status = 'BUSY' WHERE id = ?`).bind(bid.driver_id).run();

      const driverChatId = bid.driver_phone.includes('@') ? bid.driver_phone : `${bid.driver_phone}@s.whatsapp.net`;

      return [
        {
          chatId: msg.chatId,
          text: `🎉 *تم الاتفاق وتأكيد مشوارك بنجاح!* (#${ride.id})\n━━━━━━━━━━━━━━━━━━━━\n👤 الكابتن: *${bid.driver_name}*\n📞 رقم الكابتن: *${bid.driver_phone}*\n🚗 السيارة: *${bid.driver_car || 'سيارة خاصة'}* (${bid.driver_plate || ''})\n💰 الأجرة المتفق عليها: *${formatEGP(bid.offered_price)}*\n\nالكابتن يتواصل معك الآن وفي طريقه لموقع الركوب. نتمنى لك رحلة آمنة! ✨`,
        },
        {
          chatId: driverChatId,
          text: `✅ *مبروك كابتن ${bid.driver_name}! العميل وافق على عرضك (${formatEGP(bid.offered_price)}) للمشوار #${ride.id}*\n━━━━━━━━━━━━━━━━━━━━\n👤 اسم العميل: *${ride.client_name || 'العميل'}*\n📞 هاتف العميل: *${ride.client_phone}*\n📍 مكان الركوب: *${ride.from_text}*\n🏁 مكان النزول: *${ride.to_text}*\n\nتواصل مع العميل وتوجه إليه فوراً. بالتوفيق! 🚗`,
        },
      ];
    }
  }

  // 2. Client Rejects Driver Bid: رفض / مش موافق / لا
  if (lower === 'رفض' || lower === 'لا' || lower.includes('مش موافق') || lower.startsWith('رفض')) {
    const bid = await db.prepare(`
      SELECT * FROM ride_bids 
      WHERE ride_id = ? AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    `).bind(ride.id).first<RideBid>();

    if (bid) {
      await db.prepare(`UPDATE ride_bids SET status = 'rejected' WHERE id = ?`).bind(bid.id).run();
      const driverChatId = bid.driver_phone.includes('@') ? bid.driver_phone : `${bid.driver_phone}@s.whatsapp.net`;

      return [
        {
          chatId: msg.chatId,
          text: `👍 تم تسجيل رفض العرض. طلب مشوارك (#${ride.id}) لا يزال معروضاً على باقي كباتن العياط، وسنوافيك بأي عرض جديد فوراً!`,
        },
        {
          chatId: driverChatId,
          text: `ℹ️ كابتن ${bid.driver_name}، العميل اعتذر عن قبول عرض السعر (${formatEGP(bid.offered_price)}) للمشوار #${ride.id}. يمكنك تقديم عرض جديد أو انتظار طلبات أخرى.`,
        },
      ];
    }
  }

  // 3. Client Counter-Offer: تفاوض 250 / اخري 250 / سعري 250
  const counterMatch = text.match(/(?:تفاوض|اخري|آخري|سعري|ممكن)\s*(\d+)/i) || (text.length <= 5 && text.match(/^(\d{2,4})$/));
  if (counterMatch) {
    const counterPrice = Number(counterMatch[1]);
    if (counterPrice >= 20 && counterPrice <= 5000) {
      await db.prepare(`
        UPDATE rides 
        SET client_offered_price = ?, negotiation_state = 'client_countered' 
        WHERE id = ?
      `).bind(counterPrice, ride.id).run();

      const groupRow = await db.prepare(`SELECT value FROM settings WHERE key = 'drivers_group_jid'`).first<{ value: string }>();
      const groupJid = groupRow?.value || '120363000000000000@g.us';

      return [
        {
          chatId: msg.chatId,
          text: `👍 تم إرسال سعرك الجديد (*${formatEGP(counterPrice)}*) لكباتن وسيارات العياط للتفاوض في المشوار #${ride.id}. جاري انتظار رد الكباتن!`,
        },
        {
          chatId: groupJid,
          text: `🔔 *تحديث تفاوض من العميل للمشوار #${ride.id}*\n👤 العميل: *${ride.client_name || 'عميل العياط'}*\n📍 من: ${ride.from_text} ⬅️ إلى: ${ride.to_text}\n💰 السعر الجديد المعروض من العميل: *${formatEGP(counterPrice)}*\n\n✅ للموافقة: اكتب «*موافق #${ride.id}*»\n💬 لتقديم عرض آخر: اكتب «*عرض #${ride.id} [سعرك]*»`,
        },
      ];
    }
  }

  return null;
}

async function handleShuttleMessage(env: Env, msg: InboundMessage): Promise<OutboundReply[]> {
  const db = env.DB;
  const raw = msg.text.toLowerCase();

  // Show all Egyptian university lines from Ayat and villages
  if (raw.includes('مواعيد') || raw.includes('خطوط') || raw.includes('جدول') || raw.includes('جامعات') || raw.includes('جروب') || raw.includes('جروبات')) {
    const lines = await getShuttleLines(db);
    const vehicles = await getShuttleVehicles(db);
    
    let reply = `🎓 *دليل خطوط وجروبات باصات وسيارات جامعات مصر (انطلاق من العياط وقراها)*:\n\n`;
    reply += `نوفر أسطول باصات وسيارات 14 راكب وسيارات خاصة لكل جامعة لخدمة أبنائنا الطلاب في العياط ومحيطها:\n\n`;

    lines.slice(0, 16).forEach((l, idx) => {
      const lineVehicles = vehicles.filter((v) => v.line_id === l.id);
      const totalCapacity = lineVehicles.reduce((sum, v) => sum + v.seat_capacity, 0);
      const booked = lineVehicles.reduce((sum, v) => sum + (v.booked_seats || 0), 0);
      const remaining = Math.max(0, totalCapacity - booked);

      reply += `${idx + 1}️⃣ *${l.name}*\n`;
      reply += `• نقطة الانطلاق: ${l.pickup_point}\n`;
      reply += `• موعد التحرك: ⏰ ${l.departure_time} | العودة: ⏰ ${l.return_time}\n`;
      reply += `• تسعيرة المقعد: ${l.round_trip_price} ج ذهاب وعودة (${l.one_way_price} ج ذهاب فقط)\n`;
      if (totalCapacity > 0) {
        reply += `• المقاعد المتاحة اليوم: *${remaining} من ${totalCapacity} مقعد* 💺\n`;
      }
      reply += `\n`;
    });

    reply += `━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `📲 *للحجز الفوري لمقعدك*:\nاكتب مثلاً: «*حجز مقعد لجامعة القاهرة*» أو «*حجز أكتوبر*» أو «*حجز حلوان*»\n`;
    reply += `💬 للانضمام لجروب واتساب الجامعة أو الاستفسار عن سيارة خاصة، اكتب اسم جامعتك!`;

    return [{ chatId: msg.chatId, text: reply }];
  }

  // University specific detection
  let targetLineId = 1;
  let lineName = 'جامعة القاهرة';

  if (raw.includes('اكتوبر') || raw.includes('أكتوبر') || raw.includes('حصري')) {
    targetLineId = 2;
    lineName = 'جامعة 6 أكتوبر';
  } else if (raw.includes('must') || raw.includes('مصر للعلوم')) {
    targetLineId = 3;
    lineName = 'جامعة مصر للعلوم والتكنولوجيا MUST';
  } else if (raw.includes('msa')) {
    targetLineId = 4;
    lineName = 'جامعة MSA بأكتوبر';
  } else if (raw.includes('حلوان') || raw.includes('عين حلوان')) {
    targetLineId = 5;
    lineName = 'جامعة حلوان';
  } else if (raw.includes('عين شمس') || raw.includes('عباسية')) {
    targetLineId = 6;
    lineName = 'جامعة عين شمس';
  } else if (raw.includes('guc') || raw.includes('الألمانية') || raw.includes('الالمانية')) {
    targetLineId = 7;
    lineName = 'الجامعة الألمانية GUC';
  } else if (raw.includes('auc') || raw.includes('الأمريكية') || raw.includes('الامريكية')) {
    targetLineId = 8;
    lineName = 'الجامعة الأمريكية AUC';
  } else if (raw.includes('بدر') || raw.includes('شروق')) {
    targetLineId = 9;
    lineName = 'جامعة بدر والشروق';
  } else if (raw.includes('بني سويف') || raw.includes('سويف') || raw.includes('النهضة')) {
    targetLineId = 10;
    lineName = 'جامعة بني سويف والنهضة';
  } else if (raw.includes('فيوم')) {
    targetLineId = 11;
    lineName = 'جامعة الفيوم';
  }

  let direction = 'round';
  let dirLabel = 'ذهاب وعودة';
  if (raw.includes('ذهاب فقط') || raw.includes('رايح بس')) {
    direction = 'one_way_go';
    dirLabel = 'ذهاب فقط';
  } else if (raw.includes('عودة فقط') || raw.includes('راجع بس')) {
    direction = 'one_way_back';
    dirLabel = 'عودة فقط';
  }

  const gender = raw.includes('شباب') ? 'شباب' : (raw.includes('بنات') ? 'بنات' : 'all');

  const bookResult = await bookShuttleSeat(db, {
    lineId: targetLineId,
    studentName: 'طالب / طالبة من العياط',
    studentPhone: msg.senderPhone,
    gender,
    direction,
    seatsCount: 1,
    pickupLocation: 'موقف العياط ومداخل القرى',
    fareAmount: direction === 'round' ? 60 : 35,
  });

  if (bookResult.ok) {
    const vehicles = await getShuttleVehicles(db);
    const assignedVehicle = vehicles.find((v) => v.id === bookResult.vehicleId);

    let confirmMsg = `✅ *تم تأكيد حجز مقعدك الجامعي بنجاح!*\n`;
    confirmMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    confirmMsg += `🎓 الوجهة: *${lineName}*\n`;
    confirmMsg += `🚗 السيارة: *${assignedVehicle?.vehicle_name || 'عربية 1 (تويوتا 14 راكب)'}*\n`;
    confirmMsg += `👤 الكابتن: *${assignedVehicle?.driver_name || 'كابتن محمود الهواري'}* (${assignedVehicle?.driver_phone || '01011223344'})\n`;
    confirmMsg += `📍 نقطة الركوب: موقف العياط الرئيسي أو مدخل قريتك\n`;
    confirmMsg += `⏰ موعد التحرك: الساعة 6:15 صباحاً\n`;
    confirmMsg += `🔁 نوع الحجز: ${dirLabel}\n`;
    confirmMsg += `💺 مقاعدك المحجوزة: مقعد 1 مؤكد\n`;
    confirmMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    confirmMsg += `💡 *ملاحظة:* في حال طرأ أي ظرف واعتذرت عن الحضور، يُرجى إرسال «*اعتذار*» قبل 5:30 ص لتوفير مقعدك لزميل آخر.`;

    return [{ chatId: msg.chatId, text: confirmMsg }];
  }

  return [{
    chatId: msg.chatId,
    text: `⚠️ عذراً، سيارات خط ${lineName} الحالية مكتملة العدد لرحلة الغد. تم وضع رقمك في قائمة الانتظار، وسنوافيك فور توفر مقعد أو عربية إضافية!`,
  }];
}

async function handleDriverCommand(env: Env, driver: any, text: string, msg: InboundMessage): Promise<OutboundReply[] | null> {
  const db = env.DB;
  const lower = text.toLowerCase();

  // Driver requests manifest
  if (lower.includes('كشف') || lower.includes('الركاب') || lower.includes('الطلاب') || lower.includes('باصي')) {
    const vehicle = await db.prepare(`SELECT id FROM shuttle_vehicles WHERE driver_phone = ? OR driver_name = ?`).bind(driver.phone, driver.name).first<{ id: number }>();
    if (vehicle) {
      const manifest = await generateDriverManifest(db, vehicle.id);
      return [{ chatId: msg.chatId, text: manifest }];
    }
  }

  // Driver status: متاح / مشغول
  if (lower === 'متاح' || lower.includes('جاهز')) {
    await db.prepare(`UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?`).bind(driver.id).run();
    return [{ chatId: msg.chatId, text: `✅ مرحباً كابتن ${driver.name}، تم تسجيل حالتك: *متاح للعمل في العياط ومحيطها* 🟢` }];
  }

  if (lower === 'غير متاح' || lower.includes('مش فاضي') || lower.includes('استراحة')) {
    await db.prepare(`UPDATE drivers SET status = 'BUSY' WHERE id = ?`).bind(driver.id).run();
    return [{ chatId: msg.chatId, text: `⏸️ تم تسجيل حالتك: *في استراحة / غير متاح* 🔴` }];
  }

  // Driver accepts directly (موافق #12 أو قبلت 12)
  const acceptMatch = text.match(/(?:موافق|قبلت)\s*#?(\d+)/i);
  if (acceptMatch) {
    const rideId = Number(acceptMatch[1]);
    const ride = await db.prepare(`SELECT * FROM rides WHERE id = ? AND status = 'DISPATCHING'`).bind(rideId).first<Ride>();
    if (ride) {
      const finalPrice = ride.client_offered_price && ride.client_offered_price > 0 ? ride.client_offered_price : ride.price;

      await db.prepare(`
        UPDATE rides 
        SET status = 'ASSIGNED', driver_id = ?, final_price = ?, price = ?, 
            negotiation_state = 'agreed', assigned_at = datetime('now') 
        WHERE id = ? AND status = 'DISPATCHING'
      `).bind(driver.id, finalPrice, finalPrice, rideId).run();

      await db.prepare(`UPDATE drivers SET status = 'BUSY' WHERE id = ?`).bind(driver.id).run();

      const clientChatId = ride.client_phone.includes('@') ? ride.client_phone : `${ride.client_phone}@s.whatsapp.net`;
      return [
        {
          chatId: msg.chatId,
          text: `🚕 تم إسناد المشوار #${rideId} لك بنجاح!\n━━━━━━━━━━━━━━━━━━━━\n👤 العميل: ${ride.client_name || 'العميل'}\n📞 هاتف العميل: ${ride.client_phone}\n📍 مكان الركوب: ${ride.from_text}\n🏁 مكان النزول: ${ride.to_text}\n💰 الأجرة المقبولة: ${formatEGP(finalPrice)}`,
        },
        {
          chatId: clientChatId,
          text: `🚕 *الكابتن في طريقه إليك الآن!* (#${rideId})\n━━━━━━━━━━━━━━━━━━━━\n👤 الكابتن: *${driver.name}*\n📞 الهاتف: *${driver.phone}*\n🚗 السيارة: *${driver.car || 'سيارة خاصة'}* (${driver.plate || ''})\n💰 الأجرة المتفق عليها: *${formatEGP(finalPrice)}*`,
        },
      ];
    }
  }

  // Driver counter-offers price: عرض #12 300 أو سعر #12 300
  const bidMatch = text.match(/(?:عرض|سعر|اقترح|اوصلك)\s*#?(\d+)\s+(?:بـ|بـ |سعر )?(\d+)/i);
  if (bidMatch) {
    const rideId = Number(bidMatch[1]);
    const offeredPrice = Number(bidMatch[2]);

    const ride = await db.prepare(`SELECT * FROM rides WHERE id = ? AND status = 'DISPATCHING'`).bind(rideId).first<Ride>();
    if (!ride) {
      return [{
        chatId: msg.chatId,
        text: `⚠️ المشوار #${rideId} تم قبوله بالفعل أو لم يعد متاحاً.`,
      }];
    }

    // Save bid
    await db.prepare(`
      INSERT INTO ride_bids (ride_id, driver_id, driver_name, driver_phone, driver_car, driver_plate, offered_price, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s', 'now'))
    `).bind(
      rideId,
      driver.id,
      driver.name,
      driver.phone,
      driver.car || '',
      driver.plate || '',
      offeredPrice
    ).run();

    await db.prepare(`UPDATE rides SET negotiation_state = 'driver_offered' WHERE id = ?`).bind(rideId).run();

    const clientChatId = ride.client_phone.includes('@') ? ride.client_phone : `${ride.client_phone}@s.whatsapp.net`;

    return [
      {
        chatId: msg.chatId,
        text: `✅ تم إرسال عرض سعرك (*${formatEGP(offeredPrice)}*) للعميل للمشوار #${rideId}. في انتظار موافقة العميل! ⏳`,
      },
      {
        chatId: clientChatId,
        text: `🚗 *عرض سعر جديد لمشوارك (#${rideId})*\n━━━━━━━━━━━━━━━━━━━━\nالكابتن: *${driver.name}*\nالسيارة: *${driver.car || 'سيارة خاصة'}* (${driver.plate || ''})\n💰 السعر المقترح من الكابتن: *${formatEGP(offeredPrice)}* (بدلاً من ${formatEGP(ride.client_offered_price || ride.price)})\n━━━━━━━━━━━━━━━━━━━━\n📌 *خياراتك للرد:*\n1️⃣ للموافقة على السعر: اكتب «*موافق*»\n2️⃣ لرفض العرض: اكتب «*رفض*»\n3️⃣ لتفاوض بسعر مختلف: اكتب «*تفاوض [سعرك]*» (مثال: *تفاوض 280*)`,
      },
    ];
  }

  // Driver arrived (وصلت 12)
  const arrivedMatch = text.match(/وصلت\s*#?(\d+)/i);
  if (arrivedMatch) {
    const rideId = Number(arrivedMatch[1]);
    const ride = await db.prepare(`SELECT * FROM rides WHERE id = ? AND driver_id = ?`).bind(rideId, driver.id).first<Ride>();
    if (ride) {
      await db.prepare(`UPDATE rides SET status = 'ARRIVED' WHERE id = ?`).bind(rideId).run();
      const clientChatId = ride.client_phone.includes('@') ? ride.client_phone : `${ride.client_phone}@s.whatsapp.net`;
      return [
        { chatId: msg.chatId, text: `👍 تم إبلاغ العميل بوصولك لموقع الركوب.` },
        { chatId: clientChatId, text: `🚕 الكابتن *${driver.name}* وصل وينتظرك بالخارج!\n🚗 سيارة: ${driver.car} (${driver.plate})` },
      ];
    }
  }

  // Driver finished (خلصت 12)
  const doneMatch = text.match(/(خلصت|تمت|انتهى)\s*#?(\d+)/i);
  if (doneMatch) {
    const rideId = Number(doneMatch[2]);
    const ride = await db.prepare(`SELECT * FROM rides WHERE id = ? AND driver_id = ?`).bind(rideId, driver.id).first<Ride>();
    if (ride) {
      await db.prepare(`UPDATE rides SET status = 'COMPLETED', done_at = datetime('now') WHERE id = ?`).bind(rideId).run();
      await db.prepare(`UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?`).bind(driver.id).run();
      const clientChatId = ride.client_phone.includes('@') ? ride.client_phone : `${ride.client_phone}@s.whatsapp.net`;
      return [
        { chatId: msg.chatId, text: `🏁 تم إنهاء المشوار #${rideId} بنجاح. أصبحت متاحاً لطلبات جديدة!` },
        { chatId: clientChatId, text: `حمد لله على سلامتك! نتمنى أن تكون رحلتك مريحة وسعيدة. شكراً لاختيارك خدماتنا 🚕✨` },
      ];
    }
  }

  return null;
}

async function handleGroupMessage(env: Env, msg: InboundMessage): Promise<OutboundReply[]> {
  const db = env.DB;
  const text = msg.text.trim();

  // Driver in group accepts: موافق #12 أو قبلت 12
  const acceptMatch = text.match(/(?:موافق|قبلت)\s*#?(\d+)/i);
  if (acceptMatch) {
    const rideId = Number(acceptMatch[1]);
    const driver = await db.prepare(`SELECT * FROM drivers WHERE phone = ? AND active = 1`).bind(msg.senderPhone).first<any>();
    if (!driver) {
      return [{
        chatId: msg.chatId,
        text: `⚠️ عذراً، رقم الهاتف غير مسجل كسائق معتمد في النظام.`,
      }];
    }

    const ride = await db.prepare(`SELECT * FROM rides WHERE id = ? AND status = 'DISPATCHING'`).bind(rideId).first<Ride>();
    if (!ride) {
      return [{
        chatId: msg.chatId,
        text: `⚠️ المشوار #${rideId} تم قبوله مسبقاً أو غير متاح.`,
      }];
    }

    const finalPrice = ride.client_offered_price && ride.client_offered_price > 0 ? ride.client_offered_price : ride.price;

    await db.prepare(`
      UPDATE rides 
      SET status = 'ASSIGNED', driver_id = ?, final_price = ?, price = ?, 
          negotiation_state = 'agreed', assigned_at = datetime('now') 
      WHERE id = ? AND status = 'DISPATCHING'
    `).bind(driver.id, finalPrice, finalPrice, rideId).run();

    await db.prepare(`UPDATE drivers SET status = 'BUSY' WHERE id = ?`).bind(driver.id).run();

    const clientChatId = ride.client_phone.includes('@') ? ride.client_phone : `${ride.client_phone}@s.whatsapp.net`;
    return [
      {
        chatId: msg.chatId,
        text: `✅ تم إسناد المشوار #${rideId} للكابتن *${driver.name}* بنفس السعر المطلوب (${formatEGP(finalPrice)})!`,
      },
      {
        chatId: clientChatId,
        text: `🚕 تم قبول مشوارك!\nالكابتن *${driver.name}* في طريقه إليك.\n📞 هاتف السائق: ${driver.phone}\n🚗 سيارة: ${driver.car} (${driver.plate})\n💰 الأجرة: ${formatEGP(finalPrice)}`,
      },
    ];
  }

  // Driver in group proposes a different price: عرض #12 300
  const bidMatch = text.match(/(?:عرض|سعر|اقترح)\s*#?(\d+)\s+(?:بـ|بـ |سعر )?(\d+)/i);
  if (bidMatch) {
    const rideId = Number(bidMatch[1]);
    const offeredPrice = Number(bidMatch[2]);

    const driver = await db.prepare(`SELECT * FROM drivers WHERE phone = ? AND active = 1`).bind(msg.senderPhone).first<any>();
    if (!driver) {
      return [{ chatId: msg.chatId, text: `⚠️ عذراً، رقم الهاتف غير مسجل كسائق معتمد.` }];
    }

    const ride = await db.prepare(`SELECT * FROM rides WHERE id = ? AND status = 'DISPATCHING'`).bind(rideId).first<Ride>();
    if (!ride) {
      return [{ chatId: msg.chatId, text: `⚠️ المشوار #${rideId} تم قبوله أو غير متاح.` }];
    }

    await db.prepare(`
      INSERT INTO ride_bids (ride_id, driver_id, driver_name, driver_phone, driver_car, driver_plate, offered_price, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s', 'now'))
    `).bind(
      rideId,
      driver.id,
      driver.name,
      driver.phone,
      driver.car || '',
      driver.plate || '',
      offeredPrice
    ).run();

    await db.prepare(`UPDATE rides SET negotiation_state = 'driver_offered' WHERE id = ?`).bind(rideId).run();

    const clientChatId = ride.client_phone.includes('@') ? ride.client_phone : `${ride.client_phone}@s.whatsapp.net`;

    return [
      {
        chatId: msg.chatId,
        text: `💬 كابتن *${driver.name}* اقترح سعر *${formatEGP(offeredPrice)}* للمشوار #${rideId}. جاري إرسال العرض للعميل!`,
      },
      {
        chatId: clientChatId,
        text: `🚗 *عرض سعر جديد لمشوارك (#${rideId})*\n━━━━━━━━━━━━━━━━━━━━\nالكابتن: *${driver.name}*\nالسيارة: *${driver.car || 'سيارة خاصة'}* (${driver.plate || ''})\n💰 السعر المقترح من الكابتن: *${formatEGP(offeredPrice)}* (بدلاً من ${formatEGP(ride.client_offered_price || ride.price)})\n━━━━━━━━━━━━━━━━━━━━\n📌 *خياراتك للرد:*\n1️⃣ للموافقة على السعر: اكتب «*موافق*»\n2️⃣ لرفض العرض: اكتب «*رفض*»\n3️⃣ لتفاوض بسعر مختلف: اكتب «*تفاوض [سعرك]*» (مثال: *تفاوض 280*)`,
      },
    ];
  }

  return [];
}

// استخراج بيانات المشوار المنظم أو الرسائل التلقائية (الاسم، الموبايل، الركوب، النزول، السعر)
function parseDetailedRideRequest(text: string, senderPhone: string): {
  name: string;
  phone: string;
  from: string;
  to: string;
  offeredPrice: number;
} | null {
  // 1. Check structured form format (الاسم: ... الموبايل: ... الركوب: ... النزول: ... السعر: ...)
  let name = '';
  let phone = '';
  let from = '';
  let to = '';
  let offeredPrice = 0;

  const nameMatch = text.match(/(?:الاسم|اسمي|اسم|العميل)[\s:=-]+([^\n,]+)/i);
  if (nameMatch) name = nameMatch[1].trim();

  const phoneMatch = text.match(/(?:الموبايل|موبايل|الهاتف|تليفون|رقم)[\s:=-]+([0-9+]{9,15})/i) || text.match(/\b(01[0125][0-9]{8})\b/);
  if (phoneMatch) phone = phoneMatch[1].trim();

  const fromMatch = text.match(/(?:مكان الركوب|الركوب|من|ركوب)[\s:=-]+([^\n,]+?)(?=(?:مكان النزول|النزول|إلى|الي|لعند|المبلغ|السعر|$))/i);
  if (fromMatch) from = fromMatch[1].trim();

  const toMatch = text.match(/(?:مكان النزول|النزول|إلى|الي|لعند|نزول)[\s:=-]+([^\n,]+?)(?=(?:المبلغ|السعر|المبلغ المقدر|$))/i);
  if (toMatch) to = toMatch[1].trim();

  const priceMatch = text.match(/(?:المبلغ المقدر|المبلغ|السعر|سعر|بـ|بمبلغ)[\s:=-]*(\d+)/i) || text.match(/(\d+)\s*(?:جنيه|ج|جنية|ج\.م)/i);
  if (priceMatch) offeredPrice = Number(priceMatch[1]);

  // If structured extracted from and to
  if (from && to) {
    return {
      name: name || 'عميل محترم',
      phone: phone || senderPhone,
      from,
      to,
      offeredPrice,
    };
  }

  // 2. Natural language fallback: "مشوار من العياط إلى جامعة القاهرة بـ 250 جنيه"
  const m1 = text.match(/(?:مشوار|تاكسي|عربية|طلب|محتاج|عايز)?\s*من\s+([^\s]+(?:\s+[^\s]+){0,5})\s+(?:لعند|إلى|الي|لـ|ل)\s+([^\s]+(?:\s+[^\s]+){0,5})(?:\s+(?:بـ|بمبلغ|بسعر|بـ |حوالي)?\s*(\d+))?/i);
  if (m1 && m1[1] && m1[2]) {
    return {
      name: name || 'عميل من العياط',
      phone: phone || senderPhone,
      from: m1[1].trim(),
      to: m1[2].trim(),
      offeredPrice: m1[3] ? Number(m1[3]) : offeredPrice,
    };
  }

  // Natural language format: "عايز اروح جامعة 6 اكتوبر من قرية البليدة بـ 200"
  const m2 = text.match(/(?:عايز اروح|بدي روح|رايح|مشوار)\s+(?:لعند|إلى|الي|لـ|ل)\s+([^\s]+(?:\s+[^\s]+){0,5})\s+من\s+([^\s]+(?:\s+[^\s]+){0,5})(?:\s+(?:بـ|بمبلغ|بسعر)?\s*(\d+))?/i);
  if (m2 && m2[1] && m2[2]) {
    return {
      name: name || 'عميل من العياط',
      phone: phone || senderPhone,
      from: m2[2].trim(),
      to: m2[1].trim(),
      offeredPrice: m2[3] ? Number(m2[3]) : offeredPrice,
    };
  }

  return null;
}

async function matchZone(db: D1Database, name: string): Promise<Zone | null> {
  const clean = name.trim();
  const direct = await db.prepare(`SELECT * FROM zones WHERE name LIKE ? LIMIT 1`).bind(`%${clean}%`).first<Zone>();
  if (direct) return direct;

  const all = await db.prepare(`SELECT * FROM zones`).all<Zone>();
  for (const z of all.results || []) {
    if (z.aliases && z.aliases.includes(clean)) {
      return z;
    }
  }
  return null;
}

