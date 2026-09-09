import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { NexusAuroraVisual } from './NexusAuroraLoader';
import { translateDatabaseError } from '../../lib/errorTranslator';

type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackDetail {
  label: string;
  value: string;
}

interface FeedbackInput {
  title: string;
  message?: string;
  details?: FeedbackDetail[];
  tone?: FeedbackTone;
  duration?: number;
}

interface FeedbackItem extends FeedbackInput {
  id: number;
  tone: FeedbackTone;
}

interface OperationInput {
  title: string;
  message?: string;
}

interface OperationItem extends OperationInput {
  id: number;
  startedAt: number;
}

interface SystemFeedbackValue {
  beginOperation: (input: OperationInput) => number;
  endOperation: (id: number) => void;
  notify: (input: FeedbackInput) => number;
  success: (input: Omit<FeedbackInput, 'tone'>) => number;
  error: (input: Omit<FeedbackInput, 'tone'>) => number;
  warning: (input: Omit<FeedbackInput, 'tone'>) => number;
}

interface NetworkFeedbackDetail {
  action: string;
  context?: FeedbackDetail[];
  duration?: number;
  id: number;
  method: string;
  ok?: boolean;
  status?: number;
  statusText?: string;
}

const SystemFeedbackContext = createContext<SystemFeedbackValue | null>(null);
const networkOperationMap = new Map<number, number>();
let isNetworkFeedbackInstalled = false;

function getActionLabel(target: EventTarget | null) {
  if (!(target instanceof Element)) return 'บันทึกการเปลี่ยนแปลง';
  const control = target.closest<HTMLElement>('button, [role="button"], input[type="submit"]');
  if (!control || control.closest('.system-toast, .system-loading-overlay')) return 'บันทึกการเปลี่ยนแปลง';
  const label = control.getAttribute('aria-label')
    || control.getAttribute('title')
    || control.textContent
    || (control instanceof HTMLInputElement ? control.value : '');
  return label.replace(/\s+/g, ' ').trim().slice(0, 90) || 'บันทึกการเปลี่ยนแปลง';
}

function getActionContext(target: EventTarget | null): FeedbackDetail[] {
  if (!(target instanceof Element)) return [];
  const form = target.closest('form');
  if (!form) return [];
  const details: FeedbackDetail[] = [];
  const controls = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="password"]):not([type="file"]), select, textarea',
  );
  const sensitiveName = /(password|token|secret|citizen|identity|phone|email|address|รหัสผ่าน|อีเมล|โทร|เลขประจำตัว|เลขประชาชน|ที่อยู่)/i;

  controls.forEach((control) => {
    if (details.length >= 4 || !control.value.trim() || sensitiveName.test(control.name || control.id)) return;
    const label = control.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim()
      || control.getAttribute('aria-label')
      || control.name;
    if (!label || label.length > 55 || sensitiveName.test(label)) return;
    const value = control instanceof HTMLSelectElement
      ? control.selectedOptions[0]?.textContent?.trim() || control.value
      : control.value.trim();
    if (value.length <= 80) details.push({ label, value });
  });
  return details;
}

export function installSystemNetworkFeedback() {
  if (isNetworkFeedbackInstalled || typeof window === 'undefined') return;
  isNetworkFeedbackInstalled = true;

  let lastAction = 'บันทึกการเปลี่ยนแปลง';
  let lastContext: FeedbackDetail[] = [];
  let lastActionAt = 0;
  let lastActionIsMutationIntent = false;
  let requestId = 0;
  const originalFetch = window.fetch.bind(window);

  document.addEventListener('click', (event) => {
    const control = event.target instanceof Element
      ? event.target.closest('button, input[type="submit"], [role="button"]')
      : null;
    const isWidget = Boolean(event.target instanceof Element && event.target.closest('.support-widget, .support-chat, .ai-chat'));
    lastActionIsMutationIntent = Boolean(control) && !isWidget;
    lastAction = getActionLabel(event.target);
    lastContext = getActionContext(event.target);
    lastActionAt = Date.now();
  }, true);
  document.addEventListener('submit', (event) => {
    const isWidget = Boolean(event.target instanceof Element && event.target.closest('.support-widget, .support-chat, .ai-chat'));
    lastActionIsMutationIntent = !isWidget;
    lastAction = getActionLabel(event.submitter);
    lastContext = getActionContext(event.submitter);
    lastActionAt = Date.now();
  }, true);

  window.fetch = async (input, init) => {
    const method = (
      init?.method
      || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    const isAiApi = url.includes('generativelanguage.googleapis.com') || url.includes('/v1beta/models');
    const isSilent = Boolean(
      init?.headers && (
        (init.headers instanceof Headers && init.headers.get('x-silent') === 'true') ||
        (typeof init.headers === 'object' && !Array.isArray(init.headers) && (
          (init.headers as Record<string, string>)['x-silent'] === 'true' ||
          (init.headers as Record<string, string>)['X-Silent'] === 'true'
        ))
      )
    );

    // Supabase read-only RPC calls also use POST. Show global feedback only
    // when the request follows an explicit click or form submission, and exclude AI chat API.
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method)
      && lastActionIsMutationIntent
      && !isAiApi
      && !isSilent
      && Date.now() - lastActionAt < 2500;
    const id = ++requestId;
    const action = Date.now() - lastActionAt < 2500 ? lastAction : 'บันทึกการเปลี่ยนแปลง';
    const context = Date.now() - lastActionAt < 2500 ? lastContext : [];
    const startedAt = Date.now();

    if (isMutation) {
      window.dispatchEvent(new CustomEvent<NetworkFeedbackDetail>('classcare:network-start', {
        detail: { action, context, id, method },
      }));
    }

    try {
      const response = await originalFetch(input, init);
      if (isMutation) {
        let statusText = response.statusText;
        if (!response.ok) {
          try {
            const clone = response.clone();
            const json = await clone.json();
            const raw = json?.message || json?.error_description || json?.details || json?.hint || response.statusText;
            statusText = translateDatabaseError(raw);
          } catch {
            statusText = translateDatabaseError(response.statusText);
          }
        }
        window.dispatchEvent(new CustomEvent<NetworkFeedbackDetail>('classcare:network-end', {
          detail: {
            action,
            context,
            duration: Date.now() - startedAt,
            id,
            method,
            ok: response.ok,
            status: response.status,
            statusText,
          },
        }));
      }
      return response;
    } catch (error) {
      if (isMutation) {
        const errorMsg = error instanceof Error ? error.message : 'Network error';
        window.dispatchEvent(new CustomEvent<NetworkFeedbackDetail>('classcare:network-end', {
          detail: {
            action,
            context,
            duration: Date.now() - startedAt,
            id,
            method,
            ok: false,
            statusText: translateDatabaseError(errorMsg),
          },
        }));
      }
      throw error;
    }
  };
}


const toneConfig = {
  success: {
    icon: CheckCircle2,
    badgeText: 'สำเร็จ',
    badgeClass: 'badge-success',
  },
  error: {
    icon: CircleAlert,
    badgeText: 'ข้อผิดพลาด',
    badgeClass: 'badge-error',
  },
  warning: {
    icon: AlertTriangle,
    badgeText: 'คำเตือน',
    badgeClass: 'badge-warning',
  },
  info: {
    icon: Info,
    badgeText: 'ข้อมูลระบบ',
    badgeClass: 'badge-info',
  },
};

const ATTENDANCE_KEYS = new Set(['มา', 'ขาด', 'สาย', 'ลา', 'ป่วย', 'กิจกรรม']);
const META_KEYS = new Set(['วันที่', 'ห้องเรียน', 'ช่วงเวลา', 'วัน/เวลา', 'เวลา', 'ภาคเรียน', 'ปีการศึกษา']);

const ATTENDANCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; text: string }> = {
  'มา': {
    label: 'มาเรียน',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
    text: '#34d399',
  },
  'ขาด': {
    label: 'ขาดเรียน',
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.28)',
    text: '#fb7185',
  },
  'สาย': {
    label: 'มาสาย',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.28)',
    text: '#fbbf24',
  },
  'ลา': {
    label: 'ลากิจ',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.28)',
    text: '#7dd3fc',
  },
  'ป่วย': {
    label: 'ลาป่วย',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.28)',
    text: '#c4b5fd',
  },
  'กิจกรรม': {
    label: 'กิจกรรม',
    color: '#2dd4bf',
    bg: 'rgba(45, 212, 191, 0.12)',
    border: 'rgba(45, 212, 191, 0.28)',
    text: '#5eead4',
  },
};

const Toast = memo(function Toast({
  item,
  onDismiss,
  onPause,
  onResume,
}: {
  item: FeedbackItem;
  onDismiss: (id: number) => void;
  onPause?: () => void;
  onResume?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = toneConfig[item.tone] || toneConfig.info;
  const Icon = config.icon;
  const duration = item.duration ?? (item.tone === 'error' ? 9000 : 6500);

  // Categorize details if available
  const metaDetails: FeedbackDetail[] = [];
  const attendanceDetails: FeedbackDetail[] = [];
  const generalDetails: FeedbackDetail[] = [];

  let statusDetail: FeedbackDetail | null = null;
  let durationDetail: FeedbackDetail | null = null;
  let codeDetail: FeedbackDetail | null = null;

  item.details?.forEach((detail) => {
    if (ATTENDANCE_KEYS.has(detail.label)) {
      attendanceDetails.push(detail);
    } else if (META_KEYS.has(detail.label)) {
      metaDetails.push(detail);
    } else if (detail.label === 'สถานะ') {
      statusDetail = detail;
    } else if (detail.label === 'ระยะเวลา') {
      durationDetail = detail;
    } else if (detail.label === 'รหัสตอบกลับ' || detail.label === 'HTTP Status') {
      codeDetail = detail;
    } else if (
      detail.label === 'รายการ' &&
      (detail.value === item.message || detail.value === item.title)
    ) {
      // Omit redundant duplicate action text that clutters the UI
    } else {
      generalDetails.push(detail);
    }
  });

  const hasAttendance = attendanceDetails.length > 0;
  const hasMeta = metaDetails.length > 0;
  const hasStatusPills = Boolean(statusDetail || durationDetail || codeDetail);
  const hasGeneral = generalDetails.length > 0;
  const hasAnyDetails = hasAttendance || hasMeta || hasStatusPills || hasGeneral;

  return (
    <article
      className={`system-toast is-${item.tone} group`}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      role={item.tone === 'error' ? 'alert' : 'status'}
    >
      {/* Specular light highlight */}
      <div className="system-toast-specular" aria-hidden="true" />

      <div className="system-toast-body relative z-10">
        <div className="flex items-start gap-3.5">
          {/* Tone glowing icon jewel */}
          <div className="system-toast-icon-wrap" aria-hidden="true">
            <Icon size={18} strokeWidth={2.4} />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1 pt-0.5">
            {/* Header row: Tone badge with pulsing dot + Time + Close */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`system-toast-badge ${config.badgeClass}`}>
                  <span className="system-toast-badge-dot" />
                  {config.badgeText}
                </span>
                <span className="text-[11px] font-medium text-slate-400/80">เมื่อสักครู่</span>
              </div>
              <button
                aria-label="ปิดการแจ้งเตือน"
                className="system-toast-close"
                onClick={() => onDismiss(item.id)}
                type="button"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Title & Message */}
            <div className="mt-1.5 space-y-0.5">
              <h4 className="system-toast-title">{item.title}</h4>
              {item.message ? (
                <p className="system-toast-message line-clamp-2" title={item.message}>
                  {item.message}
                </p>
              ) : null}
            </div>

            {/* Expandable details button */}
            {hasAnyDetails ? (
              <div className="mt-2.5">
                <button
                  className="system-toast-details-toggle"
                  onClick={() => setIsExpanded((current) => !current)}
                  type="button"
                  aria-expanded={isExpanded}
                >
                  <span>{isExpanded ? 'ย่อรายละเอียด' : 'ดูรายละเอียด'}</span>
                  <ChevronDown
                    className={`system-toast-toggle-icon ${isExpanded ? 'is-open' : ''}`}
                    size={12}
                    aria-hidden="true"
                  />
                </button>

                {/* Structured Details Container */}
                {isExpanded ? (
                  <div className="system-toast-details-box system-toast-details">
                    {/* Executive Status Pills */}
                    {hasStatusPills ? (
                      <div className="system-toast-pill-row">
                        {statusDetail ? (
                          <span className="system-toast-pill is-status">
                            <CheckCircle2 size={11} className="shrink-0" />
                            <span>{(statusDetail as FeedbackDetail).value}</span>
                          </span>
                        ) : null}
                        {durationDetail ? (
                          <span className="system-toast-pill is-timing">
                            <Clock size={11} className="shrink-0" />
                            <span>{(durationDetail as FeedbackDetail).value}</span>
                          </span>
                        ) : null}
                        {codeDetail ? (
                          <span className="system-toast-pill is-code">
                            <ShieldCheck size={11} className="shrink-0" />
                            <span>HTTP {(codeDetail as FeedbackDetail).value}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Meta badges row (Classroom, Date, Period) */}
                    {hasMeta ? (
                      <div className="system-toast-meta-chips">
                        {metaDetails.map((meta) => (
                          <span key={`${meta.label}-${meta.value}`} className="system-toast-meta-chip">
                            <span className="system-toast-meta-chip-label">{meta.label}</span>
                            <span className="system-toast-meta-chip-val">{meta.value}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* Attendance Stat Grid if attendance details exist */}
                    {hasAttendance ? (
                      <div className="system-toast-stat-grid">
                        {attendanceDetails.map((stat) => {
                          const cfg = ATTENDANCE_CONFIG[stat.label];
                          const isZero = stat.value === '0 คน' || stat.value === '0';
                          return (
                            <div
                              key={stat.label}
                              className={`system-toast-stat-card ${isZero ? 'is-zero' : 'is-highlight'}`}
                              style={{
                                '--stat-color': cfg?.color || '#94a3b8',
                                '--stat-bg': cfg?.bg || 'rgba(255, 255, 255, 0.04)',
                                '--stat-border': cfg?.border || 'rgba(255, 255, 255, 0.08)',
                                '--stat-text': cfg?.text || '#e2e8f0',
                              } as React.CSSProperties}
                            >
                              <div className="system-toast-stat-header">
                                <span className="system-toast-stat-dot" />
                                <span className="system-toast-stat-label">{cfg?.label || stat.label}</span>
                              </div>
                              <span className="system-toast-stat-val">{stat.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* General details list (Network, Operation, etc.) */}
                    {hasGeneral ? (
                      <div className="system-toast-general-list">
                        {generalDetails.map((detail) => (
                          <div key={`${detail.label}-${detail.value}`} className="system-toast-general-row">
                            <span className="system-toast-general-label">{detail.label}</span>
                            <span className="system-toast-general-val">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Auto-dismiss animated progress bar */}
      {duration > 0 ? (
        <div className="system-toast-progress-track">
          <div
            className="system-toast-progress-bar"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      ) : null}
    </article>
  );
});

export function SystemFeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const operationsRef = useRef<OperationItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());
  const recentNotifications = useRef(new Map<string, { id: number; time: number }>());
  operationsRef.current = operations;

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const pauseTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const resumeTimer = useCallback((id: number, delayMs = 3500) => {
    if (timers.current.has(id)) return;
    timers.current.set(id, window.setTimeout(() => dismiss(id), delayMs));
  }, [dismiss]);

  const notify = useCallback((input: FeedbackInput) => {
    const signature = `${input.tone || 'info'}:${input.title}:${input.message || ''}`;
    const recent = recentNotifications.current.get(signature);
    if (recent && Date.now() - recent.time < 900) return recent.id;
    const id = ++nextId.current;
    const tone = input.tone || 'info';
    recentNotifications.current.set(signature, { id, time: Date.now() });
    setItems((current) => [...current.slice(-3), { ...input, id, tone }]);
    const duration = input.duration ?? (tone === 'error' ? 9000 : 6500);
    if (duration > 0) {
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    }
    return id;
  }, [dismiss]);

  const beginOperation = useCallback((input: OperationInput) => {
    const id = ++nextId.current;
    setOperations((current) => [...current, { ...input, id, startedAt: Date.now() }]);
    return id;
  }, []);

  const endOperation = useCallback((id: number) => {
    setOperations((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    const handleError = () => notify({
      title: 'ระบบพบข้อผิดพลาดที่ไม่คาดคิด',
      message: 'งานนี้อาจดำเนินการไม่สมบูรณ์ กรุณาลองใหม่หรือตรวจสอบการเชื่อมต่อ',
      tone: 'error',
    });
    window.addEventListener('unhandledrejection', handleError);
    return () => window.removeEventListener('unhandledrejection', handleError);
  }, [notify]);

  useEffect(() => {
    const handleNetworkStart = (event: Event) => {
      const detail = (event as CustomEvent<NetworkFeedbackDetail>).detail;
      if (operationsRef.current.length > 0) {
        networkOperationMap.set(detail.id, 0);
        return;
      }
      const operationId = beginOperation({
        title: detail.action,
        message: 'ระบบกำลังตรวจสอบและบันทึกการเปลี่ยนแปลง',
      });
      networkOperationMap.set(detail.id, operationId);
    };
    const handleNetworkEnd = (event: Event) => {
      const detail = (event as CustomEvent<NetworkFeedbackDetail>).detail;
      const operationId = networkOperationMap.get(detail.id);
      if (operationId === 0) {
        networkOperationMap.delete(detail.id);
        return;
      }
      if (operationId) endOperation(operationId);
      networkOperationMap.delete(detail.id);

      const details: FeedbackDetail[] = [
        { label: 'รายการ', value: detail.action },
        { label: 'สถานะ', value: detail.ok ? 'บันทึกการเปลี่ยนแปลงแล้ว' : 'ดำเนินการไม่สำเร็จ' },
        { label: 'ระยะเวลา', value: `${Math.max(1, Math.round((detail.duration || 0) / 100) / 10)} วินาที` },
        ...(detail.context || []),
      ];
      if (detail.status) details.push({ label: 'รหัสตอบกลับ', value: String(detail.status) });

      if (detail.ok) {
        notify({
          title: 'บันทึกการเปลี่ยนแปลงสำเร็จ',
          message: detail.action,
          details,
          tone: 'success',
        });
      } else {
        notify({
          title: 'ดำเนินการไม่สำเร็จ',
          message: detail.statusText || 'ระบบไม่ได้รับการตอบกลับที่สมบูรณ์ กรุณาลองอีกครั้ง',
          details,
          tone: 'error',
        });
      }
    };

    window.addEventListener('classcare:network-start', handleNetworkStart);
    window.addEventListener('classcare:network-end', handleNetworkEnd);
    return () => {
      window.removeEventListener('classcare:network-start', handleNetworkStart);
      window.removeEventListener('classcare:network-end', handleNetworkEnd);
    };
  }, [beginOperation, endOperation, notify]);

  const value = useMemo<SystemFeedbackValue>(() => ({
    beginOperation,
    endOperation,
    notify,
    success: (input) => notify({ ...input, tone: 'success' }),
    error: (input) => notify({ ...input, tone: 'error' }),
    warning: (input) => notify({ ...input, tone: 'warning' }),
  }), [beginOperation, endOperation, notify]);

  const activeOperation = operations[operations.length - 1];

  return (
    <SystemFeedbackContext.Provider value={value}>
      {children}
      {activeOperation ? (
        <div aria-live="polite" aria-modal="true" className="system-loading-overlay" role="dialog">
          <NexusAuroraVisual message={activeOperation.message || 'กรุณารอสักครู่ ระบบกำลังตรวจสอบและบันทึกข้อมูลให้ครบถ้วน'} title={activeOperation.title} />
        </div>
      ) : null}
      <aside aria-label="สถานะการทำงานของระบบ" className="system-toast-stack">
        {items.map((item) => (
          <Toast
            item={item}
            key={item.id}
            onDismiss={dismiss}
            onPause={() => pauseTimer(item.id)}
            onResume={() => resumeTimer(item.id)}
          />
        ))}
      </aside>
    </SystemFeedbackContext.Provider>
  );
}

export function useSystemFeedback() {
  const context = useContext(SystemFeedbackContext);
  if (!context) throw new Error('useSystemFeedback must be used inside SystemFeedbackProvider');
  return context;
}
