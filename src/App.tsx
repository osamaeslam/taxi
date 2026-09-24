/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { UniversityLinesManager } from './UniversityLinesManager.js';
import type { ShuttleLine } from './shuttle.js';

// الـ 16 خط المعتمدة لمنظومة كابتن عز (العياط وقراها ⬅️ جامعات القاهرة والجيزة والمحافظات)
const INITIAL_LINES: ShuttleLine[] = [
  {
    id: 1,
    name: 'خط العياط ⬅️ جامعة القاهرة (الجيزة)',
    pickup_point: 'موقف العياط الرئيسي - كوبري العياط - محطة القطار',
    destination: 'جامعة القاهرة (بين السرايات / مترو الجامعة)',
    departure_time: '06:15 ص',
    return_time: '03:30 م',
    one_way_price: 35,
    round_trip_price: 60,
    active: 1,
  },
  {
    id: 2,
    name: 'خط العياط ⬅️ جامعة 6 أكتوبر والحصري',
    pickup_point: 'موقف العياط ومفارق المتانيا والبليدة',
    destination: 'جامعة 6 أكتوبر (ميدان الحصري / المحور المركزي)',
    departure_time: '06:15 ص',
    return_time: '04:00 م',
    one_way_price: 40,
    round_trip_price: 75,
    active: 1,
  },
  {
    id: 3,
    name: 'خط العياط ⬅️ جامعة مصر للعلوم والتكنولوجيا (MUST)',
    pickup_point: 'العياط - شارع الجيش وموقف الباصات',
    destination: 'جامعة MUST - محور 26 يوليو بأكتوبر',
    departure_time: '06:15 ص',
    return_time: '04:00 م',
    one_way_price: 40,
    round_trip_price: 75,
    active: 1,
  },
  {
    id: 4,
    name: 'خط العياط ⬅️ جامعة أكتوبر للعلوم الحديثة والآداب (MSA)',
    pickup_point: 'العياط - كوبري السكة الحديد',
    destination: 'جامعة MSA - طريق الواحات 6 أكتوبر',
    departure_time: '06:15 ص',
    return_time: '04:00 م',
    one_way_price: 40,
    round_trip_price: 75,
    active: 1,
  },
  {
    id: 5,
    name: 'خط العياط ⬅️ جامعة حلوان (عين حلوان)',
    pickup_point: 'معدية العياط - مدخل العياط والبليدة',
    destination: 'حرم جامعة حلوان / محطة مترو عين حلوان',
    departure_time: '06:30 ص',
    return_time: '03:30 م',
    one_way_price: 30,
    round_trip_price: 55,
    active: 1,
  },
  {
    id: 6,
    name: 'خط العياط ⬅️ جامعة عين شمس (العباسية وروكسي)',
    pickup_point: 'العياط - المحطة وميدان المزلقان',
    destination: 'جامعة عين شمس (العباسية / الخليفة المأمون)',
    departure_time: '06:00 ص',
    return_time: '04:00 م',
    one_way_price: 45,
    round_trip_price: 80,
    active: 1,
  },
  {
    id: 7,
    name: 'خط العياط ⬅️ الجامعة الألمانية بالقاهرة (GUC التجمع)',
    pickup_point: 'موقف العياط الرئيسي - طريق مصر أسيوط',
    destination: 'حرم الجامعة الألمانية GUC - التجمع الخامس',
    departure_time: '06:00 ص',
    return_time: '04:30 م',
    one_way_price: 55,
    round_trip_price: 100,
    active: 1,
  },
  {
    id: 8,
    name: 'خط العياط ⬅️ الجامعة الأمريكية (AUC التجمع الخامس)',
    pickup_point: 'العياط ومداخل القرى (برنشت والبليدة)',
    destination: 'الجامعة الأمريكية AUC - شارع التسعين بالتجمع',
    departure_time: '06:00 ص',
    return_time: '04:30 م',
    one_way_price: 60,
    round_trip_price: 110,
    active: 1,
  },
  {
    id: 9,
    name: 'خط العياط ⬅️ جامعة بدر (BUC) وجامعة الشروق',
    pickup_point: 'العياط - محطة مصر الزراعي',
    destination: 'جامعة بدر الدولية والشروق (طريق السويس)',
    departure_time: '05:45 ص',
    return_time: '04:30 م',
    one_way_price: 60,
    round_trip_price: 110,
    active: 1,
  },
  {
    id: 10,
    name: 'خط العياط ⬅️ جامعة بني سويف وجامعة النهضة',
    pickup_point: 'جنوب العياط - جرزا وكفر شحاتة وميت القائد',
    destination: 'جامعة بني سويف وميدان الزراعيين / جامعة النهضة',
    departure_time: '06:30 ص',
    return_time: '03:30 م',
    one_way_price: 35,
    round_trip_price: 65,
    active: 1,
  },
  {
    id: 11,
    name: 'خط العياط ⬅️ جامعة الفيوم (دمو والحرم الجامعي)',
    pickup_point: 'العياط - مفارق طهما وجرزا والبرمبل',
    destination: 'جامعة الفيوم / كلية الهندسة والمجمع الطبي بدمو',
    departure_time: '06:30 ص',
    return_time: '03:30 م',
    one_way_price: 35,
    round_trip_price: 65,
    active: 1,
  },
  {
    id: 12,
    name: 'خط العياط ⬅️ جامعة الأهرام الكندية (ACU) ونيو جيزة',
    pickup_point: 'العياط - كوبري المدينة',
    destination: 'أكتوبر - المنطقة الصناعية / نيو جيزة',
    departure_time: '06:15 ص',
    return_time: '04:00 م',
    one_way_price: 45,
    round_trip_price: 80,
    active: 1,
  },
  {
    id: 13,
    name: 'خط العياط ⬅️ جامعة النيل الأهلية وجامعة الجيزة الجديدة',
    pickup_point: 'موقف العياط - الطريق السريع',
    destination: 'جامعة النيل - محور 26 يوليو أمام هايبر وان',
    departure_time: '06:15 ص',
    return_time: '04:00 م',
    one_way_price: 45,
    round_trip_price: 80,
    active: 1,
  },
  {
    id: 14,
    name: 'خط العياط ⬅️ جامعة 15 مايو والجامعات التكنولوجية',
    pickup_point: 'العياط - معدية كفر عمار وموقف حلوان',
    destination: 'جامعة 15 مايو ومدينة مايو الجديدة',
    departure_time: '06:45 ص',
    return_time: '03:30 م',
    one_way_price: 35,
    round_trip_price: 60,
    active: 1,
  },
  {
    id: 15,
    name: 'خط قرى العياط المجمعة (البليدة - المتانيا - برنشت)',
    pickup_point: 'ميدان البليدة - مدخل المتانيا - برنشت',
    destination: 'جامعة القاهرة وجامعة الجيزة التكنولوجية',
    departure_time: '06:00 ص',
    return_time: '03:30 م',
    one_way_price: 35,
    round_trip_price: 60,
    active: 1,
  },
  {
    id: 16,
    name: 'خط قرى العياط البحرية (ميت القائد - كفر شحاتة)',
    pickup_point: 'ميت القائد - كفر شحاتة - كفر عمار',
    destination: 'جامعة 6 أكتوبر وميدان الحصري',
    departure_time: '06:00 ص',
    return_time: '04:00 م',
    one_way_price: 40,
    round_trip_price: 75,
    active: 1,
  },
];

export default function App() {
  // تخزين مصفوفة حالة خطوط الجامعات لتجربة التفاعل الحي
  const [lines, setLines] = useState<ShuttleLine[]>(INITIAL_LINES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // إضافة خط جديد
  const handleAddLine = (newLineData: Omit<ShuttleLine, 'id'>) => {
    const nextId = lines.length > 0 ? Math.max(...lines.map((l) => l.id)) + 1 : 1;
    const newLine: ShuttleLine = {
      ...newLineData,
      id: nextId,
    };
    setLines((prev) => [newLine, ...prev]);
    showToast(`✅ تمت إضافة خط "${newLine.name}" بنجاح.`);
  };

  // تعديل خط موجود
  const handleUpdateLine = (updatedLine: ShuttleLine) => {
    setLines((prev) => prev.map((l) => (l.id === updatedLine.id ? updatedLine : l)));
    showToast(`✏️ تم تحديث خط "${updatedLine.name}" بنجاح.`);
  };

  // حذف خط
  const handleDeleteLine = (id: number) => {
    const target = lines.find((l) => l.id === id);
    setLines((prev) => prev.filter((l) => l.id !== id));
    showToast(`🗑️ تم حذف الخط #${id} (${target?.name ?? ''}) بنجاح.`);
  };

  // تبديل حالة التنشيط
  const handleToggleActive = (id: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const nextActive = l.active === 1 ? 0 : 1;
          showToast(
            nextActive === 1
              ? `🟢 تم تفعيل الخط #${id} لاستقبال الحجوزات`
              : `⏸ تم إيقاف الخط #${id} مؤقتاً`
          );
          return { ...l, active: nextActive };
        }
        return l;
      })
    );
  };

  // استعادة الخطوط الافتراضية
  const handleResetDefaults = () => {
    setLines(INITIAL_LINES);
    showToast('🔄 تم استعادة الـ 16 خط الافتراضية المعتمدة لمنظومة كابتن عز.');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚕</span>
            <div>
              <span className="font-black text-lg text-emerald-400 tracking-tight">كابتن عز</span>
              <span className="text-xs text-slate-400 block -mt-1">
                خدمات النقل الذكي وباصات الجامعات بالعياط
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/book"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors hidden sm:inline-block font-medium"
            >
              حجز باص عام ↗
            </a>
            <a
              href="/ride"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors hidden sm:inline-block font-medium"
            >
              طلب مشوار خاص ↗
            </a>
            <a
              href="/admin/whatsapp"
              className="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-xs"
            >
              📱 لوحة واتساب
            </a>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-xs md:text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white mr-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content: University Lines Manager */}
      <main className="flex-1 py-6">
        <UniversityLinesManager
          lines={lines}
          onAddLine={handleAddLine}
          onUpdateLine={handleUpdateLine}
          onDeleteLine={handleDeleteLine}
          onToggleActive={handleToggleActive}
          onResetDefaults={handleResetDefaults}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>منظومة كابتن عز — إدارة خطوط وباصات الجامعات بالعياط وقراها</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>تحديث تفاعلي حي</span>
            <span aria-hidden="true">·</span>
            <span>React + Tailwind CSS</span>
            <span aria-hidden="true">·</span>
            <span>16 خط معتمد</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
