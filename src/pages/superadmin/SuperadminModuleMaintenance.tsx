import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Power,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import {
  clearAllModuleMaintenance,
  fetchActiveModuleMaintenance,
  getCachedModuleMaintenanceMap,
  MODULE_MAINTENANCE_EVENT,
  setModuleMaintenanceStatus,
  SYSTEM_MAINTENANCE_MODULES,
  type ManagedSystemModule,
  type ModuleMaintenanceMap,
} from '../../lib/moduleMaintenance';

interface SuperadminModuleMaintenanceProps {
  onStatusChanged?: (pausedCount: number) => void;
}

const GROUPS = [
  { id: 'daily', label: 'งานประจำวันในห้องเรียน' },
  { id: 'academic', label: 'งานวิชาการ & วัดผล' },
  { id: 'care', label: 'ดูแลช่วยเหลือนักเรียน' },
  { id: 'system', label: 'จัดการระบบ & เครื่องมือ' },
] as const;

function formatThaiDateTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(d);
}

function toLocalDatetimeInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SuperadminModuleMaintenance({ onStatusChanged }: SuperadminModuleMaintenanceProps) {
  const [map, setMap] = useState<ModuleMaintenanceMap>(() => getCachedModuleMaintenanceMap());
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paused' | 'active'>('all');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Edit modal for custom message & schedule
  const [editingMod, setEditingMod] = useState<ManagedSystemModule | null>(null);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editMessage, setEditMessage] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const live = await fetchActiveModuleMaintenance();
    setMap(live);
    onStatusChanged?.(Object.keys(live).length);
    setIsLoading(false);
  }, [onStatusChanged]);

  useEffect(() => {
    void refresh();
    const handleSync = () => {
      const next = getCachedModuleMaintenanceMap();
      setMap(next);
      onStatusChanged?.(Object.keys(next).length);
    };
    window.addEventListener(MODULE_MAINTENANCE_EVENT, handleSync);
    return () => window.removeEventListener(MODULE_MAINTENANCE_EVENT, handleSync);
  }, [onStatusChanged, refresh]);

  const pausedCount = Object.keys(map).length;

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SYSTEM_MAINTENANCE_MODULES.filter((mod) => {
      const isPaused = Boolean(map[mod.key]?.isUnderMaintenance);
      if (filter === 'paused' && !isPaused) return false;
      if (filter === 'active' && isPaused) return false;
      if (!q) return true;
      return `${mod.label} ${mod.description} ${mod.key} ${mod.groupLabel}`.toLowerCase().includes(q);
    });
  }, [filter, map, search]);

  async function handleQuickToggle(mod: ManagedSystemModule) {
    const currentlyPaused = Boolean(map[mod.key]?.isUnderMaintenance);
    const nextState = !currentlyPaused;
    setBusyKey(mod.key);
    setNotice(null);
    const { error } = await setModuleMaintenanceStatus({
      moduleKey: mod.key,
      isUnderMaintenance: nextState,
      message: nextState
        ? map[mod.key]?.message || `กำลังปรับปรุงโมดูล "${mod.label}" ชั่วคราว โมดูลอื่นยังใช้งานได้ตามปกติ`
        : '',
      endsAt: nextState ? map[mod.key]?.endsAt || null : null,
    });
    setBusyKey(null);
    if (error) {
      setNotice({ tone: 'error', text: `อัปเดตสถานะไม่สำเร็จ: ${error}` });
      return;
    }
    const updated = getCachedModuleMaintenanceMap();
    setMap(updated);
    onStatusChanged?.(Object.keys(updated).length);
    setNotice({
      tone: 'success',
      text: nextState
        ? `ปิดปรับปรุงโมดูล "${mod.label}" แล้ว — ผู้ใช้ทั่วไปจะเข้าหน้านี้ไม่ได้ชั่วคราว (SuperAdmin เข้าทดสอบได้ปกติ)`
        : `เปิดใช้งานโมดูล "${mod.label}" กลับมาปกติแล้ว`,
    });
  }

  function openEditModal(mod: ManagedSystemModule) {
    const existing = map[mod.key];
    setEditingMod(mod);
    setEditEnabled(existing ? existing.isUnderMaintenance : true);
    setEditMessage(existing?.message || `ทีมงานกำลังปรับปรุงโมดูล "${mod.label}" ชั่วคราวเพื่อเพิ่มความเสถียร โมดูลอื่นยังใช้งานได้ตามปกติ`);
    setEditEndsAt(toLocalDatetimeInput(existing?.endsAt || null));
  }

  async function handleSaveEdit() {
    if (!editingMod) return;
    setBusyKey(editingMod.key);
    setNotice(null);
    const { error } = await setModuleMaintenanceStatus({
      moduleKey: editingMod.key,
      isUnderMaintenance: editEnabled,
      message: editMessage.trim(),
      endsAt: editEnabled && editEndsAt ? new Date(editEndsAt).toISOString() : null,
    });
    setBusyKey(null);
    if (error) {
      setNotice({ tone: 'error', text: `บันทึกไม่สำเร็จ: ${error}` });
      return;
    }
    const updated = getCachedModuleMaintenanceMap();
    setMap(updated);
    onStatusChanged?.(Object.keys(updated).length);
    setNotice({
      tone: 'success',
      text: editEnabled
        ? `บันทึกการปิดปรับปรุงโมดูล "${editingMod.label}" เรียบร้อยแล้ว`
        : `เปิดใช้งานโมดูล "${editingMod.label}" ตามปกติแล้ว`,
    });
    setEditingMod(null);
  }

  async function handleClearAll() {
    if (!window.confirm(`ยืนยันเปิดใช้งานทุกโมดูล (${pausedCount} โมดูล) กลับมาใช้งานปกติทันทีหรือไม่?`)) return;
    setBusyKey('__all__');
    setNotice(null);
    const { error } = await clearAllModuleMaintenance();
    setBusyKey(null);
    if (error) {
      setNotice({ tone: 'error', text: `เปิดใช้งานทั้งหมดไม่สำเร็จ: ${error}` });
      return;
    }
    setMap({});
    onStatusChanged?.(0);
    setNotice({ tone: 'success', text: 'เปิดใช้งานทุกโมดูลในระบบกลับมาปกติเรียบร้อยแล้ว' });
  }

  return (
    <div className="space-y-4">
      <div className="nexus-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <Wrench size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-950">ปิดปรับปรุงรายโมดูล (Module Maintenance)</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">
                ปิดปรับปรุงเฉพาะโมดูลที่กำลังแก้ไขโดยไม่กระทบส่วนอื่น — ครูจะยังใช้งานโมดูลอื่นได้ปกติ ส่วน SuperAdmin เข้าทดสอบโมดูลที่ปิดได้ตลอดเวลา
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> รีเฟรช
            </button>
            {pausedCount > 0 ? (
              <button
                type="button"
                disabled={busyKey === '__all__'}
                onClick={() => void handleClearAll()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
              >
                <Power size={14} /> เปิดใช้งานทุกโมดูล ({pausedCount})
              </button>
            ) : null}
          </div>
        </div>

        {/* Filter & Search */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative block flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาโมดูล เช่น เงินออม, เช็กชื่อ, คะแนน, OMR..."
              className="nexus-field h-10 w-full pl-9 pr-3 text-xs font-bold"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: `ทั้งหมด (${SYSTEM_MAINTENANCE_MODULES.length})` },
              { id: 'paused', label: `กำลังปิดปรับปรุง (${pausedCount})` },
              { id: 'active', label: `เปิดใช้งานปกติ (${SYSTEM_MAINTENANCE_MODULES.length - pausedCount})` },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id as 'all' | 'paused' | 'active')}
                className={`h-9 rounded-xl px-3 text-xs font-black transition ${
                  filter === item.id
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-4 flex items-center gap-2 rounded-2xl border p-3 text-xs font-black ${
              notice.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {notice.tone === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>{notice.text}</span>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-2.5 text-xs font-bold text-cyan-900">
          <ShieldCheck size={15} className="shrink-0 text-cyan-700" />
          <span>หน้าแรก (ภาพรวม) และศูนย์ควบคุม SuperAdmin จะไม่ถูกปิดปรับปรุง เพื่อป้องกันการล็อกระบบตัวเอง</span>
        </div>
      </div>

      {/* Grouped Module Grid */}
      {GROUPS.map((group) => {
        const items = filteredModules.filter((m) => m.group === group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id} className="nexus-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">{group.label}</h3>
              <span className="text-[11px] font-bold text-slate-400">{items.length} โมดูล</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((mod) => {
                const entry = map[mod.key];
                const isPaused = Boolean(entry?.isUnderMaintenance);
                const isBusy = busyKey === mod.key;
                const reopenText = formatThaiDateTime(entry?.endsAt || null);
                return (
                  <article
                    key={mod.key}
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                      isPaused
                        ? 'border-amber-300 bg-amber-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-black text-slate-950">{mod.label}</p>
                            {isPaused ? (
                              <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-950">
                                ปิดปรับปรุง
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                ปกติ
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{mod.description}</p>
                        </div>

                        {/* 1-Click Toggle */}
                        <label
                          className="relative inline-flex shrink-0 cursor-pointer items-center"
                          title={isPaused ? 'คลิกเพื่อเปิดใช้งานปกติ' : 'คลิกเพื่อปิดปรับปรุงโมดูลนี้'}
                        >
                          <input
                            type="checkbox"
                            disabled={isBusy}
                            checked={isPaused}
                            onChange={() => void handleQuickToggle(mod)}
                            className="sr-only peer"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-disabled:opacity-50" />
                        </label>
                      </div>

                      {isPaused ? (
                        <div className="mt-2.5 rounded-xl bg-white/80 p-2.5 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-200/80">
                          <p className="line-clamp-2">{entry.message || 'กำลังปรับปรุงโมดูลชั่วคราว'}</p>
                          {reopenText ? (
                            <p className="mt-1 flex items-center gap-1 font-black text-amber-800">
                              <Clock size={11} /> เปิดอัตโนมัติ: {reopenText}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(mod)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                      >
                        <Settings2 size={12} /> ตั้งข้อความ / เวลาเปิด
                      </button>
                      <Link
                        to={mod.path}
                        className="inline-flex items-center gap-1 text-[11px] font-black text-cyan-700 hover:underline"
                      >
                        เข้าทดสอบ <ExternalLink size={11} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Edit Custom Message & Schedule Modal */}
      {editingMod ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">ตั้งค่าปิดปรับปรุงโมดูล</p>
                <h3 className="mt-0.5 text-lg font-black text-slate-950">{editingMod.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMod(null)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                <div>
                  <p className="text-xs font-black text-amber-950">สถานะปิดปรับปรุงโมดูลนี้</p>
                  <p className="text-[11px] font-semibold text-amber-800">ผู้ใช้ทั่วไปจะเห็นหน้าแจ้งปรับปรุงชั่วคราว</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all" />
                </label>
              </div>

              <label className="block text-xs font-black text-slate-700">
                ข้อความแจ้งครูและผู้ใช้
                <textarea
                  rows={3}
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="เช่น กำลังปรับปรุงระบบคำนวณเงินออมและรายงาน A4 คาดว่าจะแล้วเสร็จเวลา 16:00 น."
                  className="nexus-field mt-1 w-full p-3 text-xs font-bold"
                />
              </label>

              <label className="block text-xs font-black text-slate-700">
                เวลาเปิดใช้งานอัตโนมัติ (ไม่บังคับ — เมื่อถึงเวลาโมดูลจะเปิดเองทันที)
                <input
                  type="datetime-local"
                  value={editEndsAt}
                  onChange={(e) => setEditEndsAt(e.target.value)}
                  className="nexus-field mt-1 h-10 w-full px-3 text-xs font-bold"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMod(null)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={busyKey === editingMod.key}
                  onClick={() => void handleSaveEdit()}
                  className="blue-action inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-xs font-black disabled:opacity-50"
                >
                  <Wrench size={14} /> {busyKey === editingMod.key ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
