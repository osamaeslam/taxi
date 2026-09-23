import type { D1Database } from '@cloudflare/workers-types';
import type { Issue } from './types.js';

export async function todayStats(db: D1Database): Promise<{
  total: number;
  done: number;
  revenue: number;
  activeDrivers: number;
}> {
  const ridesRes = await db.prepare(`
    SELECT 
      COUNT(*) as total_rides,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_rides,
      SUM(CASE WHEN status = 'COMPLETED' THEN COALESCE(price, 0) ELSE 0 END) as total_rev
    FROM rides 
    WHERE date(created_at) = date('now')
  `).first<{ total_rides: number; completed_rides: number; total_rev: number }>();

  // Also include shuttle revenues if any
  const shuttleRes = await db.prepare(`
    SELECT 
      COUNT(*) as total_shuttle,
      SUM(COALESCE(fare_amount, 0)) as shuttle_rev
    FROM shuttle_bookings
    WHERE date(created_at, 'unixepoch') = date('now') AND status != 'cancelled'
  `).first<{ total_shuttle: number; shuttle_rev: number }>();

  const driversRes = await db.prepare(`
    SELECT COUNT(*) as active_drivers FROM drivers WHERE active = 1 AND status != 'OFFLINE'
  `).first<{ active_drivers: number }>();

  const total = (ridesRes?.total_rides ?? 0) + (shuttleRes?.total_shuttle ?? 0);
  const done = (ridesRes?.completed_rides ?? 0) + (shuttleRes?.total_shuttle ?? 0);
  const revenue = (ridesRes?.total_rev ?? 0) + (shuttleRes?.shuttle_rev ?? 0);
  const activeDrivers = driversRes?.active_drivers ?? 0;

  return { total, done, revenue, activeDrivers };
}

export async function getConversations(db: D1Database, limit = 30): Promise<Array<{
  chat_id: string;
  phone: string;
  name?: string;
  last_text: string;
  last_time: string;
  unread: number;
  is_group: boolean;
  paused: boolean;
}>> {
  const res = await db.prepare(`
    SELECT 
      chat_id,
      sender_phone,
      text as last_text,
      created_at as last_time
    FROM messages
    WHERE id IN (
      SELECT MAX(id) FROM messages GROUP BY chat_id
    )
    ORDER BY id DESC
    LIMIT ?
  `).bind(limit).all<{ chat_id: string; sender_phone: string; last_text: string; last_time: string }>();

  const pausedList = await getPausedChats(db);

  return (res.results || []).map((c) => {
    const is_group = c.chat_id.endsWith('@g.us');
    const phone = c.sender_phone || c.chat_id.split('@')[0];
    const paused = pausedList.includes(phone);

    return {
      chat_id: c.chat_id,
      phone,
      last_text: c.last_text || '',
      last_time: c.last_time || '',
      unread: 0,
      is_group,
      paused,
    };
  });
}

export async function getChatMessages(db: D1Database, chatId: string, limit = 60): Promise<Array<{
  id: number;
  direction: 'in' | 'out';
  chat_id: string;
  sender_phone: string;
  text: string;
  created_at: string;
}>> {
  const res = await db.prepare(`
    SELECT id, direction, chat_id, sender_phone, text, created_at
    FROM messages
    WHERE chat_id = ?
    ORDER BY id ASC
    LIMIT ?
  `).bind(chatId, limit).all<{
    id: number;
    direction: 'in' | 'out';
    chat_id: string;
    sender_phone: string;
    text: string;
    created_at: string;
  }>();

  return res.results || [];
}

export async function getPausedChats(db: D1Database): Promise<string[]> {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = 'paused_chats'`).first<{ value: string }>();
  if (!row?.value) return [];
  try {
    return JSON.parse(row.value) as string[];
  } catch {
    return [];
  }
}

export async function setPaused(db: D1Database, phone: string, paused: boolean): Promise<string[]> {
  const current = await getPausedChats(db);
  const set = new Set(current);
  if (paused) {
    set.add(phone);
  } else {
    set.delete(phone);
  }
  const next = Array.from(set);
  await db.prepare(`
    INSERT INTO settings (key, value) VALUES ('paused_chats', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).bind(JSON.stringify(next)).run();
  return next;
}

export async function queueOutbox(db: D1Database, chatId: string, text: string, role = 'BOT'): Promise<void> {
  await db.prepare(`
    INSERT INTO outbox (chat_id, text, sent_at, created_at)
    VALUES (?, ?, NULL, datetime('now'))
  `).bind(chatId, text).run();

  await logMessage(db, {
    direction: 'out',
    chat_id: chatId,
    sender_phone: chatId.split('@')[0],
    text,
    intent: role,
  });
}

export async function logMessage(db: D1Database, data: {
  direction: 'in' | 'out';
  chat_id: string;
  sender_phone: string;
  text: string;
  intent?: string;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO messages (direction, chat_id, sender_phone, text, intent, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    data.direction,
    data.chat_id,
    data.sender_phone,
    data.text,
    data.intent ?? null
  ).run();
}

export async function listIssues(db: D1Database, limit = 50): Promise<Issue[]> {
  const res = await db.prepare(`
    SELECT * FROM issues ORDER BY id DESC LIMIT ?
  `).bind(limit).all<Issue>();
  return res.results || [];
}

export async function setIssueStatus(db: D1Database, id: number, status: 'new' | 'acked' | 'fixed'): Promise<void> {
  await db.prepare(`UPDATE issues SET status = ? WHERE id = ?`).bind(status, id).run();
}
