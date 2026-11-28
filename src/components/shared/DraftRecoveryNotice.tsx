interface Props {
  draft: { pending: { updatedAt: number } | null; savedAt: number | null; error: boolean; recover: () => void; clear: () => void };
}
export function DraftRecoveryNotice({ draft }: Props) {
  if (!draft.pending && !draft.savedAt && !draft.error) return null;
  return <aside className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800" aria-live="polite">
    <div><p className="font-bold">{draft.error ? 'ยังเก็บร่างในเครื่องไม่ได้ กรุณาบันทึกงานก่อนปิดหน้า' : draft.pending ? 'พบงานที่ยังไม่ได้บันทึก ต้องการทำต่อหรือไม่?' : 'เก็บร่างในเครื่องนี้แล้ว'}</p><p className="mt-1 text-xs">{draft.pending ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draft.pending.updatedAt)) + ' · ' : ''}ร่างเก็บ 7 วัน แยกตามบัญชีและโรงเรียน ต้องกดบันทึกเพื่อส่งเข้าระบบ</p></div>
    {draft.pending && <div className="flex gap-2"><button type="button" onClick={draft.recover} className="min-h-11 rounded-xl bg-sky-800 px-4 font-bold text-white">กู้คืนงานค้าง</button><button type="button" onClick={draft.clear} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">ใช้ข้อมูลปัจจุบัน</button></div>}
  </aside>;
}
