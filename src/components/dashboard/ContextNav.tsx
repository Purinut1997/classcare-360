import { Link, useLocation } from 'react-router-dom';

import { withDemoContext } from '../../lib/auth';

interface ContextNavProps {
  activeView: string;
}

type ContextNavTab =
  | { kind: 'param'; label: string; param: string; value: string }
  | { kind: 'view'; label: string; targetView: string; aliasViews?: string[] };

const contextNav: Record<string, ContextNavTab[]> = {
  students: [
    { kind: 'param', label: 'รายชื่อ', param: 'studentView', value: 'roster' },
    { kind: 'param', label: 'ตรวจข้อมูล', param: 'studentView', value: 'quality' },
    { kind: 'param', label: 'เยี่ยมบ้าน', param: 'studentView', value: 'home-visit' },
    { kind: 'param', label: 'ข้อมูลรายคน', param: 'studentView', value: 'profile' },
    { kind: 'param', label: 'เคสดูแล', param: 'studentView', value: 'care' },
    { kind: 'param', label: 'หน้าผู้ปกครอง', param: 'studentView', value: 'portal' },
    { kind: 'param', label: 'ประวัติ', param: 'studentView', value: 'timeline' },
  ],
  schedule: [
    { kind: 'param', label: 'ตารางสอน', param: 'scheduleView', value: 'table' },
    { kind: 'param', label: 'ตั้งค่าคาบและวิชา', param: 'scheduleView', value: 'settings' },
  ],
  notifications: [
    { kind: 'view', label: 'กล่องแจ้งเตือน', targetView: 'notifications' },
    { kind: 'view', label: 'ตั้งเวลาเตือนเด็กเสี่ยง', targetView: 'automation' },
  ],
  automation: [
    { kind: 'view', label: 'กล่องแจ้งเตือน', targetView: 'notifications' },
    { kind: 'view', label: 'ตั้งเวลาเตือนเด็กเสี่ยง', targetView: 'automation' },
  ],
  'import-export': [
    { kind: 'view', label: 'นำเข้า / ส่งออก', targetView: 'import-export' },
    { kind: 'view', label: 'สำรองข้อมูล & ถังขยะ', targetView: 'data-safety' },
  ],
  'data-safety': [
    { kind: 'view', label: 'นำเข้า / ส่งออก', targetView: 'import-export' },
    { kind: 'view', label: 'สำรองข้อมูล & ถังขยะ', targetView: 'data-safety' },
  ],
  'workspace-settings': [
    { kind: 'view', label: 'ตั้งค่าโรงเรียน & บัญชี', targetView: 'workspace-settings' },
    { kind: 'view', label: 'ปีการศึกษา & ล็อกงวด', targetView: 'academic-year', aliasViews: ['period-locks'] },
  ],
  'academic-year': [
    { kind: 'view', label: 'ตั้งค่าโรงเรียน & บัญชี', targetView: 'workspace-settings' },
    { kind: 'view', label: 'ปีการศึกษา & ล็อกงวด', targetView: 'academic-year', aliasViews: ['period-locks'] },
  ],
  'period-locks': [
    { kind: 'view', label: 'ตั้งค่าโรงเรียน & บัญชี', targetView: 'workspace-settings' },
    { kind: 'view', label: 'ปีการศึกษา & ล็อกงวด', targetView: 'academic-year', aliasViews: ['period-locks'] },
  ],
  behavior: [
    { kind: 'view', label: 'พฤติกรรม & ดูแลช่วยเหลือ', targetView: 'behavior' },
    { kind: 'view', label: 'คุณลักษณะ 8 ประการ', targetView: 'desirable-characteristics' },
  ],
  'desirable-characteristics': [
    { kind: 'view', label: 'พฤติกรรม & ดูแลช่วยเหลือ', targetView: 'behavior' },
    { kind: 'view', label: 'คุณลักษณะ 8 ประการ', targetView: 'desirable-characteristics' },
  ],
};

const defaults: Record<string, string> = {
  students: 'roster',
  schedule: 'table',
};

export function ContextNav({ activeView }: ContextNavProps) {
  const location = useLocation();
  const items = contextNav[activeView];
  if (!items || items.length === 0) return null;

  const params = new URLSearchParams(location.search);

  return (
    <nav className="app-context-nav no-print print:hidden" aria-label="เมนูย่อย">
      {items.map((item) => {
        if (item.kind === 'view') {
          const isActive =
            activeView === item.targetView || Boolean(item.aliasViews?.includes(activeView));
          return (
            <Link
              className={isActive ? 'is-active' : ''}
              key={item.targetView}
              to={withDemoContext(`/app/dashboard?view=${item.targetView}`, location.search)}
            >
              {item.label}
            </Link>
          );
        }

        const activeValue = params.get(item.param) || defaults[activeView];
        const isActive = activeValue === item.value;
        return (
          <Link
            className={isActive ? 'is-active' : ''}
            key={item.value}
            to={withDemoContext(`/app/dashboard?view=${activeView}&${item.param}=${item.value}`, location.search)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
