import type { Env } from './types.js';

export async function runSupervisor(env: Env): Promise<void> {
  try {
    // 1. Mark stale dispatching rides as EXPIRED after 15 minutes
    await env.DB.prepare(`
      UPDATE rides
      SET status = 'EXPIRED'
      WHERE status IN ('NEW', 'DISPATCHING') 
      AND created_at < datetime('now', '-15 minutes')
    `).run();

    // 2. Clean outbox items older than 7 days
    await env.DB.prepare(`
      DELETE FROM outbox 
      WHERE sent_at IS NOT NULL 
      AND sent_at < datetime('now', '-7 days')
    `).run();
  } catch (err) {
    console.error('[Supervisor Error]:', err);
  }
}
