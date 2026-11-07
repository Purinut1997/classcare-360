import { useEffect, useMemo, useState } from 'react';
import { BarChart3, LockKeyhole, ShieldCheck } from 'lucide-react';

import type { AppNavItem } from '../../routes/appRoutes';
import { canManageWorkspace } from '../../lib/roles';
import { menuUsageConsentKey } from '../../lib/menuUsage';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface MenuUsageRow {
  menu_key: string;
  view_count: number;
}

export function MenuUsageInsights({ navItems, session }: { navItems: AppNavItem[]; session: AppSessionContext }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [rows, setRows] = useState<MenuUsageRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canViewWorkspaceTotals = canManageWorkspace(session.profile.role);

  useEffect(() => {
    try {
      setIsEnabled(window.localStorage.getItem(menuUsageConsentKey(session)) === 'true');
    } catch {
      setIsEnabled(false);
    }
  }, [session]);

  useEffect(() => {
    if (!canViewWorkspaceTotals || !supabase || !session.workspace) return;
    let active = true;
    setIsLoading(true);
    const cutoff = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

    void supabase
      .from('workspace_menu_usage_daily')
      .select('menu_key,view_count')
      .eq('workspace_id', session.workspace.id)
      .gte('usage_date', cutoff)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotice(error.message.includes('workspace_menu_usage_daily')
            ? 'เปิดใช้สถิติได้หลังติดตั้ง migration 0078'
            : 'ยังโหลดสถิติไม่ได้ ตรวจสิทธิ์และการเชื่อมต่อฐานข้อมูล');
          setRows([]);
        } else {
          setNotice(null);
          setRows((data || []) as MenuUsageRow[]);
        }
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canViewWorkspaceTotals, session.workspace]);

  const topMenus = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach((row) => totals.set(row.menu_key, (totals.get(row.menu_key) || 0) + Number(row.view_count || 0)));
    return [...totals.entries()]
      .map(([key, count]) => ({ key, count, label: navItems.find((item) => item.key === key)?.label || key }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [navItems, rows]);

  function updateConsent(nextEnabled: boolean) {
    try {
      if (nextEnabled) window.localStorage.setItem(menuUsageConsentKey(session), 'true');
      else window.localStorage.removeItem(menuUsageConsentKey(session));
      setIsEnabled(nextEnabled);
      setNotice(nextEnabled ? 'เปิดการเก็บสถิติบนอุปกรณ์นี้แล้ว' : 'ปิดการเก็บสถิติบนอุปกรณ์นี้แล้ว');
    } catch {
      setNotice('เปลี่ยนการตั้งค่าไม่ได้ โปรดตรวจสิทธิ์การจัดเก็บข้อมูลของเบราว์เซอร์');
    }
  }

  return (
    <section aria-label="สถิติการใช้เมนู" className="mt-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
            {canViewWorkspaceTotals ? <BarChart3 size={19} aria-hidden="true" /> : <LockKeyhole size={19} aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-950">ช่วยปรับเมนูให้ตรงกับงานจริง</h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-600">
              {canViewWorkspaceTotals
                ? 'ดูเมนูที่ทีมเปิดใช้บ่อยในช่วง 30 วัน ข้อมูลเป็นยอดรวมระดับโรงเรียน ไม่มีชื่อครูหรือนักเรียน'
                : 'หากยินยอม ระบบจะนับเฉพาะรหัสเมนูที่เปิดบนอุปกรณ์นี้ ไม่เก็บชื่อครู นักเรียน หรือเนื้อหาที่กรอก'}
            </p>
          </div>
        </div>
        <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
          <input
            checked={isEnabled}
            className="h-4 w-4 accent-teal-600"
            onChange={(event) => updateConsent(event.target.checked)}
            type="checkbox"
          />
          อนุญาตให้นับเมนูบนอุปกรณ์นี้
        </label>
      </div>

      {canViewWorkspaceTotals ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3">
          {isLoading ? (
            <p className="text-xs font-bold text-slate-500">กำลังโหลดสถิติ…</p>
          ) : topMenus.length ? (
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {topMenus.map((item, index) => (
                <li className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs" key={item.key}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-50 font-black text-violet-700">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-700">{item.label}</span>
                  <span className="shrink-0 font-black text-slate-950">{item.count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs font-bold text-slate-500">
              {notice || (isSupabaseReady ? 'ยังไม่มีสถิติจากผู้ใช้ที่ยินยอม' : 'สถิตินี้ต้องเชื่อมต่อฐานข้อมูลจริง')}
            </p>
          )}
          {notice && topMenus.length > 0 ? <p className="mt-2 text-xs font-bold text-amber-700">{notice}</p> : null}
        </div>
      ) : null}

      {notice && !canViewWorkspaceTotals ? <p aria-live="polite" className="mt-2 text-xs font-bold text-teal-800">{notice}</p> : null}
      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <ShieldCheck size={13} aria-hidden="true" /> ปิดได้ทุกเมื่อ · ยอดรวมลบอัตโนมัติเมื่อเกิน 90 วัน
      </p>
    </section>
  );
}
