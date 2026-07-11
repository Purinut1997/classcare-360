import { SearchX } from 'lucide-react';

import { RoutePlaceholder } from '../components/shared/RoutePlaceholder';

export function NotFoundPage() {
  return (
    <RoutePlaceholder
      checkpoints={[
        'ตรวจ path ที่เรียกอีกครั้ง',
        'กลับแดชบอร์ดเพื่อเลือกเมนูหลัก',
        'route จริงจะถูกเพิ่มตาม Prompt ทีละกลุ่ม',
      ]}
      description="ยังไม่มีหน้า route นี้ใน foundation ปัจจุบัน ระบบจะค่อยๆ เพิ่มหน้าตามเฟสที่บันทึกไว้ใน PROJECT_STATUS.md"
      eyebrow="404"
      icon={SearchX}
      title="ไม่พบหน้านี้"
    />
  );
}
