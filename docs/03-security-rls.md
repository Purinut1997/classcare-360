# ClassCare 360 Security and RLS Design

อัปเดตล่าสุด: 2026-06-24  
สถานะ: Phase 1 security draft  
อ้างอิง: `Prompt.txt`

## Security Goals

เป้าหมายหลัก:

- แยกข้อมูลแต่ละ workspace ด้วย `workspace_id`
- parent/student เห็นเฉพาะข้อมูลที่ผูกกับตัวเอง
- FREE_LOGIN ใช้โมดูลหลักไม่ได้
- subscription ไม่ active ห้าม create/update/delete ข้อมูลหลัก
- Superadmin ทำงานระบบได้ แต่การเปิดดูข้อมูลจริงของ workspace ต้องมี audit log
- service role ใช้เฉพาะ server/Edge Functions
- token ของ Telegram/LINE/Google Drive ต้อง encrypt
- พิกัดบ้านและข้อมูลสุขภาพจำกัดสิทธิ์เข้มกว่าข้อมูลทั่วไป

## Security Boundaries

### Frontend Boundary

Frontend ทำได้:

- ใช้ Supabase anon key
- ตรวจ route guard เพื่อ UX
- ซ่อนเมนูตาม role/subscription
- validate input เบื้องต้น
- upload ผ่าน signed policy หรือ Edge Function

Frontend ห้ามทำ:

- ใช้ service role
- เก็บ secret/token/API key
- hard-code QR Code
- เรียก integration ที่ต้องใช้ secret ตรง
- cache PII ของนักเรียนใน service worker แบบไม่ปลอดภัย

### Database Boundary

Database ต้อง enforce:

- RLS ทุกตารางที่ frontend เข้าถึง
- membership check ผ่าน `auth.uid()`
- workspace isolation
- parent/student relationship check
- write guard จาก role และ subscription
- audit log ผ่าน function/trigger สำหรับ action สำคัญ

### Edge Function Boundary

Edge Functions ใช้สำหรับ:

- actions ที่ต้อง service role
- payment approval
- refund approval
- slip optimization
- report generation
- import confirm
- backup/restore
- send notification
- Google Drive/Maps/Telegram/LINE integration

Edge Function ทุกตัวต้องตรวจ:

- user session JWT
- role
- workspace membership
- active subscription
- entitlement
- input validation
- rate limit หรือ abuse guard ตามความเสี่ยง
- audit log

## Role Permission Matrix

| Area | superadmin | teacher_owner | teacher_member | parent | student | viewer |
| --- | --- | --- | --- | --- | --- | --- |
| System settings | manage | none | none | none | none | none |
| Workspace settings | audit-managed | manage own | limited | none | none | view limited |
| Users/members | manage system | manage workspace | none | none | none | view limited |
| Students | audit/view as needed | CRUD | scoped CRUD | own child read | self read | read reports |
| Attendance | audit/view as needed | CRUD | scoped CRUD | own child read | self read | read reports |
| Scores/tasks | audit/view as needed | CRUD | scoped CRUD | own child read | self read | read reports |
| Savings | audit/view as needed | CRUD | scoped CRUD | own child read | self read if enabled | read reports |
| Behavior | audit/view as needed | CRUD | scoped CRUD | limited read if enabled | limited read if enabled | read reports |
| Student care sensitive notes | audit-required | manage | scoped manage | none | none | none |
| Home coordinates | audit-required | manage | scoped manage | own child limited | none | none |
| Reports | manage system | generate | scoped generate | own child read | self read | read |
| Payments/refunds | manage | own workspace request | none | none | none | none |
| Subscription | manage | view/request | view limited | none | none | none |
| Notifications | manage system | manage workspace | scoped | own | own | read |

หมายเหตุ:

- `audit-managed` หมายถึง Superadmin ทำได้ผ่านหน้าหรือ function ที่บันทึก audit log ชัดเจน
- `scoped CRUD` หมายถึงจำกัดตาม classroom/subject/permission scope ใน `workspace_memberships`

## RLS Helper Functions

ควรสร้าง helper functions ใน schema เช่น `app_private` หรือ `public` ตามแนวทาง Supabase ที่เลือก

### `auth_profile_id()`

คืนค่า `auth.uid()`

```sql
create or replace function public.auth_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;
```

### `is_superadmin()`

ตรวจว่า user เป็น superadmin active

```sql
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.superadmin_profiles sp
    where sp.profile_id = auth.uid()
      and sp.is_active = true
  );
$$;
```

### `is_workspace_member(workspace_id uuid)`

```sql
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
      and wm.status = 'active'
  );
$$;
```

### `has_workspace_role(workspace_id uuid, roles text[])`

```sql
create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;
```

### `has_active_subscription(workspace_id uuid)`

```sql
create or replace function public.has_active_subscription(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.workspace_id = target_workspace_id
      and s.status in ('trial', 'active')
      and (s.starts_at is null or s.starts_at <= now())
      and (s.ends_at is null or s.ends_at > now())
      and p.code in ('TRIAL_30', 'VIP_YEARLY')
  );
$$;
```

### `can_use_module(workspace_id uuid, module_key text)`

ใช้ตรวจ entitlement ระดับ module

```sql
create or replace function public.can_use_module(
  target_workspace_id uuid,
  target_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.module_entitlements me on me.plan_id = s.plan_id
    where s.workspace_id = target_workspace_id
      and s.status in ('trial', 'active')
      and (s.ends_at is null or s.ends_at > now())
      and me.module_key = target_module_key
      and me.is_enabled = true
  );
$$;
```

## Generic RLS Policy Patterns

### Workspace-readable table

ใช้กับตารางทั่วไป เช่น `classrooms`, `subjects`

```sql
alter table public.classrooms enable row level security;

create policy "classrooms_select_workspace_members"
on public.classrooms
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);
```

### Workspace-write table with active subscription

```sql
create policy "classrooms_insert_owner_or_teacher"
on public.classrooms
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  and public.has_active_subscription(workspace_id)
  and public.can_use_module(workspace_id, 'classrooms')
);

create policy "classrooms_update_owner_or_teacher"
on public.classrooms
for update
to authenticated
using (
  public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  and public.has_active_subscription(workspace_id)
  and public.can_use_module(workspace_id, 'classrooms')
)
with check (
  public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  and public.has_active_subscription(workspace_id)
  and public.can_use_module(workspace_id, 'classrooms')
);
```

### Superadmin managed table

ใช้กับ `plans`, `payment_qr_codes`, `maintenance_windows`

```sql
alter table public.plans enable row level security;

create policy "plans_select_authenticated"
on public.plans
for select
to authenticated
using (true);

create policy "plans_write_superadmin"
on public.plans
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());
```

### Parent/student restricted read

ใช้กับข้อมูล portal โดยต้องมี relation table เช่น `student_guardians` สำหรับ parent และ `student_profile_links` สำหรับ student account ส่วนการเชิญให้ใช้ `portal_invitations` ก่อน แล้วให้ Edge Function สร้าง link จริงตอน accept

```sql
create policy "students_select_workspace_or_linked_guardian"
on public.students
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
  or exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = students.id
      and sg.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.student_profile_links spl
    where spl.student_id = students.id
      and spl.profile_id = auth.uid()
      and spl.status = 'active'
  )
);
```

ใน migration foundation ใช้ตาราง `student_profile_links(student_id, profile_id, workspace_id, status)` เพื่อผูกบัญชี role `student` กับ record นักเรียนจริง และใช้ `portal_invitations(workspace_id, student_id, portal_role, invite_email, status)` เพื่อสร้างคำเชิญแบบ email-first โดยยังไม่เปิดให้ frontend ค้นหา profile อื่นแบบกว้าง ๆ

ข้อควรระวังของ invitation:

- ผู้รับคำเชิญอ่าน invite ของตัวเองได้เมื่อ email ตรงกับ `profiles.email`
- ครูใน workspace และ superadmin จัดการสถานะคำเชิญได้
- การ accept invitation ควรอยู่ใน Edge Function เพราะต้องตรวจ token/email/session และสร้าง `student_guardians` หรือ `student_profile_links` แบบ atomic

### Sensitive table pattern

ใช้กับ `student_care_cases`, `home_visits`, `student_home_distances`, health records

```sql
create policy "student_care_select_restricted"
on public.student_care_cases
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or (
    public.has_workspace_role(workspace_id, array['teacher_member'])
    and assigned_to = auth.uid()
  )
);
```

ข้อมูล sensitive ไม่ควรเปิดให้ parent/student โดย default

## Table Group RLS Requirements

### Public/Auth Tables

`profiles`

- user อ่าน/แก้ไข profile ตัวเองได้
- superadmin อ่าน metadata ได้
- field sensitive อาจต้องแยก view หรือ RPC

`workspaces`

- owner/member อ่าน workspace ตัวเอง
- teacher_owner update setting
- superadmin จัดการ metadata

`workspace_memberships`

- user อ่าน membership ของตัวเอง
- teacher_owner เห็นสมาชิก workspace
- teacher_owner เชิญ/แก้ไขสมาชิกตาม plan entitlement
- superadmin เห็นทั้งหมด

### Subscription Tables

`plans`

- authenticated อ่าน active plans
- superadmin CRUD

`subscriptions`

- workspace member อ่าน subscription workspace ตัวเอง
- write ผ่าน Edge Functions เท่านั้นสำหรับ approve/refund/expire
- teacher_owner สร้าง request ได้ผ่าน flow ที่จำกัด

`module_entitlements`

- authenticated อ่านได้เพื่อแสดง UI
- superadmin CRUD

### Payment Tables

`payment_requests`

- teacher_owner อ่าน/สร้างของ workspace ตัวเอง
- update status approve/reject/refund ผ่าน Edge Function/service role เท่านั้น
- superadmin อ่านและ review

`payment_qr_codes`

- authenticated อ่านเฉพาะ active QR metadata ที่จำเป็นต่อการชำระ
- QR image ต้องโหลดผ่าน signed URL หรือ public policy เฉพาะไฟล์ active ที่ปลอดภัย
- superadmin CRUD

`refund_requests`

- teacher_owner สร้าง/อ่านของตัวเอง
- superadmin review
- status สำคัญแก้ผ่าน function

### Student and Classroom Tables

- teacher_owner CRUD ทั้ง workspace
- teacher_member CRUD ตาม scope
- parent/student read เฉพาะข้อมูลที่อนุญาต
- viewer read report-safe data เท่านั้น
- write ต้องมี active subscription และ entitlement

### Notification Tables

- user อ่าน notification ของตัวเอง
- workspace admin อ่าน notification summary ของ workspace
- delivery status เขียนผ่าน Edge Function
- token/channel secret เข้าถึงผ่าน Edge Function เท่านั้น

### Audit and Edit History

- insert ผ่าน trigger/function
- user ปกติอ่านไม่ได้ หรืออ่านเฉพาะ log ของ action ตัวเองแบบจำกัด
- teacher_owner อ่าน audit log workspace แบบ mask ข้อมูล sensitive
- superadmin อ่านทั้งหมด
- ห้าม update/delete ผ่าน frontend

## Storage Policies

Buckets:

- `payment-qr-codes`
- `payment-slips`
- `student-files`
- `report-exports`
- `import-files`
- `backup-exports`
- `public-assets`

Policy หลัก:

- private buckets ไม่เปิด public
- access ผ่าน signed URL
- upload sensitive file ผ่าน Edge Function
- storage path ควรขึ้นต้นด้วย `workspace_id/`
- payment slip ลบไฟล์จริงหลังรายการปิดครบ 30 วัน
- report/backup exports ต้องมี expiry

ตัวอย่าง path:

- `payment-slips/{workspace_id}/{payment_request_id}/slip.webp`
- `report-exports/{workspace_id}/{report_job_id}/report.pdf`
- `backup-exports/{workspace_id}/{backup_job_id}/backup.zip`

## Audit Log Requirements

ต้องบันทึก:

- login และ auth callback สำคัญ
- สร้าง/แก้ไข workspace
- invite/remove member
- เปลี่ยน role/permission
- create/update/delete นักเรียน
- update พิกัดบ้าน
- เปิดดูข้อมูล sensitive โดย superadmin
- สร้าง payment request
- approve/reject payment
- request/approve/reject refund
- referral credit manual adjust
- generate report
- import confirm
- backup/restore
- period lock/unlock
- close academic year
- notification send failure สำคัญ

Audit fields ต้องมี:

- actor
- workspace
- action
- entity
- timestamp
- risk level
- metadata ที่ไม่เก็บ secret
- IP/user agent ถ้ามี

## Data Masking Rules

ควร mask:

- เบอร์โทรผู้ปกครองในบางบริบท
- พิกัดบ้าน
- ข้อมูลสุขภาพ
- sensitive notes ใน student care
- payment detail
- integration token

Notification:

- หลีกเลี่ยงชื่อเต็ม + เหตุละเอียดใน channel ภายนอก
- ไม่ส่ง lat/lng หรือที่อยู่บ้านละเอียดผ่าน Telegram/LINE
- ส่งเพียงข้อความย่อ เช่น "มีเคสดูแลช่วยเหลือที่ต้องติดตามใน ClassCare 360"

## Function Security Checklist

ทุก Edge Function ต้อง:

- อ่าน JWT จาก request
- verify user
- validate input schema
- check workspace membership
- check role
- check subscription/entitlement ถ้าเป็น module หลัก
- enforce file size/type
- remove EXIF สำหรับรูปภาพ
- use signed URL แทน public URL ในไฟล์ private
- log audit
- return error message ที่ไม่เปิดเผยข้อมูล sensitive

## Phase 1 RLS Acceptance Criteria

ถือว่า Phase 1 ด้าน security พร้อมเริ่ม migration เมื่อ:

- มี helper functions สำหรับ superadmin, membership, role, subscription, entitlement
- มี policy pattern สำหรับ table group หลัก
- มี table list ว่าตารางไหน sensitive
- มี storage bucket policy plan
- มี audit log requirement
- มีคำตัดสินชัดเจนว่า service role ใช้เฉพาะ Edge Functions
- มี rule ว่า FREE_LOGIN ใช้โมดูลหลักไม่ได้ทั้ง frontend และ backend
