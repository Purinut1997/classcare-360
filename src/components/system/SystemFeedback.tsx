/* eslint-disable react-refresh/only-export-components */
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Info,
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

import { AppLogo } from '../brand/AppLogo';

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
  let requestId = 0;
  const originalFetch = window.fetch.bind(window);

  document.addEventListener('click', (event) => {
    lastAction = getActionLabel(event.target);
    lastContext = getActionContext(event.target);
    lastActionAt = Date.now();
  }, true);
  document.addEventListener('submit', (event) => {
    lastAction = getActionLabel(event.submitter);
    lastContext = getActionContext(event.submitter);
    lastActionAt = Date.now();
  }, true);

  window.fetch = async (input, init) => {
    const method = (
      init?.method
      || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
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
        window.dispatchEvent(new CustomEvent<NetworkFeedbackDetail>('classcare:network-end', {
          detail: {
            action,
            context,
            duration: Date.now() - startedAt,
            id,
            method,
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
          },
        }));
      }
      return response;
    } catch (error) {
      if (isMutation) {
        window.dispatchEvent(new CustomEvent<NetworkFeedbackDetail>('classcare:network-end', {
          detail: {
            action,
            context,
            duration: Date.now() - startedAt,
            id,
            method,
            ok: false,
            statusText: error instanceof Error ? error.message : 'Network error',
          },
        }));
      }
      throw error;
    }
  };
}


const toneIcons = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
};

const Toast = memo(function Toast({
  item,
  onDismiss,
}: {
  item: FeedbackItem;
  onDismiss: (id: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(item.tone === 'error' || (item.details?.length || 0) >= 4);
  const Icon = toneIcons[item.tone];

  return (
    <article className={`system-toast is-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
      <div className="system-toast-icon">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="system-toast-title">{item.title}</p>
            {item.message ? <p className="system-toast-message">{item.message}</p> : null}
          </div>
          <button
            aria-label="ปิดการแจ้งเตือน"
            className="system-toast-close"
            onClick={() => onDismiss(item.id)}
            type="button"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {item.details?.length ? (
          <>
            <button
              className="system-toast-details-toggle"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
            >
              {isExpanded ? 'ซ่อนรายละเอียด' : `ดูรายละเอียด ${item.details.length} รายการ`}
              <ChevronDown className={isExpanded ? 'rotate-180' : ''} size={14} aria-hidden="true" />
            </button>
            {isExpanded ? (
              <dl className="system-toast-details">
                {item.details.map((detail) => (
                  <div key={`${detail.label}-${detail.value}`}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        ) : null}
      </div>
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
          <div className="system-loading-card">
            <div className="system-loading-logo">
              <span className="system-loading-orbit" />
              <AppLogo className="h-16 w-16 rounded-2xl bg-white p-1.5 shadow-xl" />
            </div>
            <p className="system-loading-eyebrow">CLASSCARE 360 กำลังดำเนินการ</p>
            <h2>{activeOperation.title}</h2>
            <p>{activeOperation.message || 'กรุณารอสักครู่ ระบบกำลังตรวจสอบและบันทึกข้อมูลให้ครบถ้วน'}</p>
            <div className="system-loading-progress"><span /></div>
            <small>อย่าปิดหน้านี้ระหว่างที่ระบบกำลังทำงาน</small>
          </div>
        </div>
      ) : null}
      <aside aria-label="สถานะการทำงานของระบบ" className="system-toast-stack">
        {items.map((item) => <Toast item={item} key={item.id} onDismiss={dismiss} />)}
      </aside>
    </SystemFeedbackContext.Provider>
  );
}

export function useSystemFeedback() {
  const context = useContext(SystemFeedbackContext);
  if (!context) throw new Error('useSystemFeedback must be used inside SystemFeedbackProvider');
  return context;
}
