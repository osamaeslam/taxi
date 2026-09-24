export function formatSYP(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '0 ج.م';
  return price.toLocaleString('ar-EG') + ' ج.م';
}

export function formatEGP(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '0 جنيه';
  return price.toLocaleString('ar-EG') + ' جنيه';
}

/**
 * فئات تسعير المناطق والمشاوير بالعياط:
 * 1: داخل العياط
 * 2: منطقة قريبة ريفية
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
    name: 'منطقة قريبة ريفية',
    label: 'منطقة قريبة ريفية',
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

  // لو من منطقة قريبة ريفية لأخرى أو لداخل العياط
  if (fromCat.id === 2 || toCat.id === 2) {
    return { price: 70, source: 'ZONE' };
  }

  const base = Math.max(fromCat.baseFare, toCat.baseFare);
  return { price: base, source: 'ZONE' };
}
