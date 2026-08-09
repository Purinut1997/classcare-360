import { Link, useLocation } from 'react-router-dom';

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
    { label: 'ภาพรวม', param: 'scoreView', value: 'overview' },
    { label: 'สร้างชุดคะแนน', param: 'scoreView', value: 'setup' },
    { label: 'กรอกคะแนน', param: 'scoreView', value: 'entry' },
    { label: 'สมุดรวม', param: 'scoreView', value: 'gradebook' },
  ],
  reports: [
    { label: 'เวลาเรียน', param: 'reportView', value: 'attendance' },
    { label: 'รายวิชา', param: 'reportView', value: 'subject-attendance' },
    { label: 'เงินออม', param: 'reportView', value: 'savings' },
    { label: 'คะแนนห้อง', param: 'reportView', value: 'scores' },
    { label: 'สุขภาพ', param: 'reportView', value: 'health' },
    { label: 'ทะเบียน', param: 'reportView', value: 'student-register' },
    { label: 'ผู้บริหาร', param: 'reportView', value: 'executive' },
    { label: 'รายบุคคล', param: 'reportView', value: 'individual' },
    { label: 'พฤติกรรม', param: 'reportView', value: 'behavior' },
    { label: 'ตั้งค่ารายงาน', param: 'reportView', value: 'settings' },
  ],
};

const defaults: Record<string, string> = {
  students: 'roster',
  schedule: 'table',
  scores: 'entry',
  reports: 'attendance',
};

export function ContextNav({ activeView }: ContextNavProps) {
  const location = useLocation();
  const items = contextNav[activeView];
  if (!items) return null;

  const params = new URLSearchParams(location.search);
  const activeValue = params.get(items[0].param) || defaults[activeView];

  return (
    <nav className="app-context-nav" aria-label="เมนูย่อย">
      {items.map((item) => (
        <Link
          className={activeValue === item.value ? 'is-active' : ''}
          key={item.value}
          to={`/app/dashboard?view=${activeView}&${item.param}=${item.value}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
