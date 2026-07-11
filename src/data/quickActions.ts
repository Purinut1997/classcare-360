import {
  CalendarClock,
  FileSpreadsheet,
  HeartHandshake,
  MapPinned,
  type LucideIcon,
} from 'lucide-react';

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  color: string;
}

export const quickActions: QuickAction[] = [
  { label: 'เช็คเวลาเรียน', icon: CalendarClock, color: 'bg-teal-600' },
  { label: 'เพิ่มบันทึกดูแล', icon: HeartHandshake, color: 'bg-rose-500' },
  { label: 'สร้างรายงาน', icon: FileSpreadsheet, color: 'bg-sky-600' },
  { label: 'ปักหมุดเยี่ยมบ้าน', icon: MapPinned, color: 'bg-amber-500' },
];
