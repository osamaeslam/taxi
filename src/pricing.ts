export function formatSYP(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '0 ج.م';
  return price.toLocaleString('ar-EG') + ' ج.م';
}

export function formatEGP(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '0 جنيه';
  return price.toLocaleString('ar-EG') + ' جنيه';
}

/**
 * فئات تسعير المناطق والمشاوير بالعياط (بيانات أولية / احتياطية):
 * 1: داخل العياط
 * 2: منطقة ريفية
 * 3: مدينة
 * 4: مطار القاهرة
 * 5: مشوار خاص
 */
export interface AreaCategory {
  id: number;
  name: string;
  label: string;
  icon: string;
  baseFare: number;
  description: string;
}

export interface ZonePriceItem {
  id: number;
  category_key: string;
  name: string;
  icon: string;
  base_price: number;
  return_price: number;
  description: string;
  sort_order: number;
  is_active: number;
  updated_at?: string;
}

export const DEFAULT_ZONE_PRICING: ZonePriceItem[] = [
  {
    id: 1,
    category_key: 'inside_ayat',
    name: 'داخل العياط',
    icon: '🏙️',
    base_price: 40,
    return_price: 70,
    description: 'مشاوير داخلية في نطاق مدينة العياط، المحطة، السوق، والمواقف والمصالح',
    sort_order: 1,
    is_active: 1,
  },
  {
    id: 2,
    category_key: 'rural_area',
    name: 'منطقة ريفية',
    icon: '🌾',
    base_price: 70,
    return_price: 120,
    description: 'قرى وعزب ونجوع العياط (البليدة، المتانيا، برنشت، كفر شحاتة، ميت القائد، طهما، بهبيت، جرزا...)',
    sort_order: 2,
    is_active: 1,
  },
  {
    id: 3,
    category_key: 'city',
    name: 'مدينة',
    icon: '🚗',
    base_price: 240,
    return_price: 420,
    description: 'مشاوير المدن والمحافظات (الجيزة، 6 أكتوبر، الشيخ زايد، الهرم، حلوان، الفيوم، بني سويف)',
    sort_order: 3,
    is_active: 1,
  },
  {
    id: 4,
    category_key: 'cairo_airport',
    name: 'مطار القاهرة',
    icon: '✈️',
    base_price: 550,
    return_price: 950,
    description: 'توصيل واستقبال مطار القاهرة الدولي ومطار سفنكس الدولي والرحلات الجوية',
    sort_order: 4,
    is_active: 1,
  },
  {
    id: 5,
    category_key: 'private_ride',
    name: 'مشوار خاص',
    icon: '👑',
    base_price: 450,
    return_price: 800,
    description: 'مشوار خاص مخصص بالساعة، يوم كامل، مناسبات، مشاوير انتظار، أو سفر عائلي حر',
    sort_order: 5,
    is_active: 1,
  },
];

export const AREA_CATEGORIES: Record<number, AreaCategory> = {
  1: {
    id: 1,
    name: 'داخل العياط',
    label: 'داخل العياط',
    icon: '🏙️',
    baseFare: 40,
    description: 'مشاوير داخلية في نطاق مدينة العياط، المحطة، السوق، والمواقف',
  },
  2: {
    id: 2,
    name: 'منطقة ريفية',
    label: 'منطقة ريفية',
    icon: '🌾',
    baseFare: 70,
    description: 'قرى وعزب العياط (برنشت، المتانيا، بهبيت، كفر عمار، البليدة، طهما)',
  },
  3: {
    id: 3,
    name: 'مدينة',
    label: 'مدينة',
    icon: '🚗',
    baseFare: 240,
    description: 'مشاوير المدن والمحافظات (الجيزة، أكتوبر، الهرم، حلوان، الفيوم، بني سويف)',
  },
  4: {
    id: 4,
    name: 'مطار القاهرة',
    label: 'مطار القاهرة',
    icon: '✈️',
    baseFare: 550,
    description: 'توصيل واستقبال مطار القاهرة الدولي ومطار سفنكس الدولي',
  },
  5: {
    id: 5,
    name: 'مشوار خاص',
    label: 'مشوار خاص',
    icon: '👑',
    baseFare: 450,
    description: 'مشوار خاص مخصص بالساعة، يوم كامل، مناسبات، أو سفر مفتوح',
  },
};

/**
 * جلب تسعيرة المناطق المفعلة من قاعدة البيانات ديناميكياً
 */
export async function getDynamicZonePricing(db: any): Promise<ZonePriceItem[]> {
  try {
    const res = await db.prepare(
      `SELECT id, category_key, name, icon, base_price, return_price, description, sort_order, is_active, updated_at 
       FROM zone_pricing 
       WHERE is_active = 1 
       ORDER BY sort_order ASC, id ASC`
    ).all();
    if (res.results && res.results.length > 0) {
      return res.results as ZonePriceItem[];
    }
  } catch (err) {
    console.warn('[Pricing] Error querying zone_pricing, fallback to defaults:', err);
  }
  return DEFAULT_ZONE_PRICING;
}

/**
 * جلب جميع فئات التسعير (المفعلة وغير المفعلة) للوحة الإدارة
 */
export async function getAllZonePricing(db: any): Promise<ZonePriceItem[]> {
  try {
    const res = await db.prepare(
      `SELECT id, category_key, name, icon, base_price, return_price, description, sort_order, is_active, updated_at 
       FROM zone_pricing 
       ORDER BY sort_order ASC, id ASC`
    ).all();
    if (res.results && res.results.length > 0) {
      return res.results as ZonePriceItem[];
    }
  } catch (err) {
    console.warn('[Pricing] Error querying all zone_pricing:', err);
  }
  return DEFAULT_ZONE_PRICING;
}

/**
 * تحديث سعر فئة منطقة معينة
 */
export async function updateZonePrice(
  db: any,
  id: number,
  basePrice: number,
  returnPrice?: number,
  description?: string,
  name?: string,
  icon?: string,
  isActive?: number
): Promise<boolean> {
  try {
    const updates: string[] = ['base_price = ?', "updated_at = datetime('now')"];
    const params: any[] = [basePrice];

    if (returnPrice !== undefined) {
      updates.push('return_price = ?');
      params.push(returnPrice);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (icon !== undefined && icon.trim()) {
      updates.push('icon = ?');
      params.push(icon.trim());
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
    }

    params.push(id);
    await db.prepare(`UPDATE zone_pricing SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    return true;
  } catch (err) {
    console.error('[Pricing] Failed to update zone price:', err);
    return false;
  }
}

/**
 * إضافة فئة تسعير منطقة جديدة
 */
export async function addZonePriceCategory(
  db: any,
  item: {
    category_key: string;
    name: string;
    icon?: string;
    base_price: number;
    return_price?: number;
    description?: string;
  }
): Promise<number | null> {
  try {
    const res = await db.prepare(`
      INSERT INTO zone_pricing (category_key, name, icon, base_price, return_price, description, sort_order, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM zone_pricing), 1, datetime('now'))
    `).bind(
      item.category_key || `custom_${Date.now()}`,
      item.name,
      item.icon || '📍',
      item.base_price,
      item.return_price || 0,
      item.description || ''
    ).run();
    return res.meta?.last_row_id || null;
  } catch (err) {
    console.error('[Pricing] Failed to add zone price category:', err);
    return null;
  }
}

/**
 * حذف أو إلغاء تفعيل فئة منطقة
 */
export async function deleteZonePriceCategory(db: any, id: number): Promise<boolean> {
  try {
    await db.prepare(`DELETE FROM zone_pricing WHERE id = ?`).bind(id).run();
    return true;
  } catch (err) {
    console.error('[Pricing] Failed to delete zone price category:', err);
    return false;
  }
}

/**
 * استعادة التسعيرة الافتراضية للفئات الـ 5 المعتمدة
 */
export async function resetDefaultZonePricing(db: any): Promise<boolean> {
  try {
    await db.prepare(`DELETE FROM zone_pricing`).run();
    for (const item of DEFAULT_ZONE_PRICING) {
      await db.prepare(`
        INSERT INTO zone_pricing (id, category_key, name, icon, base_price, return_price, description, sort_order, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      `).bind(
        item.id,
        item.category_key,
        item.name,
        item.icon,
        item.base_price,
        item.return_price || 0,
        item.description,
        item.sort_order
      ).run();
    }
    return true;
  } catch (err) {
    console.error('[Pricing] Failed to reset default zone pricing:', err);
    return false;
  }
}

/**
 * صياغة رسالة تسعيرة المناطق الديناميكية الموجهة لبوت الواتساب
 */
export function formatZonePricingForWhatsApp(items: ZonePriceItem[]): string {
  let msg = `💰 *قائمة تسعيرة المناطق والمشاوير المعتمدة — كابتن عز* 🚕🇪🇬\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `نقدم لكم التسعيرة الاسترشادية الرسمية لخدمة أهالينا وطلابنا في مركز العياط وكافة القرى المجاورة:\n\n`;

  items.forEach((item, idx) => {
    msg += `${item.icon || '📍'} *${item.name}*: *${formatEGP(item.base_price)}*\n`;
    if (item.return_price && item.return_price > 0) {
      msg += `   🔄 ذهاب وعودة / انتظار: *${formatEGP(item.return_price)}*\n`;
    }
    if (item.description) {
      msg += `   📝 ${item.description}\n`;
    }
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 *كيف يتم تسعير المشوار والاتفاق؟*\n`;
  msg += `• هذه الأسعار تسعيرة مرجعية واضحة تضمن حق العميل والكابتن.\n`;
  msg += `• يمكنك دائماً طلب مشوارك وتحديد سعرك الخاص للتفاوض المباشر مع كباتن العياط!\n\n`;
  msg += `🚕 *لطلب مشوارك الآن، أرسل:* \n`;
  msg += `*مشوار من [مكانك] إلى [وجهتك] بـ [سعرك]*\n`;
  msg += `(مثال: *مشوار من العياط المحطة إلى جامعة القاهرة بـ 240 جنيه*)\n\n`;
  msg += `🌐 أو اطلب مباشرة عبر الرابط الإلكتروني: /book`;

  return msg;
}

export function getCategoryName(catId: number): string {
  return AREA_CATEGORIES[catId]?.name || 'داخل العياط';
}

export function getCategoryIcon(catId: number): string {
  return AREA_CATEGORIES[catId]?.icon || '📍';
}

// تسعير تقديري للمشاوير حسب تصنيف المنطقتين
export function computeFare(
  fromCategory: number,
  toCategory: number,
  fixedFares?: Array<{ from_zone_id: number; to_zone_id: number; price: number }>,
  fromZoneId?: number,
  toZoneId?: number
): { price: number; source: 'FIXED' | 'ZONE' | 'NONE' } {
  // 1) فحص التسعيرة الثابتة بين المنطقتين أولاً إن وجدت
  if (fixedFares && fromZoneId && toZoneId) {
    const match = fixedFares.find(
      (f) =>
        (f.from_zone_id === fromZoneId && f.to_zone_id === toZoneId) ||
        (f.from_zone_id === toZoneId && f.to_zone_id === fromZoneId)
    );
    if (match && match.price > 0) {
      return { price: match.price, source: 'FIXED' };
    }
  }

  const fromCat = AREA_CATEGORIES[fromCategory] || AREA_CATEGORIES[1];
  const toCat = AREA_CATEGORIES[toCategory] || AREA_CATEGORIES[1];

  // لو داخل العياط لداخل العياط
  if (fromCat.id === 1 && toCat.id === 1) {
    return { price: 40, source: 'ZONE' };
  }

  // لو مطار القاهرة طرف في المشوار
  if (fromCat.id === 4 || toCat.id === 4) {
    return { price: 550, source: 'ZONE' };
  }

  // لو مشوار خاص
  if (fromCat.id === 5 || toCat.id === 5) {
    return { price: 450, source: 'ZONE' };
  }

  // لو مدينة طرف في المشوار
  if (fromCat.id === 3 || toCat.id === 3) {
    return { price: 240, source: 'ZONE' };
  }

  // لو من منطقة ريفية لأخرى أو لداخل العياط
  if (fromCat.id === 2 || toCat.id === 2) {
    return { price: 70, source: 'ZONE' };
  }

  const base = Math.max(fromCat.baseFare, toCat.baseFare);
  return { price: base, source: 'ZONE' };
}
