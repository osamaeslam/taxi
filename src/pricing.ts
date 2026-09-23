export function formatSYP(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '0 ج.م';
  return price.toLocaleString('ar-EG') + ' ج.م';
}

export function formatEGP(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '0 جنيه';
  return price.toLocaleString('ar-EG') + ' جنيه';
}

export interface ZoneBelt {
  [belt: number]: number;
}

// تسعير تقديري للمشاوير الخاصة والعادية المنطلقة من العياط وقراها
export const BELT_BASE: ZoneBelt = {
  1: 35,   // مشاوير داخلية في العياط والقرى المجاورة
  2: 80,   // إلى المراكز المجاورة (البدرشين، طهما، جرزا، كفر شحاتة، الواسطى)
  3: 180,  // إلى حلوان، المعادي، الهرم، فيصل، ميدان الجيزة
  4: 260,  // إلى وسط البلد، رمسيس، العباسية، مدينة نصر، التجمع، أكتوبر
  5: 350,  // المحافظات والمدن البعيدة (بني سويف، الفيوم، بدر، الشروق)
};

export function computeFare(
  fromBelt: number,
  toBelt: number,
  fixedFares?: Array<{ from_zone_id: number; to_zone_id: number; price: number }>,
  fromZoneId?: number,
  toZoneId?: number
): { price: number; source: 'FIXED' | 'BELT' | 'NONE' } {
  // Check fixed fares first
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

  const hi = Math.max(fromBelt || 1, toBelt || 1);
  const lo = Math.min(fromBelt || 1, toBelt || 1);
  const base = BELT_BASE[hi] ?? 120;
  const diff = hi - lo;
  const price = base + diff * 30;

  return { price, source: 'BELT' };
}
