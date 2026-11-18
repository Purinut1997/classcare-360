import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Crown,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  ALL_CONFIGURABLE_VIEW_KEYS,
  DEFAULT_PLAN_ACCESS_POLICIES,
  FREE_DEFAULT_VIEWS,
  PLAN_ACCESS_MANAGED_VIEWS,
  loadPlanAccessPolicies,
  savePlanAccessPolicy,
  type ConfigurableTierKey,
  type PlanAccessPolicyMap,
} from '../../lib/planAccessPolicy';

const TIER_COLUMNS: Array<{
  badgeClass: string;
  key: ConfigurableTierKey;
  label: string;
  sublabel: string;
}> = [
  {
    key: 'free',
    label: 'ไม่ใช่ VIP (Free)',
    sublabel: 'บัญชีฟรี / VIP หมดอายุ',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  {
    key: 'trial',
    label: 'ทดลองใช้ (Trial)',
    sublabel: 'ช่วงทดลองใช้งาน',
    badgeClass: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  {
    key: 'temp_vip',
    label: 'VIP ชั่วคราว',
    sublabel: 'VIP รายปี / โค้ดมีวันหมดอายุ',
    badgeClass: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
];

const GROUP_ORDER: Array<{ key: 'daily' | 'academic' | 'care' | 'system'; label: string }> = [
  { key: 'daily', label: 'งานประจำวันในห้องเรียน' },
  { key: 'academic', label: 'งานวิชาการ & วัดผล' },
  { key: 'care', label: 'ดูแลช่วยเหลือนักเรียน' },
  { key: 'system', label: 'เครื่องมือช่วยสอน & จัดการระบบ' },
];

function clonePolicies(source: PlanAccessPolicyMap): PlanAccessPolicyMap {
  return {
    free: { ...source.free, allowedViews: [...source.free.allowedViews] },
    trial: { ...source.trial, allowedViews: [...source.trial.allowedViews] },
    temp_vip: { ...source.temp_vip, allowedViews: [...source.temp_vip.allowedViews] },
  };
}

function areSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}

export function SuperadminPlanAccessMatrix() {
  const [savedPolicies, setSavedPolicies] = useState<PlanAccessPolicyMap>(() =>
    clonePolicies(DEFAULT_PLAN_ACCESS_POLICIES),
  );
  const [draft, setDraft] = useState<PlanAccessPolicyMap>(() =>
    clonePolicies(DEFAULT_PLAN_ACCESS_POLICIES),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function refreshPolicies() {
    setIsLoading(true);
    setNotice(null);
    const live = await loadPlanAccessPolicies(true);
    setSavedPolicies(clonePolicies(live));
    setDraft(clonePolicies(live));
    setIsLoading(false);
  }

  useEffect(() => {
    void refreshPolicies();
  }, []);

  const dirtyTiers = useMemo(() => {
    const keys: ConfigurableTierKey[] = ['free', 'trial', 'temp_vip'];
    return keys.filter((tier) => {
      const a = savedPolicies[tier];
      const b = draft[tier];
      return a.allowAiGemini !== b.allowAiGemini || !areSetsEqual(a.allowedViews, b.allowedViews);
    });
  }, [draft, savedPolicies]);

  function toggleView(tier: ConfigurableTierKey, viewKey: string) {
    setDraft((prev) => {
      const current = prev[tier].allowedViews;
      const exists = current.includes(viewKey);
      const nextViews = exists ? current.filter((k) => k !== viewKey) : [...current, viewKey];
      return {
        ...prev,
        [tier]: { ...prev[tier], allowedViews: nextViews },
      };
    });
  }

  function toggleAiGemini(tier: ConfigurableTierKey) {
    setDraft((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], allowAiGemini: !prev[tier].allowAiGemini },
    }));
  }

  function applyColumnPreset(tier: ConfigurableTierKey, mode: 'all' | 'basic' | 'default') {
    setDraft((prev) => {
      if (mode === 'all') {
        return {
          ...prev,
          [tier]: { ...prev[tier], allowedViews: [...ALL_CONFIGURABLE_VIEW_KEYS], allowAiGemini: true },
        };
      }
      if (mode === 'basic') {
        return {
          ...prev,
          [tier]: { ...prev[tier], allowedViews: [...FREE_DEFAULT_VIEWS], allowAiGemini: false },
        };
      }
      const def = DEFAULT_PLAN_ACCESS_POLICIES[tier];
      return {
        ...prev,
        [tier]: { ...prev[tier], allowedViews: [...def.allowedViews], allowAiGemini: def.allowAiGemini },
      };
    });
  }

  async function handleSaveAll() {
    if (dirtyTiers.length === 0) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const updatedMap = clonePolicies(savedPolicies);
      for (const tier of dirtyTiers) {
        const res = await savePlanAccessPolicy(tier, draft[tier].allowedViews, draft[tier].allowAiGemini);
        updatedMap[tier] = res;
      }
      setSavedPolicies(clonePolicies(updatedMap));
      setDraft(clonePolicies(updatedMap));
      setNotice({
        tone: 'success',
        text: `บันทึกสิทธิ์การเข้าถึงสำเร็จ (${dirtyTiers.length} ระดับแพ็กเกจ) — มีผลกับผู้ใช้งานทันทีแบบเรียลไทม์`,
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'บันทึกสิทธิ์การเข้าถึงไม่สำเร็จ',
      });
    } finally {
      setIsSaving(false);
    }
  }

  const totalFeatures = PLAN_ACCESS_MANAGED_VIEWS.length + 1; // +1 for AI Gemini

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <section className="nexus-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <Crown size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  กำหนดสิทธิ์การเข้าถึงตามแพ็กเกจ (Free / Trial / VIP ชั่วคราว)
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  เลือกเปิด-ปิดเมนูและฟีเจอร์ AI แยกตามระดับแพ็กเกจได้อิสระ มีผลทันทีทั้งแถบเมนูและระบบป้องกันสิทธิ์
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoading || isSaving}
              onClick={() => void refreshPolicies()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              รีเฟรช
            </button>
            {dirtyTiers.length > 0 ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setDraft(clonePolicies(savedPolicies))}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={14} />
                ยกเลิกการแก้
              </button>
            ) : null}
            <button
              type="button"
              disabled={dirtyTiers.length === 0 || isSaving}
              onClick={() => void handleSaveAll()}
              className="blue-action inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-black shadow-xs disabled:opacity-45"
            >
              <Save size={14} />
              {isSaving
                ? 'กำลังบันทึก...'
                : dirtyTiers.length > 0
                  ? `บันทึกการเปลี่ยนแปลง (${dirtyTiers.length} ระดับ)`
                  : 'บันทึกแล้ว'}
            </button>
          </div>
        </div>

        {/* Tier Summary Strip */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TIER_COLUMNS.map((col) => {
            const count = draft[col.key].allowedViews.length + (draft[col.key].allowAiGemini ? 1 : 0);
            const isDirty = dirtyTiers.includes(col.key);
            return (
              <div
                key={col.key}
                className={`rounded-2xl border p-3.5 ${
                  isDirty ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/80 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${col.badgeClass}`}>
                    {col.label}
                  </span>
                  <span className="text-sm font-black tabular-nums text-slate-900">
                    {count}/{totalFeatures}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{col.sublabel}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => applyColumnPreset(col.key, 'all')}
                    className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-slate-200 hover:bg-emerald-50"
                  >
                    เปิดทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => applyColumnPreset(col.key, 'basic')}
                    className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                  >
                    พื้นฐาน
                  </button>
                  <button
                    type="button"
                    onClick={() => applyColumnPreset(col.key, 'default')}
                    className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-cyan-700 ring-1 ring-slate-200 hover:bg-cyan-50"
                  >
                    ค่าเริ่มต้น
                  </button>
                </div>
              </div>
            );
          })}

          {/* Lifetime VIP Info Box */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                <ShieldCheck size={12} /> VIP ถาวร (ตลอดชีพ)
              </span>
              <span className="text-sm font-black text-emerald-800">
                {totalFeatures}/{totalFeatures}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-5 text-emerald-900/80">
              VIP ถาวร และ SuperAdmin เข้าถึงได้ครบทุกโมดูลและ AI เสมอ (หน้าแรก, ตั้งค่าบัญชี, คู่มือ และหน้าแพ็กเกจเปิดให้ทุกบัญชีเสมอ)
            </p>
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-4 flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black ${
              notice.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {notice.tone === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>{notice.text}</span>
          </div>
        ) : null}
      </section>

      {/* Access Matrix Table */}
      <section className="nexus-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="px-5 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500">
                  โมดูล / ฟีเจอร์ในระบบ
                </th>
                {TIER_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="w-40 px-4 py-3.5 text-center text-xs font-black text-slate-800"
                  >
                    <div>{col.label}</div>
                    <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{col.sublabel}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white text-xs">
              {/* Highlighted AI Row */}
              <tr className="bg-amber-50/35">
                <td className="px-5 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                      <Bot size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-black text-slate-950 flex items-center gap-1.5">
                        ผู้ช่วยอัจฉริยะ ClassCare AI (Google Gemini &amp; OCR)
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                          <Sparkles size={10} /> AI
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                        อนุญาตให้ใส่ Gemini API Key, วิเคราะห์ข้อมูลห้องเรียน, ร่างข้อสอบ และสแกน OCR
                      </p>
                    </div>
                  </div>
                </td>
                {TIER_COLUMNS.map((col) => {
                  const enabled = draft[col.key].allowAiGemini;
                  return (
                    <td key={col.key} className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => toggleAiGemini(col.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? 'bg-[#2F7D5B]' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>

              {/* Grouped System Modules */}
              {GROUP_ORDER.map((group) => {
                const items = PLAN_ACCESS_MANAGED_VIEWS.filter((m) => m.group === group.key);
                if (items.length === 0) return null;
                return (
                  <GroupRows
                    key={group.key}
                    draft={draft}
                    groupLabel={group.label}
                    items={items}
                    onToggle={toggleView}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GroupRows({
  draft,
  groupLabel,
  items,
  onToggle,
}: {
  draft: PlanAccessPolicyMap;
  groupLabel: string;
  items: typeof PLAN_ACCESS_MANAGED_VIEWS;
  onToggle: (tier: ConfigurableTierKey, viewKey: string) => void;
}) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <td colSpan={4} className="px-5 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
          {groupLabel} ({items.length} โมดูล)
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.key} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-5 py-3">
            <p className="font-black text-slate-900">{item.label}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{item.description}</p>
          </td>
          {TIER_COLUMNS.map((col) => {
            const enabled = draft[col.key].allowedViews.includes(item.key);
            return (
              <td key={col.key} className="px-4 py-3 text-center">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${item.label} สำหรับ ${col.label}`}
                  onClick={() => onToggle(col.key, item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? 'bg-[#2F7D5B]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
