export const dashboardStats = [
  {
    label: 'นักเรียนในความดูแล',
    value: '36',
    detail: 'ห้อง ป.5/2',
    tone: 'bg-teal-50 text-teal-700 ring-teal-100',
  },
  {
    label: 'เช็คชื่อแล้ว',
    value: '92%',
    detail: 'เหลือ 3 รายการ',
    tone: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  {
    label: 'เคสที่ต้องติดตาม',
    value: '4',
    detail: '2 เคสด่วน',
    tone: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
  {
    label: 'เงินออมเดือนนี้',
    value: '8,420',
    detail: 'บาท',
    tone: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
];

export const studentWatchlist = [
  { name: 'ณัฐวุฒิ', status: 'งานค้าง 2 ชิ้น', accent: 'bg-rose-100 text-rose-700' },
  { name: 'พิมพ์ชนก', status: 'คะแนนดีขึ้น', accent: 'bg-teal-100 text-teal-700' },
  { name: 'กิตติพงศ์', status: 'นัดผู้ปกครอง', accent: 'bg-sky-100 text-sky-700' },
];

export const buildRoadmap = [
  'เชื่อม Supabase client และ Auth guard',
  'ตรวจ migration core กับ Supabase จริง',
  'สร้าง workspace selector และ package guard',
  'เริ่ม Edge Functions กลุ่ม payment',
];
