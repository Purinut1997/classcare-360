import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, FileUp, ShieldCheck, Sparkles } from 'lucide-react';

import { planLabels } from '../../lib/entitlements';
import { canManageWorkspace } from '../../lib/roles';
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
  account_hint: 'ตั้งค่าโดย Superadmin เท่านั้น',
  account_name: 'ClassCare 360',
  bank_name: 'Demo Bank',
  display_name: 'QR ชำระเงินตัวอย่าง',
  id: 'demo-qr',
};

const requestStatusLabels: Record<PaymentRequestRow['status'], string> = {
  approved: 'อนุมัติแล้ว',
  cancelled: 'ยกเลิก',
  draft: 'แบบร่าง',
  expired: 'หมดอายุ',
  pending_review: 'รอตรวจสลิป',
  refunded: 'คืนเงินแล้ว',
  rejected: 'ไม่อนุมัติ',
};

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
  const [plan, setPlan] = useState<PlanRow>(demoPlan);
  const [paymentQr, setPaymentQr] = useState<PaymentQrRow | null>(demoQr);
  const [credits, setCredits] = useState<ReferralCreditRow[]>([]);
  const [requests, setRequests] = useState<PaymentRequestRow[]>([]);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อสร้าง payment request จริง',
  );

  const availableCredit = useMemo(
    () => credits.filter((credit) => credit.status === 'available').reduce((sum, credit) => sum + credit.amount_thb, 0),
    [credits],
  );
  const creditAmount = Math.min(Math.max(availableCredit, 0), plan.price_thb);
  const payableAmount = Math.max(plan.price_thb - creditAmount, 0);
  const canCreateRequest = canManageWorkspace(session.profile.role);

  useEffect(() => {
    let isMounted = true;

    async function loadPackageData() {
      if (!supabase || !session.workspace) {
        setPlan(demoPlan);
        setPaymentQr(demoQr);
        setQrImageUrl(null);
        setCredits([{ amount_thb: 20, id: 'demo-credit', status: 'available' }]);
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
          .single(),
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
        setNotice(planError?.message || qrError?.message || creditError?.message || requestError?.message || 'โหลดข้อมูลแพ็กเกจไม่สำเร็จ');
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
  }, [session.profile.id, session.workspace]);

  async function uploadSlipAndCreateFileRecord(file: File) {
    if (!supabase || !session.workspace) return null;

    const bucket = 'payment-slips';
    const storagePath = getStoragePath(session.workspace.id, session.profile.id, file);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: fileRow, error: fileError } = await supabase
      .from('app_files')
      .insert({
        workspace_id: session.workspace.id,
        bucket,
        storage_path: storagePath,
        original_filename: file.name,
        content_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        privacy_level: 'sensitive',
        owner_profile_id: session.profile.id,
        metadata: {
          purpose: 'payment_slip',
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
      setNotice('เฉพาะครูเจ้าของ workspace เท่านั้นที่สร้างคำขอชำระเงินได้');
      setIsSubmitting(false);
      return;
    }

    if (!paymentQr) {
      setNotice('ยังไม่มี QR ชำระเงินที่ active โปรดให้ Superadmin ตั้งค่า Payment QR ก่อน');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const localRequest: PaymentRequestRow = {
        base_amount_thb: plan.price_thb,
        created_at: new Date().toISOString(),
        credit_amount_thb: creditAmount,
        id: `demo-payment-${Date.now()}`,
        payable_amount_thb: payableAmount,
        status: slipFile ? 'pending_review' : 'draft',
      };
      setRequests((current) => [localRequest, ...current]);
      setNotice(slipFile ? 'สร้างคำขอและแนบสลิปในโหมดตัวอย่างแล้ว' : 'สร้างแบบร่างในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    try {
      const slipFileId = slipFile ? await uploadSlipAndCreateFileRecord(slipFile) : null;
      const { data, error } = await supabase
        .from('payment_requests')
        .insert({
          workspace_id: session.workspace.id,
          profile_id: session.profile.id,
          plan_id: plan.id,
          qr_code_id: paymentQr.id,
          status: slipFileId ? 'pending_review' : 'draft',
          base_amount_thb: plan.price_thb,
          credit_amount_thb: creditAmount,
          payable_amount_thb: payableAmount,
          slip_file_id: slipFileId,
          submitted_at: slipFileId ? new Date().toISOString() : null,
          review_note: reviewNote.trim() || null,
        })
        .select('id,status,base_amount_thb,credit_amount_thb,payable_amount_thb,created_at')
        .single();

      if (error) throw error;

      setRequests((current) => [data as PaymentRequestRow, ...current]);
      setSlipFile(null);
      setReviewNote('');
      setNotice(slipFileId ? 'ส่งคำขอตรวจสลิปสำเร็จ รอ Superadmin อนุมัติ' : 'สร้างแบบร่างคำขอชำระเงินสำเร็จ');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'สร้างคำขอชำระเงินไม่สำเร็จ');
    }

    setIsSubmitting(false);
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-50/90 px-4 text-xs font-black text-amber-700 ring-1 ring-amber-100">
            <Sparkles size={18} aria-hidden="true" />
            Package
          </div>
          <h1 className="app-page-title">
            อัปเกรดเป็น ClassCare 360 VIP
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            ใช้คำว่า VIP เฉพาะบริบทแพ็กเกจพรีเมียมเท่านั้น และทุกสลิปต้องเก็บเป็นไฟล์ private/sensitive ไม่ใช่ base64
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[520px]">
          {[
            { label: 'ราคา', value: formatBaht(plan.price_thb) },
            { label: 'เครดิต', value: formatBaht(creditAmount) },
            { label: 'ชำระจริง', value: formatBaht(payableAmount) },
          ].map((item) => (
            <div className="nexus-card p-3 text-center transition hover:-translate-y-1" key={item.label}>
              <p className="text-lg font-black text-slate-950 sm:text-xl">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="nexus-card overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-amber-700">{planLabels.VIP_YEARLY}</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{plan.name}</h2>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-600">
                เปิดใช้โมดูลหลักทั้งหมด เช่น Student 360, Attendance, Reports, Import/Export, Backup, Parent Portal และฟีเจอร์พรีเมียมอื่นตาม Prompt
              </p>
            </div>
            <div className="rounded-[24px] bg-slate-950 p-4 text-white shadow-[0_18px_42px_rgba(2,6,23,0.22)] lg:min-w-[260px]">
              <p className="text-xs font-black text-amber-200">ระยะเวลา</p>
              <p className="mt-1 text-3xl font-black">{plan.duration_days || 365} วัน</p>
              <p className="mt-3 text-xs font-bold leading-5 text-slate-300">การอนุมัติจริงต้องทำผ่าน Superadmin/Edge Function</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              'ไม่ hard-code QR ใน frontend',
              'สลิปเก็บใน private bucket',
              'อนุมัติสิทธิ์ผ่าน backend เท่านั้น',
            ].map((item) => (
              <div className="flex gap-2 rounded-2xl bg-cyan-50/90 p-3 text-sm font-black text-cyan-800 ring-1 ring-cyan-100" key={item}>
                <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <form className="nexus-card p-4 sm:p-5" onSubmit={handleCreatePaymentRequest}>
          <div className="nexus-kicker">
            <CreditCard size={16} aria-hidden="true" />
            คำขอชำระเงิน
          </div>

          <div className="nexus-muted-box mt-4 p-3">
            <p className="text-sm font-black text-slate-700">QR ชำระเงินที่ active</p>
            {paymentQr ? (
              <div className="mt-2 text-sm font-bold leading-6 text-slate-600">
                {qrImageUrl ? (
                  <div className="mb-3 overflow-hidden rounded-3xl border border-slate-100 bg-white p-3 shadow-sm">
                    <img
                      alt={paymentQr.display_name}
                      className="mx-auto aspect-square max-h-64 w-full max-w-64 rounded-2xl object-contain"
                      src={qrImageUrl}
                    />
                  </div>
                ) : null}
                <p>{paymentQr.display_name}</p>
                <p>{paymentQr.bank_name || 'ไม่ระบุธนาคาร'} | {paymentQr.account_name || 'ไม่ระบุชื่อบัญชี'}</p>
                <p className="text-xs text-slate-500">{paymentQr.account_hint || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm font-bold leading-6 text-rose-700">
                ยังไม่มี Payment QR ที่ active
              </p>
            )}
          </div>

          <label className="mt-4 grid gap-2 text-sm font-black text-slate-700">
            แนบสลิป
            <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-sky-200 bg-white/80 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
              <FileUp className="text-teal-600" size={24} aria-hidden="true" />
              <span className="mt-2 text-xs font-bold text-slate-500">
                {slipFile ? `${slipFile.name} (${Math.ceil(slipFile.size / 1024)} KB)` : 'เลือกไฟล์ภาพ/PDF สลิป'}
              </span>
              <input
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(event) => setSlipFile(event.target.files?.[0] || null)}
                type="file"
              />
            </span>
          </label>

          <label className="mt-4 grid gap-2 text-sm font-black text-slate-700">
            หมายเหตุถึงผู้ตรวจ
            <textarea
              className="nexus-field min-h-20 px-3 py-2"
              onChange={(event) => setReviewNote(event.target.value)}
              value={reviewNote}
            />
          </label>

          <button
            className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting || isLoading || !canCreateRequest}
            type="submit"
          >
            {isSubmitting ? 'กำลังสร้างคำขอ' : slipFile ? 'ส่งคำขอตรวจสลิป' : 'สร้างแบบร่าง'}
            <CreditCard size={17} aria-hidden="true" />
          </button>

          {!canCreateRequest ? (
            <p className="mt-3 text-xs font-bold leading-5 text-rose-700">
              เฉพาะครูเจ้าของ workspace เท่านั้นที่สร้างคำขอชำระเงินได้
            </p>
          ) : null}
        </form>
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-teal-700">Payment Requests</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">ประวัติคำขอ</h2>
            </div>
            <ShieldCheck className="text-teal-600" size={28} aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-3">
            {requests.map((request) => (
              <div className="nexus-muted-box p-3" key={request.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-slate-950">{requestStatusLabels[request.status]}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{new Date(request.created_at).toLocaleString('th-TH')}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-black text-slate-950">{formatBaht(request.payable_amount_thb)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">เครดิต {formatBaht(request.credit_amount_thb)}</p>
                  </div>
                </div>
              </div>
            ))}

            {requests.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ยังไม่มีคำขอชำระเงินใน workspace นี้
              </div>
            ) : null}
          </div>
        </div>

        <div className="nexus-card p-4 sm:p-5">
          <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
            <ShieldCheck size={16} className="text-teal-600" aria-hidden="true" />
            Security checklist
          </div>
          <ul className="mt-4 grid gap-3 text-sm font-bold leading-6 text-slate-600">
            <li>สลิปต้องอัปโหลดเป็นไฟล์ใน bucket `payment-slips`</li>
            <li>ตาราง `app_files` เก็บ metadata เท่านั้น ไม่เก็บ base64</li>
            <li>สถานะ `approved` ต้องให้ Superadmin หรือ Edge Function เปลี่ยนเท่านั้น</li>
            <li>QR ที่แสดงมาจาก `payment_qr_codes` ไม่ hard-code ใน frontend</li>
          </ul>
        </div>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
