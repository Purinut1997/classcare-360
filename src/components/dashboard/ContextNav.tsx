import { Link, useLocation } from 'react-router-dom';

import { withDemoContext } from '../../lib/auth';

interface ContextNavProps {
  activeView: string;
}

const contextNav: Record<string, Array<{ label: string; param: string; value: string }>> = {
  students: [
    { label: 'รายชื่อ', param: 'studentView', value: 'roster' },
    { label: 'คุณภาพข้อมูล', param: 'studentView', value: 'quality' },
    { label: 'เยี่ยมบ้าน', param: 'studentView', value: 'home-visit' },
    { label: 'โปรไฟล์', param: 'studentView', value: 'profile' },
    { label: 'เคสดูแล', param: 'studentView', value: 'care' },
    { label: 'Portal', param: 'studentView', value: 'portal' },
    { label: 'ประวัติ', param: 'studentView', value: 'timeline' },
  ],
  schedule: [
    { label: 'ตารางสอน', param: 'scheduleView', value: 'table' },
    { label: 'ตั้งค่าคาบและวิชา', param: 'scheduleView', value: 'settings' },
  ],
  scores: [
    { label: 'ตาราง Excel', param: 'scoreView', value: 'excel' },
    { label: 'กรอกคะแนน', param: 'scoreView', value: 'entry' },
    { label: 'สมุดรวม & ตัดเกรด', param: 'scoreView', value: 'gradebook' },
    { label: 'สร้างชุดคะแนน', param: 'scoreView', value: 'setup' },
    { label: 'ภาพรวม', param: 'scoreView', value: 'overview' },
  ],
};

const defaults: Record<string, string> = {
  students: 'roster',
  schedule: 'table',
  scores: 'excel',
};

export function ContextNav({ activeView }: ContextNavProps) {
  const location = useLocation();
  const items = contextNav[activeView];
  if (!items) return null;

  const params = new URLSearchParams(location.search);
  const activeValue = params.get(items[0].param) || defaults[activeView];

  return (
    <nav className="app-context-nav no-print print:hidden" aria-label="เมนูย่อย">
      {items.map((item) => (
        <Link
          className={activeValue === item.value ? 'is-active' : ''}
          key={item.value}
          to={withDemoContext(`/app/dashboard?view=${activeView}&${item.param}=${item.value}`, location.search)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
