import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileSpreadsheet,
  GraduationCap,
  LifeBuoy,
  Link as LinkIcon,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';

import { ContextLink } from '../../components/navigation/ContextLink';
import { canUseModule } from '../../lib/entitlements';
import { canManageWorkspace, roleLabels } from '../../lib/roles';
import type { AppSessionContext, ModuleKey, WorkspaceRole } from '../../types/core';

interface HelpCenterPageProps {
  session: AppSessionContext;
}

interface HelpLinkAccess {
  allowedRoles: WorkspaceRole[];
  moduleKey: ModuleKey;
}

interface GuideCard extends HelpLinkAccess {
  title: string;
  body: string;
  cta: string;
  href: string;
  tags: string[];
}

const teacherRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner', 'teacher_member'];
const ownerRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner'];
const reportRoles: WorkspaceRole[] = [...teacherRoles, 'viewer'];

const startSteps: Array<HelpLinkAccess & { title: string; body: string; href: string }> = [
  {
    title: '1. ตั้งค่าโรงเรียนและรายงาน',
    body: 'กรอกชื่อโรงเรียน ปีการศึกษา ห้องหลัก โลโก้ และผู้ลงนาม เพื่อให้รายงานทุกตัวใช้ข้อมูลเดียวกัน',
    href: '/app/dashboard?view=workspace-settings#workspace-profile',
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: '2. เพิ่มห้องและนำเข้านักเรียน',
    body: 'เพิ่มห้องเรียนก่อน แล้วนำเข้าหรือเพิ่มนักเรียนเอง ตรวจห้อง/ปี/สถานะให้ตรงก่อนใช้งานงานครู',
    href: '/app/dashboard?view=import-export',
    allowedRoles: ownerRoles,
    moduleKey: 'import_export',
  },
  {
    title: '3. ตรวจ Data Quality',
    body: 'เช็กรายชื่อซ้ำ นักเรียนไม่มีห้อง นักเรียนผิดปี หรือ import รอบล่าสุดที่ต้องลบ/เก็บถาวร',
    href: '/app/dashboard?view=students&studentView=quality',
    allowedRoles: teacherRoles,
    moduleKey: 'students',
  },
  {
    title: '4. ตั้งตารางสอนและรายวิชา',
    body: 'ตั้งคาบเรียน พักเที่ยง วันเรียน รายวิชา และห้อง เพื่อให้เช็กเวลาเรียนรายวิชาและคะแนนอิงชุดเดียวกัน',
    href: '/app/dashboard?view=schedule&scheduleView=settings',
    allowedRoles: teacherRoles,
    moduleKey: 'attendance',
  },
  {
    title: '5. เริ่มงานครูและออกรายงาน',
    body: 'เช็กชื่อ กรอกคะแนน เงินออม พฤติกรรม แล้วสรุป PDF/CSV/XLSX จากศูนย์รายงาน',
    href: '/app/dashboard?view=reports&reportView=attendance',
    allowedRoles: teacherRoles,
    moduleKey: 'reports',
  },
];

const guideCards: GuideCard[] = [
  {
    title: 'นักเรียนนำเข้าแล้วไม่แสดง',
    body: 'ตรวจตัวกรองห้อง/สถานะก่อน จากนั้นไป Data Quality เพื่อดูว่านักเรียนอยู่ผิดห้อง ผิดปี หรือถูกเก็บถาวรหรือไม่',
    cta: 'เปิด Data Quality',
    href: '/app/dashboard?view=students&studentView=quality',
    tags: ['student', 'import', 'data quality', 'นักเรียนไม่ขึ้น', 'รายชื่อ'],
    allowedRoles: teacherRoles,
    moduleKey: 'students',
  },
  {
    title: 'หาเมนูนำเข้านักเรียนไม่เจอ',
    body: 'เมนูนำเข้าอยู่ที่ นำเข้า/สำรอง ใช้ได้ทั้ง DMC Excel, เพิ่มนักเรียนเอง, CSV นักเรียน และ Guardian CSV',
    cta: 'ไปหน้านำเข้า',
    href: '/app/dashboard?view=import-export',
    tags: ['import', 'csv', 'dmc', 'นำเข้า', 'เพิ่มนักเรียน'],
    allowedRoles: ownerRoles,
    moduleKey: 'import_export',
  },
  {
    title: 'ลบแล้วข้อมูลกลับมา',
    body: 'ตรวจว่าเป็นการลบถาวรหรือเก็บถาวร และบัญชีมีสิทธิ์ owner/admin จากนั้นเปิดศูนย์ดูแลข้อมูลเพื่อตรวจคิวกู้คืนและปัญหาข้อมูล',
    cta: 'เปิดศูนย์ดูแลข้อมูล',
    href: '/app/dashboard?view=data-safety',
    tags: ['delete', 'archive', 'rls', 'ลบไม่ได้', 'กู้คืน'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: 'จะเช็กชื่อแบบครูประจำชั้นหรือรายวิชา',
    body: 'ใช้บันทึกเวลาเรียนเพื่อแยกรอบเช็กชื่อ ห้อง วันที่ คาบ และวิชา ระบบจะนำข้อมูลไปใช้รายงานรายเดือน/เทอมต่อได้',
    cta: 'เปิดบันทึกเวลาเรียน',
    href: '/app/dashboard?view=teacher-work',
    tags: ['attendance', 'session', 'เช็กชื่อ', 'รายวิชา'],
    allowedRoles: teacherRoles,
    moduleKey: 'attendance',
  },
  {
    title: 'คะแนนควรเริ่มจากตรงไหน',
    body: 'เริ่มที่สร้างชุดคะแนน เลือกห้อง/วิชา/ประเภท/คะแนนเต็ม แล้วไปกรอกคะแนนหรือดูสมุดรวมคะแนน',
    cta: 'สร้างชุดคะแนน',
    href: '/app/dashboard?view=scores&scoreView=setup',
    tags: ['score', 'assessment', 'คะแนน', 'กลางภาค', 'ปลายภาค'],
    allowedRoles: teacherRoles,
    moduleKey: 'scores',
  },
  {
    title: 'รายงานออกมาไม่ตรงหัวกระดาษ',
    body: 'ตั้งค่าโลโก้ โรงเรียน ครูผู้สอน หัวหน้าวิชาการ ผู้อำนวยการ และช่วงเทอมที่ศูนย์จัดการโรงเรียนก่อน',
    cta: 'ตั้งค่าโรงเรียน',
    href: '/app/dashboard?view=workspace-settings#workspace-profile',
    tags: ['report', 'logo', 'signature', 'รายงาน', 'ผู้ลงนาม'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: 'ครูเข้าผิดโรงเรียนหรือ workspace ซ้ำ',
    body: 'เจ้าของ workspace ตรวจสมาชิกและคำขอเข้าโรงเรียน ส่วน Superadmin ใช้ Workspace Directory เพื่อรวม/เก็บถาวร workspace ซ้ำ',
    cta: 'ศูนย์จัดการโรงเรียน',
    href: '/app/dashboard?view=workspace-settings#workspace-members',
    tags: ['workspace', 'owner', 'member', 'โรงเรียน', 'สิทธิ์'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: 'ต้องการให้ผู้ปกครองหรือนักเรียนดูข้อมูลเอง',
    body: 'ตั้งค่า Public Report Policy ก่อน แล้วส่งคำเชิญ Portal หรือใช้หน้าค้นหารายงานสาธารณะตามข้อมูลที่โรงเรียนอนุญาต',
    cta: 'ตั้งค่าสิทธิ์รายงาน',
    href: '/app/dashboard?view=workspace-settings#public-report-policy',
    tags: ['portal', 'parent', 'student', 'public report', 'ผู้ปกครอง'],
    allowedRoles: ownerRoles,
    moduleKey: 'parent_portal',
  },
  {
    title: 'ดูรายงานตามสิทธิ์ที่ได้รับ',
    body: 'เปิดศูนย์รายงานเพื่อดูข้อมูลสรุปของ workspace โดยระบบจะไม่เปิดเมนูจัดการนักเรียนหรือการตั้งค่าโรงเรียนให้ผู้ดูรายงาน',
    cta: 'เปิดศูนย์รายงาน',
    href: '/app/dashboard?view=reports',
    tags: ['viewer', 'report', 'รายงาน', 'สรุป'],
    allowedRoles: ['viewer'],
    moduleKey: 'reports',
  },
];

const roleWorkflows = [
  {
    icon: Users,
    title: 'ครูผู้สอน / ครูประจำชั้น',
    items: ['เช็กเวลาเรียน', 'กรอกคะแนน', 'เงินออม', 'พฤติกรรม', 'รายงานห้องที่ดูแล'],
    roles: ['teacher_owner', 'teacher_member'] as WorkspaceRole[],
  },
  {
    icon: ShieldCheck,
    title: 'เจ้าของ workspace / Admin',
    items: ['อนุมัติครูเข้าโรงเรียน', 'จัดสิทธิ์สมาชิก', 'ลบหรือเก็บถาวรห้องเรียน', 'ตั้งค่าโรงเรียน', 'สำรองข้อมูล'],
    roles: ['teacher_owner'] as WorkspaceRole[],
  },
  {
    icon: Wrench,
    title: 'Superadmin',
    items: ['ตรวจ workspace ซ้ำ', 'จัดสิทธิ์ Admin/Superadmin', 'ตรวจระบบ/RLS', 'ดู audit', 'ช่วยกู้คืนหรือปิดสิทธิ์'],
    roles: ['superadmin'] as WorkspaceRole[],
  },
  {
    icon: FileSpreadsheet,
    title: 'ผู้ดูรายงาน',
    items: ['ดูข้อมูลสรุปที่ได้รับอนุญาต', 'ส่งออกรายงานตามสิทธิ์', 'ไม่เห็น Student 360 หรือการตั้งค่าโรงเรียน'],
    roles: ['viewer'] as WorkspaceRole[],
  },
];

const quickLinks: Array<HelpLinkAccess & { label: string; href: string; icon: typeof DatabaseZap }> = [
  { label: 'เพิ่มหรือนำเข้านักเรียน', href: '/app/dashboard?view=import-export', icon: DatabaseZap, allowedRoles: ownerRoles, moduleKey: 'import_export' },
  { label: 'ตรวจรายชื่อผิด/ซ้ำ', href: '/app/dashboard?view=students&studentView=quality', icon: Search, allowedRoles: teacherRoles, moduleKey: 'students' },
  { label: 'ตั้งตารางสอน', href: '/app/dashboard?view=schedule&scheduleView=settings', icon: ClipboardList, allowedRoles: teacherRoles, moduleKey: 'attendance' },
  { label: 'กรอกคะแนน', href: '/app/dashboard?view=scores&scoreView=entry', icon: GraduationCap, allowedRoles: teacherRoles, moduleKey: 'scores' },
  { label: 'ออกรายงาน', href: '/app/dashboard?view=reports&reportView=attendance', icon: FileSpreadsheet, allowedRoles: reportRoles, moduleKey: 'reports' },
];

export function HelpCenterPage({ session }: HelpCenterPageProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const canOpenHelpLink = (item: HelpLinkAccess) => (
    item.allowedRoles.includes(session.profile.role) && canUseModule(session.subscription, item.moduleKey)
  );
  const accessibleLinks = quickLinks.filter(canOpenHelpLink);
  const roleQuickLinks = (() => {
    if (session.profile.role === 'superadmin') {
      return [...accessibleLinks, { label: 'ตรวจระบบ', href: '/app/dashboard?view=setup', icon: Settings2, allowedRoles: ['superadmin'] as WorkspaceRole[], moduleKey: 'support' as ModuleKey }];
    }
    if (canManageWorkspace(session.profile.role)) {
      return [...accessibleLinks, { label: 'ตั้งค่าโรงเรียน', href: '/app/dashboard?view=workspace-settings', icon: Settings2, allowedRoles: ownerRoles, moduleKey: 'support' as ModuleKey }];
    }
    return accessibleLinks;
  })();

  const accessibleStartSteps = startSteps.filter(canOpenHelpLink);
  const accessibleGuides = guideCards.filter(canOpenHelpLink);

  const filteredGuides = normalizedQuery
    ? accessibleGuides.filter((guide) => {
      const haystack = [guide.title, guide.body, guide.cta, ...guide.tags].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    : accessibleGuides;

  return (
    <main className="app-page">
      <div className="app-page-header">
        <div>
          <span className="nexus-kicker">
            <LifeBuoy size={16} aria-hidden="true" />
            Help Center
          </span>
          <h1 className="app-page-title">คู่มือใช้งานและทางลัดแก้ปัญหา</h1>
          <p className="app-page-description">
            รวมลำดับงานที่ควรทำก่อนหลัง ปัญหาที่เจอบ่อย และปุ่มลัดไปยังหน้าที่ถูกต้อง
            สำหรับบทบาท {roleLabels[session.profile.role]} ใน workspace ปัจจุบัน
          </p>
        </div>

        <div className="nexus-card min-w-[220px] p-4 text-sm font-black text-slate-700">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Current role</p>
          <p className="mt-1 text-xl text-slate-950">{roleLabels[session.profile.role]}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{session.workspace?.schoolName || 'ยังไม่ได้เลือกโรงเรียน'}</p>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {roleQuickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <ContextLink
              className="nexus-card flex min-h-24 items-center gap-3 p-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-[#d89333] hover:bg-white"
              key={item.href}
              to={item.href}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </ContextLink>
          );
        })}
      </section>

      {accessibleStartSteps.length > 0 ? <section className="nexus-card mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="nexus-kicker">
              <Route size={16} aria-hidden="true" />
              First Setup
            </span>
            <h2 className="mt-3 text-2xl font-black text-slate-950">เริ่มใช้งานให้ไม่หลงขั้นตอน</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">
              ถ้าทดลองระบบแล้วข้อมูลไม่ขึ้น ให้ไล่ตามลำดับนี้ก่อน เพราะทุกโมดูลอิง workspace, classroom,
              student, schedule และ report settings ร่วมกัน
            </p>
          </div>
          {canManageWorkspace(session.profile.role) ? <ContextLink
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#3a2817] px-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(58,40,23,0.18)] transition hover:-translate-y-0.5"
            to="/app/dashboard?view=workspace-settings"
          >
            เปิดศูนย์จัดการโรงเรียน
            <LinkIcon size={17} aria-hidden="true" />
          </ContextLink> : null}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {accessibleStartSteps.map((step) => (
            <ContextLink
              className="rounded-2xl border border-[#ead8bd] bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-[#d89333] hover:shadow-[0_14px_34px_rgba(122,79,38,0.10)]"
              key={step.title}
              to={step.href}
            >
              <p className="text-sm font-black text-slate-950">{step.title}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-600">{step.body}</p>
            </ContextLink>
          ))}
        </div>
      </section> : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="nexus-kicker">
                <AlertTriangle size={16} aria-hidden="true" />
                Troubleshooting
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-950">ปัญหาที่เจอบ่อยและควรไปหน้าไหน</h2>
            </div>
            <label className="relative block w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                className="nexus-field h-12 pl-11 pr-4"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหา เช่น ลบไม่ได้, นักเรียนไม่ขึ้น, คะแนน"
                type="search"
                value={query}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {filteredGuides.map((guide) => (
              <article className="rounded-2xl border border-[#ead8bd] bg-white/82 p-4" key={guide.title}>
                <h3 className="text-base font-black text-slate-950">{guide.title}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{guide.body}</p>
                <ContextLink
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#fff1c9] px-3 text-sm font-black text-[#5a3515] ring-1 ring-[#e8c47b] transition hover:-translate-y-0.5"
                  to={guide.href}
                >
                  {guide.cta}
                  <LinkIcon size={16} aria-hidden="true" />
                </ContextLink>
              </article>
            ))}

            {filteredGuides.length === 0 ? (
              <div className="rounded-2xl border border-[#ead8bd] bg-[#fff8ef]/80 p-4 text-sm font-bold text-slate-600 md:col-span-2">
                ยังไม่พบคู่มือจากคำค้นนี้ ลองค้นด้วยชื่อเมนู เช่น นักเรียน, นำเข้า, คะแนน, รายงาน หรือ workspace
              </div>
            ) : null}
          </div>
        </div>

        <aside className="grid gap-5">
          <section className="nexus-card p-4 sm:p-5">
            <span className="nexus-kicker">
              <BookOpen size={16} aria-hidden="true" />
              Role Workflow
            </span>
            <div className="mt-4 grid gap-3">
              {roleWorkflows.filter((workflow) => workflow.roles.includes(session.profile.role)).map((workflow) => {
                const Icon = workflow.icon;

                return (
                  <article className="rounded-2xl border border-[#ead8bd] bg-white/82 p-4" key={workflow.title}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-black text-slate-950">{workflow.title}</h3>
                        <ul className="mt-2 grid gap-1 text-xs font-bold leading-5 text-slate-600">
                          {workflow.items.map((item) => (
                            <li className="flex items-start gap-2" key={item}>
                              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={14} aria-hidden="true" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {session.profile.role !== 'viewer' ? <section className="nexus-card p-4 sm:p-5">
            <span className="nexus-kicker">
              <Wrench size={16} aria-hidden="true" />
              Smoke Test
            </span>
            <h2 className="mt-3 text-xl font-black text-slate-950">เช็กลิสต์ก่อนให้ครูทดลอง</h2>
            <div className="mt-4 grid gap-2">
              {[
                'เลือก workspace ถูกโรงเรียน',
                'มีห้องเรียน active อย่างน้อย 1 ห้อง',
                'มีนักเรียน active ในห้องที่เลือก',
                'ตั้งค่าวิชา/ตารางสอนก่อนเช็กชื่อรายวิชา',
                'สร้างชุดคะแนนก่อนกรอกคะแนน',
                'ตั้งค่าโลโก้/ผู้ลงนามก่อนพิมพ์รายงาน',
              ].map((item) => (
                <label
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-[#ead8bd] bg-white/80 px-3 text-sm font-bold text-slate-700"
                  key={item}
                >
                  <input className="h-4 w-4 rounded border-[#d8bd90] text-[#d89333] focus:ring-[#f7dfad]" type="checkbox" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section> : null}
        </aside>
      </section>
    </main>
  );
}
