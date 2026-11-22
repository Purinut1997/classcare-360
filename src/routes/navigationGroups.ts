import { BookOpen, Heart, Settings2, type LucideIcon } from 'lucide-react';

export interface UnifiedNavGroupConfig {
  key: 'classroom-care' | 'academic-docs' | 'school-admin';
  label: string;
  shortLabel: string;
  tone: 'emerald' | 'blue' | 'slate';
  icon: LucideIcon;
  itemKeys: string[];
}

/** Everyday 1-click core menus shared consistently across Desktop Sidebar and Mobile Sheet. */
export const DAILY_NAV_KEYS: string[] = [
  'overview',
  'system-overview',
  'teacher-work',
  'students',
  'scores',
  'schedule',
];

/** Fixed Mobile Bottom Dock slots (left/mid-left/mid-right; slot 3 is AI Hero, slot 5 is Menu). */
export const MOBILE_BOTTOM_DOCK_KEYS = {
  slot1: 'overview',
  slot2: 'teacher-work',
  slot4: 'students',
} as const;

/** Three consistent collapsible groups shared across Sidebar and MobileNav. */
export const UNIFIED_NAV_GROUPS: UnifiedNavGroupConfig[] = [
  {
    key: 'classroom-care',
    label: 'ดูแลห้อง & กิจกรรม',
    shortLabel: 'ดูแลห้อง',
    tone: 'emerald',
    icon: Heart,
    itemKeys: [
      'student-health',
      'savings',
      'behavior',
      'desirable-characteristics',
      'classroom-operations',
      'randomizer',
      'math-games',
    ],
  },
  {
    key: 'academic-docs',
    label: 'ข้อสอบ & เอกสาร ปพ.',
    shortLabel: 'เอกสาร ปพ.',
    tone: 'blue',
    icon: BookOpen,
    itemKeys: [
      'omr-scanner',
      'reports',
      'academic-hub',
      'daily-brief',
      'school-calendar',
    ],
  },
  {
    key: 'school-admin',
    label: 'ตั้งค่า & ข้อมูล',
    shortLabel: 'ตั้งค่า',
    tone: 'slate',
    icon: Settings2,
    itemKeys: [
      'notifications',
      'automation',
      'parent-access',
      'workspace-settings',
      'academic-year',
      'import-export',
      'data-safety',
      'help-center',
    ],
  },
];

/** Routes accessible directly via workspace switcher, sub-tabs, or VIP badge rather than main menus. */
export const INTEGRATED_ALIAS_KEYS: string[] = [
  'workspace-switch',
  'period-locks',
  'setup',
  'audit',
  'package',
];
