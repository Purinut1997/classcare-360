import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Download,
  Gift,
  History,
  KeyRound,
  Plus,
  Power,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';

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

interface WorkspaceOption {
  id: string;
  name: string;
  school_name?: string | null;
}

interface RedemptionDetail {
  created_at: string;
  duration_days: number;
  id: string;
  new_ends_at: string;
  redeemed_by_name: string;
  workspace_name: string;
}

const demoCodes: VipCodeRow[] = [
  {
    code_prefix: 'CC360-DEMO1',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    duration_days: 30,
    expires_at: null,
    id: 'demo-vip-code-1',
    is_active: true,
    label: 'โค้ดทดลองสำหรับกิจกรรมสัมมนา',
    max_redemptions: 10,
    redemption_count: 2,
  },
  {
    code_prefix: 'CC360-DEMO2',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    duration_days: 365,
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    id: 'demo-vip-code-2',
    is_active: false,
    label: 'แพ็กเกจโรงเรียนนำร่องประจำปี (ปิดชั่วคราว)',
    max_redemptions: 5,
    redemption_count: 5,
  },
];

const demoWorkspaces: WorkspaceOption[] = [
  { id: 'demo-ws-1', name: 'โรงเรียนอนุบาลรักเรียน', school_name: 'อนุบาลรักเรียน' },
  { id: 'demo-ws-2', name: 'โรงเรียนสาธิตพัฒนาปัญญา', school_name: 'สาธิตพัฒนาปัญญา' },
  { id: 'demo-ws-3', name: 'โรงเรียนมัธยมศึกษาดารานุสรณ์', school_name: 'มัธยมศึกษาดารานุสรณ์' },
];

const demoRedemptionsMap: Record<string, RedemptionDetail[]> = {
  'demo-vip-code-1': [
    {
      created_at: new Date(Date.now() - 86400000).toISOString(),
      duration_days: 30,
      id: 'demo-red-1',
      new_ends_at: new Date(Date.now() + 86400000 * 29).toISOString(),
      redeemed_by_name: 'ครูสมศรี ใจดี (somsri@school.ac.th)',
      workspace_name: 'โรงเรียนอนุบาลรักเรียน',
    },
    {
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      duration_days: 30,
      id: 'demo-red-2',
      new_ends_at: new Date(Date.now() + 86400000 * 28).toISOString(),
      redeemed_by_name: 'ครูมานะ ขยัน (mana@demo.ac.th)',
      workspace_name: 'โรงเรียนสาธิตพัฒนาปัญญา',
    },
  ],
};

function formatDate(value: string | null) {
  if (!value) return 'ไม่กำหนด';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return 'ไม่กำหนด';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function VipAccessManager() {
  const isDemo = !isSupabaseReady || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo'));
  const [trialDays, setTrialDays] = useState(30);
  const [vipPrice, setVipPrice] = useState(100);
  const [vipDurationDays, setVipDurationDays] = useState(365);
  const [codes, setCodes] = useState<VipCodeRow[]>(isDemo ? demoCodes : []);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>(isDemo ? demoWorkspaces : []);
  const [form, setForm] = useState({ durationDays: 30, expiresAt: '', label: '', maxRedemptions: 1 });
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Direct VIP Grant State
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [grantDays, setGrantDays] = useState<number>(365);
  const [grantReason, setGrantReason] = useState<string>('');
  const [workspaceSearch, setWorkspaceSearch] = useState<string>('');
  const [isGranting, setIsGranting] = useState<boolean>(false);

  // Audit Modal State
  const [viewingCode, setViewingCode] = useState<VipCodeRow | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionDetail[]>([]);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState<boolean>(false);

  const loadSettings = useCallback(async () => {
    if (!supabase || isDemo) return;
    const [
      { data: trialPlan, error: trialError },
      { data: vipPlan, error: vipPlanError },
      { data: codeRows, error: codeError },
      { data: workspaceRows, error: wsError },
    ] = await Promise.all([
      supabase.from('plans').select('duration_days').eq('code', 'TRIAL_30').single(),
      supabase.from('plans').select('price_thb,duration_days').eq('code', 'VIP_YEARLY').single(),
      supabase
        .from('vip_redemption_codes')
        .select('id,code_prefix,label,duration_days,max_redemptions,redemption_count,expires_at,is_active,created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('workspaces')
        .select('id,name,school_name')
        .is('archived_at', null)
        .order('name')
        .limit(100),
    ]);

    if (trialError || vipPlanError || codeError || wsError) {
      setNotice(
        trialError?.message ||
          vipPlanError?.message ||
          codeError?.message ||
          wsError?.message ||
          'โหลดการตั้งค่า VIP ไม่สำเร็จ'
      );
      return;
    }

    setTrialDays(Number(trialPlan?.duration_days || 30));
    setVipPrice(Number(vipPlan?.price_thb ?? 100));
    setVipDurationDays(Number(vipPlan?.duration_days || 365));
    setCodes((codeRows || []) as VipCodeRow[]);
    setWorkspaces((workspaceRows || []) as WorkspaceOption[]);
  }, [isDemo]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Filter workspaces for selection
  const filteredWorkspaces = useMemo(() => {
    if (!workspaceSearch.trim()) return workspaces;
    const q = workspaceSearch.toLowerCase();
    return workspaces.filter(
      (w) => w.name.toLowerCase().includes(q) || (w.school_name && w.school_name.toLowerCase().includes(q))
    );
  }, [workspaces, workspaceSearch]);

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
      const mockCode = `CC360-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setLatestCode(mockCode);
      const newMockRow: VipCodeRow = {
        code_prefix: mockCode.substring(0, 11),
        created_at: new Date().toISOString(),
        duration_days: form.durationDays,
        expires_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59+07:00`).toISOString() : null,
        id: `mock-${Date.now()}`,
        is_active: true,
        label: form.label.trim(),
        max_redemptions: form.maxRedemptions,
        redemption_count: 0,
      };
      setCodes((prev) => [newMockRow, ...prev]);
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

  // Feature 1: Toggle code active status
  async function toggleCodeStatus(code: VipCodeRow) {
    const nextStatus = !code.is_active;
    const confirmMessage = nextStatus
      ? `ต้องการเปิดใช้งานโค้ด "${code.label}" อีกครั้งใช่หรือไม่?`
      : `ต้องการระงับการใช้งานโค้ด "${code.label}" ทันทีใช่หรือไม่? (ผู้ใช้จะไม่สามารถนำโค้ดนี้ไปแลกได้อีก)`;
    if (!window.confirm(confirmMessage)) return;

    if (!supabase || isDemo) {
      setCodes((prev) => prev.map((c) => (c.id === code.id ? { ...c, is_active: nextStatus } : c)));
      setNotice(`โหมดตัวอย่าง: ${nextStatus ? 'เปิดใช้งาน' : 'ระงับ'}โค้ด "${code.label}" แล้ว`);
      return;
    }

    const { error } = await supabase.rpc('toggle_vip_code_status', {
      target_code_id: code.id,
      target_is_active: nextStatus,
    });

    if (error) {
      setNotice(`เกิดข้อผิดพลาด: ${error.message}`);
    } else {
      setNotice(`${nextStatus ? 'เปิดใช้งาน' : 'ระงับ'}โค้ด "${code.label}" เรียบร้อยแล้ว`);
      await loadSettings();
    }
  }

  // Feature 2: Direct VIP Grant to workspace
  async function handleDirectGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspaceId) {
      setNotice('กรุณาเลือกโรงเรียน/ห้องเรียนที่ต้องการมอบสิทธิ์ VIP');
      return;
    }
    const targetWs = workspaces.find((w) => w.id === selectedWorkspaceId);
    const targetName = targetWs?.name || 'Workspace ที่เลือก';

    if (
      !window.confirm(
        `ยืนยันมอบสิทธิ์ VIP จำนวน ${grantDays} วัน ให้กับ "${targetName}" ทันที?`
      )
    ) {
      return;
    }

    setIsGranting(true);
    setNotice(null);

    if (!supabase || isDemo) {
      setTimeout(() => {
        setIsGranting(false);
        setNotice(`โหมดตัวอย่าง: มอบสิทธิ์ VIP ${grantDays} วัน ให้กับ "${targetName}" สำเร็จแล้ว`);
        setSelectedWorkspaceId('');
        setGrantReason('');
      }, 500);
      return;
    }

    const { data, error } = await supabase.rpc('grant_workspace_vip', {
      days_to_add: grantDays,
      grant_reason: grantReason.trim() || 'มอบสิทธิ์โดย Superadmin',
      target_workspace_id: selectedWorkspaceId,
    });

    setIsGranting(false);

    if (error) {
      setNotice(`มอบสิทธิ์ไม่สำเร็จ: ${error.message}`);
    } else {
      const res = data as { new_ends_at?: string } | null;
      const expiryText = res?.new_ends_at ? formatDate(res.new_ends_at) : '';
      setNotice(`มอบสิทธิ์ VIP ${grantDays} วัน ให้ "${targetName}" สำเร็จ! (หมดอายุ ${expiryText})`);
      setSelectedWorkspaceId('');
      setGrantReason('');
    }
  }

  // Feature 3: View Code Redemptions History
  async function openRedemptionHistory(code: VipCodeRow) {
    setViewingCode(code);
    setIsLoadingRedemptions(true);
    setRedemptions([]);

    if (!supabase || isDemo) {
      setTimeout(() => {
        setRedemptions(demoRedemptionsMap[code.id] || []);
        setIsLoadingRedemptions(false);
      }, 300);
      return;
    }

    const { data, error } = await supabase
      .from('vip_code_redemptions')
      .select(`
        id,
        duration_days,
        created_at,
        new_ends_at,
        workspace:workspaces(id, name, school_name),
        profile:profiles(id, display_name, email)
      `)
      .eq('code_id', code.id)
      .order('created_at', { ascending: false });

    setIsLoadingRedemptions(false);

    if (error) {
      setNotice(`โหลดประวัติการแลกใช้ไม่สำเร็จ: ${error.message}`);
      return;
    }

    const mapped: RedemptionDetail[] = ((data || []) as Record<string, unknown>[]).map((item) => {
      const ws = item.workspace as { name?: string; school_name?: string } | null;
      const prof = item.profile as { display_name?: string; email?: string } | null;
      return {
        created_at: String(item.created_at || ''),
        duration_days: Number(item.duration_days || 0),
        id: String(item.id || ''),
        new_ends_at: String(item.new_ends_at || ''),
        redeemed_by_name: prof?.display_name ? `${prof.display_name} (${prof.email || ''})` : prof?.email || 'ไม่ระบุผู้ใช้',
        workspace_name: ws?.name || ws?.school_name || 'ไม่ระบุโรงเรียน',
      };
    });

    setRedemptions(mapped);
  }

  // Feature 4: Export Codes to CSV
  function exportCodesCsv() {
    if (codes.length === 0) {
      setNotice('ไม่มีรายการโค้ดสำหรับส่งออก');
      return;
    }

    const headers = ['ชื่อวัตถุประสงค์', 'รหัสขึ้นต้น', 'จำนวนวัน VIP', 'โควตาสูงสุด', 'ใช้ไปแล้ว', 'วันหมดอายุ', 'สถานะ'];
    const rows = codes.map((c) => [
      `"${c.label.replace(/"/g, '""')}"`,
      `"${c.code_prefix}..."`,
      c.duration_days,
      c.max_redemptions,
      c.redemption_count,
      `"${c.expires_at ? formatDate(c.expires_at) : 'ไม่จำกัด'}"`,
      c.is_active ? 'พร้อมใช้งาน' : 'ระงับ/ปิด',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ClassCare360-VIP-Codes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice('ส่งออกรายการโค้ดเป็นไฟล์ CSV เรียบร้อยแล้ว');
  }

  async function copyLatestCode() {
    if (!latestCode) return;
    await navigator.clipboard.writeText(latestCode);
    setNotice('คัดลอกโค้ดแล้ว');
  }

  return (
    <div className="nexus-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="nexus-kicker">
          <ShieldCheck size={16} aria-hidden="true" /> Trial & VIP Codes Manager
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
            onClick={exportCodesCsv}
            title="ดาวน์โหลดรายการโค้ดทั้งหมดเป็นไฟล์ CSV"
            type="button"
          >
            <Download size={14} /> ส่งออก CSV
          </button>
        </div>
      </div>

      {/* Grid of Settings + Generator + Direct Grant */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Box 1: Trial Days */}
        <form className="nexus-muted-box flex flex-col justify-between p-4" onSubmit={saveTrialDays}>
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="text-cyan-700" size={19} />
              <h3 className="font-black text-slate-950">ระยะทดลองใหม่</h3>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
              มีผลกับ Workspace ที่สร้างใหม่เท่านั้น ไม่ย้อนแก้สิทธิ์เดิม
            </p>
            <label className="mt-3 grid gap-2 text-sm font-black text-slate-700">
              จำนวนวันทดลอง
              <input
                className="nexus-field h-11 px-3"
                max="365"
                min="1"
                onChange={(event) => setTrialDays(Number(event.target.value))}
                type="number"
                value={trialDays}
              />
            </label>
          </div>
          <button
            className="blue-action mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black"
            disabled={isSaving}
            type="submit"
          >
            บันทึกวันทดลอง
          </button>
        </form>

        {/* Box 2: VIP Pricing */}
        <form className="nexus-muted-box flex flex-col justify-between p-4" onSubmit={saveVipPricing}>
          <div>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="text-emerald-600" size={19} />
              <h3 className="font-black text-slate-950">ราคาแพ็กเกจ VIP</h3>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
              ราคามาตรฐานและจำนวนวันรอบแพ็กเกจที่ระบบคำนวณ
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-xs font-black text-slate-700">
                ราคา (บาท)
                <input
                  className="nexus-field h-11 px-3"
                  max="1000000"
                  min="0"
                  onChange={(event) => setVipPrice(Number(event.target.value))}
                  type="number"
                  value={vipPrice}
                />
              </label>
              <label className="grid gap-2 text-xs font-black text-slate-700">
                จำนวนวัน
                <input
                  className="nexus-field h-11 px-3"
                  max="3650"
                  min="1"
                  onChange={(event) => setVipDurationDays(Number(event.target.value))}
                  type="number"
                  value={vipDurationDays}
                />
              </label>
            </div>
          </div>
          <button
            className="blue-action mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black"
            disabled={isSaving}
            type="submit"
          >
            บันทึกราคา VIP
          </button>
        </form>

        {/* Box 3: Generate Code */}
        <form className="nexus-muted-box flex flex-col justify-between p-4" onSubmit={createCode}>
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="text-amber-600" size={19} />
              <h3 className="font-black text-slate-950">ออกโค้ดเพิ่มวัน VIP</h3>
            </div>
            <label className="mt-3 grid gap-1 text-xs font-black text-slate-700">
              ชื่อ/วัตถุประสงค์
              <input
                className="nexus-field h-10 px-3 text-xs"
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="เช่น แคมเปญวันครู 2569"
                value={form.label}
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-black text-slate-700">
                จำนวนวัน
                <input
                  className="nexus-field h-10 px-3 text-xs"
                  max="3650"
                  min="1"
                  onChange={(event) => setForm((current) => ({ ...current, durationDays: Number(event.target.value) }))}
                  type="number"
                  value={form.durationDays}
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-700">
                กี่โรงเรียน
                <input
                  className="nexus-field h-10 px-3 text-xs"
                  max="100000"
                  min="1"
                  onChange={(event) => setForm((current) => ({ ...current, maxRedemptions: Number(event.target.value) }))}
                  type="number"
                  value={form.maxRedemptions}
                />
              </label>
            </div>
            <label className="mt-2 grid gap-1 text-xs font-black text-slate-700">
              วันหมดอายุโค้ด
              <input
                className="nexus-field h-10 px-3 text-xs"
                onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                type="date"
                value={form.expiresAt}
              />
            </label>
          </div>
          <button
            className="blue-action mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl px-4 text-sm font-black"
            disabled={isSaving}
            type="submit"
          >
            <Plus size={16} /> สร้างโค้ด
          </button>
        </form>

        {/* Box 4: Direct VIP Grant (เติมวันด่วนให้โรงเรียน) */}
        <form className="nexus-muted-box flex flex-col justify-between border-blue-200 bg-blue-50/40 p-4" onSubmit={handleDirectGrant}>
          <div>
            <div className="flex items-center gap-2">
              <Gift className="text-blue-600" size={19} />
              <h3 className="font-black text-slate-950">มอบสิทธิ์ VIP ตรง</h3>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">เติมวัน VIP ให้โรงเรียนทันทีโดยไม่ต้องใช้โค้ด</p>

            <div className="mt-3 grid gap-1 text-xs font-black text-slate-700">
              <span>เลือกโรงเรียน</span>
              <div className="relative">
                <input
                  className="nexus-field h-8 w-full pl-7 pr-2 text-xs"
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  placeholder="ค้นหาชื่อโรงเรียน..."
                  type="text"
                  value={workspaceSearch}
                />
                <Search className="absolute left-2 top-2 text-slate-400" size={14} />
              </div>
              <select
                className="nexus-field mt-1 h-9 px-2 text-xs font-medium"
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                value={selectedWorkspaceId}
              >
                <option value="">-- เลือกโรงเรียน ({filteredWorkspaces.length}) --</option>
                {filteredWorkspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.school_name ? `(${w.school_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2">
              <span className="text-xs font-black text-slate-700">เติมจำนวนวัน</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {[30, 90, 365, 1095].map((d) => (
                  <button
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                      grantDays === d ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                    }`}
                    key={d}
                    onClick={() => setGrantDays(d)}
                    type="button"
                  >
                    +{d >= 365 ? `${d / 365} ปี` : `${d} วัน`}
                  </button>
                ))}
              </div>
              <input
                className="nexus-field mt-1 h-8 w-full px-2 text-xs"
                max="36500"
                min="1"
                onChange={(e) => setGrantDays(Number(e.target.value))}
                placeholder="หรือพิมพ์จำนวนวัน..."
                type="number"
                value={grantDays}
              />
            </div>

            <label className="mt-2 grid gap-1 text-xs font-black text-slate-700">
              บันทึกช่วยจำ / เหตุผล
              <input
                className="nexus-field h-8 px-2 text-xs"
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="เช่น โอนผ่านบัญชีโรงเรียน / อภินันทนาการ"
                value={grantReason}
              />
            </label>
          </div>

          <button
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={isGranting || !selectedWorkspaceId}
            type="submit"
          >
            <CheckCircle2 size={16} />
            {isGranting ? 'กำลังมอบสิทธิ์...' : 'ยืนยันมอบ VIP ด่วน'}
          </button>
        </form>
      </div>

      {/* Notice & Latest Code Toast */}
      {latestCode ? (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black text-amber-700">โค้ดฉบับเต็ม — แสดงครั้งนี้ครั้งเดียว (กรุณาคัดลอกทันที)</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 font-black text-cyan-100">
              {latestCode}
            </code>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-amber-200 hover:bg-amber-100"
              onClick={() => void copyLatestCode()}
              type="button"
            >
              <Copy size={16} /> คัดลอกโค้ด
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-900 ring-1 ring-cyan-100">
          {notice}
        </div>
      ) : null}

      {/* Code List with Status Toggle and History */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-950">รายการโค้ด VIP ล่าสุด ({codes.length})</h3>
          <span className="text-xs font-bold text-slate-500">คลิกที่จำนวนสิทธิ์เพื่อดูประวัติโรงเรียนที่นำไปใช้</span>
        </div>

        <div className="mt-3 grid gap-3">
          {codes.map((code) => {
            const isExhausted = code.redemption_count >= code.max_redemptions;
            const isExpired = code.expires_at ? new Date(code.expires_at).getTime() <= Date.now() : false;

            return (
              <div
                className={`nexus-muted-box p-3.5 transition-colors ${
                  !code.is_active ? 'opacity-70 bg-slate-100/70' : ''
                }`}
                key={code.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-950">{code.label}</p>
                      {!code.is_active ? (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                          ระงับการใช้งาน
                        </span>
                      ) : isExhausted ? (
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                          ครบโควตาแล้ว
                        </span>
                      ) : isExpired ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                          หมดอายุแล้ว
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          พร้อมใช้งาน
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      รหัส: <span className="font-mono text-slate-700">{code.code_prefix}…</span> · {code.duration_days} วัน ·
                      หมดอายุ: {formatDate(code.expires_at)} · สร้างเมื่อ: {formatDate(code.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Redemption Audit History Button */}
                    <button
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ring-1 transition-colors ${
                        code.redemption_count > 0
                          ? 'bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100'
                          : 'bg-slate-50 text-slate-500 ring-slate-200'
                      }`}
                      onClick={() => void openRedemptionHistory(code)}
                      title="คลิกเพื่อดูประวัติโรงเรียนที่แลกใช้โค้ดนี้"
                      type="button"
                    >
                      <History size={13} />
                      {code.redemption_count} / {code.max_redemptions} สิทธิ์
                    </button>

                    {/* Toggle Active / Deactivate Button */}
                    <button
                      className={`inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-black transition-colors ${
                        code.is_active
                          ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                          : 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                      }`}
                      onClick={() => void toggleCodeStatus(code)}
                      title={code.is_active ? 'กดเพื่อระงับโค้ดนี้' : 'กดเพื่อเปิดใช้งานโค้ดนี้อีกครั้ง'}
                      type="button"
                    >
                      <Power size={13} />
                      {code.is_active ? 'ระงับโค้ด' : 'เปิดใช้งาน'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Redemption History Modal */}
      {viewingCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="nexus-card max-h-[85vh] w-full max-w-2xl overflow-hidden bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <History className="text-blue-600" size={20} />
                  <h3 className="text-base font-black text-slate-950">ประวัติการแลกใช้โค้ด VIP</h3>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  โค้ด: <span className="font-mono text-slate-800">{viewingCode.code_prefix}…</span> ({viewingCode.label})
                  · สิทธิ์ {viewingCode.redemption_count}/{viewingCode.max_redemptions}
                </p>
              </div>
              <button
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setViewingCode(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
              {isLoadingRedemptions ? (
                <div className="py-8 text-center text-sm font-bold text-slate-500">กำลังโหลดประวัติ...</div>
              ) : redemptions.length === 0 ? (
                <div className="py-8 text-center">
                  <ShieldAlert className="mx-auto text-slate-300" size={36} />
                  <p className="mt-2 text-sm font-bold text-slate-500">ยังไม่มีโรงเรียนใดนำโค้ดนี้ไปแลกใช้</p>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {redemptions.map((red) => (
                    <div className="nexus-muted-box flex flex-wrap items-center justify-between gap-3 p-3 text-xs" key={red.id}>
                      <div>
                        <p className="font-black text-slate-900">{red.workspace_name}</p>
                        <p className="mt-0.5 text-slate-500">ผู้แลก: {red.redeemed_by_name}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-black text-emerald-700">
                          +{red.duration_days} วัน VIP
                        </span>
                        <p className="mt-1 text-[11px] text-slate-400">แลกเมื่อ: {formatDateTime(red.created_at)}</p>
                        <p className="text-[11px] text-slate-500">หมดอายุใหม่: {formatDate(red.new_ends_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                onClick={() => setViewingCode(null)}
                type="button"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
