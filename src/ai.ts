import type { Env } from './types.js';

export async function aiChat(
  env: Env,
  systemPrompt: string,
  userText: string,
  _maxTokens = 600
): Promise<string | null> {
  const key = env.AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    // Graceful offline fallback summary
    return `ملخص المحادثة: استفسار وحجز رحلة. تفاصيل الرسائل الأخيرة: ${userText.slice(0, 150)}...`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userText }] }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return `ملخص المحادثة: طلب رحلة جاري المعالجة. النص: ${userText.slice(0, 100)}`;
    }

    const data = (await res.json()) as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return `ملخص المحادثة: ${userText.slice(0, 120)}`;
  }
}
