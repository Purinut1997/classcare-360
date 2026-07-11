# ClassCare 360

ระบบผู้ช่วยครูและดูแลนักเรียนครบวงจร  
Created by MIKPURINUT

## สถานะปัจจุบัน

โปรเจคอยู่ระหว่าง foundation หลักของ ClassCare 360: Auth/Workspace, Student 360, Attendance, Report Center, Payment Review, Parent/Student Portal และ theme refresh ตาม reference

ทำแล้ว:

- อ่าน requirement หลักจาก `Prompt.txt`
- แบ่งเฟสและบันทึกสถานะใน `PROJECT_STATUS.md`
- สร้างเอกสาร Phase 1 ใน `docs/`
- เริ่ม scaffold React + Vite + TypeScript
- เพิ่ม Tailwind CSS และ dashboard shell โทนสดใส
- เพิ่ม typed foundation สำหรับ env, Supabase client, auth routing, roles และ entitlements
- แตก app shell เป็น `components`, `layouts`, `pages`, `routes` เพื่อเตรียม route จริง
- เพิ่ม React Router และ route ชุดแรกสำหรับ auth/app/superadmin/portal
- เพิ่ม route guard foundation สำหรับ session, workspace, role, subscription และ entitlement
- เพิ่ม demo session หลายสถานะผ่าน `?demo=...` เพื่อทดสอบ Free Login, expired, parent/student และ superadmin
- เปลี่ยนหน้า Login จาก placeholder เป็นฟอร์ม Login/Register/Forgot พร้อมปุ่ม Google OAuth ที่รอ Supabase env
- เพิ่มหน้า Complete Profile และหน้าเลือก/สร้าง workspace
- เพิ่ม build chunk splitting สำหรับ router, Supabase และ lucide icons
- เริ่มปรับธีมตาม reference: grid background ฟ้า, glass panels, pill buttons, hero visual, font Anuphan
- ขยายธีมไปหน้า Login/Register/Forgot, Complete Profile, Workspace Setup และ Route Guard notice
- ขยายธีมไปหน้า Student 360, Attendance/Teacher Work, Report Center และ Package
- หน้า Package อยู่ใน AppShell เดียวกับ dashboard แล้ว จึงมี sidebar, mobile nav และ grid background ชุดเดียวกัน
- เปลี่ยนหน้า Pricing เป็นหน้าแพ็กเกจแบบเต็มขึ้น พร้อมแผน FREE_LOGIN, TRIAL_30 และ ClassCare 360 VIP
- ปรับ RoutePlaceholder กลางสำหรับ Superadmin, Portal, 404 และหน้า foundation อื่นให้เข้าธีม Nexus แล้ว
- เปลี่ยน Superadmin Dashboard จาก placeholder เป็น payment review foundation มีคิวตรวจสลิป, QR active, subscription ล่าสุด และปุ่มอนุมัติ/ปฏิเสธ
- เพิ่ม Supabase Edge Function scaffold ตัวแรก `approve-payment-request` สำหรับ approve/reject payment request และเปิด subscription ฝั่ง server
- เปลี่ยน Parent/Student Portal จาก placeholder เป็นหน้า foundation มี Privacy Guard, นักเรียนในสิทธิ์ และ timeline เวลาเรียนล่าสุด
- เพิ่ม `student_profile_links` สำหรับผูกบัญชี role `student` กับนักเรียนจริง และเพิ่ม UI ผูกบัญชีในหน้า Student 360
- เพิ่ม Care Quick Log + Case Timeline ใน Student 360 พร้อม migration `student_care_cases` สำหรับประวัติเคสดูแลหลายรายการ และปุ่มเปลี่ยนสถานะเปิด/เฝ้าติดตาม/ปิดเคส
- เพิ่ม Student Profile summary ใน Student 360 รวมข้อมูลพื้นฐาน ผู้ปกครองหลัก สถานะ Portal และเคสดูแลล่าสุดของนักเรียนที่เลือก
- เพิ่ม inline edit ใน Case Timeline เพื่อแก้ไขประเภทเคส ระดับติดตาม รายละเอียด และสิ่งที่ต้องทำต่อ
- เพิ่ม Case Detail Panel ใน Student 360 เพื่อเลือกดูรายละเอียดเคสดูแลพร้อมบริบทนักเรียน ผู้ปกครอง และ action ถัดไป
- เพิ่ม Home Visit / กสศ.01 foundation ใน Student 360 อ้างอิงแบบฟอร์ม กสศ.01 PDF สำหรับข้อมูลครัวเรือน ที่อยู่อาศัย การเดินทาง รูปถ่าย และ consent
- เพิ่ม migration `student_home_visits` พร้อม RLS และเชื่อม Student 360 ให้บันทึกแบบเยี่ยมบ้านลงตารางจริงได้เมื่อรัน migration แล้ว
- เพิ่มช่องแนบรูปเยี่ยมบ้าน 2 รูปตามแบบ กสศ.01: ภายนอกที่พักอาศัยและภายในที่พักอาศัย พร้อม metadata ใน `app_files`
- เพิ่ม migration storage bucket `home-visit-photos` พร้อม policy สำหรับรูปเยี่ยมบ้านแบบ private
- เพิ่มปุ่มพิมพ์ / Save PDF สำหรับแบบเยี่ยมบ้าน กสศ.01 โดยสร้างหน้า A4 print-ready จากข้อมูลในฟอร์ม
- เพิ่ม migration `0005_teacher_audit_logs.sql` และ audit trail foundation ใน Student 360 สำหรับข้อมูลนักเรียน เคสดูแล และแบบเยี่ยมบ้าน/กสศ.01
- เพิ่ม migration `0006_teacher_audit_log_read.sql` และ Activity Timeline ใน Student 360 สำหรับดูประวัติการทำงานล่าสุดของนักเรียนที่เลือก
- เพิ่มหน้า `ตั้งค่าระบบ` ที่ `/app/dashboard?view=setup` สำหรับตรวจ readiness ก่อน deploy จริง เช่น env, migrations, storage, RLS และ Edge Functions
- เพิ่มปุ่ม `Export report` ในหน้า `ตั้งค่าระบบ` เพื่อดาวน์โหลด readiness report เป็น JSON สำหรับส่งต่อเครื่อง/ทีม deploy
- เพิ่มหน้า `ประวัติระบบ` ที่ `/app/dashboard?view=audit` สำหรับค้นหา/กรอง/ส่งออก audit log ของ workspace
- เพิ่ม helper audit log กลางและเชื่อม Score, Savings, Behavior, Randomizer เข้า Audit Center
- เพิ่ม migration storage bucket `payment-slips` พร้อม policy สำหรับสลิปชำระเงินแบบ private
- เพิ่ม Production Deployment Pack ที่ `docs/04-production-deployment.md`
- ขยายหน้า `ตั้งค่าระบบ` ให้ตรวจ migration ถึง `0010`, storage buckets, server secrets และลำดับคำสั่ง deploy
- เพิ่มคำสั่ง `npm.cmd run check:deploy` สำหรับตรวจ readiness ฝั่ง repo/local ก่อน deploy จริง
- เพิ่ม Workspace Backup Package ในหน้า Import/Export สำหรับ export JSON และนำกลับมา preview ก่อน import
- เชื่อม Import/Export/Backup เข้ากับ Audit Center สำหรับ import นักเรียน, import ผู้ปกครอง และสร้าง backup package
- เพิ่มหน้า `ตั้งค่าโรงเรียน` สำหรับแก้ workspace, ปีการศึกษา, ห้องหลัก, เพิ่มห้องเรียน และ export settings snapshot
- เพิ่ม Core Summary Report ใน Report Center รวมเวลาเรียน คะแนน เงินออม และพฤติกรรม พร้อมฝังใน JSON report package
- เพิ่ม Workspace Selector ที่โหลด workspace จริงจาก membership และจำ active workspace ที่เลือกไว้ในเครื่อง
- เพิ่ม `portal_invitations` สำหรับสร้างคำเชิญ Parent/Student Portal ด้วย email จากหน้า Student 360
- เพิ่ม Edge Function `accept-portal-invitation` และหน้า `/portal/invitations` สำหรับรับคำเชิญแล้วสร้างสิทธิ์ parent/student จริง
- เพิ่ม Report Center export เป็น Excel-compatible `.xls` นอกเหนือจาก CSV/print
- เพิ่มปุ่มแจ้งผู้ปกครองจากหน้าเช็คชื่อ สำหรับสถานะขาด/สาย/ลา/ป่วย ผ่าน `dispatch-notification`
- เพิ่ม PWA manifest/offline page เบื้องต้น
- เพิ่ม migration core draft ชุดแรก

ยังไม่เสร็จ:

- ยังไม่ได้เชื่อม Supabase จริง
- ยังไม่ได้ deploy Cloudflare Pages
- ยังไม่ได้ deploy/test Edge Functions กับ Supabase project จริง
- Auth/Payment/Reports ยังเป็น foundation บางส่วน ยังไม่ใช่ production flow ครบชุด
- Portal invitation และ accept flow มี foundation แล้ว แต่ยังต้อง deploy/test กับ Supabase จริงและยังไม่ส่งอีเมลจริง

## เอกสารสำคัญ

- `PROJECT_STATUS.md` - สถานะและเฟสงานล่าสุด
- `docs/01-architecture.md` - Architecture Cloudflare + Supabase
- `docs/02-database-schema.md` - Database schema draft
- `docs/03-security-rls.md` - Security และ RLS design
- `docs/04-production-deployment.md` - Production Deployment Pack สำหรับ Supabase จริง
- `supabase/migrations/0001_core_foundation.sql` - migration core ชุดแรก
- `src/lib/` - Supabase/Auth/Role/Entitlement foundation
- `src/types/core.ts` - type กลางของระบบ
- `src/data/dashboard.ts` - demo data สำหรับ app shell
- `src/data/quickActions.ts` - action data สำหรับ dashboard
- `src/components/dashboard/` - dashboard UI components
- `src/layouts/AppShell.tsx` - layout หลักของ app
- `src/pages/app/DashboardPage.tsx` - หน้า dashboard foundation
- `src/pages/app/PackagePage.tsx` - หน้าแพ็กเกจ foundation
- `src/pages/app/WorkspaceSetupPage.tsx` - หน้าเลือก/สร้าง workspace foundation
- `src/pages/auth/LoginPage.tsx` - ฟอร์ม Login/Register/Forgot foundation
- `src/pages/auth/CompleteProfilePage.tsx` - หน้า Complete Profile foundation
- `src/pages/auth/PricingPage.tsx` - หน้า pricing foundation
- `src/pages/superadmin/SuperadminDashboard.tsx` - หน้า Superadmin foundation
- `supabase/functions/approve-payment-request/index.ts` - Edge Function foundation สำหรับ approve/reject payment request
- `supabase/functions/README.md` - คู่มือ Edge Function
- `src/pages/portal/PortalHome.tsx` - หน้า portal foundation
- `src/pages/portal/PortalInvitationsPage.tsx` - หน้า accept portal invitation
- `src/pages/NotFoundPage.tsx` - fallback route
- `src/components/shared/RoutePlaceholder.tsx` - shell สำหรับหน้า foundation
- `src/routes/appRoutes.ts` - nav/view config
- `src/routes/RouteGuards.tsx` - route guard foundation และหน้าแจ้งเตือนสิทธิ์

## การติดตั้ง

```bash
npm install
```

## รันสำหรับพัฒนา

```bash
npm run dev
```

ค่าเริ่มต้นของ Vite จะเปิดที่ `http://127.0.0.1:5173`

## Build

```bash
npm run build
```

## ตรวจความพร้อมก่อน Deploy

```bash
npm.cmd run check:deploy
```

ผลตรวจล่าสุดผ่าน 25/28 checks โดยเหลือ `.env.local`, Supabase CLI และ Deno ที่ต้องตั้งค่าบนเครื่อง deploy จริง

## UI Foundation

หน้าปัจจุบันใช้ Tailwind CSS ผ่าน `tailwind.config.js`, `postcss.config.js` และ `src/styles/globals.css`

ตรวจล่าสุด:

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser ที่ `http://127.0.0.1:5173` แล้วทั้ง mobile/desktop ไม่มี horizontal overflow และไม่มี console error
- ตรวจเมนู dashboard เปลี่ยน state ได้ เช่น รายงานแสดง guard/entitlement preview ถูกต้อง
- ตรวจหลัง refactor เป็น components แล้วเมนู `รายงาน` ยังเปลี่ยน state ได้และไม่มี console error
- ตรวจ route `/`, `/login`, `/pricing`, `/app/dashboard?view=reports`, `/app/package`, `/superadmin/dashboard`, `/portal/parent` ผ่าน
- ตรวจ client-side navigation จาก dashboard ไป `/app/package` ผ่าน
- ตรวจ route guard ผ่าน: `/app/dashboard?demo=free` ถูกบล็อก, `/app/package?demo=free` เข้าได้, `/superadmin/dashboard` ถูกบล็อกสำหรับครู, `/superadmin/dashboard?demo=superadmin` เข้าได้, `/portal/parent?demo=parent` เข้าได้, `/app/dashboard?demo=signed-out` ถูกบล็อกไป login
- ตรวจ Auth UI ผ่าน: `/login`, `/login?mode=register`, `/login?mode=forgot`, `/auth/complete-profile`, `/app/select-workspace?demo=no-workspace`, `/app/dashboard?demo=no-workspace`
- ตรวจ Dashboard theme ใหม่ผ่าน browser: font เป็น Anuphan, hero radius 32px, ไม่มี console error และไม่มี horizontal overflow
- ตรวจ theme routes ล่าสุดผ่าน browser: `/app/dashboard`, `/login`, `/login?mode=register`, `/auth/complete-profile`, `/app/select-workspace?demo=no-workspace`, `/app/dashboard?demo=no-workspace` ไม่มี console error และไม่มี horizontal overflow
- ตรวจ theme routes ชุด app ล่าสุดผ่าน browser: `/app/dashboard?view=students`, `/app/dashboard?view=teacher-work`, `/app/dashboard?view=reports`, `/app/package`, `/app/dashboard` ใช้ font Anuphan, มี grid background, ไม่มี console error และไม่มี horizontal overflow
- ตรวจ theme routes ชุด public/foundation ล่าสุดผ่าน browser: `/pricing`, `/superadmin/dashboard?demo=superadmin`, `/portal/parent?demo=parent`, `/portal/student?demo=student`, `/not-found-demo` ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจ Superadmin Payment Review ผ่าน browser: `/superadmin/dashboard?demo=superadmin` โหลด demo queue, กดอนุมัติแล้ว state เปลี่ยนเป็น `อนุมัติแล้ว`, ไม่มี console error และไม่มี horizontal overflow
- ตรวจหลังเชื่อม Superadmin กับ `approve-payment-request`: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ demo mode ยังกดอนุมัติได้
- ตรวจ Parent/Student Portal ผ่าน browser: `/portal/parent?demo=parent`, `/portal/student?demo=student` แสดง portal ใหม่, มี Privacy Guard, มี timeline เวลาเรียนล่าสุด, ไม่มี console error และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Student account link management ใน Student 360: `npm run lint` และ `npm run build` ผ่าน
- ตรวจหลังเพิ่ม Portal invitation foundation ใน Student 360: `npm run lint` และ `npm run build` ผ่าน
- ตรวจหลังเพิ่ม Accept Portal Invitation: `npm run lint`, `npm run build` ผ่าน และ browser `/portal/invitations?demo=student` รับคำเชิญ demo ได้
- ตรวจหลังเพิ่ม Report Excel export: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=reports` ไม่มี console error/overflow
- ตรวจหลังเพิ่ม Attendance Guardian Notification: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=teacher-work` ส่งแจ้งเตือน demo ได้
- ตรวจหลังเพิ่ม Student Care Quick Log: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` บันทึกเคสดูแล demo ได้
- ตรวจหลังเพิ่ม `student_care_cases` + Workspace Selector: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students`, `/app/select-workspace?demo=no-workspace` ไม่มี Vite overlay/overflow
- ตรวจหลังเพิ่ม Care Case Lifecycle: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` ปิดเคส demo แล้วเปิดใหม่ได้
- ตรวจหลังเพิ่ม Student Profile summary: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` แสดง Student Profile/Quick Links ได้โดยไม่มี Vite overlay/overflow
- ตรวจหลังเพิ่ม Care Case inline edit: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` เปิดฟอร์มแก้ไขเคส demo ได้โดยไม่มี console error/overlay/overflow
- ตรวจหลังเพิ่ม Case Detail Panel: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` เลือกดูรายละเอียดเคส demo ได้โดยไม่มี console error/overlay/overflow
- ตรวจหลังเพิ่ม Home Visit / กสศ.01 foundation: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` บันทึกแบบเยี่ยมบ้าน demo ได้โดยไม่มี console error/overlay/overflow
- ตรวจหลังเพิ่ม `student_home_visits` migration และเชื่อม Student 360: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` ยังแสดงฟอร์มเยี่ยมบ้านได้โดยไม่มี console error/overlay/overflow
- ตรวจหลังเพิ่ม Home Visit Photo Attachment: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ browser `/app/dashboard?view=students` แสดง file input รูปถ่าย 2 ช่องโดยไม่มี console error/overlay/overflow
- ตรวจหลังเพิ่ม Home Visit Print / Save PDF: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=students` ได้ status `200`
- ตรวจหลังเพิ่ม Home Visit Photo Storage Bucket migration: `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจหลังเพิ่ม Student 360 Audit Trail foundation: `npm.cmd run lint` และ `npm.cmd run build` ผ่าน
- ตรวจหลังเพิ่ม Student Activity Timeline foundation: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=students` ได้ status `200`
- ตรวจหลังเพิ่ม System Readiness / Deployment Checklist foundation: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=setup` ได้ status `200`
- ตรวจหลังเพิ่ม readiness report export: `npm.cmd run lint`, `npm.cmd run build` ผ่าน และ HTTP `/app/dashboard?view=setup` ได้ status `200`
- ตรวจหลังเพิ่ม Audit Center foundation: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Cross-Module Audit Trail foundation: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=scores`, `/app/dashboard?view=savings`, `/app/dashboard?view=behavior`, `/app/dashboard?view=randomizer`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Report Export Package foundation: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=reports`, `/app/dashboard?view=setup`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Production Deployment Pack foundation: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=setup`, `/app/dashboard?view=package`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Local Deployment Readiness Script: `npm.cmd run check:deploy` ผ่าน 25/28 checks, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจหลังเพิ่ม Workspace Backup Package: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน, HTTP `/app/dashboard?view=import-export` ได้ status `200` และ browser แสดง Workspace Backup Package/ตรวจ Backup/Import Preview ครบ
- ตรวจหลังเพิ่ม Import/Backup Audit Trail: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, `npm.cmd run check:deploy` ผ่านตามสถานะเดิม 25/28, HTTP `/app/dashboard?view=import-export`, `/app/dashboard?view=audit`, `/app/dashboard?view=setup` ได้ status `200`
- ตรวจหลังเพิ่ม Workspace Settings: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, `npm.cmd run check:deploy` ผ่านตามสถานะเดิม 25/28, HTTP `/app/dashboard?view=workspace-settings`, `/app/dashboard?view=setup`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Core Summary Report: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, `npm.cmd run check:deploy` ผ่านตามสถานะเดิม 25/28, HTTP `/app/dashboard?view=reports`, `/app/dashboard?view=workspace-settings`, `/app/dashboard?view=setup` ได้ status `200`

หมายเหตุ: เครื่องนี้ยังไม่มี `deno` และ `supabase` CLI ใน PATH จึงยังไม่ได้รันหรือ deploy Edge Function จริง

## Score Center Update

- เพิ่มหน้า `/app/dashboard?view=scores` สำหรับสร้างชุดคะแนน บันทึกคะแนนรายนักเรียน ดูสรุป และ export CSV
- เพิ่ม migration `supabase/migrations/0007_scorebook_foundation.sql` สำหรับ `score_assessments` และ `score_entries` พร้อม RLS
- ตรวจแล้ว: `npm.cmd run lint`, `npm.cmd run build`, HTTP status `200`, browser ไม่มี Vite overlay/console error/horizontal overflow

## Savings And Behavior Update

- เพิ่มหน้า `/app/dashboard?view=savings` สำหรับฝาก/ถอนเงินออม ดูยอดคงเหลือรายคน timeline ธุรกรรม และ export CSV
- เพิ่มหน้า `/app/dashboard?view=behavior` สำหรับบันทึกพฤติกรรมเชิงบวก/ข้อห่วงใย คะแนน สถานะติดตาม และ export CSV
- เพิ่ม migration `supabase/migrations/0008_savings_behavior_foundation.sql` สำหรับ `savings_accounts`, `savings_transactions`, และ `behavior_records` พร้อม RLS
- ตรวจแล้ว: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, HTTP status `200` ทั้งสองหน้า, browser ไม่มี Vite overlay/console error/horizontal overflow

## Classroom Randomizer Update

- เพิ่มหน้า `/app/dashboard?view=randomizer` สำหรับสุ่มรายคน แบ่งกลุ่ม และสุ่มลำดับนำเสนอจากรายชื่อนักเรียน
- เพิ่ม migration `supabase/migrations/0009_randomizer_foundation.sql` สำหรับ `randomizer_sessions` พร้อม RLS
- ตรวจแล้ว: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, HTTP status `200`, browser ไม่มี Vite overlay/console error/horizontal overflow

## Cross-Module Audit Trail Update

- เพิ่ม helper กลาง `src/lib/auditLog.ts` สำหรับบันทึก `audit_logs` จาก frontend เมื่อเชื่อม Supabase workspace จริง
- เชื่อม audit event จาก Score Center, Savings, Behavior และ Classroom Randomizer เข้า Audit Center แล้ว
- Audit Center แสดง label/summary เพิ่มสำหรับ `score_assessment.*`, `score_entries.saved`, `savings_transaction.created`, `behavior_record.created`, และ `randomizer_session.created`
- ตรวจแล้ว: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, HTTP status `200` สำหรับหน้า scores/savings/behavior/randomizer/audit

## Report Export Package Update

- หน้า `/app/dashboard?view=reports` export ได้ทั้ง CSV, Excel-compatible `.xls`, JSON package และ PDF/พิมพ์ผ่านหน้ารายงานสะอาด
- JSON package มี filters, summary, rows, workspace id, timezone, timestamp และเครดิต สำหรับส่งต่อหรือ debug ข้ามเครื่อง
- PDF/พิมพ์ใช้ layout A4 landscape พร้อมหัวรายงาน summary ตารางรายละเอียด และเครดิต `Created by MIKPURINUT`
- ตรวจแล้ว: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, HTTP status `200` สำหรับ reports/setup/audit

## Environment Variables

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า Supabase จริง

ค่าที่ขึ้นต้นด้วย `VITE_` จะถูกเปิดเผยใน browser ได้เท่านั้น ห้ามใส่ secret จริงในตัวแปรเหล่านี้

Secret เช่น service role, Telegram token, LINE secret, Google Drive secret ต้องตั้งใน Supabase Edge Functions หรือ Cloudflare environment เท่านั้น

## กติกาแบรนด์

- ชื่อระบบหลักคือ `ClassCare 360`
- PWA App Name คือ `ClassCare 360`
- ใช้ `ClassCare 360 VIP` เฉพาะบริบทแพ็กเกจพรีเมียม การสมัคร ต่ออายุ สิทธิ์พิเศษ และฟีเจอร์พรีเมียม
- ห้ามใช้คำว่า VIP ต่อท้ายชื่อระบบหลักในโลโก้ Login Header PWA หรือรายงานทั่วไป

## Supabase Setup Draft

1. สร้าง Supabase project
2. ตั้งค่า Auth และ Google OAuth
3. รัน migration ใน `supabase/migrations/` ตาม `docs/04-production-deployment.md`
4. รัน seed ใน `supabase/seed.sql`
5. ตรวจ storage buckets `home-visit-photos` และ `payment-slips`
6. Deploy Edge Functions ในเฟสถัดไป

## งานถัดไป

1. ตรวจ migration core กับ Supabase local/remote
2. Deploy/test `accept-portal-invitation` กับ Supabase project จริง
3. ทดสอบ Student 360, Attendance, Parent/Student Portal กับ Supabase project จริง
4. Deploy/test `approve-payment-request` กับ Supabase project จริง
5. เริ่ม Supabase Edge Functions เพิ่มเติมกลุ่ม auth/audit/notification
6. เพิ่ม native XLSX/PDF generator สำหรับ Report Center
