import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Crown,
  FileUp,
  KeyRound,
  Lock,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import {
  getEffectivePlanCode,
  getVipUpgradeMeta,
  isLifetimeVip,
  planLabels,
  planLimits,
} from '../../lib/entitlements';
import { convertImageToWebp, IMAGE_WEBP_PRESETS } from '../../lib/imageOptimizer';
import { canManageWorkspace } from '../../lib/roles';
import { requestAppSessionRefresh } from '../../lib/session';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface PackagePageProps {
  session: AppSessionContext;
}

interface PlanRow {
  duration_days: number | null;
  id: string;
  name: string;
  price_thb: number;
}

interface PaymentQrRow {
  account_hint: string | null;
  account_name: string | null;
  app_files?: {
    bucket: string;
    original_filename: string | null;
    storage_path: string;
  } | null;
  bank_name: string | null;
  display_name: string;
  id: string;
}

interface ReferralCreditRow {
  amount_thb: number;
  id: string;
  status: 'pending' | 'available' | 'used' | 'reversed' | 'expired';
}

interface PaymentRequestRow {
  base_amount_thb: number;
  credit_amount_thb: number;
  created_at: string;
  id: string;
  payable_amount_thb: number;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'expired';
}

const demoPlan: PlanRow = {
  duration_days: 365,
  id: 'demo-vip-plan',
  name: 'ClassCare 360 VIP',
  price_thb: 100,
};

const demoQr: PaymentQrRow = {
  account_hint: 'พร้อมเพย์สำหรับชำระค่าแพ็กเกจรายปี',
  account_name: 'ClassCare 360',
  bank_name: 'ธนาคารกสิกรไทย',
  display_name: 'PromptPay QR ClassCare 360',
  id: 'demo-qr',
};

const isDevelopmentDemo =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

const requestStatusLabels: Record<PaymentRequestRow['status'], string> = {
  approved: 'อนุมัติแล้ว',
  cancelled: 'ยกเลิก',
  draft: 'แบบร่าง',
  expired: 'หมดอายุ',
  pending_review: 'รอตรวจสอบสลิป',
  refunded: 'คืนเงินแล้ว',
  rejected: 'ไม่อนุมัติ',
};

const requestStatusTones: Record<PaymentRequestRow['status'], string> = {
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  expired: 'bg-slate-100 text-slate-500 ring-slate-200',
  pending_review: 'bg-amber-50 text-amber-800 ring-amber-200',
  refunded: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const VIP_HIGHLIGHTS = [
  {
    title: 'ครบทุกโมดูลวิชาการและเอกสาร ปพ.',
    detail: 'สมุดคะแนน ตัดเกรด 8 ระดับ ตรวจข้อสอบ OMR คุณลักษณะ 8 ประการ และพิมพ์รายงาน A4 / Excel',
  },
  {
    title: 'ดูแลนักเรียนและเงินออมครบวงจร',
    detail: 'สมุดเงินออม พฤติกรรม เยี่ยมบ้าน กสศ.01 ตารางเวรทำความสะอาด และรายงานสรุปประจำวัน',
  },
  {
    title: 'ผู้ช่วยอัจฉริยะ ClassCare AI (Gemini)',
    detail: 'วิเคราะห์ข้อมูลห้องเรียนตามสิทธิ์จริง ร่างเอกสารแจ้งผู้ปกครอง และสแกน OCR อัตโนมัติ',
  },
  {
    title: 'ขยายโควตารองรับทั้งโรงเรียน',
    detail: 'รองรับสูงสุด 100 ห้องเรียน นักเรียน 5,000 คน และเชิญครูร่วมงานได้สูงสุด 100 บัญชี',
  },
  {
    title: 'นำเข้า-ส่งออกและแจ้งเตือนเชิงรุก',
    detail: 'นำเข้าไฟล์ DMC / Excel แจ้งเตือนนักเรียนกลุ่มเสี่ยง และพอร์ทัลผู้ปกครองครบระบบ',
  },
  {
    title: 'สมัครครั้งเดียว ใช้ร่วมกันได้ทั้งโรงเรียน',
    detail: 'ครูทุกคนที่ได้รับเชิญเข้าพื้นที่ทำงานนี้จะได้รับสิทธิ์ VIP ร่วมกันโดยไม่ต้องชำระเพิ่ม',
  },
];

function formatBaht(value: number) {
  return new Intl.NumberFormat('th-TH', {
    currency: 'THB',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function getStoragePath(workspaceId: string, profileId: string, file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  return `${workspaceId}/${profileId}/${Date.now()}.${extension}`;
}

export function PackagePage({ session }: PackagePageProps) {
  const useRealBackend = Boolean(supabase) && !isDevelopmentDemo;
  const [plan, setPlan] = useState<PlanRow>(demoPlan);
  const [paymentQr, setPaymentQr] = useState<PaymentQrRow | null>(demoQr);
  const [credits, setCredits] = useState<ReferralCreditRow[]>([]);
  const [requests, setRequests] = useState<PaymentRequestRow[]>([]);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [isOptimizingSlip, setIsOptimizingSlip] = useState(false);
  const slipInputRef = useRef<HTMLInputElement | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [vipCode, setVipCode] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [codeNotice, setCodeNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(useRealBackend && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(
    isSupabaseReady ? null : { tone: 'info', text: 'โหมดตัวอย่าง: แสดงข้อมูลจำลองสำหรับการทดสอบหน้าชำระเงิน' },
  );

  const effectivePlanCode = getEffectivePlanCode(session.subscription);
  const hasLifetimeVip = isLifetimeVip(session.subscription, session.profile.role);
  const vipMeta = getVipUpgradeMeta(session.subscription);
  const availableCredit = useMemo(
    () => credits.filter((credit) => credit.status === 'available').reduce((sum, credit) => sum + credit.amount_thb, 0),
    [credits],
  );
  const creditAmount = Math.min(Math.max(availableCredit, 0), plan.price_thb);
  const payableAmount = Math.max(plan.price_thb - creditAmount, 0);
  const canCreateRequest = canManageWorkspace(session.profile.role);
  const durationDays = plan.duration_days || 365;
  const monthlyApprox = Math.max(1, Math.round(plan.price_thb / Math.max(1, Math.round(durationDays / 30))));

  useEffect(() => {
    let isMounted = true;

    async function loadPackageData() {
      if (!useRealBackend || !supabase || !session.workspace) {
        setPlan(demoPlan);
        setPaymentQr(demoQr);
        setQrImageUrl(null);
        setCredits([]);
        setRequests([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: planRow, error: planError },
        { data: qrRow, error: qrError },
        { data: creditRows, error: creditError },
        { data: requestRows, error: requestError },
      ] = await Promise.all([
        supabase
          .from('plans')
          .select('id,name,price_thb,duration_days')
          .eq('code', 'VIP_YEARLY')
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('payment_qr_codes')
          .select('id,display_name,bank_name,account_name,account_hint,app_files(bucket,storage_path,original_filename)')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('referral_credits')
          .select('id,amount_thb,status')
          .eq('profile_id', session.profile.id)
          .in('status', ['available', 'pending']),
        supabase
          .from('payment_requests')
          .select('id,status,base_amount_thb,credit_amount_thb,payable_amount_thb,created_at')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (!isMounted) return;

      if (planError || qrError || creditError || requestError) {
        setNotice({
          tone: 'error',
          text:
            planError?.message ||
            qrError?.message ||
            creditError?.message ||
            requestError?.message ||
            'ไม่สามารถโหลดข้อมูลแพ็กเกจได้ในขณะนี้',
        });
        setIsLoading(false);
        return;
      }

      setPlan((planRow || demoPlan) as PlanRow);
      const nextQr = (qrRow as PaymentQrRow | null) || null;
      setPaymentQr(nextQr);
      if (nextQr?.app_files?.bucket && nextQr.app_files.storage_path) {
        const { data: signedUrlData } = await supabase.storage
          .from(nextQr.app_files.bucket)
          .createSignedUrl(nextQr.app_files.storage_path, 60 * 10);
        setQrImageUrl(signedUrlData?.signedUrl || null);
      } else {
        setQrImageUrl(null);
      }
      setCredits((creditRows || []) as ReferralCreditRow[]);
      setRequests((requestRows || []) as PaymentRequestRow[]);
      setIsLoading(false);
    }

    void loadPackageData();

    return () => {
      isMounted = false;
    };
  }, [session.profile.id, session.workspace, useRealBackend]);

  useEffect(() => {
    return () => {
      if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl);
    };
  }, [slipPreviewUrl]);

  function clearSlipSelection() {
    if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl);
    setSlipPreviewUrl(null);
    setSlipFile(null);
    if (slipInputRef.current) slipInputRef.current.value = '';
  }

  async function handleSlipFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const rawFile = event.target.files?.[0];
    if (!rawFile) return;

    setNotice(null);
    setIsOptimizingSlip(true);
    try {
      const preparedFile =
        rawFile.type === 'application/pdf'
          ? rawFile
          : await convertImageToWebp(rawFile, IMAGE_WEBP_PRESETS.payment_slip);

      if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl);
      setSlipFile(preparedFile);
      setSlipPreviewUrl(
        preparedFile.type.startsWith('image/') ? URL.createObjectURL(preparedFile) : null,
      );
    } catch {
      setSlipFile(rawFile);
      setSlipPreviewUrl(null);
    } finally {
      setIsOptimizingSlip(false);
    }
  }

  async function uploadSlipAndCreateFileRecord(file: File) {
    if (!useRealBackend || !supabase || !session.workspace) return null;

    const optimizedFile =
      file.type === 'application/pdf'
        ? file
        : await convertImageToWebp(file, IMAGE_WEBP_PRESETS.payment_slip);

    const bucket = 'payment-slips';
    const storagePath = getStoragePath(session.workspace.id, session.profile.id, optimizedFile);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, optimizedFile, {
      contentType: optimizedFile.type || 'image/webp',
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: fileRow, error: fileError } = await supabase
      .from('app_files')
      .insert({
        workspace_id: session.workspace.id,
        bucket,
        storage_path: storagePath,
        original_filename: optimizedFile.name,
        content_type: optimizedFile.type || 'image/webp',
        size_bytes: optimizedFile.size,
        privacy_level: 'sensitive',
        owner_profile_id: session.profile.id,
        metadata: {
          purpose: 'payment_slip',
          optimized_webp: optimizedFile.type === 'image/webp',
        },
      })
      .select('id')
      .single();

    if (fileError) throw fileError;
    return fileRow.id as string;
  }

  async function handleCreatePaymentRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!canCreateRequest) {
      setNotice({ tone: 'error', text: 'เฉพาะเจ้าของพื้นที่ทำงานเท่านั้นที่สามารถส่งคำขอชำระเงินได้' });
      setIsSubmitting(false);
      return;
    }

    if (!slipFile) {
      setNotice({ tone: 'error', text: 'กรุณาแนบไฟล์สลิปการโอนเงินก่อนส่งคำขอ' });
      setIsSubmitting(false);
      return;
    }

    if (!useRealBackend || !supabase || !session.workspace) {
      const localRequest: PaymentRequestRow = {
        base_amount_thb: plan.price_thb,
        created_at: new Date().toISOString(),
        credit_amount_thb: creditAmount,
        id: `demo-payment-${Date.now()}`,
        payable_amount_thb: payableAmount,
        status: 'pending_review',
      };
      setRequests((current) => [localRequest, ...current]);
      clearSlipSelection();
      setReviewNote('');
      setNotice({ tone: 'success', text: 'ส่งหลักฐานการชำระเงินในโหมดตัวอย่างเรียบร้อยแล้ว' });
      setIsSubmitting(false);
      return;
    }

    try {
      const slipFileId = await uploadSlipAndCreateFileRecord(slipFile);
      const { data, error } = await supabase
        .from('payment_requests')
        .insert({
          workspace_id: session.workspace.id,
          profile_id: session.profile.id,
          plan_id: plan.id,
          qr_code_id: paymentQr?.id ?? null,
          status: 'pending_review',
          base_amount_thb: plan.price_thb,
          credit_amount_thb: creditAmount,
          payable_amount_thb: payableAmount,
          slip_file_id: slipFileId,
          submitted_at: new Date().toISOString(),
          review_note: reviewNote.trim() || null,
        })
        .select('id,status,base_amount_thb,credit_amount_thb,payable_amount_thb,created_at')
        .single();

      if (error) throw error;

      setRequests((current) => [data as PaymentRequestRow, ...current]);
      clearSlipSelection();
      setReviewNote('');
      setNotice({
        tone: 'success',
        text: 'ส่งหลักฐานการชำระเงินเรียบร้อยแล้ว ทีมผู้ดูแลระบบจะตรวจสอบและเปิดสิทธิ์ VIP ให้โดยเร็วที่สุด',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'ไม่สามารถส่งคำขอชำระเงินได้ กรุณาลองใหม่อีกครั้ง',
      });
    }

    setIsSubmitting(false);
  }

  async function handleRedeemVipCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeNotice(null);
    if (!canCreateRequest || !session.workspace) {
      setCodeNotice({ tone: 'error', text: 'เฉพาะเจ้าของพื้นที่ทำงานเท่านั้นที่สามารถใช้โค้ด VIP ได้' });
      return;
    }
    if (!vipCode.trim()) {
      setCodeNotice({ tone: 'error', text: 'กรุณากรอกรหัสโค้ด VIP' });
      return;
    }

    setIsRedeemingCode(true);
    if (!useRealBackend || !supabase) {
      setCodeNotice({ tone: 'success', text: 'ตรวจสอบรูปแบบโค้ดในโหมดตัวอย่างเรียบร้อยแล้ว' });
      setVipCode('');
      setIsRedeemingCode(false);
      return;
    }

    const { data, error } = await supabase.rpc('redeem_vip_code', {
      redemption_code: vipCode.trim(),
      target_workspace_id: session.workspace.id,
    });
    if (error) {
      const messages: Record<string, string> = {
        vip_code_already_redeemed: 'พื้นที่ทำงานนี้เคยใช้โค้ดนี้ไปแล้ว',
        vip_code_expired: 'โค้ดนี้หมดอายุการใช้งานแล้ว',
        vip_code_fully_redeemed: 'โค้ดนี้ถูกใช้งานครบตามจำนวนสิทธิ์แล้ว',
        vip_code_inactive: 'โค้ดนี้ถูกปิดการใช้งานแล้ว',
        vip_code_invalid: 'ไม่พบรหัสโค้ดนี้ กรุณาตรวจสอบตัวอักษรอีกครั้ง',
        workspace_has_lifetime_vip: 'พื้นที่ทำงานนี้มีสิทธิ์ VIP ตลอดชีพอยู่แล้ว',
        workspace_owner_required: 'เฉพาะเจ้าของพื้นที่ทำงานเท่านั้นที่สามารถใช้โค้ดได้',
      };
      setCodeNotice({ tone: 'error', text: messages[error.message] || error.message });
    } else {
      const result = data as { duration_days?: number; ends_at?: string } | null;
      const endLabel = result?.ends_at
        ? new Date(result.ends_at).toLocaleDateString('th-TH', { dateStyle: 'long' })
        : '-';
      setCodeNotice({
        tone: 'success',
        text: `เปิดสิทธิ์ VIP เพิ่ม ${result?.duration_days || 0} วันสำเร็จ ใช้งานได้ถึงวันที่ ${endLabel}`,
      });
      setVipCode('');
      requestAppSessionRefresh();
    }
    setIsRedeemingCode(false);
  }

  return (
    <main className="app-page">
      {/* Executive Page Header */}
      <div className="app-page-header">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
            <Crown size={14} aria-hidden="true" />
            แพ็กเกจและการสมัครสมาชิก
          </span>
          <h1 className="app-page-title mt-2">
            {hasLifetimeVip ? 'สถานะสมาชิก ClassCare 360 VIP' : 'อัปเกรดเป็น ClassCare 360 VIP'}
          </h1>
          <p className="app-page-description">
            ปลดล็อกเครื่องมือบริหารจัดการห้องเรียนครบทุกโมดูล รองรับครูทุกคนในพื้นที่ทำงานเดียวกัน พร้อมผู้ช่วยอัจฉริยะ ClassCare AI
          </p>
        </div>

        {/* Live Current Subscription Status Pill */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                effectivePlanCode === 'VIP_YEARLY'
                  ? 'bg-amber-100 text-amber-700'
                  : effectivePlanCode === 'TRIAL_30'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {effectivePlanCode === 'VIP_YEARLY' ? <Crown size={18} /> : <Sparkles size={18} />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500">
                แพ็กเกจปัจจุบัน · {session.workspace?.schoolName || 'พื้นที่ทำงานหลัก'}
              </p>
              <p className="text-sm font-black text-slate-950">
                {hasLifetimeVip ? 'ClassCare 360 VIP (ตลอดชีพ)' : planLabels[effectivePlanCode]}
                {!hasLifetimeVip && effectivePlanCode !== 'FREE_LOGIN' ? (
                  <span className="ml-1.5 text-xs font-bold text-amber-700">· {vipMeta.subtitle}</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {notice ? (
        <div
          className={`mt-5 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-black shadow-2xs ${
            notice.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-cyan-200 bg-cyan-50 text-cyan-900'
          }`}
        >
          {notice.tone === 'error' ? (
            <AlertTriangle size={16} className="shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {/* Main 2-Column Balanced Executive Grid */}
      <div className="mt-5 grid gap-6 xl:grid-cols-12 xl:items-start">
        {/* LEFT COLUMN (7 cols): Plan Details, Benefits, Comparison & History */}
        <div className="space-y-5 xl:col-span-7">
          {/* Premium VIP Plan Showcase Card */}
          <section className="overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-sm">
            {/* Dark Forest-Green Hero Strip */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#142720] via-[#1C342B] to-[#0f172a] p-6 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(251,191,36,0.22),transparent_55%)]" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-black text-amber-200 ring-1 ring-amber-300/35">
                    <Crown size={13} aria-hidden="true" />
                    แพ็กเกจแนะนำสำหรับครูและสถานศึกษา
                  </span>
                  <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{plan.name}</h2>
                  <p className="mt-1.5 max-w-md text-xs font-semibold leading-5 text-emerald-100/80">
                    ใช้งานได้ครบทุกฟีเจอร์ตลอด {durationDays} วันเต็ม สิทธิ์ครอบคลุมทั้งพื้นที่ทำงาน
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-left backdrop-blur-sm sm:text-right">
                  {creditAmount > 0 ? (
                    <p className="text-xs font-bold text-slate-300 line-through">{formatBaht(plan.price_thb)}</p>
                  ) : null}
                  <div className="flex items-baseline gap-1.5 sm:justify-end">
                    <span className="text-3xl font-black tracking-tight text-amber-300">
                      {formatBaht(payableAmount)}
                    </span>
                    <span className="text-xs font-bold text-emerald-100/80">/ {durationDays} วัน</span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-emerald-200/90">
                    เฉลี่ยเพียง {formatBaht(monthlyApprox)} ต่อเดือน
                  </p>
                </div>
              </div>
            </div>

            {/* 6 Clear VIP Benefits Grid */}
            <div className="p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                สิทธิประโยชน์ที่ได้รับในแพ็กเกจ VIP
              </p>
              <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                {VIP_HIGHLIGHTS.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5"
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Check size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Clean Free vs VIP Comparison Table */}
          <section className="nexus-card overflow-hidden p-5 sm:p-6">
            <h3 className="text-base font-black text-slate-950">เปรียบเทียบสิทธิ์การใช้งาน</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              ข้อมูลเดิมทั้งหมดจะยังคงอยู่ครบถ้วนเมื่ออัปเกรดเป็น VIP
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead>
                  <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 pr-4">รายการสิทธิ์</th>
                    <th className="px-4 py-2.5 text-center">แพ็กเกจ Free</th>
                    <th className="pl-4 py-2.5 text-center text-amber-700">ClassCare 360 VIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  <tr>
                    <td className="py-2.5 pr-4">จำนวนห้องเรียนที่ใช้งานได้</td>
                    <td className="px-4 py-2.5 text-center text-slate-500">{planLimits.FREE_LOGIN.activeClassrooms} ห้อง</td>
                    <td className="pl-4 py-2.5 text-center font-black text-emerald-700">
                      สูงสุด {planLimits.VIP_YEARLY.activeClassrooms} ห้อง
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">จำนวนนักเรียนในระบบ</td>
                    <td className="px-4 py-2.5 text-center text-slate-500">{planLimits.FREE_LOGIN.activeStudents} คน</td>
                    <td className="pl-4 py-2.5 text-center font-black text-emerald-700">
                      สูงสุด {planLimits.VIP_YEARLY.activeStudents.toLocaleString('th-TH')} คน
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">จำนวนครูผู้ร่วมงานในโรงเรียน</td>
                    <td className="px-4 py-2.5 text-center text-slate-500">{planLimits.FREE_LOGIN.collaborators} บัญชี</td>
                    <td className="pl-4 py-2.5 text-center font-black text-emerald-700">
                      สูงสุด {planLimits.VIP_YEARLY.collaborators} บัญชี
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">คะแนน ตัดเกรด OMR เงินออม พฤติกรรม &amp; ปพ.</td>
                    <td className="px-4 py-2.5 text-center text-slate-400">จำกัดเฉพาะเช็กชื่อพื้นฐาน</td>
                    <td className="pl-4 py-2.5 text-center font-black text-emerald-700">เปิดใช้งานครบทุกโมดูล</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">ผู้ช่วยอัจฉริยะ ClassCare AI (Gemini) &amp; OCR</td>
                    <td className="px-4 py-2.5 text-center text-slate-400">โหมดแนะนำการใช้งานเท่านั้น</td>
                    <td className="pl-4 py-2.5 text-center font-black text-emerald-700">ปลดล็อกเต็มรูปแบบ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Payment Request History */}
          <section className="nexus-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">ประวัติการแจ้งชำระเงิน</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  ติดตามสถานะการตรวจสอบสลิปและการต่ออายุของพื้นที่ทำงานนี้
                </p>
              </div>
              <ReceiptText size={20} className="text-slate-400" aria-hidden="true" />
            </div>

            <div className="mt-4 space-y-2.5">
              {requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-xs font-bold text-slate-500">
                  ยังไม่มีประวัติการแจ้งชำระเงินในพื้นที่ทำงานนี้
                </div>
              ) : (
                requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${requestStatusTones[request.status]}`}
                      >
                        {request.status === 'pending_review' ? <Clock3 size={11} /> : null}
                        {requestStatusLabels[request.status]}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {new Date(request.created_at).toLocaleString('th-TH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-black text-slate-950">{formatBaht(request.payable_amount_thb)}</p>
                      {request.credit_amount_thb > 0 ? (
                        <p className="text-[11px] font-bold text-emerald-700">
                          ใช้ส่วนลดเครดิต {formatBaht(request.credit_amount_thb)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Sticky Checkout + VIP Code Redemption */}
        <div className="space-y-5 xl:col-span-5 xl:sticky xl:top-20">
          {!canCreateRequest ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900">
              <Lock size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                การชำระเงินและการใช้โค้ด VIP ดำเนินการโดย<strong>เจ้าของพื้นที่ทำงาน</strong> เมื่อเปิดสิทธิ์แล้ว ครูทุกคนในโรงเรียนจะได้รับสิทธิ์ VIP ร่วมกันโดยอัตโนมัติ
              </p>
            </div>
          ) : null}

          {hasLifetimeVip ? (
            <section className="nexus-card border-amber-200 bg-gradient-to-br from-amber-50/80 to-white p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                <Crown size={24} />
              </span>
              <h2 className="mt-3 text-lg font-black text-slate-950">บัญชีนี้ได้รับสิทธิ์ VIP ตลอดชีพแล้ว</h2>
              <p className="mt-1.5 text-xs font-semibold leading-6 text-slate-600">
                พื้นที่ทำงานของคุณสามารถใช้งานครบทุกโมดูลและผู้ช่วยอัจฉริยะ ClassCare AI ได้อย่างไม่จำกัดระยะเวลา โดยไม่จำเป็นต้องต่ออายุเพิ่มเติม
              </p>
            </section>
          ) : (
            <>
              {/* Checkout Card: QR Payment & Slip Upload */}
              <form className="nexus-card p-5 sm:p-6" onSubmit={handleCreatePaymentRequest}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-[#1C342B]">
                    <CreditCard size={16} className="text-[#2F7D5B]" aria-hidden="true" />
                    ชำระเงินผ่าน QR และแนบสลิป
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
                    ยืนยันภายใน 24 ชม.
                  </span>
                </div>

                {/* Price Breakdown Summary */}
                <div className="mt-4 space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold">ค่าแพ็กเกจ ({durationDays} วัน)</span>
                    <span className="font-bold">{formatBaht(plan.price_thb)}</span>
                  </div>
                  {creditAmount > 0 ? (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="font-semibold">ส่วนลดเครดิตแนะนำ</span>
                      <span className="font-bold">-{formatBaht(creditAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-sm">
                    <span className="font-black text-slate-900">ยอดโอนชำระสุทธิ</span>
                    <span className="text-lg font-black text-[#1C342B]">{formatBaht(payableAmount)}</span>
                  </div>
                </div>

                {/* Step 1: Payment QR Box */}
                <div className="mt-4">
                  <p className="text-xs font-black text-slate-700">1. ช่องทางการโอนเงิน</p>
                  {paymentQr ? (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-center">
                      {qrImageUrl ? (
                        <img
                          alt={paymentQr.display_name}
                          className="mx-auto mb-3 aspect-square max-h-56 w-full max-w-56 rounded-xl border border-slate-100 object-contain p-1"
                          src={qrImageUrl}
                        />
                      ) : null}
                      <p className="text-sm font-black text-slate-950">{paymentQr.display_name}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-600">
                        {paymentQr.bank_name || 'พร้อมเพย์'} · {paymentQr.account_name || 'ClassCare 360'}
                      </p>
                      {paymentQr.account_hint ? (
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{paymentQr.account_hint}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs font-semibold leading-5 text-amber-900">
                      <p className="font-black">ช่องทางชำระเงิน QR อยู่ระหว่างอัปเดตข้อมูลบัญชี</p>
                      <p className="mt-1 text-amber-800">
                        ท่านสามารถกรอกโค้ด VIP ด้านล่างเพื่อเปิดสิทธิ์ทันที หรือติดต่อผู้ดูแลระบบผ่านปุ่มแชทมุมขวาล่างเพื่อสอบถามเลขบัญชีโอนเงิน
                      </p>
                    </div>
                  )}
                </div>

                {/* Step 2: Slip Upload */}
                <div className="mt-4">
                  <p className="text-xs font-black text-slate-700">2. แนบหลักฐานการโอนเงิน (สลิป)</p>
                  <input
                    ref={slipInputRef}
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={!canCreateRequest || isOptimizingSlip}
                    onChange={(event) => void handleSlipFileSelect(event)}
                    type="file"
                  />
                  {slipFile ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {slipPreviewUrl ? (
                          <img
                            src={slipPreviewUrl}
                            alt="ตัวอย่างสลิป"
                            className="h-12 w-12 shrink-0 rounded-xl border border-emerald-200 bg-white object-cover"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-emerald-950">{slipFile.name}</p>
                          <p className="text-[11px] font-semibold text-emerald-700">
                            ขนาดไฟล์ {Math.max(1, Math.ceil(slipFile.size / 1024))} KB
                            {slipFile.type === 'image/webp' ? ' (WebP คมชัด ประหยัดพื้นที่)' : ''} · พร้อมส่งตรวจสอบ
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSlipSelection}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 hover:text-rose-600"
                        title="เปลี่ยนไฟล์สลิป"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canCreateRequest || isOptimizingSlip}
                      onClick={() => slipInputRef.current?.click()}
                      className="mt-2 flex w-full select-none flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition hover:border-[#2F7D5B]/50 hover:bg-emerald-50/30 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <FileUp className="text-[#2F7D5B]" size={22} aria-hidden="true" />
                      <span className="mt-2 text-xs font-black text-slate-700">
                        {isOptimizingSlip ? 'กำลังแปลงภาพเป็น WebP และย่อขนาด...' : 'คลิกเพื่ออัปโหลดภาพสลิปหรือ PDF'}
                      </span>
                      <span className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        ระบบแปลงรูปเป็น .webp และย่อขนาดอัตโนมัติโดยคงความคมชัด (รองรับ JPG, PNG, WebP, PDF)
                      </span>
                    </button>
                  )}
                </div>

                {/* Optional Note */}
                <label className="mt-3.5 block text-xs font-black text-slate-700">
                  หมายเหตุเพิ่มเติม (ไม่บังคับ)
                  <input
                    className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                    disabled={!canCreateRequest}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="เช่น ชื่อผู้โอน หรือเวลาโอนเงิน"
                    type="text"
                    value={reviewNote}
                  />
                </label>

                <button
                  className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSubmitting || isOptimizingSlip || isLoading || !canCreateRequest || !slipFile}
                  type="submit"
                >
                  <CreditCard size={16} aria-hidden="true" />
                  {isSubmitting
                    ? 'กำลังส่งหลักฐานการชำระเงิน...'
                    : `ยืนยันการชำระเงิน (${formatBaht(payableAmount)})`}
                </button>

                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400">
                  <ShieldCheck size={13} className="shrink-0 text-emerald-600" aria-hidden="true" />
                  หลักฐานการโอนเงินถูกเก็บรักษาอย่างปลอดภัยและตรวจสอบโดยเจ้าหน้าที่
                </p>
              </form>

              {/* VIP Code Redemption Card */}
              <form className="nexus-card p-5" onSubmit={handleRedeemVipCode}>
                <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <KeyRound size={15} className="text-amber-600" aria-hidden="true" />
                  เปิดสิทธิ์ด้วยโค้ด VIP
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  หากได้รับรหัสโค้ดจากโครงการหรือผู้ดูแลระบบ สามารถกรอกเพื่อเพิ่มวันใช้งาน VIP ได้ทันที
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    autoCapitalize="characters"
                    className="nexus-field h-10 min-w-0 flex-1 px-3 font-mono text-xs font-black uppercase tracking-wider"
                    disabled={!canCreateRequest || isRedeemingCode}
                    onChange={(event) => setVipCode(event.target.value.toUpperCase())}
                    placeholder="CC360-XXXXXXXXXXXX"
                    value={vipCode}
                  />
                  <button
                    className="dark-action inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black disabled:opacity-45"
                    disabled={!canCreateRequest || isRedeemingCode || !vipCode.trim()}
                    type="submit"
                  >
                    <KeyRound size={14} aria-hidden="true" />
                    {isRedeemingCode ? 'กำลังตรวจ...' : 'ใช้โค้ด'}
                  </button>
                </div>
                {codeNotice ? (
                  <div
                    className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                      codeNotice.tone === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {codeNotice.tone === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{codeNotice.text}</span>
                  </div>
                ) : null}
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
