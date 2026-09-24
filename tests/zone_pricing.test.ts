import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../src/db';
import {
  getDynamicZonePricing,
  getAllZonePricing,
  updateZonePrice,
  addZonePriceCategory,
  deleteZonePriceCategory,
  resetDefaultZonePricing,
  formatZonePricingForWhatsApp,
} from '../src/pricing';
import { handleMessage } from '../src/engine';
import type { Env } from '../src/types';

describe('Zone Pricing Dynamic System', () => {
  let db: any;
  let env: Env;

  beforeEach(async () => {
    const { d1 } = getDatabase(':memory:');
    db = d1;
    env = {
      DB: db,
      ADMIN_KEY: 'test-admin-key',
    };
  });

  it('initializes default 5 zone pricing categories from migrations', async () => {
    const zones = await getDynamicZonePricing(db);
    expect(zones.length).toBe(5);

    const keys = zones.map((z) => z.category_key);
    expect(keys).toContain('inside_ayat');
    expect(keys).toContain('rural_area');
    expect(keys).toContain('city');
    expect(keys).toContain('cairo_airport');
    expect(keys).toContain('private_ride');

    const insideAyat = zones.find((z) => z.category_key === 'inside_ayat');
    expect(insideAyat?.base_price).toBe(40);
    expect(insideAyat?.name).toBe('داخل العياط');
  });

  it('updates price dynamically and reflects in WhatsApp text formatting', async () => {
    const zones = await getDynamicZonePricing(db);
    const insideAyat = zones.find((z) => z.category_key === 'inside_ayat')!;

    // Update inside Ayat to 50 EGP
    const ok = await updateZonePrice(db, insideAyat.id, 50, 80, 'توصيل سريع بداخل المدينة');
    expect(ok).toBe(true);

    const updatedZones = await getDynamicZonePricing(db);
    const updatedInsideAyat = updatedZones.find((z) => z.category_key === 'inside_ayat')!;
    expect(updatedInsideAyat.base_price).toBe(50);
    expect(updatedInsideAyat.return_price).toBe(80);

    const waText = formatZonePricingForWhatsApp(updatedZones);
    expect(waText).toContain('٥٠ جنيه');
    expect(waText).toContain('٨٠ جنيه');
    expect(waText).toContain('توصيل سريع بداخل المدينة');
  });

  it('responds to user asking for prices in WhatsApp bot with dynamic table', async () => {
    const replies = await handleMessage(env, {
      chatId: '201011223344@s.whatsapp.net',
      senderPhone: '201011223344',
      text: 'ممكن اعرف اسعار المناطق والمشاوير؟',
      isGroup: false,
    });

    expect(replies.length).toBeGreaterThan(0);
    const replyText = replies[0].text;
    expect(replyText).toContain('قائمة تسعيرة المناطق والمشاوير المعتمدة');
    expect(replyText).toContain('داخل العياط');
    expect(replyText).toContain('منطقة ريفية');
    expect(replyText).toContain('مطار القاهرة');
  });

  it('supports adding custom zone category, toggling, and resetting defaults', async () => {
    const newId = await addZonePriceCategory(db, {
      category_key: 'sphinx_airport',
      name: 'مطار سفنكس',
      icon: '🛫',
      base_price: 350,
      return_price: 600,
      description: 'طريق مصر الإسكندرية الصحراوي',
    });
    expect(newId).toBeGreaterThan(0);

    let all = await getAllZonePricing(db);
    expect(all.length).toBe(6);

    // Delete
    await deleteZonePriceCategory(db, newId!);
    all = await getAllZonePricing(db);
    expect(all.length).toBe(5);

    // Reset defaults restores the baseline 5 categories
    const resetOk = await resetDefaultZonePricing(db);
    expect(resetOk).toBe(true);
    const resetZones = await getDynamicZonePricing(db);
    expect(resetZones.length).toBe(5);
  });
});
