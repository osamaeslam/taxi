import React, { useState } from 'react';
import type { ShuttleLine } from './shuttle.js';

export interface UniversityLinesManagerProps {
  lines: ShuttleLine[];
  onAddLine: (line: Omit<ShuttleLine, 'id'>) => void;
  onUpdateLine: (line: ShuttleLine) => void;
  onDeleteLine: (id: number) => void;
  onToggleActive: (id: number) => void;
  onResetDefaults?: () => void;
}

const DEFAULT_FORM_STATE: Omit<ShuttleLine, 'id'> = {
  name: '',
  pickup_point: '',
  destination: '',
  departure_time: '06:15 ص',
  return_time: '03:30 م',
  one_way_price: 40,
  round_trip_price: 70,
  active: 1,
};

export const UniversityLinesManager: React.FC<UniversityLinesManagerProps> = ({
  lines,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onToggleActive,
  onResetDefaults,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'price_asc' | 'price_desc'>('id');
  
  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ShuttleLine | null>(null);
  const [deletingLine, setDeletingLine] = useState<ShuttleLine | null>(null);

  // Form state
  const [formData, setFormData] = useState<Omit<ShuttleLine, 'id'>>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter and sort lines
  const filteredLines = lines
    .filter((line) => {
      const matchesSearch =
        line.name.toLowerCase().includes(search.toLowerCase()) ||
        line.destination.toLowerCase().includes(search.toLowerCase()) ||
        line.pickup_point.toLowerCase().includes(search.toLowerCase());

      if (statusFilter === 'active') return matchesSearch && line.active === 1;
      if (statusFilter === 'inactive') return matchesSearch && line.active === 0;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      if (sortBy === 'price_asc') return a.round_trip_price - b.round_trip_price;
      if (sortBy === 'price_desc') return b.round_trip_price - a.round_trip_price;
      return a.id - b.id;
    });

  // Stats calculation
  const totalCount = lines.length;
  const activeCount = lines.filter((l) => l.active === 1).length;
  const inactiveCount = totalCount - activeCount;
  const avgRoundTrip = totalCount > 0
    ? Math.round(lines.reduce((acc, l) => acc + l.round_trip_price, 0) / totalCount)
    : 0;

  const handleOpenAdd = () => {
    setFormData(DEFAULT_FORM_STATE);
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (line: ShuttleLine) => {
    setEditingLine(line);
    setFormData({
      name: line.name,
      pickup_point: line.pickup_point,
      destination: line.destination,
      departure_time: line.departure_time,
      return_time: line.return_time,
      one_way_price: line.one_way_price,
      round_trip_price: line.round_trip_price,
      active: line.active,
    });
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('يرجى كتابة اسم خط الجامعة');
      return;
    }
    if (!formData.pickup_point.trim()) {
      setFormError('يرجى تحديد نقاط الانطلاق والتجمع');
      return;
    }
    if (!formData.destination.trim()) {
      setFormError('يرجى تحديد وجهة الحرم الجامعي');
      return;
    }
    if (formData.one_way_price <= 0 || formData.round_trip_price <= 0) {
      setFormError('يجب أن تكون الأسعار أرقاماً موجبة أكبر من صفر');
      return;
    }

    if (editingLine) {
      onUpdateLine({
        ...formData,
        id: editingLine.id,
      });
      setEditingLine(null);
    } else {
      onAddLine(formData);
      setIsAddOpen(false);
    }
    setFormData(DEFAULT_FORM_STATE);
  };

  const handleConfirmDelete = () => {
    if (deletingLine) {
      onDeleteLine(deletingLine.id);
      setDeletingLine(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-slate-800">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span>منظومة كابتن عز</span>
            <span aria-hidden="true">·</span>
            <span>باصات الجامعات</span>
            <span aria-hidden="true">·</span>
            <span>العياط وقراها</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            إدارة خطوط الجامعات والمحطات
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            إضافة وتعديل وحذف مسارات باصات الطلبة، مواعيد الانطلاق، وتسعير رحلات الذهاب والعودة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-3.5 py-2 text-xs md:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 transition-colors"
              title="استعادة الـ 16 خط الافتراضية المعتمدة"
            >
              🔄 استعادة الخطوط الافتراضية
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>إضافة خط جديد</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (Clean, unboxed typography) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div>
          <div className="text-xs font-medium text-slate-500">إجمالي الخطوط</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">خط معتمد مسجل</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">الخطوط النشطة</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">تستقبل الحجوزات الآن</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">الخطوط المتوقفة</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{inactiveCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">معطلة مؤقتاً للصيانة</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">متوسط تذكرة الذهاب والعودة</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{avgRoundTrip} ج.م</div>
          <div className="text-xs text-slate-500 mt-0.5">للطالب يومياً</div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الخط، الجامعة، أو نقطة الركوب..."
            className="w-full pl-8 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
          />
          <span className="absolute right-3 top-2.5 text-slate-400 text-sm">🔍</span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs (Segmented control) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start md:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'active'
                ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            النشطة ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-white text-amber-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المتوقفة ({inactiveCount})
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs text-slate-500 font-medium">ترتيب:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="id">رقم الخط الافتراضي</option>
            <option value="name">الاسم أبجدياً</option>
            <option value="price_asc">السعر: من الأقل للأعلى</option>
            <option value="price_desc">السعر: من الأعلى للأقل</option>
          </select>
        </div>
      </div>

      {/* Lines Grid / Cards */}
      {filteredLines.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-300 rounded-xl p-8">
          <div className="text-4xl mb-3">🎓</div>
          <h3 className="text-base font-semibold text-slate-800">لا توجد خطوط تطابق البحث</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            لم نتمكن من العثور على أي خط يتطابق مع معايير الفلترة المحددة. جرب تغيير نص البحث أو إضافة خط جديد.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            مسح عوامل التصفية
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLines.map((line) => {
            const isActive = line.active === 1;

            return (
              <div
                key={line.id}
                className={`bg-white border rounded-xl p-4 flex flex-col justify-between transition-shadow hover:shadow-md ${
                  isActive ? 'border-slate-200' : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-slate-400 font-semibold">
                      خط #{line.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleActive(line.id)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                      title={isActive ? 'اضغط للتعطيل' : 'اضغط للتفعيل'}
                    >
                      {isActive ? '● نشط يعمل' : '○ متوقف مؤقتاً'}
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {line.name}
                  </h3>

                  {/* Route points */}
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0">📍 الانطلاق:</span>
                      <span className="text-slate-700 leading-relaxed">{line.pickup_point}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold shrink-0">🎓 الوجهة:</span>
                      <span className="text-slate-700 font-medium leading-relaxed">{line.destination}</span>
                    </div>
                  </div>

                  {/* Timing & Prices (Clean Metadata, no pills) */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="text-slate-500">
                        التحرك: <strong className="text-slate-800">{line.departure_time}</strong>
                      </div>
                      <div className="text-slate-500">
                        العودة: <strong className="text-slate-800">{line.return_time}</strong>
                      </div>
                    </div>

                    <div className="text-left space-y-1">
                      <div className="text-slate-500">
                        ذهاب: <span className="font-bold text-slate-900">{line.one_way_price} ج</span>
                      </div>
                      <div className="text-slate-500">
                        ذهاب وعودة: <span className="font-bold text-emerald-700 text-sm">{line.round_trip_price} ج</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(line)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <span>✏️</span>
                    <span>تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingLine(line)}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <span>🗑️</span>
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add or Edit Line */}
      {(isAddOpen || editingLine) && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => {
            setIsAddOpen(false);
            setEditingLine(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 text-slate-900 relative my-8"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingLine ? `تعديل خط: ${editingLine.name}` : 'إضافة خط جامعة جديد'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingLine(null);
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الخط الرسمي:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خط العياط ⬅️ جامعة حلوان (عين حلوان)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نقاط الركوب والتجمع:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: موقف العياط - كوبري المدينة"
                    value={formData.pickup_point}
                    onChange={(e) => setFormData({ ...formData, pickup_point: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    وجهة الحرم الجامعي:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: حرم جامعة حلوان ومحطة المترو"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    موعد الانطلاق صباحاً:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 06:15 ص"
                    value={formData.departure_time}
                    onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    موعد العودة مساءً:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 03:30 م"
                    value={formData.return_time}
                    onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر الذهاب فقط (جنيه):
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.one_way_price}
                    onChange={(e) =>
                      setFormData({ ...formData, one_way_price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر الذهاب والعودة (جنيه):
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.round_trip_price}
                    onChange={(e) =>
                      setFormData({ ...formData, round_trip_price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة الخط:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="active_status"
                      checked={formData.active === 1}
                      onChange={() => setFormData({ ...formData, active: 1 })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>نشط يستقبل الحجوزات</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="active_status"
                      checked={formData.active === 0}
                      onChange={() => setFormData({ ...formData, active: 0 })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>متوقف مؤقتاً</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingLine(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors"
                >
                  {editingLine ? 'حفظ التعديلات' : 'إضافة الخط'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {deletingLine && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeletingLine(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-slate-900 relative"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="text-3xl mb-3 text-rose-600">⚠️</div>
            <h3 className="text-lg font-bold text-slate-900">
              تأكيد حذف الخط الجامعي
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              هل أنت متأكد من رغبتك في حذف <strong>{deletingLine.name}</strong>؟
              سيتم إزالة الخط من قائمة الحجوزات المتاحة للطلبة.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingLine(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
