import { supabase } from './supabaseClient';

export interface ModuleMaintenanceEntry {
  moduleKey: string;
  isUnderMaintenance: boolean;
  message: string;
  endsAt: string | null;
  updatedAt: string;
}

export type ModuleMaintenanceMap = Record<string, ModuleMaintenanceEntry>;

export interface ManagedSystemModule {
  key: string;
  label: string;
  group: 'daily' | 'academic' | 'care' | 'system';
  groupLabel: string;
  description: string;
  path: string;
}

export const SYSTEM_MAINTENANCE_MODULES: ManagedSystemModule[] = [
  // 1. งานประจำวันในห้องเรียน
  {
    key: 'students',
    label: 'รายชื่อนักเรียน',
    group: 'daily',
    groupLabel: 'งานประจำวันในห้องเรียน',
    description: 'ทะเบียนนักเรียน เพิ่ม/แก้ไข/ย้ายห้อง และข้อมูลผู้ปกครอง',
    path: '/app/dashboard?view=students',
  },
  {
    key: 'teacher-work',
    label: 'เช็กชื่อเข้าแถว / คาบเรียน',
    group: 'daily',
    groupLabel: 'งานประจำวันในห้องเรียน',
    description: 'บันทึกการมาเรียน ขาด ลา มาสาย และสแกน OCR เช็กชื่อ',
    path: '/app/dashboard?view=teacher-work',
  },
  {
    key: 'savings',
    label: 'สมุดเงินออมนักเรียน',
    group: 'daily',
    groupLabel: 'งานประจำวันในห้องเรียน',
    description: 'ฝาก ถอน ปรับยอดยกมา และสมุดบัญชีเงินออมรายบุคคล',
    path: '/app/dashboard?view=savings',
  },
  {
    key: 'student-health',
    label: 'สุขภาพและกิจวัตรนักเรียน',
    group: 'daily',
    groupLabel: 'งานประจำวันในห้องเรียน',
    description: 'น้ำหนัก ส่วนสูง BMI แปรงฟัน ดื่มนม อาหารกลางวัน',
    path: '/app/dashboard?view=student-health',
  },
  {
    key: 'classroom-operations',
    label: 'ตารางเวรทำความสะอาด',
    group: 'daily',
    groupLabel: 'งานประจำวันในห้องเรียน',
    description: 'จัดกลุ่มเวรประจำวันและงานกิจการห้องเรียน',
    path: '/app/dashboard?view=classroom-operations',
  },

  // 2. งานวิชาการ & วัดผล
  {
    key: 'schedule',
    label: 'ตารางสอน / ตารางเรียน',
    group: 'academic',
    groupLabel: 'งานวิชาการ & วัดผล',
    description: 'ตารางสอนครู ตารางเรียนห้องเรียน และคาบสอนรายสัปดาห์',
    path: '/app/dashboard?view=schedule',
  },
  {
    key: 'scores',
    label: 'สมุดคะแนน & ตัดเกรด',
    group: 'academic',
    groupLabel: 'งานวิชาการ & วัดผล',
    description: 'กรอกคะแนนเก็บ สอบกลางภาค ปลายภาค และคำนวณเกรดอัตโนมัติ',
    path: '/app/dashboard?view=scores',
  },
  {
    key: 'omr-scanner',
    label: 'ตรวจข้อสอบ (กระดาษ OMR)',
    group: 'academic',
    groupLabel: 'งานวิชาการ & วัดผล',
    description: 'สร้างกระดาษคำตอบและสแกนตรวจข้อสอบอัตโนมัติ',
    path: '/app/dashboard?view=omr-scanner',
  },
  {
    key: 'academic-hub',
    label: 'ศูนย์วิชาการ & เอกสาร ปพ.',
    group: 'academic',
    groupLabel: 'งานวิชาการ & วัดผล',
    description: 'จัดการเอกสาร ปพ.5 / ปพ.6 และงานปิดภาคเรียน',
    path: '/app/dashboard?view=academic-hub',
  },
  {
    key: 'reports',
    label: 'พิมพ์รายงาน & สมุด ปพ.',
    group: 'academic',
    groupLabel: 'งานวิชาการ & วัดผล',
    description: 'รายงาน A4/PDF/Excel เวลาเรียน เงินออม คะแนน และสุขภาพ',
    path: '/app/dashboard?view=reports&reportView=attendance',
  },
  {
    key: 'daily-brief',
    label: 'สรุปประจำวัน',
    group: 'academic',
    groupLabel: 'งานวิชาการ & วัดผล',
    description: 'รายงานสรุปภาพรวมประจำวันของโรงเรียนและห้องเรียน',
    path: '/app/dashboard?view=daily-brief',
  },

  // 3. ดูแลช่วยเหลือนักเรียน
  {
    key: 'behavior',
    label: 'พฤติกรรม & ดูแลช่วยเหลือนักเรียน',
    group: 'care',
    groupLabel: 'ดูแลช่วยเหลือนักเรียน',
    description: 'บันทึกพฤติกรรม เยี่ยมบ้าน และติดตามช่วยเหลือนักเรียน',
    path: '/app/dashboard?view=behavior',
  },
  {
    key: 'desirable-characteristics',
    label: 'ประเมินคุณลักษณะ 8 ประการ',
    group: 'care',
    groupLabel: 'ดูแลช่วยเหลือนักเรียน',
    description: 'ประเมินคุณลักษณะอันพึงประสงค์และอ่านคิดวิเคราะห์เขียน',
    path: '/app/dashboard?view=desirable-characteristics',
  },
  {
    key: 'parent-access',
    label: 'QR เชื่อมต่อผู้ปกครอง',
    group: 'care',
    groupLabel: 'ดูแลช่วยเหลือนักเรียน',
    description: 'สร้างรหัสและ QR พอร์ทัลให้ผู้ปกครองตรวจข้อมูลบุตรหลาน',
    path: '/app/dashboard?view=parent-access',
  },

  // 4. จัดการระบบ & เครื่องมือ
  {
    key: 'school-calendar',
    label: 'ปฏิทินโรงเรียน',
    group: 'system',
    groupLabel: 'จัดการระบบ & เครื่องมือ',
    description: 'วันหยุด กิจกรรมโรงเรียน และตารางสอบ',
    path: '/app/dashboard?view=school-calendar',
  },
  {
    key: 'import-export',
    label: 'นำเข้า & ส่งออกข้อมูล',
    group: 'system',
    groupLabel: 'จัดการระบบ & เครื่องมือ',
    description: 'นำเข้าไฟล์ DMC / Excel และส่งออกข้อมูลห้องเรียน',
    path: '/app/dashboard?view=import-export',
  },
  {
    key: 'data-safety',
    label: 'สำรองข้อมูล & กู้คืน (ระดับโรงเรียน)',
    group: 'system',
    groupLabel: 'จัดการระบบ & เครื่องมือ',
    description: 'ศูนย์สำรองข้อมูลส่วนตัวของครูประจำชั้น',
    path: '/app/dashboard?view=data-safety',
  },
  {
    key: 'notifications',
    label: 'ศูนย์แจ้งเตือน & เด็กเสี่ยง (Telegram)',
    group: 'system',
    groupLabel: 'จัดการระบบ & เครื่องมือ',
    description: 'งานค้างรายวัน, ระบบตรวจจับเด็กเสี่ยง (Early Warning), อนุมัติส่งผู้ปกครอง และเชื่อมต่อบอท Telegram',
    path: '/app/dashboard?view=notifications',
  },
  {
    key: 'workspace-settings',
    label: 'ศูนย์จัดการโรงเรียน',
    group: 'system',
    groupLabel: 'จัดการระบบ & เครื่องมือ',
    description: 'ตั้งค่าข้อมูลโรงเรียน โลโก้ ลายเซ็น และสมาชิกครู',
    path: '/app/dashboard?view=workspace-settings',
  },
  {
    key: 'package',
    label: 'แพ็กเกจและชำระเงิน',
    group: 'system',
    groupLabel: 'จัดการระบบ & เครื่องมือ',
    description: 'อัปเกรด VIP แลกโค้ด และแนบสลิปการชำระเงิน',
    path: '/app/dashboard?view=package',
  },
];

const STORAGE_KEY = 'classcare_module_maintenance_map';
export const MODULE_MAINTENANCE_EVENT = 'classcare-module-maintenance-changed';

function filterNonExpired(map: ModuleMaintenanceMap): ModuleMaintenanceMap {
  const now = Date.now();
  const next: ModuleMaintenanceMap = {};
  Object.entries(map || {}).forEach(([key, entry]) => {
    if (!entry || !entry.isUnderMaintenance) return;
    if (entry.endsAt && new Date(entry.endsAt).getTime() <= now) return;
    next[key] = entry;
  });
  return next;
}

export function getCachedModuleMaintenanceMap(): ModuleMaintenanceMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return filterNonExpired(JSON.parse(raw) as ModuleMaintenanceMap);
  } catch {
    return {};
  }
}

export function cacheModuleMaintenanceMap(map: ModuleMaintenanceMap): void {
  const cleaned = filterNonExpired(map);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent(MODULE_MAINTENANCE_EVENT, { detail: cleaned }));
  } catch {
    // ignore storage errors
  }
}

export async function fetchActiveModuleMaintenance(): Promise<ModuleMaintenanceMap> {
  if (!supabase) return getCachedModuleMaintenanceMap();
  try {
    const { data, error } = await supabase.rpc('get_module_maintenance_map');
    if (error || !data || typeof data !== 'object') {
      return getCachedModuleMaintenanceMap();
    }
    const cleaned = filterNonExpired(data as ModuleMaintenanceMap);
    cacheModuleMaintenanceMap(cleaned);
    return cleaned;
  } catch {
    return getCachedModuleMaintenanceMap();
  }
}

export async function setModuleMaintenanceStatus(params: {
  moduleKey: string;
  isUnderMaintenance: boolean;
  message?: string;
  endsAt?: string | null;
}): Promise<{ data: ModuleMaintenanceEntry | null; error: string | null }> {
  if (!supabase) {
    const current = getCachedModuleMaintenanceMap();
    const entry: ModuleMaintenanceEntry = {
      moduleKey: params.moduleKey,
      isUnderMaintenance: params.isUnderMaintenance,
      message: params.message?.trim() || '',
      endsAt: params.endsAt || null,
      updatedAt: new Date().toISOString(),
    };
    if (entry.isUnderMaintenance) {
      current[params.moduleKey] = entry;
    } else {
      delete current[params.moduleKey];
    }
    cacheModuleMaintenanceMap(current);
    return { data: entry, error: null };
  }

  const { data, error } = await supabase.rpc('superadmin_set_module_maintenance', {
    p_module_key: params.moduleKey,
    p_is_under_maintenance: params.isUnderMaintenance,
    p_message: params.message?.trim() || '',
    p_ends_at: params.endsAt || null,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  await fetchActiveModuleMaintenance();
  return { data: (data as ModuleMaintenanceEntry | null) || null, error: null };
}

export async function clearAllModuleMaintenance(): Promise<{ error: string | null }> {
  if (!supabase) {
    cacheModuleMaintenanceMap({});
    return { error: null };
  }

  const { error } = await supabase.rpc('superadmin_clear_all_module_maintenance');
  if (error) return { error: error.message };
  cacheModuleMaintenanceMap({});
  return { error: null };
}
