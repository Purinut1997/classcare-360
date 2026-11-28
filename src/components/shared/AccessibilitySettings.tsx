import { useEffect, useState } from 'react';

export function AccessibilitySettings({ accountKey }: { accountKey: string }) {
  const [settings, setSettings] = useState({ scale: '100', contrast: false, motion: false });
  const key = `classcare:accessibility:${accountKey}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      setSettings({ scale: ['100', '112', '125'].includes(saved.scale) ? saved.scale : '100', contrast: saved.contrast === true, motion: saved.motion === true });
    } catch { setSettings({ scale: '100', contrast: false, motion: false }); }
  }, [key]);
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.scale}%`;
    document.documentElement.dataset.ccContrast = String(settings.contrast);
    document.documentElement.dataset.ccReducedMotion = String(settings.motion);
    return () => { document.documentElement.style.fontSize = ''; delete document.documentElement.dataset.ccContrast; delete document.documentElement.dataset.ccReducedMotion; };
  }, [settings]);
  function update(next: typeof settings) {
    setSettings(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Preferences remain available for this session. */ }
  }
  return <details className="no-print mx-4 my-2 rounded-xl border border-slate-200 bg-white text-sm sm:mx-6">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-slate-700">ปรับการอ่านและการใช้งาน</summary>
    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 p-4">
      <label className="flex items-center gap-2">ขนาดตัวอักษร<select aria-label="ขนาดตัวอักษร" className="min-h-11 rounded-lg border border-slate-300 px-3" value={settings.scale} onChange={(event) => update({ ...settings, scale: event.target.value })}><option value="100">ปกติ</option><option value="112">ใหญ่</option><option value="125">ใหญ่มาก</option></select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={settings.contrast} onChange={(event) => update({ ...settings, contrast: event.target.checked })} />เพิ่มความชัดของข้อความ</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={settings.motion} onChange={(event) => update({ ...settings, motion: event.target.checked })} />ลดภาพเคลื่อนไหว</label>
    </div>
  </details>;
}
