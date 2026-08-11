import { AppLogo } from '../brand/AppLogo';

interface NexusAuroraLoaderProps {
  message?: string;
  title: string;
  variant?: 'page' | 'panel';
}

export function NexusAuroraVisual({ message, title }: Omit<NexusAuroraLoaderProps, 'variant'>) {
  return (
    <div className="system-loading-card">
      <div aria-hidden="true" className="system-loading-aurora system-loading-aurora-one" />
      <div aria-hidden="true" className="system-loading-aurora system-loading-aurora-two" />
      <div className="system-loading-logo">
        <span className="system-loading-orbit" />
        <span className="system-loading-orbit-dot" />
        <AppLogo className="h-16 w-16 rounded-2xl bg-white p-1.5 shadow-xl" />
      </div>
      <div className="system-loading-content">
        <p className="system-loading-eyebrow">CLASSCARE 360 กำลังดำเนินการ</p>
        <h2>{title}</h2>
        <p>{message || 'กรุณารอสักครู่ ระบบกำลังตรวจสอบและเตรียมข้อมูลให้ครบถ้วน'}</p>
        <div aria-label="ความคืบหน้าการดำเนินการ" className="system-loading-steps">
          <span className="is-active"><i />ตรวจสอบข้อมูล</span>
          <span><i />เตรียมรายการ</span>
          <span><i />พร้อมใช้งาน</span>
        </div>
        <div className="system-loading-progress"><span /></div>
        <small>ระบบจะดำเนินการต่อโดยอัตโนมัติ</small>
      </div>
    </div>
  );
}

export function NexusAuroraLoader({ message, title, variant = 'panel' }: NexusAuroraLoaderProps) {
  if (variant === 'page') {
    return <main className="route-loading-screen"><NexusAuroraVisual message={message} title={title} /></main>;
  }
  return (
    <div aria-live="polite" className="nexus-aurora-panel-loader" role="status">
      <span aria-hidden="true" className="nexus-aurora-mini-orbit"><i /></span>
      <span className="min-w-0">
        <strong>{title}</strong>
        {message ? <small>{message}</small> : null}
      </span>
      <span aria-hidden="true" className="nexus-aurora-dots"><i /><i /><i /></span>
    </div>
  );
}

export function NexusAuroraInline({ label = 'กำลังโหลด' }: { label?: string }) {
  return <span aria-live="polite" className="nexus-aurora-inline" role="status"><i aria-hidden="true" />{label}</span>;
}
