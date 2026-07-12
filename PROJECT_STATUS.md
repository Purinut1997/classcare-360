# ClassCare 360 - PROJECT STATUS

อัปเดตล่าสุด: 2026-07-11  
Timezone: Asia/Bangkok  

## อัปเดตล่าสุด 2026-07-12

- เพิ่มหน้าแรก public landing page ที่ `/` สำหรับอธิบาย/โปรโมตระบบ ClassCare 360 แล้ว
- เพิ่ม deployment ชั่วคราวผ่าน Sites เพื่อให้มี URL ภายนอกสำหรับทดสอบเร็ว แต่ target production ตาม requirement คือ Cloudflare Pages
- เพิ่ม GitHub + Cloudflare Pages workflow document ที่ `docs/05-github-cloudflare-pages.md`
- เพิ่ม GitHub Actions CI ที่ `.github/workflows/ci.yml` เพื่อรัน `npm run lint`, `npm run build`, `npm run check:deploy` ทุกครั้งที่ push/PR เข้า `main`
- เพิ่ม npm script `deploy:cloudflare` สำหรับ manual deploy ไป Cloudflare Pages ผ่าน Wrangler เมื่อเครื่องมี `wrangler`/Cloudflare login พร้อม
- ตรวจเครื่องล่าสุด: local git remote ยังชี้ไปที่ Sites source repository ไม่ใช่ GitHub, และเครื่องนี้ยังไม่มี `gh`/`wrangler` ใน PATH
- เส้นทาง production ที่ควรทำต่อ: สร้าง GitHub repository จริง, push source ไป GitHub, แล้วเชื่อม Cloudflare Pages กับ GitHub repo ให้ deploy อัตโนมัติจาก branch `main`

## อัปเดตล่าสุด 2026-07-11

- เชื่อม Supabase Auth/Profile/Workspace flow ใช้งานจริงแล้ว
- เพิ่ม Superadmin/Admin lifetime VIP และหน้า Superadmin อยู่ใน shell หลักของ ClassCare แล้ว
- ปรับเมนูตามสิทธิ์: ครูร่วม, เจ้าของ workspace, Superadmin เห็นเมนูต่างกัน
- เจ้าของ workspace สามารถใช้งานห้องเรียนเองและจัดการสมาชิกได้
- เพิ่มระบบครูขอเข้า workspace ตามโรงเรียนใน profile และเจ้าของ workspace อนุมัติ/ปฏิเสธได้
- Dashboard เจ้าของ workspace แจ้งเตือนเมื่อมีคำขอเข้า workspace รออนุมัติ
- Superadmin เห็น Workspace Directory, ค้นหา/กรอง workspace, เข้าใช้งานภาพรวมโรงเรียนได้
- เพิ่มระบบจัดการ Admin/Superadmin จาก Superadmin Dashboard
- ปรับ System Setup ให้ตรวจ migration/RPC/storage/Edge Function ล่าสุดถึง `0014_workspace_join_requests.sql`
- regenerate `tmp/supabase-setup.sql` เป็นไฟล์รวม migration `0001`-`0014` + `seed.sql` สำหรับรันใน Supabase SQL Editor
- ตรวจล่าสุด: `npm.cmd run lint` ผ่าน, `npm.cmd run build` ผ่าน, `npm.cmd run check:deploy` ผ่าน 31/33 โดยเหลือ warning เฉพาะ Supabase CLI และ Deno ยังไม่อยู่ใน PATH ของเครื่องนี้

สถานะรวม: Phase 1/2 foundation เสร็จแล้ว, เริ่มต่อ Phase 4/5 ส่วน Supabase Auth session + onboarding จริงแล้ว, Student 360 CRUD foundation พร้อมใช้งานในระดับ repo แล้ว, เพิ่ม Student Profile รายคน, Care Quick Log, ตารางประวัติ `student_care_cases`, วงจรปิด/เปิดเคสดูแล, inline edit, Case Detail Panel, แบบเยี่ยมบ้าน กสศ.01 foundation, ตาราง `student_home_visits` พร้อม RLS, ช่องแนบรูปเยี่ยมบ้าน, storage bucket/policies สำหรับ `home-visit-photos` และปุ่มพิมพ์/Save PDF แบบเยี่ยมบ้านใน Student 360 แล้ว, เพิ่ม Workspace Selector ที่จำ active workspace ได้แล้ว, Attendance/Teacher Work foundation แล้ว, เพิ่ม Attendance -> Guardian Notification foundation แล้ว, เริ่ม Report Center foundation แล้ว, Import/Export/Backup foundation แล้ว, เพิ่ม DMC Excel import สำหรับรายชื่อนักเรียนแล้ว, เริ่ม Parent/Student Portal foundation แล้ว, เพิ่ม student account mapping ด้วย `student_profile_links` แล้ว, เพิ่ม Portal invitation foundation ด้วย `portal_invitations` แล้ว, เพิ่ม Edge Function และหน้า accept invitation แล้ว, เริ่ม Superadmin Payment Review foundation แล้ว, สร้าง Edge Functions สำคัญชุดแรกสำหรับ payment และ portal แล้ว, เริ่ม Notification Center foundation แล้ว, เพิ่ม Notification Dispatch Edge Function scaffold แล้ว และขยาย theme refresh ตาม reference โทน MIKPURINUT Nexus ไปถึง dashboard/auth/onboarding/guard/Student 360/Attendance/Reports/ImportExport/Notifications/Package/Pricing/placeholder routes แล้ว

## 1. สรุปจาก Prompt.txt

`Prompt.txt` เป็นสเปกระบบขนาดใหญ่สำหรับสร้าง **ClassCare 360** เว็บแอประบบผู้ช่วยครูประจำชั้นและดูแลนักเรียนครบวงจร รองรับหลายโรงเรียน/หลาย workspace โดยต้องแยกข้อมูลด้วย `workspace_id` อย่างปลอดภัย

ข้อมูลแบรนด์หลัก:

- ชื่อระบบหลัก: `ClassCare 360`
- ชื่อเต็ม: `ClassCare 360 ระบบผู้ช่วยครูและดูแลนักเรียนครบวงจร`
- แพ็กเกจพรีเมียม: `ClassCare 360 VIP`
- สโลแกน: `ดูแลทั้งห้อง ครบจบในระบบเดียว`
- เครดิต: `Created by MIKPURINUT`
- ภาษาเริ่มต้น: ภาษาไทย
- Timezone: `Asia/Bangkok`

กติกาการใช้ชื่อ:

- ใช้ `ClassCare 360` เป็นชื่อระบบหลักเท่านั้น
- ใช้ `ClassCare 360 VIP` เฉพาะบริบทแพ็กเกจพรีเมียม การสมัคร ต่ออายุ สิทธิ์พิเศษ และฟีเจอร์พรีเมียม
- ห้ามใช้คำว่า `VIP` ต่อท้ายชื่อระบบหลักในโลโก้, Login Header, PWA App Name หรือรายงานทั่วไป
- PWA App Name ต้องเป็น `ClassCare 360`

เทคโนโลยีหลักตาม Prompt:

- Frontend: React + Vite + TypeScript
- Hosting: Cloudflare Pages
- Backend Logic: Supabase Edge Functions หรือ Cloudflare Workers
- Database: Supabase PostgreSQL
- Auth: Supabase Auth + Google OAuth
- Authorization: Supabase RLS
- Storage: Supabase Storage หรือ Cloudflare R2
- Cold Storage: Google Drive ของผู้ใช้ หลังผู้ใช้เลือกเชื่อมภายหลัง
- Maps: Google Maps JavaScript API, Geocoding API, Routes API
- Reports: PDF/XLSX
- Notifications: In-App, Telegram Bot, LINE Messaging API / LINE Official Account
- PWA: Add to Home Screen / Install App

ข้อห้ามสำคัญ:

- ห้ามใช้ Google Sheet เป็นฐานข้อมูลหลัก
- ห้ามเก็บภาพ/สลิป/เอกสารเป็น base64 ใน database
- ห้ามใช้ `service_role` key ใน frontend
- ห้ามปิด RLS สำหรับตารางที่ frontend เข้าถึง
- ห้ามให้ผู้ใช้เห็นข้อมูล workspace อื่น
- ห้ามให้ parent/student เห็นข้อมูลของคนอื่น
- ห้าม hard-code secret/token/password/API key หรือ QR Code ใน frontend
- ห้ามโหลดข้อมูลทั้งหมดในครั้งเดียว
- ห้าม cache ข้อมูลส่วนบุคคลนักเรียนแบบไม่ปลอดภัยใน service worker
- Free Login ห้ามใช้โมดูลหลักถ้าไม่มี subscription active

## 2. Architecture ที่เลือกใช้ตอนนี้

Frontend:

- React + Vite + TypeScript
- React Router
- Tailwind CSS
- Lucide icons
- PWA manifest/offline foundation

Backend/Data:

- Supabase client แบบ optional ผ่าน `.env.local`
- Supabase Auth session resolver
- Supabase PostgreSQL migration draft
- RLS policy foundation
- Seed plans/module entitlements

Security Model:

- ทุกข้อมูลหลักผูก `workspace_id`
- Route guard ฝั่ง frontend ใช้เพื่อ UX เท่านั้น
- การบังคับสิทธิ์จริงต้องอยู่ที่ Supabase RLS และ Edge Functions
- Secret ทั้งหมดต้องอยู่ฝั่ง server/Supabase/Cloudflare เท่านั้น

## 3. โครงสร้างไฟล์สำคัญ

- `Prompt.txt` - requirement หลัก
- `PROJECT_STATUS.md` - ไฟล์สถานะและ handoff นี้
- `README.md` - คู่มือเริ่มต้น
- `.env.example` - ตัวอย่าง environment variables
- `docs/01-architecture.md` - Architecture Cloudflare + Supabase
- `docs/02-database-schema.md` - Database schema draft
- `docs/03-security-rls.md` - Security และ RLS design
- `docs/04-production-deployment.md` - Production Deployment Pack สำหรับ Supabase จริง
- `supabase/migrations/0001_core_foundation.sql` - migration core foundation
- `supabase/seed.sql` - seed plan และ module entitlement
- `src/lib/supabaseClient.ts` - Supabase client optional
- `src/lib/session.ts` - Supabase Auth session resolver ล่าสุด
- `src/lib/auth.ts` - demo sessions และ route helper
- `src/lib/roles.ts` - role helper
- `src/lib/entitlements.ts` - plan/module entitlement helper
- `src/routes/RouteGuards.tsx` - route guard foundation
- `src/App.tsx` - route composition
- `src/pages/auth/LoginPage.tsx` - Login/Register/Forgot + Google OAuth foundation
- `src/pages/auth/CompleteProfilePage.tsx` - Complete Profile ต่อ Supabase แล้ว
- `src/pages/app/WorkspaceSetupPage.tsx` - สร้าง workspace + membership + trial subscription ได้แล้วเมื่อ Supabase พร้อม
- `src/pages/app/DashboardPage.tsx` - dashboard foundation
- `src/pages/app/PackagePage.tsx` - package/payment foundation
- `src/pages/superadmin/SuperadminDashboard.tsx` - superadmin foundation
- `src/pages/portal/PortalHome.tsx` - parent/student portal foundation

## 4. สิ่งที่ทำเสร็จแล้ว

Phase 0 - Understanding/Handoff:

- อ่าน requirement จาก `Prompt.txt`
- สรุประบบหลักและข้อห้ามสำคัญ
- แบ่งเฟสการพัฒนา
- สร้าง/ปรับ `PROJECT_STATUS.md`

Phase 1 - Architecture/Database/Security:

- เพิ่มเอกสาร architecture, schema, security/RLS ใน `docs/`
- สร้าง migration core foundation
- สร้าง seed plan: `FREE_LOGIN`, `TRIAL_30`, `VIP_YEARLY`
- เพิ่ม RLS policy หลักสำหรับ profile, workspace, membership, subscription, payment, notification, audit, edit history

Phase 2 - Frontend Foundation:

- Scaffold React/Vite/TypeScript
- เพิ่ม Tailwind CSS
- เพิ่ม dashboard shell ภาษาไทย
- แตกโครง `components`, `layouts`, `pages`, `routes`, `lib`, `types`
- เพิ่ม React Router
- เพิ่ม route guard สำหรับ session, workspace, role, subscription, entitlement
- เพิ่ม demo session ผ่าน `?demo=teacher`, `?demo=free`, `?demo=expired`, `?demo=no-workspace`, `?demo=parent`, `?demo=student`, `?demo=viewer`, `?demo=superadmin`, `?demo=signed-out`
- เพิ่ม Login/Register/Forgot foundation
- เพิ่ม Google OAuth button แบบไม่ขอ Drive scope ตอน login
- เพิ่ม Complete Profile foundation
- เพิ่ม Workspace Setup foundation
- เพิ่ม PWA manifest/offline page เบื้องต้น
- เริ่ม theme refresh ตาม reference: grid background ฟ้า, glass panels, pill controls, blue action buttons, Anuphan font, hero visual scene และ card hover motion
- ขยาย theme refresh ไปยัง `/login`, `/auth/complete-profile`, `/app/select-workspace` และ route guard notice
- ขยาย theme refresh ไปยัง `Student 360`, `Attendance/Teacher Work`, `Report Center` และ `Package`
- เพิ่ม utility class กลางใน `src/styles/globals.css` สำหรับ `nexus-card`, `nexus-kicker`, `nexus-field`, `nexus-muted-box`, `nexus-icon-button`, `blue-action`, `dark-action`, `amber-action`
- ห่อ `/app/package` ด้วย `AppShell` แล้ว เพื่อให้ package ใช้ grid background, sidebar และ mobile nav ชุดเดียวกับหน้า app อื่น
- ปรับ `RoutePlaceholder` กลางให้ใช้ classcare grid background, glass panel, dark checklist panel และ pill/blue action buttons
- เปลี่ยน `/pricing` จาก placeholder เป็นหน้าแพ็กเกจจริงขึ้น มีแผน `FREE_LOGIN`, `TRIAL_30`, `ClassCare 360 VIP` และ payment guard checklist
- ปรับ session loading/error screen ใน `App.tsx` ให้เข้า theme เดียวกัน

Phase 4/5 - Auth/Workspace Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม `src/lib/session.ts`
- `App.tsx` โหลด Supabase Auth user/profile/workspace/subscription จริงเมื่อมี `.env.local`
- `?demo=` ยังใช้บังคับ demo mode ได้เพื่อทดสอบ guard
- เพิ่ม loading/error screen สำหรับ session resolver
- `CompleteProfilePage` upsert `profiles` จริงได้
- `WorkspaceSetupPage` สร้าง `workspaces`, `workspace_memberships`, และ `subscriptions` trial 30 วันจริงได้
- ปรับ RLS onboarding:
  - ผู้ใช้ insert profile ตัวเองได้
  - เจ้าของ workspace เห็น workspace ที่สร้างเองได้
  - เจ้าของ workspace เพิ่ม membership ตัวเองเป็น `teacher_owner` ได้
  - เจ้าของ workspace สร้าง initial `TRIAL_30` subscription จาก onboarding ได้
- เพิ่ม function `public.owns_workspace`
- เพิ่ม function `public.workspace_has_subscription`
- ปรับ seed trial entitlement จาก `reports_limited` เป็น `reports` ให้ตรงกับ `ModuleKey`

Phase 6 - Student 360 Foundation ที่เริ่มต่อแล้ว:

- เพิ่มตาราง `classrooms`
- เพิ่มตาราง `students`
- เพิ่มตาราง `student_guardians`
- เพิ่ม trigger `touch_updated_at` ให้ตาราง Student 360 ชุดแรก
- เปิด RLS ให้ `classrooms`, `students`, `student_guardians`
- เพิ่ม policy สำหรับครูใน workspace อ่าน/เพิ่ม/แก้ไขข้อมูลนักเรียนได้ตาม role
- เพิ่ม policy ให้ parent/guardian อ่านข้อมูลนักเรียนที่ผูกกับตัวเองและ `consent_status = granted` เท่านั้น
- เพิ่มหน้า `src/pages/app/StudentsPage.tsx`
- เมนู `นักเรียน` ใน dashboard แยกไปหน้า Student 360 จริงแล้ว
- หน้า Student 360 มี summary, search, roster table, empty state, form เพิ่มนักเรียน
- เมื่อมี Supabase env และ workspace จริง หน้า Student 360 โหลด `classrooms/students` ผ่าน RLS
- เมื่อไม่มี Supabase env หน้า Student 360 ใช้ demo data และเพิ่มรายการ local เพื่อทดสอบ UX
- ขยายหน้า Student 360 ให้สร้างห้องเรียนได้
- ขยายหน้า Student 360 ให้แก้ไขข้อมูลนักเรียนได้
- ขยายหน้า Student 360 ให้เปลี่ยนสถานะนักเรียนเป็น `archived` และนำกลับมา `active` ได้
- เพิ่ม selected student detail สำหรับดูผู้ปกครองที่ผูกกับนักเรียน
- เพิ่มฟอร์ม `student_guardians` สำหรับบันทึกผู้ปกครองและสถานะ consent
- CRUD foundation รอบนี้ยังคงใช้ Supabase RLS และ `workspace_id` ทุก mutation

Phase 7 - Attendance / Teacher Work Foundation ที่เริ่มต่อแล้ว:

- เพิ่มตาราง `attendance_sessions`
- เพิ่มตาราง `attendance_records`
- เพิ่ม trigger `touch_updated_at` ให้ตาราง attendance
- เปิด RLS ให้ `attendance_sessions` และ `attendance_records`
- เพิ่ม policy ให้ครูใน workspace อ่าน/สร้าง/แก้ไขรอบเช็คชื่อและรายการเช็คชื่อได้
- เพิ่ม policy ให้ guardian ที่ผูกกับนักเรียนและ `consent_status = granted` อ่าน attendance record ของนักเรียนคนนั้นได้เท่านั้น
- ปรับ policy ข้อมูลนักเรียน/attendance ให้ไม่ใช้ `is_workspace_member` กว้างเกินไปกับ parent/student
- เพิ่มหน้า `src/pages/app/AttendancePage.tsx`
- เมนู `งานครู` ใน dashboard แยกไปหน้าเช็คเวลาเรียนจริงแล้ว
- หน้า Attendance มีเลือกห้องเรียน, วันที่, ช่วงเวลา, วิชา/กิจกรรม, เปิดรอบเช็คชื่อ, mark ทั้งห้อง, mark รายคน, note รายคน และบันทึกลง `attendance_records`
- เมื่อไม่มี Supabase env หน้า Attendance ใช้ demo data เพื่อทดสอบ UX

Phase 8 - Report Center Foundation ที่เริ่มต่อแล้ว:

- เพิ่มหน้า `src/pages/app/ReportsPage.tsx`
- เมนู `รายงาน` ใน dashboard แยกไปหน้า Report Center จริงแล้ว
- รายงานชุดแรกเป็น Attendance Summary จาก `attendance_sessions` และ `attendance_records`
- มีตัวกรองห้องเรียน, วันที่เริ่มต้น, วันที่สิ้นสุด และคำค้นหา
- มี summary ตามสถานะ มา/ขาด/สาย/ลา/ป่วย/กิจกรรม
- มีตารางรายละเอียดรายนักเรียน
- เพิ่ม CSV export ฝั่ง browser พร้อม UTF-8 BOM สำหรับภาษาไทย
- เพิ่มปุ่มพิมพ์รายงานผ่าน `window.print()`
- แสดงเครดิต `Created by MIKPURINUT` ในหน้าและ CSV export
- เมื่อไม่มี Supabase env หน้า Report Center ใช้ demo data เพื่อทดสอบ UX
- เพิ่ม Excel-compatible export เป็น `.xls` มี summary และรายละเอียด พร้อมเครดิต `Created by MIKPURINUT`

Phase 8.5 - Package / Payment Request Foundation ที่เริ่มต่อแล้ว:

- เปลี่ยน `src/pages/app/PackagePage.tsx` จาก placeholder เป็น workflow คำขอชำระเงินจริงขึ้น
- หน้า Package รับ `session` จาก route และตรวจว่าเฉพาะเจ้าของ workspace จึงสร้างคำขอชำระเงินได้
- โหลดแผน `VIP_YEARLY`, `payment_qr_codes`, `referral_credits`, `payment_requests` ผ่าน Supabase เมื่อมี `.env.local`
- เมื่อไม่มี Supabase env ใช้ demo data เพื่อทดสอบ UX
- คำนวณราคา, referral credit ที่ available และยอดชำระจริง
- รองรับเลือกไฟล์สลิป image/PDF โดยไม่แปลงเป็น base64
- เมื่อมี Supabase จะอัปโหลดสลิปเข้า bucket `payment-slips` และสร้าง metadata ใน `app_files` เป็น `privacy_level = sensitive`
- สร้าง `payment_requests` เป็น `draft` หรือ `pending_review` ตามการแนบสลิป
- แสดงประวัติคำขอชำระเงินล่าสุดของ workspace
- เพิ่ม security checklist ว่า QR ต้องมาจาก `payment_qr_codes`, สลิปเป็น private/sensitive file และการอนุมัติจริงต้องผ่าน backend
- ปรับ RLS ของ `payment_requests` และ `refund_requests` ให้ select ได้เฉพาะ superadmin, เจ้าของ request หรือ `teacher_owner` ของ workspace ไม่ใช้ `is_workspace_member` กว้างเกินไป

Phase 9 - Superadmin Payment Review Foundation ที่เริ่มต่อแล้ว:

- เปลี่ยน `src/pages/superadmin/SuperadminDashboard.tsx` จาก placeholder เป็น dashboard foundation จริง
- มี hero + system guard สำหรับ workflow superadmin
- มีสรุปจำนวนคำขอรอตรวจ, อนุมัติแล้ว, QR active และ subscription active/trial
- โหลด `payment_requests`, `payment_qr_codes`, `subscriptions` ผ่าน Supabase เมื่อมี `.env.local`
- เมื่อไม่มี Supabase env ใช้ demo data สำหรับทดสอบ UX
- มีตัวกรองคิวตรวจสลิป: รอตรวจ, ทั้งหมด, อนุมัติ, ไม่อนุมัติ
- มี action อนุมัติ/ปฏิเสธ payment request ใน demo mode และ update `payment_requests.status` เมื่อมี Supabase
- เมื่อมี Supabase จะพยายาม insert `audit_logs` สำหรับ action `payment_request.approved` หรือ `payment_request.rejected`
- หน้า Superadmin เรียก `approve-payment-request` ผ่าน `supabase.functions.invoke` เมื่อมี Supabase จริง
- ขั้นเปิด subscription จริงหลังอนุมัติถูกย้ายเป็น Edge Function scaffold แล้ว แต่ยังไม่ได้ deploy/test กับ Supabase project จริง

Phase 10 - Edge Function Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม `supabase/functions/approve-payment-request/index.ts`
- เพิ่ม `supabase/functions/README.md`
- Function ตรวจ `Authorization` bearer token ของผู้เรียก
- Function ตรวจ active superadmin จาก `superadmin_profiles`
- รองรับ action `approve` และ `reject`
- `reject` จะอัปเดต `payment_requests.status = rejected` และบันทึก `audit_logs`
- `approve` จะตรวจสถานะ `pending_review`, ตรวจสลิปเมื่อยอดชำระมากกว่า 0, อัปเดต `payment_requests.status = approved`, ปิด subscription `trial/active` เดิม, สร้าง subscription `active` ใหม่ และบันทึก `audit_logs` ระดับ `critical`
- แก้ audit insert ใน Superadmin frontend จาก `entity_type` เป็น `entity_table` ให้ตรง schema

Phase 11 - Parent/Student Portal Foundation ที่เริ่มต่อแล้ว:

- เปลี่ยน `src/pages/portal/PortalHome.tsx` จาก placeholder เป็น portal foundation จริง
- `PortalRoute` ส่ง `session` และ `portalRole` เข้า `PortalHome`
- Parent Portal แสดง hero, privacy guard, summary เวลาเรียน, นักเรียนในสิทธิ์ และ timeline เวลาเรียนล่าสุด
- เพิ่มตาราง `student_profile_links` สำหรับผูกบัญชี role `student` กับ record นักเรียนจริง
- Student Portal query `student_profile_links` ที่ `status = active` แล้ว เพื่ออ่านข้อมูลเฉพาะนักเรียนของบัญชีนั้นผ่าน RLS
- เมื่อมี Supabase env จะ query `student_guardians`, `student_profile_links` และ `attendance_records` ตาม RLS
- เมื่อไม่มี Supabase env ใช้ demo data เพื่อทดสอบ UX
- ยังยึดหลัก privacy: parent เห็นเฉพาะ guardian link ที่ consent `granted`, student เห็นเฉพาะ link ของตัวเองที่ active

Phase 12 - Student Account Link Management ที่เริ่มต่อแล้ว:

- เพิ่ม UI ใน `src/pages/app/StudentsPage.tsx` สำหรับครูผูกบัญชี Student Portal กับนักเรียน
- หน้า Student 360 โหลด `student_profile_links` ตาม `workspace_id`
- เลือกนักเรียนแล้วดูบัญชี student ที่ผูกไว้ได้
- กรอก `profile_id` ของบัญชี role `student` และตั้งสถานะ `invited`, `active`, `suspended`, `removed` ได้
- อัปเดตสถานะ link ได้จากหน้า Student 360 โดยยังคุมผ่าน RLS และ `workspace_id`
- โหมด demo ทำงานแบบ local เพื่อทดลอง UX ได้ทันที
- ยังมีช่องทาง manual `profile_id` ไว้ใช้ทดสอบ แต่ workflow หลักควรใช้ invitation foundation ใน Phase 13

Phase 13 - Portal Invitation Foundation ที่เริ่มต่อแล้ว:

- เพิ่มตาราง `portal_invitations` ใน migration core
- `portal_invitations` เก็บ `workspace_id`, `student_id`, `portal_role`, `invite_email`, `relation`, `status`, `invited_by`, `accepted_by`, `accepted_at`, `expires_at`
- เพิ่ม indexes, trigger `touch_updated_at` และ RLS policies สำหรับ `portal_invitations`
- ครูใน workspace และ superadmin อ่าน/สร้าง/อัปเดตคำเชิญได้
- ผู้รับคำเชิญอ่าน invite ของตัวเองได้เมื่อ `profiles.email` ตรงกับ `invite_email`
- เพิ่ม UI ใน Student 360 สำหรับสร้างคำเชิญ Parent/Student Portal ด้วย email
- หน้า Student 360 แสดงคำเชิญของนักเรียนที่เลือก และเปลี่ยนสถานะ `invited`, `revoked`, `expired` ได้
- โหมด demo สร้างคำเชิญ local ได้ทันที
- ขั้น accept invitation จริงยังต้องทำผ่าน Edge Function เพื่อสร้าง `student_guardians` หรือ `student_profile_links` แบบปลอดภัย

Phase 14 - Accept Portal Invitation Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม `supabase/functions/accept-portal-invitation/index.ts`
- Function ตรวจ bearer token, profile email, invitation status และวันหมดอายุ
- Function สร้าง profile พื้นฐานให้ได้ถ้าผู้ใช้ auth ยังไม่มี row ใน `profiles`
- Function สร้าง/เปิด `workspace_memberships` role `parent` หรือ `student` ให้ผู้รับคำเชิญ
- ถ้า invite เป็น parent จะสร้างหรืออัปเดต `student_guardians` พร้อม `consent_status = granted`
- ถ้า invite เป็น student จะสร้างหรือเปิด `student_profile_links.status = active` และกันกรณี student/profile ถูก link กับคนอื่นแล้ว
- Function อัปเดต `portal_invitations.status = accepted` และบันทึก `audit_logs`
- เพิ่มหน้า `src/pages/portal/PortalInvitationsPage.tsx`
- เพิ่ม route `/portal/invitations` โดยต้อง login แต่ไม่ต้องมี workspace ก่อน
- หน้า invitation โหลด invite ของ email ที่ login อยู่ และเรียก `supabase.functions.invoke('accept-portal-invitation')`
- Demo mode รับคำเชิญ local ได้และแสดงปุ่มไป Parent/Student Portal
- ยังไม่ได้ deploy/test Function กับ Supabase project จริงเพราะเครื่องนี้ยังไม่มี Supabase CLI/Deno

Phase 15 - Guardian Import + Portal Invite Batch Foundation ที่เริ่มต่อแล้ว:

- ขยาย `src/pages/app/ImportExportPage.tsx` จาก student import/export ไปถึง Guardian CSV
- เพิ่ม template `classcare-guardians-template.csv`
- Guardian CSV ใช้ columns: `student_code`, `relation`, `guardian_name`, `guardian_email`, `guardian_phone`, `consent_status`, `create_portal_invite`
- Preview จับคู่ผู้ปกครองกับนักเรียนจาก `student_code`
- ตรวจ error: ไม่มี student_code, ไม่พบนักเรียน, ไม่มี guardian_name, email ไม่ถูกต้อง
- ตรวจ warning: ไม่มี email/phone และข้อมูลซ้ำในไฟล์เดียวกัน
- Import จริงจะ insert `student_guardians`
- ถ้า `create_portal_invite = yes` และมี email จะ insert `portal_invitations` role `parent` พร้อมกัน
- บันทึก `import_jobs` สำหรับ `guardians` พร้อม preview/error summary
- โหมด demo import ผู้ปกครองและนับคำเชิญได้เพื่อทดสอบ workflow โดยไม่ต้องมี Supabase

Phase 16 - Notification Center Foundation ที่เริ่มต่อแล้ว:

- เพิ่มหน้า `src/pages/app/NotificationsPage.tsx`
- เพิ่มเมนู `แจ้งเตือน` ใน dashboard route `/app/dashboard?view=notifications`
- ผูกโมดูลกับ entitlement key `notifications` ซึ่งเปิดใน `VIP_YEARLY`
- โหลดข้อมูลจากตาราง `notifications` โดยผูก `workspace_id` และ `profile_id`
- มี demo fallback เมื่อยังไม่มี `.env.local` หรือ Supabase client
- แสดง inbox, unread count, channel readiness และ privacy level
- รองรับ filter: ทั้งหมด, ยังไม่อ่าน, In-App, Telegram, LINE
- อ่าน channel metadata จาก `data.channels` หรือ `data.channel` โดยไม่เพิ่ม secret ใน frontend
- Mark read รายการเดียวและ mark all read ผ่าน RLS ของ `notifications_update_read_self`
- เตรียมฐานให้ Edge Function `notification dispatch` ส่งจริงในอนาคตโดยให้ backend ถือ Telegram/LINE secrets เท่านั้น

Phase 17 - Notification Dispatch Edge Function Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม `supabase/functions/dispatch-notification/index.ts`
- เพิ่มตาราง `notification_dispatch_logs` ใน migration พร้อม index และ RLS select/insert/update เบื้องต้น
- Function ตรวจ `Authorization` bearer token และยืนยันผู้เรียกเป็น active superadmin หรือ workspace teacher
- Function insert `notifications` พร้อม `data.channels`
- Function บันทึกผล channel ลง `notification_dispatch_logs`
- Function บันทึก `audit_logs` action `notification.dispatched`
- รองรับ channel `in_app`, `telegram`, `line`
- Telegram/LINE ใช้ env ฝั่ง Supabase Functions เท่านั้น: `TELEGRAM_BOT_TOKEN`, `LINE_CHANNEL_ACCESS_TOKEN`
- ถ้าไม่มี env หรือไม่มี recipient id จะ log เป็น `skipped` แทนการส่งจริง
- เพิ่มปุ่มสร้างแจ้งเตือนทดสอบใน `src/pages/app/NotificationsPage.tsx`
- ใน demo mode ปุ่มทดสอบสร้าง local notification ได้โดยไม่ต้องมี Supabase
- เมื่อมี Supabase env ปุ่มทดสอบเรียก `supabase.functions.invoke('dispatch-notification')`
- อัปเดต `supabase/functions/README.md` พร้อม deploy command และตัวอย่าง body

Phase 18 - DMC Student Import Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม dependency `read-excel-file` สำหรับอ่านไฟล์ `.xlsx` ฝั่ง browser โดย `npm audit --audit-level=moderate` ผ่าน `0 vulnerabilities`
- อ่านตัวอย่างไฟล์ DMC `2569-1-student (2).xlsx` แล้วพบ header แถวที่ 2 และข้อมูลนักเรียนเริ่มแถวที่ 3
- รองรับคอลัมน์ DMC สำคัญ: `ชั้น`, `ห้อง`, `เลขประจำตัวนักเรียน`, `เพศ`, `คำนำหน้าชื่อ`, `ชื่อ`, `นามสกุล`, `วันเกิด`, `น้ำหนัก`, `ส่วนสูง`
- เพิ่มการอัปโหลด DMC Excel ใน `src/pages/app/ImportExportPage.tsx`
- หลังอัปโหลด ระบบอ่านชั้น/ห้องทั้งหมดจากไฟล์และให้ครูเลือกชั้นที่ดูแลก่อน preview
- Preview เฉพาะนักเรียนในชั้น/ห้องที่เลือก
- แปลง `วันเกิด` แบบ พ.ศ. เช่น `28/05/2564` เป็น ISO date สำหรับ `students.birth_date`
- แปลงเพศ DMC เป็น `male`, `female`, `other`, `unspecified`
- บันทึกข้อมูล DMC เพิ่มใน `students.metadata` เช่น prefix, เลขบัตร/เลขประจำตัวชุดแรก, โรงเรียน, น้ำหนัก, ส่วนสูง, ชั้น, ห้อง
- เพิ่มฟอร์ม “เพิ่มนักเรียนเอง” เพื่อใส่เลขประจำตัว, ชื่อ, นามสกุล, ชื่อเล่น และชั้น/ห้อง แล้วเพิ่มเข้า preview ก่อน import
- Import ยังใช้ workflow เดิม: preview ก่อน, ตรวจ duplicate, สร้าง classroom ถ้ายังไม่มี, insert `students`, บันทึก `import_jobs`

Phase 19 - Report Excel Export Foundation ที่เริ่มต่อแล้ว:

- เพิ่มปุ่ม `Excel` ใน `src/pages/app/ReportsPage.tsx`
- Export เป็นไฟล์ `.xls` แบบ Excel-compatible HTML table พร้อม UTF-8 BOM
- ไฟล์มีส่วนสรุปสถานะเวลาเรียนและตารางรายละเอียด
- ใส่ช่วงวันที่, ชื่อโรงเรียน/workspace และเครดิต `Created by MIKPURINUT`
- ยังไม่ใช่ native `.xlsx` generator และยังไม่มี PDF file generator จริง

Phase 20 - Attendance Guardian Notification Foundation ที่เริ่มต่อแล้ว:

- เพิ่มปุ่ม `แจ้งผู้ปกครอง` ใน `src/pages/app/AttendancePage.tsx`
- นับเฉพาะนักเรียนสถานะ `absent`, `late`, `leave`, `sick`
- เมื่อมี Supabase จริง จะค้น `student_guardians` ที่ `consent_status = granted` และมี `profile_id`
- เรียก `supabase.functions.invoke('dispatch-notification')` เพื่อสร้าง In-App notification ให้ผู้ปกครอง
- notification ใช้ type `attendance_guardian_alert`, privacy `restricted`, data ผูก `attendance_date`, `attendance_status`, `classroom_id`, `student_id`
- Demo mode กดส่งแล้วแสดง notice ได้ทันทีโดยไม่ต้องมี Supabase
- ยังไม่ได้ทดสอบ dispatch จริงกับ Supabase project/Edge Function ที่ deploy แล้ว

Phase 21 - Student Care Quick Log Foundation ที่เริ่มต่อแล้ว:

- เพิ่มส่วน `Care Quick Log` ใน `src/pages/app/StudentsPage.tsx`
- ครูเลือกนักเรียนแล้วบันทึกระดับติดตาม `normal`, `watch`, `urgent`
- บันทึกประเภทเคส, note ล่าสุด และสิ่งที่ต้องทำต่อ ลง `students.care_flags`
- ตาราง Student 360 ใช้ `care_flags.carePriority` เพื่อแสดง badge ติดตาม
- ใช้ RLS update policy ของ `students` เดิม ไม่ต้องเพิ่มตารางใหม่ในรอบนี้
- Demo mode บันทึก care log และอัปเดต summary ได้ทันที
- เพิ่ม migration `supabase/migrations/0002_student_care_cases.sql` สำหรับตาราง `student_care_cases`, index, trigger updated_at และ RLS เฉพาะครู/superadmin
- `Care Quick Log` สร้างประวัติรายเคสลง `student_care_cases` พร้อมอัปเดต summary ใน `students.care_flags`
- หน้า Student 360 แสดง `Case Timeline` ล่าสุดของนักเรียนที่เลือก และ demo mode เพิ่ม timeline item ได้ทันที

Phase 22 - Workspace Selector Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม `activeWorkspaceStorageKey` และ `setStoredActiveWorkspaceId()` ใน `src/lib/session.ts`
- session resolver เลือก workspace จาก localStorage ก่อน ถ้าไม่พบหรือไม่มีสิทธิ์จะ fallback เป็น membership แรก
- หน้า `src/pages/app/WorkspaceSetupPage.tsx` โหลด workspace จริงจาก `workspace_memberships`
- ปุ่มเลือก workspace บันทึก active workspace แล้ว reload เข้า `/app/dashboard`
- หลังสร้าง workspace ใหม่จะตั้ง workspace นั้นเป็น active workspace ทันที

Phase 23 - Student Care Case Lifecycle ที่เริ่มต่อแล้ว:

- เพิ่ม action ใน `Case Timeline` ของ `src/pages/app/StudentsPage.tsx`
- เคสสถานะ `open` เปลี่ยนเป็น `monitoring` หรือ `closed` ได้
- เคสสถานะ `monitoring` เปลี่ยนกลับเป็น `open` หรือปิดเป็น `closed` ได้
- เคสสถานะ `closed`/`archived` เปิดใหม่เป็น `open` ได้
- เมื่อปิด/เก็บเคสจะอัปเดต `closed_at`; เมื่อเปิดใหม่จะล้าง `closed_at`
- ใช้ RLS update policy ของ `student_care_cases` จาก migration `0002_student_care_cases.sql`

Phase 24 - Student Profile Summary Foundation ที่เริ่มต่อแล้ว:

- เพิ่มส่วน `Student Profile` ใน `src/pages/app/StudentsPage.tsx`
- แสดงข้อมูลนักเรียนที่เลือก: รหัส, ห้องเรียน, ปีการศึกษา, ชื่อเล่น และสถานะนักเรียน
- เพิ่ม summary cards สำหรับสถานะนักเรียน, จำนวนเคสเปิดอยู่, consent ผู้ปกครอง และสถานะ Student Portal
- เพิ่มกล่อง `ผู้ปกครองหลัก`, `เคสดูแลล่าสุด`, `ข้อมูลพื้นฐาน`
- เพิ่ม `Quick Links` สรุปจำนวนผู้ปกครอง, คำเชิญ Portal, บัญชี Student และจำนวนเคสดูแล
- ปุ่ม `แก้ไขข้อมูล` ใช้ action เดิม `startEditStudent()` เพื่อดึงข้อมูลนักเรียนเข้าแบบฟอร์มแก้ไข

Phase 25 - Student Care Case Edit Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม inline edit ใน `Case Timeline` ของ Student 360
- แก้ไขประเภทเคส, ระดับติดตาม, รายละเอียดเคส และสิ่งที่ต้องทำต่อได้จากการ์ดเคสเดิม
- เชื่อม update กับตาราง `student_care_cases` โดยใช้ `workspace_id` guard เหมือน lifecycle เดิม
- รองรับ demo/local state สำหรับทดสอบโดยไม่ต้องมี Supabase จริง
- ยังคงปุ่มเปลี่ยนสถานะเคสเดิมไว้ในโหมดดูปกติ

Phase 26 - Student Care Case Detail Panel ที่เริ่มต่อแล้ว:

- เพิ่ม `Case Detail` panel ใน Student 360 สำหรับเคสดูแลที่เลือก
- เพิ่มปุ่ม `ดูรายละเอียด` ใน `Case Timeline` เพื่อเลือกเคสที่ต้องการดู
- แสดงประเภทเคส, นักเรียน, ห้องเรียน, ระดับติดตาม, สถานะ, วันเปิด/ปิดเคส, ผู้ปกครองหลัก, บันทึกเคส และสิ่งที่ต้องทำต่อ
- เคสที่เลือกมี highlight บน timeline และ sync อัตโนมัติเมื่อเปลี่ยนนักเรียน
- เพิ่มปุ่ม `แก้ไขเคสนี้` และปุ่มเปลี่ยนสถานะจาก panel รายละเอียดโดยใช้ action เดิม

Phase 27 - Home Visit / กสศ.01 Foundation ที่เริ่มต่อแล้ว:

- อ่านและอ้างอิง PDF `แบบฟอร์ม นร._กสศ. 01 แบบขอรับเงินอุดหนุนนักเรียนยากจน.pdf` จำนวน 5 หน้า
- สรุปหมวดสำคัญจากแบบ: ข้อมูลนักเรียน/ผู้ปกครอง, สมาชิกและรายได้ครัวเรือน, สภาพที่อยู่อาศัย, การเดินทาง, ที่อยู่, รูปถ่ายที่พักอาศัย, การรับรองข้อมูล และข้อมูลส่วนบุคคล
- เพิ่ม `Home Visit / กสศ.01` section ใน `src/pages/app/StudentsPage.tsx`
- เก็บข้อมูล foundation ไว้ใน `students.care_flags.homeVisit` เพื่อทดลองใช้งานก่อนแยกตารางจริง
- เพิ่มฟอร์มบันทึกวันที่เยี่ยมบ้าน, ผู้ปกครอง, ความสัมพันธ์, สมาชิกครัวเรือน, รายได้, ภาระพึ่งพิง, การอยู่อาศัย, ที่อยู่, วัสดุบ้าน, ห้องส้วม, น้ำดื่ม, ไฟฟ้า, ที่ดินเกษตร, การเดินทาง, ภาพถ่าย และ consent
- เพิ่ม completion percent และสถานะ `draft`/`ready`/`submitted` สำหรับประเมินความครบถ้วน
- รองรับ demo/local state และ Supabase update ผ่าน `students.care_flags`

Phase 28 - Student Home Visits Table Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม migration `supabase/migrations/0003_student_home_visits.sql`
- สร้างตาราง `student_home_visits` สำหรับเก็บแบบเยี่ยมบ้าน/กสศ.01 แยกจาก `students.care_flags`
- เก็บข้อมูลหลัก: `academic_year`, `term`, `form_code`, `form_version`, `status`, `form_data`, `completion_percent`, จำนวนสมาชิกครัวเรือน, รายได้ครัวเรือน, ที่อยู่, การเดินทาง, สถานะรูปถ่าย, consent, วันที่เยี่ยมบ้าน, ผู้เยี่ยมบ้าน และ metadata
- เพิ่ม index สำหรับ workspace/student/status และ unique active visit ต่อ student/year/term
- เพิ่ม RLS ให้ teacher_owner/teacher_member/superadmin select/insert/update ได้
- ปรับ `StudentsPage.tsx` ให้โหลด `student_home_visits` ถ้ามี table แล้ว และ fallback เป็น `care_flags.homeVisit` ถ้ายังไม่ได้รัน migration
- ปรับการบันทึกแบบเยี่ยมบ้านให้ insert/update `student_home_visits` และยังสำรอง summary ใน `students.care_flags`

Phase 29 - Home Visit Photo Attachment Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม field รูปถ่ายใน `HomeVisitFormState`: รูปภายนอกที่พักอาศัยและรูปภายในที่พักอาศัย
- เพิ่ม file input 2 ช่องในฟอร์มเยี่ยมบ้านตามแบบ กสศ.01 หน้า 4
- demo mode บันทึกชื่อไฟล์และ file id จำลองลง form state ได้
- Supabase mode อัปโหลดรูปไป bucket `home-visit-photos` และสร้าง metadata ใน `app_files`
- เก็บ file id/ชื่อไฟล์ใน `student_home_visits.form_data`
- คำนวณ `photo_status` เป็น `pending`/`partial`/`complete`/`exempted`
- ปรับ completion percent ให้คิดรูปภายนอกและรูปภายในเป็น field สำคัญของแบบเยี่ยมบ้าน

Phase 30 - Home Visit Print / Save PDF Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม helper `renderHomeVisitPrintHtml()` ใน `src/pages/app/StudentsPage.tsx`
- เพิ่มปุ่ม `พิมพ์ / Save PDF` ในฟอร์ม Home Visit / กสศ.01
- สร้างเอกสาร HTML print-ready ขนาด A4 พร้อมส่วนข้อมูลนักเรียน, ครัวเรือน, ที่อยู่อาศัย, การเดินทาง, รูปถ่าย และช่องลงนาม
- ใช้ข้อมูลล่าสุดในฟอร์มหน้าจอ ไม่จำเป็นต้อง reload ก่อนพิมพ์
- เปิดหน้าพิมพ์ผ่าน browser และให้ผู้ใช้เลือก Save as PDF ได้จาก print dialog
- escape HTML ก่อน render เพื่อกันข้อความในฟอร์มทำให้เอกสารพิมพ์เสียรูป

Phase 31 - Home Visit Photo Storage Bucket Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม migration `supabase/migrations/0004_home_visit_photo_storage.sql`
- สร้าง private storage bucket `home-visit-photos`
- จำกัดขนาดไฟล์ 10MB และรับ mime types รูปภาพ: JPEG, PNG, WebP, HEIC, HEIF
- เพิ่ม Storage RLS policies สำหรับ `storage.objects`
- อนุญาต teacher_owner/teacher_member/superadmin ใน workspace เดียวกัน select/insert รูปเยี่ยมบ้าน
- owner หรือ teacher_owner/superadmin สามารถ update/delete object ได้
- policy ตรวจ workspace id จาก path รูปแบบ `workspaceId/home-visits/studentId/...` ซึ่งตรงกับ path ที่ `StudentsPage.tsx` สร้างตอน upload

Phase 32 - Student 360 Audit Trail Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม migration `supabase/migrations/0005_teacher_audit_logs.sql`
- เพิ่ม policy `audit_logs_insert_workspace_teacher` ให้ teacher_owner/teacher_member insert audit log ของ workspace ตัวเองได้ โดยยังผูก `actor_profile_id = auth.uid()`
- เพิ่ม helper `writeAuditLog()` ใน `src/pages/app/StudentsPage.tsx` ให้บันทึก audit แบบไม่ทำให้ workflow หลักล้มถ้า audit insert ไม่ผ่าน
- เพิ่ม audit actions สำหรับ Student 360: `student.created`, `student.updated`, `student.status_changed`
- เพิ่ม audit actions สำหรับเคสดูแล: `student_care_case.created`, `student_care_case.updated`, `student_care_case.status_changed`
- เพิ่ม audit actions สำหรับแบบเยี่ยมบ้าน/กสศ.01: `student_home_visit.saved` และ fallback `student_home_visit.fallback_saved`
- metadata ใน audit log เก็บเฉพาะ field สำคัญ เช่น `student_id`, `status`, `risk_level`, `completion_percent`, `photo_status` ไม่เก็บข้อมูลส่วนบุคคลทั้งฟอร์มซ้ำใน log

Phase 33 - Student Activity Timeline Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม migration `supabase/migrations/0006_teacher_audit_log_read.sql`
- เพิ่ม policy `audit_logs_select_workspace_teacher` ให้ teacher_owner/teacher_member อ่าน audit log ของ workspace ตัวเองได้
- เพิ่ม type `AuditLogRow`, demo audit logs, action labels, risk labels และ summary helper ใน `src/pages/app/StudentsPage.tsx`
- ปรับ `loadRoster()` ให้โหลด `audit_logs` ล่าสุด 80 รายการพร้อมข้อมูล Student 360 และ fallback เป็น empty state ถ้า audit table/policy ยังไม่พร้อม
- เพิ่ม optimistic local append หลัง `writeAuditLog()` สำเร็จ เพื่อให้กิจกรรมใหม่แสดงใน timeline ทันทีโดยไม่ต้อง reload
- เพิ่ม `Activity Timeline` section ใน Student 360 เพื่อดูประวัติล่าสุดของนักเรียนที่เลือกจาก `entity_id` หรือ `metadata.student_id`
- Timeline แสดง action, entity table, risk level, วันเวลา, actor role และ summary แบบ compact สำหรับตรวจย้อนหลัง

Phase 34 - System Readiness / Deployment Checklist Foundation ที่เริ่มต่อแล้ว:

- เพิ่มหน้า `src/pages/app/SystemSetupPage.tsx`
- เพิ่มเมนู `ตั้งค่าระบบ` ใน `src/routes/appRoutes.ts` ที่ path `/app/dashboard?view=setup`
- ต่อ route ใน `src/App.tsx` ให้ render `SystemSetupPage` ผ่าน `AppShell`
- จำกัดสิทธิ์หน้า setup เป็น `teacher_owner` เพื่อให้เจ้าของ workspace ตรวจ readiness ระดับระบบ
- หน้า setup แสดง readiness percent จาก static checks และ live checks
- static checks ตรวจ frontend env, active workspace และ subscription guard
- live checks เมื่อเชื่อม Supabase แล้วจะลอง query ตาราง `students`, `student_home_visits`, `audit_logs`, `notifications`, `score_assessments`, `savings_accounts`, `behavior_records`, `randomizer_sessions` ผ่าน `workspace_id` และ RLS
- live checks ตรวจ storage bucket `home-visit-photos` และ `payment-slips` ผ่าน Supabase Storage API
- เพิ่ม migration order checklist ตั้งแต่ `0001_core_foundation.sql` ถึง `0010_payment_slip_storage.sql`
- เพิ่ม Edge Functions checklist สำหรับ `approve-payment-request`, `accept-portal-invitation`, `dispatch-notification`
- เพิ่ม production secrets warning ว่า service role, LINE token, Telegram token และ Google secret ต้องอยู่ฝั่ง server/Supabase/Cloudflare เท่านั้น
- เพิ่มปุ่ม `Export report` เพื่อดาวน์โหลด readiness report เป็น JSON สำหรับส่งต่อเครื่อง/ทีม deploy

Phase 35 - Audit Center Foundation ที่เริ่มต่อแล้ว:

- เพิ่มหน้า `src/pages/app/AuditCenterPage.tsx`
- เพิ่มเมนู `ประวัติระบบ` ใน `src/routes/appRoutes.ts` ที่ path `/app/dashboard?view=audit`
- ต่อ route ใน `src/App.tsx` ให้ render `AuditCenterPage` ผ่าน `AppShell`
- จำกัดสิทธิ์หน้า audit เป็น `teacher_owner` เพื่อให้เจ้าของ workspace ตรวจ audit log ระดับระบบ
- โหลด `audit_logs` ล่าสุด 200 รายการจาก Supabase เมื่อมี workspace จริง และใช้ demo fallback เมื่อยังไม่ได้ตั้งค่า `.env.local`
- เพิ่มตัวกรอง audit ตามคำค้นหา, action และ risk level
- เพิ่ม summary cards สำหรับจำนวน audit log ทั้งหมด, ปกติ, ต้องติดตาม และสำคัญมาก
- เพิ่ม export CSV พร้อม UTF-8 BOM สำหรับส่งต่อ/ตรวจย้อนหลังใน Excel
- เพิ่ม privacy guard ว่า audit log เก็บ metadata แบบย่อ ไม่เก็บข้อมูลละเอียดของแบบเยี่ยมบ้านหรือเคสดูแลซ้ำใน log

Phase 36 - Cross-Module Audit Trail Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม helper กลาง `src/lib/auditLog.ts` สำหรับเขียน `audit_logs` จากหน้า frontend เมื่อมี Supabase workspace จริง
- ผูก `Score Center` ให้บันทึก audit เมื่อสร้างชุดคะแนน, บันทึกคะแนน และเปลี่ยนสถานะชุดคะแนน
- ผูก `Savings` ให้บันทึก audit เมื่อสร้างธุรกรรมเงินออม พร้อม metadata ประเภทฝาก/ถอน จำนวนเงิน และยอดหลังทำรายการ
- ผูก `Behavior` ให้บันทึก audit เมื่อสร้างบันทึกพฤติกรรม พร้อม tone, points และ follow-up status
- ผูก `Classroom Randomizer` ให้บันทึก audit เมื่อบันทึกประวัติการสุ่ม พร้อม mode, จำนวนผู้เข้าร่วม และจำนวนกลุ่ม
- ปรับ `AuditCenterPage` ให้แสดง label และ summary ของ action ใหม่จาก score/savings/behavior/randomizer ได้อ่านง่ายขึ้น

Phase 37 - Report Export Package Foundation ที่เริ่มต่อแล้ว:

- ปรับ `ReportsPage` ให้ปุ่มพิมพ์เดิมเป็น `PDF/พิมพ์` โดยเปิดหน้ารายงานสะอาดสำหรับ print หรือ Save as PDF
- เพิ่ม printable report HTML แบบ A4 landscape มีหัวรายงาน, ช่วงวันที่, summary, ตารางรายละเอียด และเครดิต `Created by MIKPURINUT`
- เพิ่ม export JSON package สำหรับส่งต่อข้อมูลรายงานแบบโครงสร้าง มี filters, summary, rows, workspace id, timezone และ timestamp
- เพิ่ม helper `downloadBlob()` ใน `ReportsPage` เพื่อลดการสร้าง download link ซ้ำระหว่าง CSV, Excel-compatible XLS และ JSON

Phase 38 - Production Deployment Pack Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม migration `supabase/migrations/0010_payment_slip_storage.sql` สำหรับสร้าง private bucket `payment-slips` พร้อม policy select/insert/update/delete ตาม `workspace_id` ใน storage path
- ขยาย `SystemSetupPage` ให้ checklist migration ครบ `0001` ถึง `0010`
- ขยาย live checks ของ `SystemSetupPage` ให้ตรวจตาราง score/savings/behavior/randomizer และตรวจ storage bucket `payment-slips`
- เพิ่ม storage bucket checklist, server secret checklist และ deployment command order ในหน้า `/app/dashboard?view=setup`
- readiness report export ตอนนี้แนบ `deployCommands`, `serverSecrets`, `storageBuckets`, `edgeFunctions` และ migration list ครบชุดมากขึ้น
- เพิ่มเอกสาร `docs/04-production-deployment.md` สำหรับพา deploy Supabase จริง ตั้งแต่ env, migration, seed, storage, Edge Functions, secrets, smoke test และ known gaps

Phase 39 - Local Deployment Readiness Script ที่เริ่มต่อแล้ว:

- เพิ่ม `scripts/check-production-readiness.mjs` สำหรับตรวจความพร้อมฝั่ง repo/local ก่อน deploy จริง
- เพิ่ม npm script `check:deploy` ใน `package.json`
- สคริปต์ตรวจ `.env.local`, public env, server-only secret leakage, migration files `0001-0010`, Edge Function folders, Supabase CLI และ Deno
- เพิ่ม `npm.cmd run check:deploy` เข้า deployment command order ในหน้า `SystemSetupPage`
- เพิ่มวิธีใช้ `npm.cmd run check:deploy` ใน `docs/04-production-deployment.md` และ `README.md`

Phase 40 - Workspace Backup Package Foundation ที่เริ่มต่อแล้ว:

- เพิ่ม type `WorkspaceBackupPackage` ใน `ImportExportPage` พร้อม `schemaVersion = classcare-workspace-backup-v1`
- เปลี่ยน backup manifest เดิมให้ export เป็น workspace backup package JSON มี workspace metadata, classrooms, students, preview rows, guardian preview rows, row counts และ restore notes
- เพิ่มตัวตรวจไฟล์ backup JSON ก่อน restore ด้วย `isWorkspaceBackupPackage()`
- เพิ่ม UI `Workspace Backup Package` ในหน้า Import/Export สำหรับ export JSON และอัปโหลดมาตรวจ
- เพิ่มปุ่ม `ใช้เป็น preview` เพื่อแปลงข้อมูล students จาก backup package กลับเข้า Import Preview โดยยังไม่เขียนทับข้อมูลจริง
- restore flow ยังคงปลอดภัยแบบ preview-first ให้ครูตรวจ duplicate/error ก่อนกด import จริง

Phase 41 - Import/Backup Audit Trail Foundation ที่เริ่มต่อแล้ว:

- เชื่อม `ImportExportPage` กับ helper `writeAuditLog`
- บันทึก audit action `import_job.students_imported` หลัง import นักเรียนสำเร็จบน Supabase
- บันทึก audit action `import_job.guardians_imported` หลัง import ผู้ปกครอง/สร้าง portal invitations สำเร็จบน Supabase
- บันทึก audit action `workspace_backup.package_created` หลังสร้าง workspace backup package และบันทึก metadata สำเร็จบน Supabase
- เพิ่ม action labels ใน `AuditCenterPage` สำหรับนำเข้านักเรียน, นำเข้าผู้ปกครอง และสร้างชุดสำรองข้อมูล
- เพิ่ม summary metadata ใน Audit Center เช่น total rows, valid rows, portal invitations และ backup schema version

Phase 42 - Workspace Settings Foundation ที่เริ่มต่อแล้ว:

- เพิ่มหน้า `src/pages/app/WorkspaceSettingsPage.tsx`
- เพิ่มเมนู `ตั้งค่าโรงเรียน` ที่ path `/app/dashboard?view=workspace-settings`
- จำกัดสิทธิ์หน้า Workspace Settings เป็น `teacher_owner`
- หน้าใหม่จัดการชื่อ workspace, ชื่อโรงเรียน, ปีการศึกษา และห้องหลัก
- เพิ่มฟอร์มสร้างห้องเรียนใหม่ในตาราง `classrooms` พร้อม grade level, academic year และ homeroom teacher
- เพิ่ม export settings snapshot เป็น JSON schema `classcare-workspace-settings-v1`
- บันทึก audit action `workspace_settings.updated` เมื่อแก้ข้อมูล workspace สำเร็จบน Supabase
- บันทึก audit action `classroom.created` เมื่อสร้างห้องเรียนสำเร็จบน Supabase
- เพิ่ม action labels และ summary metadata ใน `AuditCenterPage` สำหรับงานตั้งค่าโรงเรียน/ห้องเรียน

Phase 43 - Core Summary Report Foundation ที่เริ่มต่อแล้ว:

- ขยาย `ReportsPage` ให้มี `CoreReportMetrics`
- เพิ่ม Core Summary cards สำหรับเวลาเรียน, คะแนนเฉลี่ย, เงินออมรวม และพฤติกรรม
- demo mode แสดง snapshot รวมแบบไม่ต้องเชื่อม Supabase
- Supabase mode โหลด snapshot เพิ่มจาก `score_entries`, `savings_accounts`, `behavior_records` พร้อม attendance records ตามช่วงวันที่
- JSON report package แนบ `coreMetrics` เพื่อส่งต่อ/ตรวจรายงานรวมได้ในไฟล์เดียว
- ยังคง attendance report เดิม, CSV, Excel-compatible XLS และ PDF/พิมพ์ไว้ครบ

## 5. สถานะการตรวจสอบล่าสุด

ผ่าน:

- `node node_modules\eslint\bin\eslint.js src --max-warnings=0`
- `node node_modules\typescript\bin\tsc -b`
- `node node_modules\vite\bin\vite.js build`
- ตรวจหลังเพิ่ม Student 360 foundation แล้วผ่านทั้ง 3 คำสั่งข้างต้น
- ตรวจหลังขยาย Student 360 CRUD classroom/student/guardian แล้วผ่านทั้ง 3 คำสั่งข้างต้น
- ตรวจหลังเพิ่ม Attendance foundation แล้วผ่านทั้ง 3 คำสั่งข้างต้น
- ตรวจหลังเพิ่ม Report Center foundation แล้วผ่านทั้ง 3 คำสั่งข้างต้น
- ตรวจหลังเริ่ม Dashboard theme refresh แล้ว `npm run lint` และ `npm run build` ผ่าน
- ตรวจ browser ที่ `http://localhost:5173/app/dashboard`: font เป็น Anuphan, hero radius 32px, มี 13 card/section, ไม่มี console error และไม่มี horizontal overflow
- ตรวจหลังขยาย theme ไป Auth/Onboarding/Guard แล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser routes: `/app/dashboard`, `/login`, `/login?mode=register`, `/auth/complete-profile`, `/app/select-workspace?demo=no-workspace`, `/app/dashboard?demo=no-workspace` ไม่มี console error และไม่มี horizontal overflow
- ตรวจหลังขยาย theme ไป Student 360/Attendance/Reports/Package แล้ว `npm run lint` และ `npm run build` ผ่าน
- ตรวจ browser routes: `/app/dashboard?view=students`, `/app/dashboard?view=teacher-work`, `/app/dashboard?view=reports`, `/app/package`, `/app/dashboard` ใช้ font Anuphan, มี grid background, ไม่มี console error และไม่มี horizontal overflow
- ตรวจหลังทำ Pricing/RoutePlaceholder/SessionState theme แล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser routes: `/pricing`, `/superadmin/dashboard?demo=superadmin`, `/portal/parent?demo=parent`, `/portal/student?demo=student`, `/not-found-demo` ใช้ font Anuphan, มี grid background, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Superadmin Payment Review foundation แล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/superadmin/dashboard?demo=superadmin`: โหลด demo queue, มีปุ่มอนุมัติ/ปฏิเสธ, กดอนุมัติแล้ว state เปลี่ยนเป็น `อนุมัติแล้ว`, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม `approve-payment-request` Edge Function scaffold และเชื่อม Superadmin frontend แล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/superadmin/dashboard?demo=superadmin` ซ้ำหลังเปลี่ยน real Supabase path เป็น `supabase.functions.invoke`: demo mode ยังอนุมัติ local state ได้, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Parent/Student Portal foundation แล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser routes: `/portal/parent?demo=parent`, `/portal/student?demo=student` แสดง portal ใหม่, มี Privacy Guard, มีเวลาเรียนล่าสุด, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังยก `PackagePage` เป็น Payment Request workflow แล้ว `node node_modules\eslint\bin\eslint.js src --max-warnings=0`, `node node_modules\typescript\bin\tsc -b`, `node node_modules\vite\bin\vite.js build` ผ่าน
- ตรวจหลังเพิ่ม `student_profile_links` schema/policy และ Student Portal production mapping แล้ว `npm run lint` และ `npm run build` ผ่าน
- ตรวจหลังเพิ่ม UI ผูกบัญชี Student Portal ใน Student 360 แล้ว `npm run lint` และ `npm run build` ผ่าน
- ตรวจ dependency หลังงานล่าสุดด้วย `npm audit --audit-level=moderate` แล้วพบ `0 vulnerabilities`
- ตรวจหลังเพิ่ม `portal_invitations` schema/RLS และ UI สร้างคำเชิญใน Student 360 แล้ว `npm run lint` และ `npm run build` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` หลังเพิ่ม Portal Invitations แล้ว ไม่มี console error, ไม่มี Vite overlay, ไม่มี horizontal overflow และสร้างคำเชิญ demo ได้
- ตรวจ dependency ซ้ำหลังเพิ่ม Portal Invitations ด้วย `npm audit --audit-level=moderate` แล้วพบ `0 vulnerabilities`
- ตรวจหลังเพิ่ม `accept-portal-invitation` และหน้า `/portal/invitations` แล้ว `npm run lint` และ `npm run build` ผ่าน
- ตรวจ browser route `/portal/invitations?demo=student` แสดงคำเชิญ, ไม่มี console error, ไม่มี Vite overlay, ไม่มี horizontal overflow และกดรับคำเชิญ demo แล้วขึ้นปุ่มไป Portal ได้
- ตรวจหลังปรับ `accept-portal-invitation` ให้ auto-create profile และกัน student/profile link ซ้ำแล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจหลังเพิ่ม Guardian CSV import + Portal invite batch แล้ว `npm run lint`, `npm run build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=import-export` มี Guardian CSV, Guardian Preview, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Notification Center foundation แล้ว `node node_modules\eslint\bin\eslint.js src --max-warnings=0`, `node node_modules\typescript\bin\tsc -b`, `node node_modules\vite\bin\vite.js build` ผ่าน
- ตรวจ HTTP route `/app/dashboard?view=notifications` บน dev server แล้วได้ status `200`
- ตรวจหลังเพิ่ม Notification Dispatch Edge Function scaffold แล้ว `node node_modules\eslint\bin\eslint.js src --max-warnings=0`, `node node_modules\typescript\bin\tsc -b`, `node node_modules\vite\bin\vite.js build` ผ่าน
- ตรวจ HTTP route `/app/dashboard?view=notifications` หลังเพิ่มปุ่ม dispatch แล้วได้ status `200`
- ตรวจหลังเพิ่ม DMC Student Import foundation แล้ว `node node_modules\eslint\bin\eslint.js src --max-warnings=0`, `node node_modules\typescript\bin\tsc -b`, `node node_modules\vite\bin\vite.js build`, `npm audit --audit-level=moderate` ผ่าน
- ตรวจ HTTP route `/app/dashboard?view=import-export` หลังเพิ่ม DMC upload แล้วได้ status `200`
- ตรวจหลังเพิ่ม Report Excel export แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=reports` มีปุ่ม CSV/Excel, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจ browser route `/app/dashboard?view=notifications` มี Notification Center/ปุ่ม dispatch, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจ browser route `/app/dashboard?view=import-export` มี DMC Excel, Guardian CSV, manual add, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Attendance Guardian Notification แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=teacher-work` มีปุ่มแจ้งผู้ปกครอง, ไม่มี console error, ไม่มี Vite overlay, ไม่มี horizontal overflow และ demo interaction ส่งแจ้งเตือน 1 รายการได้
- ตรวจหลังเพิ่ม Student Care Quick Log แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` มี Care Quick Log, ไม่มี console error, ไม่มี Vite overlay, ไม่มี horizontal overflow และ demo interaction บันทึกเคสดูแลได้
- ตรวจหลังเพิ่ม `student_care_cases` และ Case Timeline แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` มี Case Timeline, ไม่มี Vite overlay, ไม่มี horizontal overflow และ demo interaction เพิ่มเคสเป็น 3 เคสได้
- ตรวจหลังเพิ่ม Workspace Selector active workspace แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/select-workspace?demo=no-workspace` มีรายการ workspace, ปุ่มเลือก, New Workspace, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Care Case Lifecycle แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` มีปุ่ม `ปิดเคส`/`เฝ้าติดตาม`, กดปิดเคส demo แล้วขึ้น notice และมีปุ่ม `เปิดใหม่`, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Student Profile Summary แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` มี `Student Profile`, `Quick Links`, ข้อมูลพื้นฐาน, ผู้ปกครองหลัก, เคสดูแลล่าสุด, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Care Case inline edit แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` หลังเพิ่ม inline edit: ปุ่มแก้ไขเคส demo เปิดฟอร์มได้, เห็นปุ่ม `บันทึกการแก้ไข`/`ยกเลิก`, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Case Detail Panel แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` หลังเพิ่ม Case Detail Panel: พบ panel รายละเอียด 1 จุด, ปุ่ม `ดูรายละเอียด` เลือกเคส demo ได้, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Home Visit / กสศ.01 foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` หลังเพิ่มแบบเยี่ยมบ้าน: พบฟอร์ม `home-visit-form` 1 จุด, ปุ่ม `บันทึกแบบเยี่ยมบ้าน` ทำงานใน demo mode, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม `student_home_visits` migration และเชื่อม Student 360 แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students` ใน tab ใหม่หลัง restart dev server: พบฟอร์ม `home-visit-form` 1 จุด, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Home Visit Photo Attachment foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ browser route `/app/dashboard?view=students`: พบ `home-visit-form` 1 จุด, file input รูปถ่าย 2 ช่อง, ข้อความรูปที่ 1/รูปที่ 2 แสดงครบ, ไม่มี console error, ไม่มี Vite overlay และไม่มี horizontal overflow
- ตรวจหลังเพิ่ม Home Visit Print / Save PDF foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจ HTTP route `/app/dashboard?view=students` หลังเพิ่มปุ่มพิมพ์แล้วได้ status `200`
- ตรวจหลังเพิ่ม Home Visit Photo Storage Bucket migration แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ยังไม่ได้รัน migration `0004_home_visit_photo_storage.sql` กับ Supabase จริง เพราะเครื่องนี้ยังไม่มี Supabase CLI ใน PATH
- ตรวจหลังเพิ่ม Student 360 Audit Trail foundation แล้ว `npm.cmd run lint` และ `npm.cmd run build` ผ่าน
- ยังไม่ได้รัน migration `0005_teacher_audit_logs.sql` กับ Supabase จริง เพราะเครื่องนี้ยังไม่มี Supabase CLI ใน PATH
- ตรวจหลังเพิ่ม Student Activity Timeline foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=students` ได้ status `200`
- ยังไม่ได้รัน migration `0006_teacher_audit_log_read.sql` กับ Supabase จริง เพราะเครื่องนี้ยังไม่มี Supabase CLI ใน PATH
- ตรวจหลังเพิ่ม System Readiness / Deployment Checklist foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=setup` ได้ status `200`
- ตรวจหลังเพิ่ม readiness report export แล้ว `npm.cmd run lint`, `npm.cmd run build` ผ่าน และ HTTP `/app/dashboard?view=setup` ได้ status `200`
- ตรวจหลังเพิ่ม Audit Center foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Cross-Module Audit Trail foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=scores`, `/app/dashboard?view=savings`, `/app/dashboard?view=behavior`, `/app/dashboard?view=randomizer`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Report Export Package foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=reports`, `/app/dashboard?view=setup`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจหลังเพิ่ม Production Deployment Pack foundation แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน และ HTTP `/app/dashboard?view=setup`, `/app/dashboard?view=package`, `/app/dashboard?view=audit` ได้ status `200`
- ตรวจซ้ำแล้วเครื่องนี้ยังไม่มี `supabase` CLI และ `deno` ใน PATH จึงยัง deploy/test Supabase Functions จริงจากเครื่องนี้ไม่ได้
- ตรวจหลังเพิ่ม Local Deployment Readiness Script แล้ว `npm.cmd run check:deploy` ผ่าน 25/28 checks โดย warning คือยังไม่มี `.env.local`, `supabase` CLI และ `deno`; จากนั้น `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน
- ตรวจหลังเพิ่ม Workspace Backup Package แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate` ผ่าน, HTTP `/app/dashboard?view=import-export` และ `/app/dashboard?view=setup` ได้ status `200`, browser แสดง `Workspace Backup Package`, `สร้าง Backup Package`, `ตรวจ Backup`, `Import Preview` ครบ
- ตรวจหลังเพิ่ม Import/Backup Audit Trail แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, `npm.cmd run check:deploy` ผ่านตามสถานะเดิม 25/28, HTTP `/app/dashboard?view=import-export`, `/app/dashboard?view=audit`, `/app/dashboard?view=setup` ได้ status `200`, browser หน้า Import/Export ยังแสดง backup package UI ครบ
- ตรวจหลังเพิ่ม Workspace Settings แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, `npm.cmd run check:deploy` ผ่านตามสถานะเดิม 25/28, HTTP `/app/dashboard?view=workspace-settings`, `/app/dashboard?view=setup`, `/app/dashboard?view=audit` ได้ status `200`, browser หน้า Workspace Settings แสดง `Workspace Settings`, `ตั้งค่าโรงเรียนและห้องเรียน`, `บันทึกข้อมูลโรงเรียน`, `รายการห้องเรียน`, `Export settings` ครบ
- ตรวจหลังเพิ่ม Core Summary Report แล้ว `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit --audit-level=moderate`, `npm.cmd run check:deploy` ผ่านตามสถานะเดิม 25/28, HTTP `/app/dashboard?view=reports`, `/app/dashboard?view=workspace-settings`, `/app/dashboard?view=setup` ได้ status `200`, browser หน้า Reports แสดง `เวลาเรียน`, `คะแนนเฉลี่ย`, `เงินออมรวม`, `พฤติกรรม`, `JSON` ครบ

หมายเหตุ:

- `npm.ps1` ถูกบล็อกโดย PowerShell Execution Policy ของเครื่องนี้
- ใช้ `npm.cmd` หรือเรียก `node node_modules\...\bin\...` แทนได้
- `npm.cmd run lint` แบบทั้ง workspace ใช้เวลานานเกิน timeout บนโฟลเดอร์ OneDrive รอบนี้ แต่ lint เฉพาะ `src` ผ่านแล้ว
- เครื่องนี้ยังไม่มี `deno` และ `supabase` CLI ใน PATH จึงยังไม่ได้รัน `supabase functions serve/deploy` หรือ Deno type check สำหรับ Edge Function
- Browser automation รอบล่าสุดตรวจหน้า Notifications, Import/Export, Reports และ Attendance แล้วไม่พบ console error, Vite overlay หรือ horizontal overflow

## 6. สิ่งที่ยังไม่เสร็จ

- ยังไม่ได้เชื่อม Supabase project จริงบนเครื่องนี้ เพราะยังไม่มี `.env.local` จริง
- ยังไม่ได้รัน migration กับ Supabase local/remote จริง
- สร้าง Edge Function แรกแล้ว แต่ยังไม่ได้ deploy/test กับ Supabase local/remote จริง
- มี Notification Dispatch Edge Function scaffold แล้ว แต่ยังไม่ได้ deploy/test กับ Supabase local/remote จริง
- ยังไม่มี Edge Functions อื่นสำหรับ auth/audit helper/report generator
- CRUD โมดูลนักเรียนมี foundation แล้ว แต่ยังไม่ได้ทดสอบกับ Supabase project จริง
- ยังไม่มี soft-delete/delete จริง แนะนำใช้ `archived` แทนจนกว่าจะมี audit log workflow
- มี Portal invitation + accept foundation แล้ว แต่ยังไม่ได้ส่งอีเมลจริง และยังไม่ได้ deploy/test Edge Function กับ Supabase project จริง
- มี Student Profile summary, Care Quick Log, `student_care_cases`, การปิด/เปิดเคส, inline edit, Case Detail Panel และ Home Visit / กสศ.01 foundation แล้ว แต่ยังไม่มีหน้า profile แยก route และยังไม่มีหน้า case detail แยก route แบบเต็ม
- แบบเยี่ยมบ้าน กสศ.01 มีตาราง `student_home_visits`, ช่องแนบรูป, storage bucket migration และ print/save PDF foundation แล้ว แต่ยังต้องรัน migration กับ Supabase จริง, ทำ native PDF generator ฝั่ง server และ audit log
- Import นักเรียนและผู้ปกครองมี foundation แล้ว แต่ยังไม่ได้ทดสอบกับ Supabase project จริง
- Student Portal มี production mapping ผ่าน `student_profile_links` แล้ว แต่ยังต้องทดสอบกับ Supabase project จริง
- Report Center มี CSV/print และ Excel-compatible `.xls` export แล้ว แต่ยังไม่มี native `.xlsx` หรือ PDF file generator จริง
- Superadmin Payment Review มี UI/action foundation และ Edge Function scaffold แล้ว แต่ยังต้องทดสอบกับ Supabase project จริง
- Import/Export/Backup มี foundation แล้ว แต่ยังไม่ได้ทดสอบกับ Supabase project จริง และยังไม่มี archive/cold storage จริง
- Notification Center มี inbox/read foundation และ dispatch function scaffold แล้ว แต่ยังไม่ได้ทดสอบกับ Supabase project จริง
- Telegram/LINE integration มี scaffold ใน `dispatch-notification` แล้ว แต่ยังไม่ได้ตั้งค่า env/provider และยังไม่ได้ทดสอบส่งจริง
- ยังไม่มี Google Drive Cold Storage flow จริง
- ยังไม่มี Google Maps home visit จริง
- ยังไม่ได้ deploy Cloudflare Pages

## 7. วิธีทดสอบตอนนี้

ติดตั้ง dependency:

```bash
npm install
```

รัน dev server:

```bash
npm.cmd run dev
```

หรือถ้า PowerShell block `npm.ps1` ให้ใช้:

```bash
npm.cmd run dev -- --host 127.0.0.1
```

URL เริ่มต้น:

```text
http://127.0.0.1:5173
```

ทดสอบ demo states:

- `/app/dashboard`
- `/app/dashboard?view=students`
- `/app/dashboard?view=teacher-work`
- `/app/dashboard?view=reports`
- `/app/dashboard?demo=free`
- `/app/dashboard?demo=expired`
- `/app/dashboard?demo=no-workspace`
- `/app/package?demo=free`
- `/superadmin/dashboard?demo=superadmin`
- `/portal/parent?demo=parent`
- `/portal/student?demo=student`
- `/login`
- `/login?mode=register`
- `/login?mode=forgot`
- `/auth/complete-profile`
- `/app/select-workspace?demo=no-workspace`

## 8. วิธีต่อ Supabase จริง

1. สร้าง Supabase project
2. คัดลอก `.env.example` เป็น `.env.local`
3. ใส่เฉพาะ public browser-safe env:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_NAME`
   - `VITE_APP_TIMEZONE`
4. รัน `supabase/migrations/0001_core_foundation.sql`
5. รัน `supabase/seed.sql`
6. ตั้งค่า Supabase Auth email/password และ Google OAuth
7. เปิดเว็บแล้วทดสอบ:
   - สมัครบัญชี
   - ยืนยันอีเมลถ้าเปิด email confirmation
   - เข้า `/auth/complete-profile`
   - บันทึก profile
   - สร้าง workspace
   - ตรวจว่า route guard เข้า `/app/dashboard` ได้ด้วย trial subscription

## 9. เฟสถัดไปที่ควรทำ

ลำดับแนะนำ:

1. ตรวจ migration กับ Supabase local/remote จริง
2. เพิ่ม SQL test หรือ manual RLS checklist สำหรับ onboarding:
   - user A เห็นเฉพาะ profile/workspace ของตัวเอง
   - user B เห็น workspace user A ไม่ได้
   - parent/student ยังไม่เห็นข้อมูลคนอื่น
   - superadmin อ่านข้อมูลตาม policy ได้
3. เพิ่มหน้า workspace list จริงแทน demo cards
4. ทดสอบ Student 360 และ Attendance กับ Supabase project จริง
5. เพิ่ม native XLSX และ PDF file generator จริงสำหรับ Report Center
6. Deploy/test `approve-payment-request` ด้วย Supabase CLI และตรวจ `payment_requests`, `subscriptions`, `audit_logs`
7. สร้าง Edge Functions เพิ่ม:
   - audit log helper
   - payment request/slip upload validation
   - report generator
8. ต่อ Payment Package flow สำหรับ `ClassCare 360 VIP` ให้ Superadmin approve แล้ว Edge Function เปิด subscription จริงใน Supabase project
9. ต่อ Telegram/LINE dispatch จริงจาก Notification Center ผ่าน Edge Function และ audit log
10. ต่อ archive/cold storage จริงจาก backup manifest ไป Google Drive Cold Storage

## 10. ข้อควรระวังสำหรับผู้พัฒนาคนถัดไป

- อย่าใส่ `SUPABASE_SERVICE_ROLE_KEY` หรือ secret ใด ๆ ใน frontend
- อย่าแก้ route guard แล้วคิดว่าเพียงพอ ต้องมี RLS ซ้ำเสมอ
- ทุก query ที่แตะข้อมูลโรงเรียน/ห้องเรียนต้องผูก workspace
- ทุกงานที่แตะข้อมูลนักเรียนต้องตรวจ privacy เป็นพิเศษ
- ก่อนเพิ่มโมดูลใหม่ให้เพิ่มทั้ง:
  - type ใน `src/types/core.ts`
  - entitlement ใน `src/lib/entitlements.ts`
  - seed module entitlement
  - RLS policy หรือ Edge Function ที่เกี่ยวข้อง
- ต้องคงเครดิต `Created by MIKPURINUT` ใน footer, login/about/report ตาม Prompt
