import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarClock, CircleDollarSign, Copy, KeyRound, Plus, ShieldCheck } from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';

interface VipCodeRow {
  code_prefix: string;
  created_at: string;
  duration_days: number;
  expires_at: string | null;
  id: string;
  is_active: boolean;
  label: string;
  max_redemptions: number;
  redemption_count: number;
}

const demoCodes: VipCodeRow[] = [{
  code_prefix: 'CC360-DEMO',
  created_at: new Date().toISOString(),
  duration_days: 30,
  expires_at: null,
  id: 'demo-vip-code',
  is_active: true,
  label: 'โค้ดทดลองสำหรับกิจกรรม',
  max_redemptions: 10,
  redemption_count: 2,
}];

function formatDate(value: string | null) {
  if (!value) return 'ไม่กำหนด';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}

export function VipAccessManager() {
  const isDemo = !isSupabaseReady || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo'));
  const [trialDays, setTrialDays] = useState(30);
  const [vipPrice, setVipPrice] = useState(100);
  const [vipDurationDays, setVipDurationDays] = useState(365);
  const [codes, setCodes] = useState<VipCodeRow[]>(isDemo ? demoCodes : []);
  const [form, setForm] = useState({ durationDays: 30, expiresAt: '', label: '', maxRedemptions: 1 });
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!supabase || isDemo) return;
    const [
      { data: trialPlan, error: trialError },
      { data: vipPlan, error: vipPlanError },
      { data: codeRows, error: codeError },
    ] = await Promise.all([
      supabase.from('plans').select('duration_days').eq('code', 'TRIAL_30').single(),
      supabase.from('plans').select('price_thb,duration_days').eq('code', 'VIP_YEARLY').single(),
      supabase
        .from('vip_redemption_codes')
        .select('id,code_prefix,label,duration_days,max_redemptions,redemption_count,expires_at,is_active,created_at')
        .order('created_at', { ascending: false })
        .limit(12),
    ]);
    if (trialError || vipPlanError || codeError) {
      setNotice(trialError?.message || vipPlanError?.message || codeError?.message || 'โหลดการตั้งค่า VIP ไม่สำเร็จ');
      return;
    }
    setTrialDays(Number(trialPlan?.duration_days || 30));
    setVipPrice(Number(vipPlan?.price_thb ?? 100));
    setVipDurationDays(Number(vipPlan?.duration_days || 365));
    setCodes((codeRows || []) as VipCodeRow[]);
  }, [isDemo]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveTrialDays(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    if (!supabase || isDemo) {
      setNotice(`โหมดตัวอย่าง: ตั้งระยะทดลองเป็น ${trialDays} วันแล้ว`);
      setIsSaving(false);
      return;
    }
    const { error } = await supabase.rpc('set_trial_duration_days', { target_days: trialDays });
    setNotice(error ? error.message : `ตั้งระยะทดลองสำหรับ Workspace ใหม่เป็น ${trialDays} วันแล้ว`);
    setIsSaving(false);
  }

  async function createCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    setLatestCode(null);
    if (!form.label.trim()) {
      setNotice('กรุณาระบุชื่อหรือวัตถุประสงค์ของโค้ด');
      setIsSaving(false);
      return;
    }
    if (!supabase || isDemo) {
      setLatestCode('CC360-DEMO123456');
      setNotice('สร้างโค้ดตัวอย่างแล้ว โค้ดจริงจะแสดงเพียงครั้งเดียวหลังสร้าง');
      setIsSaving(false);
      return;
    }
    const expiresAt = form.expiresAt ? new Date(`${form.expiresAt}T23:59:59+07:00`).toISOString() : null;
    const { data, error } = await supabase.rpc('create_vip_redemption_code', {
      code_duration_days: form.durationDays,
      code_expires_at: expiresAt,
      code_label: form.label.trim(),
      code_max_redemptions: form.maxRedemptions,
    });
    if (error) {
      setNotice(error.message);
    } else {
      const result = data as { code?: string } | null;
      setLatestCode(result?.code || null);
      setNotice('สร้างโค้ดสำเร็จ กรุณาคัดลอกตอนนี้ ระบบไม่เก็บโค้ดฉบับเต็ม');
      setForm((current) => ({ ...current, label: '' }));
      await loadSettings();
    }
    setIsSaving(false);
  }

  async function saveVipPricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    if (!Number.isInteger(vipPrice) || vipPrice < 0 || !Number.isInteger(vipDurationDays) || vipDurationDays < 1) {
      setNotice('กรุณากำหนดราคาและจำนวนวันให้ถูกต้อง');
      setIsSaving(false);
      return;
    }
    if (!supabase || isDemo) {
      setNotice(`โหมดตัวอย่าง: ตั้ง VIP ${vipPrice.toLocaleString('th-TH')} บาท / ${vipDurationDays} วันแล้ว`);
      setIsSaving(false);
      return;
    }
    const { error } = await supabase.rpc('set_vip_plan_pricing', {
      target_duration_days: vipDurationDays,
      target_price_thb: vipPrice,
    });
    setNotice(error ? error.message : `บันทึกราคา VIP ${vipPrice.toLocaleString('th-TH')} บาท / ${vipDurationDays} วันแล้ว`);
    setIsSaving(false);
  }

  async function copyLatestCode() {
    if (!latestCode) return;
    await navigator.clipboard.writeText(latestCode);
    setNotice('คัดลอกโค้ดแล้ว');
  }

  return (
    <div className="nexus-card p-4 sm:p-5">
      <div className="nexus-kicker"><ShieldCheck size={16} aria-hidden="true" /> Trial & VIP Codes</div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <form className="nexus-muted-box p-4" onSubmit={saveTrialDays}>
          <div className="flex items-center gap-2"><CalendarClock className="text-cyan-700" size={19} /><h3 className="font-black text-slate-950">ระยะทดลองของ Workspace ใหม่</h3></div>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">มีผลกับ Workspace ที่สร้างหลังบันทึกเท่านั้น ไม่ย้อนแก้สิทธิ์เดิม</p>
          <label className="mt-3 grid gap-2 text-sm font-black text-slate-700">
            จำนวนวันทดลอง
            <input className="nexus-field h-11 px-3" max="365" min="1" onChange={(event) => setTrialDays(Number(event.target.value))} type="number" value={trialDays} />
          </label>
          <button className="blue-action mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black" disabled={isSaving} type="submit">บันทึกวันทดลอง</button>
        </form>

        <form className="nexus-muted-box p-4" onSubmit={saveVipPricing}>
          <div className="flex items-center gap-2"><CircleDollarSign className="text-emerald-600" size={19} /><h3 className="font-black text-slate-950">ราคาและอายุแพ็กเกจ VIP</h3></div>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">มีผลกับคำขอชำระเงินใหม่ หน้าแพ็กเกจจะอ่านค่าล่าสุดจากฐานข้อมูล</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-xs font-black text-slate-700">ราคา (บาท)<input className="nexus-field h-11 px-3" max="1000000" min="0" onChange={(event) => setVipPrice(Number(event.target.value))} type="number" value={vipPrice} /></label>
            <label className="grid gap-2 text-xs font-black text-slate-700">จำนวนวัน<input className="nexus-field h-11 px-3" max="3650" min="1" onChange={(event) => setVipDurationDays(Number(event.target.value))} type="number" value={vipDurationDays} /></label>
          </div>
          <button className="blue-action mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black" disabled={isSaving} type="submit">บันทึกราคา VIP</button>
        </form>

        <form className="nexus-muted-box p-4" onSubmit={createCode}>
          <div className="flex items-center gap-2"><KeyRound className="text-amber-600" size={19} /><h3 className="font-black text-slate-950">ออกโค้ดเพิ่มวัน VIP</h3></div>
          <label className="mt-3 grid gap-2 text-sm font-black text-slate-700">ชื่อ/วัตถุประสงค์<input className="nexus-field h-11 px-3" onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="เช่น โปรโมชั่นเปิดเทอม" value={form.label} /></label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-xs font-black text-slate-700">จำนวนวัน<input className="nexus-field h-11 px-3" max="3650" min="1" onChange={(event) => setForm((current) => ({ ...current, durationDays: Number(event.target.value) }))} type="number" value={form.durationDays} /></label>
            <label className="grid gap-2 text-xs font-black text-slate-700">ใช้ได้กี่ Workspace<input className="nexus-field h-11 px-3" max="100000" min="1" onChange={(event) => setForm((current) => ({ ...current, maxRedemptions: Number(event.target.value) }))} type="number" value={form.maxRedemptions} /></label>
          </div>
          <label className="mt-3 grid gap-2 text-xs font-black text-slate-700">วันหมดอายุโค้ด (เว้นว่างได้)<input className="nexus-field h-11 px-3" onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} type="date" value={form.expiresAt} /></label>
          <button className="blue-action mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" disabled={isSaving} type="submit"><Plus size={16} />สร้างโค้ด</button>
        </form>
      </div>

      {latestCode ? (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black text-amber-700">โค้ดฉบับเต็ม — แสดงครั้งนี้ครั้งเดียว</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 font-black text-cyan-100">{latestCode}</code><button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-amber-200" onClick={() => void copyLatestCode()} type="button"><Copy size={16} />คัดลอก</button></div>
        </div>
      ) : null}

      {notice ? <div className="mt-4 rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-900 ring-1 ring-cyan-100">{notice}</div> : null}

      <div className="mt-4 grid gap-3">
        {codes.map((code) => (
          <div className="nexus-muted-box p-3" key={code.id}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black text-slate-950">{code.label}</p><p className="mt-1 text-xs font-bold text-slate-500">{code.code_prefix}… · {code.duration_days} วัน · หมดอายุ {formatDate(code.expires_at)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${code.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{code.redemption_count}/{code.max_redemptions}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
