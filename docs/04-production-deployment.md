# ClassCare 360 Production Deployment Pack

เอกสารนี้ใช้เป็น checklist สำหรับย้ายจาก demo/local ไป Supabase project จริง

## 1. Prerequisites

- ติดตั้ง Node.js และรัน `npm install` แล้ว
- ติดตั้ง Supabase CLI และ login แล้ว
- มี Supabase project จริง
- มีค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
- มีสิทธิ์ตั้งค่า Supabase Edge Function secrets

ตรวจ readiness ฝั่ง repo/local ก่อน:

```bash
npm.cmd run check:deploy
```

คำสั่งนี้จะตรวจ `.env.local`, migration files, Edge Function folders, bucket migrations, Supabase CLI และ Deno ในเครื่องปัจจุบัน

## 2. Frontend Environment

สร้าง `.env.local` จาก `.env.example` แล้วใส่เฉพาะค่าที่ปลอดภัยต่อ browser:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=ClassCare 360
VITE_APP_TIMEZONE=Asia/Bangkok
```

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY`, LINE token, Telegram token หรือ Google secret ในตัวแปรที่ขึ้นต้นด้วย `VITE_`

## 3. Migration Order

รัน migration ตามลำดับนี้:

```text
0001_core_foundation.sql
0002_student_care_cases.sql
0003_student_home_visits.sql
0004_home_visit_photo_storage.sql
0005_teacher_audit_logs.sql
0006_teacher_audit_log_read.sql
0007_scorebook_foundation.sql
0008_savings_behavior_foundation.sql
0009_randomizer_foundation.sql
0010_api_grants.sql
0010_payment_slip_storage.sql
0011_admin_lifetime_access.sql
0012_workspace_member_admin.sql
0013_payment_qr_storage.sql
0014_workspace_join_requests.sql
```

คำสั่งแนะนำ:

```bash
npm.cmd run check:deploy
supabase link --project-ref <project-ref>
supabase db push
```

หลังรัน migration แล้วให้รัน seed ผ่าน Supabase SQL editor หรือ `psql`:

```bash
psql "<DATABASE_URL>" -f supabase/seed.sql
```

ถ้าใช้ SQL editor ให้รันไฟล์ใน `supabase/migrations/` ทีละไฟล์ตามลำดับ แล้วค่อยรัน `supabase/seed.sql`

## 4. Storage Buckets

ระบบต้องมี private buckets:

- `home-visit-photos` สำหรับรูปเยี่ยมบ้าน กสศ.01
- `payment-slips` สำหรับสลิปชำระเงินแพ็กเกจ
- `payment-qr-codes` สำหรับรูป QR ชำระเงินที่ Superadmin จัดการ

bucket เหล่านี้มี migration สร้าง bucket/policy แล้ว แต่ต้องตรวจใน Supabase Dashboard ว่า bucket เป็น private และ policy อยู่ครบ

## 5. Edge Functions

Deploy functions:

```bash
supabase functions deploy approve-payment-request
supabase functions deploy accept-portal-invitation
supabase functions deploy dispatch-notification
```

ตั้งค่า secrets ฝั่ง Supabase Functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=...
supabase secrets set LINE_CHANNEL_SECRET=...
supabase secrets set GOOGLE_DRIVE_CLIENT_ID=...
supabase secrets set GOOGLE_DRIVE_CLIENT_SECRET=...
supabase secrets set ENCRYPTION_KEY=...
```

Secret ที่ยังไม่ใช้ใน function ปัจจุบันสามารถตั้งรอไว้ได้ แต่ห้าม commit ค่าจริงลง repo

## 6. Smoke Test

หลัง deploy แล้วให้เปิด:

```text
/app/dashboard?view=setup
```

ตรวจว่า readiness checks ผ่านหรือมี warning อะไรบ้าง จากนั้นทดสอบตามลำดับ:

1. สร้าง/เลือก workspace
2. ให้ครูอีกบัญชี Complete Profile ด้วยชื่อโรงเรียนเดียวกัน แล้วกดขอเข้า workspace
3. ให้เจ้าของ workspace อนุมัติจากหน้า ตั้งค่าโรงเรียน แล้วตรวจว่าครูเข้า dashboard ได้
4. เพิ่มห้องเรียนและนักเรียนใน Student 360
5. บันทึกแบบเยี่ยมบ้านพร้อมรูป
6. สร้างเคสดูแลและปิด/เปิดเคส
7. บันทึกคะแนน เงินออม พฤติกรรม และประวัติการสุ่ม
8. เปิด Audit Center แล้วตรวจว่ามี audit log
9. Export readiness report และ report JSON package
10. สร้าง payment request พร้อมสลิป แล้วให้ superadmin approve ผ่าน Edge Function
11. สร้าง portal invitation และรับคำเชิญผ่าน `/portal/invitations`
12. ส่ง notification demo ผ่าน Notification Center

## 7. Verification Commands

รันก่อน deploy frontend:

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

ถ้า PowerShell block `npm.ps1` ให้ใช้ `npm.cmd`

## 8. Known Production Gaps

- ยังต้องทดสอบ RLS กับบัญชีจริงหลาย role ใน Supabase project จริง
- ยังต้องทดสอบ Edge Functions กับ provider จริง เช่น LINE/Telegram
- Report PDF ตอนนี้ใช้ browser print/Save as PDF ยังไม่ใช่ native server-side PDF generator
- Excel export ตอนนี้เป็น Excel-compatible `.xls` ยังไม่ใช่ native `.xlsx`
- Google Drive cold storage ยังเป็น phase ถัดไป

## 9. Handoff Rule

หลัง deploy หรือแก้ production config ให้บันทึกผลไว้ใน `PROJECT_STATUS.md` และ export readiness report จากหน้า System Setup เก็บแนบไว้ทุกครั้ง
