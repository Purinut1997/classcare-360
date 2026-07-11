import { CheckCircle2, ShieldCheck } from 'lucide-react';

interface GuardPreviewItem {
  label: string;
  passed: boolean;
}

interface SecurityPanelProps {
  activeLabel: string;
  entitlementLabel: string;
  guardPreview: GuardPreviewItem[];
  isModuleEnabled: boolean;
}

export function SecurityPanel({
  activeLabel,
  entitlementLabel,
  guardPreview,
  isModuleEnabled,
}: SecurityPanelProps) {
  return (
    <article className="glass-panel rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)]">
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-sky-700">Security First</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">ทุก action ต้องผ่าน guard</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {guardPreview.map((guard) => (
          <div
            className="flex items-center gap-3 rounded-2xl bg-white/75 p-3 text-sm font-black text-slate-700 ring-1 ring-slate-200/80"
            key={guard.label}
          >
            <CheckCircle2
              className={guard.passed ? 'text-teal-600' : 'text-amber-500'}
              size={18}
              aria-hidden="true"
            />
            {guard.label}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-3xl bg-gradient-to-r from-sky-50 to-cyan-50 p-4 text-sm font-black text-sky-900 ring-1 ring-sky-100">
        {isModuleEnabled
          ? `${activeLabel} เปิดใช้งานได้ด้วย ${entitlementLabel}`
          : `${activeLabel} ต้องอัปเกรดแพ็กเกจก่อนใช้งาน`}
      </div>
    </article>
  );
}
