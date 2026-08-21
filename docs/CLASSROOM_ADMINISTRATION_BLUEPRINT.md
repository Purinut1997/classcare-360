---
title: ClassCare 360 Classroom Administration Blueprint
status: ready-for-implementation
updated: 2026-08-21
owner: ClassCare 360
scope: งานธุรการประจำชั้นเรียนของครูประจำชั้น
---

# Blueprint: ศูนย์ธุรการประจำชั้นเรียน

ไฟล์นี้เป็นเอกสาร handoff สำหรับนำไปพัฒนาต่อในแชท เครื่อง หรือทีมอื่น โดยอิงโครงสร้างจริงของ ClassCare 360 ณ วันที่ระบุด้านบน

## 1. เป้าหมาย

สร้าง `Classroom Administration Hub` เป็นศูนย์รวมงานธุรการที่ครูประจำชั้นต้องติดตามให้เสร็จ โดยเชื่อมข้อมูลเดิม ไม่สร้างฐานข้อมูลนักเรียนหรือรายงานซ้ำ และรักษาขอบเขตข้อมูลดังนี้:

`Workspace (โรงเรียน) -> Classroom -> Student -> Administrative workflow`

หลักสำคัญ:

- `workspace_id` เป็นขอบเขตโรงเรียนเสมอ
- ครูร่วมเห็นเฉพาะห้องที่ได้รับมอบหมาย
- สิทธิ์จริงต้องบังคับใน RLS/RPC ไม่ใช่ซ่อนเฉพาะ UI
- เอกสารและรายงานต้องสร้างจากข้อมูลจริงชุดเดียวกัน
- งานทุกชิ้นมีสถานะ ผู้รับผิดชอบ กำหนดส่ง หลักฐาน และ audit trail
- วันที่ใช้เขตเวลา Asia/Bangkok

## 2. สิ่งที่ระบบมีอยู่แล้ว

| งานครู/ธุรการ | โมดูลปัจจุบัน | สถานะ |
|---|---|---|
| ทะเบียนและข้อมูลนักเรียน/ผู้ปกครอง | Student 360, Import/Export | มีแล้ว |
| เช็กชื่อประจำวันและรายวิชา | Teacher Work / Attendance | มีแล้ว |
| สุขภาพ อาหาร นม แปรงฟัน น้ำหนัก/ส่วนสูง | Student Health | มีแล้ว |
| ตารางสอน คาบ วิชา วันเรียน | Schedule | มีแล้ว |
| คะแนนและสมุดรวม | Score Center | มีแล้ว |
| เงินออมนักเรียน | Savings | มีแล้ว |
| พฤติกรรม เคสดูแล เยี่ยมบ้าน | Behavior, Student Care, Home Visit | มีแล้ว |
| ตารางเวรนักเรียน | Classroom Operations | มีแล้ว |
| ปฏิทิน วันหยุด สอบ กิจกรรม ชดเชย | School Calendar | มีแล้ว |
| สรุปรายวัน Timeline ไฟล์แนบ การอนุมัติ | Daily Brief | มีแล้ว |
| แจ้งเตือนและ Automation | Notifications, Automation | มีแล้ว |
| Portal/QR ผู้ปกครองและนักเรียน | Parent Access / Portal | มีแล้ว |
| ล็อกงวด แก้ไขย้อนหลัง | Period Locks | มีแล้ว |
| ปิดชั้น เลื่อนชั้น Snapshot/Archive | Academic Year Operations | มีแล้ว |
| PDF/CSV/XLSX และทะเบียน/รายงานหลัก | Reports | มีแล้วหลายชนิด |
| ตรวจข้อมูลผิด ซ้ำ ไม่มีห้อง และกู้คืน | Data Safety | มีแล้ว |

## 3. ช่องว่างที่ควรสร้าง

### P0 — จำเป็นต่อการเป็น “ศูนย์ธุรการ”

1. **Administrative Inbox**
   - งานค้างวันนี้/สัปดาห์นี้/เกินกำหนด
   - งานที่ระบบสร้างจาก attendance, calendar, care case หรือกำหนดส่ง
   - มอบหมายครูร่วมและติดตาม SLA

2. **คำร้องและการอนุมัติ**
   - ลาป่วย/ลากิจ/มาสาย/ขอแก้ข้อมูลเวลาเรียน
   - ขออนุญาตเข้าร่วมกิจกรรม ทัศนศึกษา รับ-ส่งนักเรียน
   - เอกสารประกอบ ผู้อนุมัติ และประวัติการเปลี่ยนสถานะ

3. **เอกสารประจำชั้นและ Mail Merge**
   - หนังสือแจ้งผู้ปกครอง แบบตอบรับ หนังสือรับรอง รายชื่อนักเรียน
   - Template version, เลขเอกสาร, ผู้ลงนาม และข้อมูล merge จาก Student 360
   - สร้าง PDF รายคนหรือรวมทั้งห้อง

4. **การรับทราบและ Consent**
   - ส่งประกาศ/แบบยินยอมให้ผู้ปกครอง
   - สถานะ ส่งแล้ว/เปิดแล้ว/รับทราบ/ยินยอม/ปฏิเสธ/หมดอายุ
   - เตือนเฉพาะรายที่ยังไม่ตอบ

5. **Checklist และหลักฐานส่งงาน**
   - Checklist รายวัน รายสัปดาห์ รายเดือน รายเทอม
   - แนบไฟล์/ภาพ/ลิงก์ และบันทึกผู้ตรวจรับ
   - ใช้เป็นฐานรายงานความครบถ้วน

### P1 — ลดงานซ้ำของครูอย่างมาก

6. **ประชุมผู้ปกครองและบันทึกการติดต่อ**
   - นัดหมาย ผู้เข้าร่วม ประเด็น ข้อตกลง งานติดตาม
   - ผูก student/care case ได้ แต่แยกข้อมูลอ่อนไหวตามสิทธิ์

7. **การแจกจ่ายและยืมคืน**
   - หนังสือเรียน อุปกรณ์ เครื่องแบบ อุปกรณ์ดิจิทัล
   - รับ/คืน/ชำรุด/สูญหาย ลายเซ็นหรือหลักฐานรับของ

8. **โครงการสวัสดิการนักเรียน**
   - ทุน อาหารกลางวัน นม ประกัน การเดินทาง และความช่วยเหลือ
   - เก็บเฉพาะข้อมูลที่จำเป็น พร้อมระดับความอ่อนไหว

9. **บันทึกเหตุการณ์และส่งต่อเวร/ครูแทน**
   - Incident log, สิ่งที่ต้องติดตาม, ผู้รับช่วง และสถานะปิดงาน

### P2 — สำหรับโรงเรียนที่ต้องการระบบเอกสารเต็มรูปแบบ

10. เลขรับ/เลขส่งหนังสือเฉพาะงานประจำชั้น
11. Template builder และชุดแบบฟอร์มของโรงเรียน
12. ลายเซ็นอิเล็กทรอนิกส์/QR ตรวจสอบเอกสาร
13. Dashboard ผู้บริหารข้ามห้องแบบ aggregate

## 4. Information Architecture ที่แนะนำ

เพิ่มเมนูใต้ `งานครูประจำวัน`:

```text
ศูนย์ธุรการประจำชั้น  /app/dashboard?view=classroom-admin
├─ ภาพรวมงาน          adminView=inbox
├─ คำร้อง/อนุมัติ     adminView=requests
├─ เอกสารและแบบฟอร์ม adminView=documents
├─ ผู้ปกครอง/Consent adminView=consents
├─ แจกจ่าย/ยืมคืน     adminView=assets
├─ ประชุม/การติดต่อ   adminView=meetings
└─ Checklist/หลักฐาน adminView=checklists
```

ไม่ควรรวมทุกอย่างไว้ใน `ClassroomOperationsPage` เดิม เพราะหน้านั้นรับผิดชอบเวร ล็อกงวด ปิดปี และ QR อยู่แล้ว ให้ Hub ใหม่เชื่อมไปยังโมดูลเดิมผ่าน task cards และ deep links

### หน้า Inbox

- แถบบน: Workspace, ห้อง, ปีการศึกษา, ครูผู้รับผิดชอบ
- KPI: ต้องทำวันนี้, เกินกำหนด, รอผู้ปกครอง, รออนุมัติ, เสร็จเดือนนี้
- กลุ่มงาน: วันนี้ / สัปดาห์นี้ / ไม่มีวันครบกำหนด / เสร็จแล้ว
- Filter: ประเภท, นักเรียน, ผู้รับผิดชอบ, สถานะ, ความสำคัญ
- Quick actions: สร้างงาน, สร้างเอกสาร, ส่ง Consent, บันทึกการติดต่อ
- Activity timeline และ audit แสดงท้าย drawer ของแต่ละงาน

## 5. Workflow กลาง

ใช้ state machine เดียวกันกับงานธุรการทุกประเภท:

```text
draft -> ready -> in_progress -> waiting_external -> submitted
      -> approved -> completed
      -> rejected/revision_requested -> in_progress
      -> cancelled
```

กฎ:

- ครูร่วมสร้าง/แก้ draft ของห้องที่ได้รับมอบหมาย
- งานที่มีข้อมูลอ่อนไหวหรือเผยแพร่ภายนอกต้องขออนุมัติ
- Owner อนุมัติ template, bulk send, consent policy และการแก้ไขหลังล็อกงวด
- Viewer อ่านเฉพาะรายงาน aggregate ไม่มี Student 360 หรือไฟล์แนบส่วนบุคคล
- Parent/Student ตอบเฉพาะ request/consent ที่ผูกสิทธิ์ของตน
- ทุก transition เขียน audit log

## 6. สิทธิ์ที่ควรเพิ่ม

เพิ่ม capability keys โดยไม่ใช้ role อย่างเดียว:

```ts
'class_admin.read'
'class_admin.task.write'
'class_admin.request.review'
'class_admin.document.prepare'
'class_admin.document.approve'
'class_admin.communication.send'
'class_admin.consent.manage'
'class_admin.asset.manage'
'class_admin.meeting.write'
'class_admin.report.export'
```

| บทบาท | ค่าเริ่มต้น |
|---|---|
| teacher_owner | ทุก capability ใน Workspace |
| teacher_member | read, task.write, document.prepare, meeting.write เฉพาะห้องที่มอบหมาย |
| teacher_member แบบ readonly | read เท่านั้น |
| viewer | รายงาน aggregate ตาม policy; ไม่เห็นเอกสารรายบุคคล |
| superadmin | ตรวจระบบและ support; การเปิดข้อมูลโรงเรียนต้องมีเหตุผลและ audit |
| parent/student | ตอบ request/consent ของ record ที่ผูกกับตนเท่านั้น |

## 7. แพ็กเกจ

เพิ่ม `ModuleKey = 'classroom_admin'` และแยกฟีเจอร์ดังนี้:

| ฟีเจอร์ | Free | Trial/VIP |
|---|---:|---:|
| Inbox และ Checklist พื้นฐาน | ✓ 1 ห้อง | ✓ |
| งานที่สร้างเอง | จำกัดจำนวน active | ไม่จำกัดตามโควตา Workspace |
| คำร้อง/อนุมัติ | ดูและบันทึกพื้นฐาน | ✓ workflow เต็ม |
| Template เอกสาร | Template มาตรฐาน | Custom + version |
| Mail merge/PDF ทั้งห้อง | — | ✓ |
| Consent และติดตามผู้ไม่ตอบ | — | ✓ |
| Asset/ยืมคืน | — | ✓ |
| Export CSV | พื้นฐาน | ✓ |
| XLSX/PDF ชุด/ZIP | — | ✓ |
| Automation/Reminder | — | ✓ |

การจำกัดต้องตรวจทั้ง frontend entitlement และ backend RPC/trigger

## 8. Data Model ที่แนะนำ

ทุกตารางต้องมี `id uuid`, `workspace_id uuid`, timestamps และ index ตาม Workspace/Classroom

### ตารางแกนกลาง

`class_admin_tasks`

- classroom_id, student_id nullable
- task_type, title, description
- status, priority
- assigned_profile_id, created_by_profile_id
- due_at, completed_at
- source_type/source_id สำหรับเชื่อม attendance, care case, calendar
- metadata jsonb สำหรับข้อมูลเสริมที่ไม่ควรกลายเป็นคอลัมน์ถาวร

`class_admin_task_events`

- task_id, event_type, from_status, to_status
- actor_profile_id, note, metadata

### เอกสาร

`class_admin_document_templates`

- name, document_type, version, status
- body_schema jsonb, merge_fields jsonb
- requires_approval, owner_profile_id

`class_admin_documents`

- template_id/version, classroom_id, student_id
- document_no, status, generated_file_id
- prepared_by, approved_by, approved_at
- snapshot_data jsonb เพื่อให้เอกสารเก่าไม่เปลี่ยนตามข้อมูลใหม่

### Request/Consent

`class_admin_requests`

- request_type, requester_profile_id, student_id
- requested_from/to, reason, status
- reviewed_by, reviewed_at, decision_note

`class_admin_consents`

- consent_type, title, details, expires_at, status
- classroom_id, created_by, approved_by

`class_admin_consent_recipients`

- consent_id, student_id, guardian_profile_id
- delivery_status, response, responded_at, response_note

### Meeting/Asset/Checklist

- `class_admin_contact_logs`
- `class_admin_meetings`, `class_admin_meeting_attendees`
- `class_admin_assets`, `class_admin_asset_transactions`
- `class_admin_checklist_templates`, `class_admin_checklist_runs`, `class_admin_checklist_items`
- ไฟล์แนบใช้ private storage bucket และตาราง attachment กลาง ห้าม base64 ใน database

### Constraint สำคัญ

- Foreign key ที่เกี่ยวข้องต้องยืนยันว่าอยู่ `workspace_id` เดียวกัน
- Student ต้องอยู่ Classroom ที่ผู้ใช้เข้าถึงได้
- ห้ามเปลี่ยน document snapshot หลัง approved; ให้สร้าง revision
- Soft delete/archive ก่อน permanent delete
- Unique key ที่แนะนำ: `(workspace_id, document_no)` และ `(consent_id, student_id)`

## 9. RLS/RPC Design

- SELECT: membership active + classroom assignment หรือ owner/superadmin ตาม policy
- INSERT/UPDATE: `has_workspace_capability(...)` และ classroom scope
- Parent/Student: ใช้ profile link/guardian link ที่ active และ consent ที่เกี่ยวข้องเท่านั้น
- Viewer: ใช้ RPC aggregate แทน SELECT ตารางรายบุคคล
- Bulk create/send/generate PDF ใช้ RPC หรือ Edge Function ที่ตรวจ Workspace ซ้ำ
- การอนุมัติ การส่งภายนอก การย้อนสถานะ และดาวน์โหลดไฟล์อ่อนไหวต้อง audit
- เพิ่ม rollback SQL tests สำหรับ owner, member, readonly, viewer, outsider และ parent

## 10. รายงานและรูปแบบไฟล์

| รายงาน | ผู้ใช้ | รูปแบบ |
|---|---|---|
| งานค้าง/เกินกำหนด | ครู/Owner | หน้าจอ, CSV, XLSX |
| Checklist ความครบถ้วน | ครู/Owner/ผู้บริหาร | PDF A4, XLSX |
| คำร้องและผลอนุมัติ | ครู/Owner/ผู้ปกครองเฉพาะตน | PDF รายการ, PDF รายคน |
| Consent response matrix | ครู/Owner | XLSX, CSV; PDF สรุป |
| หนังสือแจ้ง/แบบตอบรับ | ผู้ปกครอง | PDF รายคน/รวม ZIP |
| บันทึกประชุม/การติดต่อ | ครู/Owner | PDF; CSV สำหรับติดตาม |
| ทะเบียนยืมคืน/แจกจ่าย | ครู/Owner | XLSX, PDF ลงนาม |
| Executive summary | Owner/Viewer | PDF aggregate, XLSX aggregate |
| Machine backup | Owner | JSON versioned schema |

มาตรฐานไฟล์:

- PDF: A4, ฟอนต์ไทยฝังได้, โลโก้/เลขเอกสาร/ผู้ลงนามจาก Workspace settings
- CSV: UTF-8 BOM เพื่อเปิดภาษาไทยใน Excel
- XLSX: หัวตารางคงที่, freeze pane, autofilter, data dictionary sheet
- JSON: มี `schemaVersion`, `workspaceId`, `exportedAt`, timezone
- ZIP: manifest + checksum เมื่อรวม PDF หลายไฟล์

## 11. Integration กับโมดูลเดิม

- Attendance ขาด/สายต่อเนื่อง -> สร้าง follow-up task หรือ request เอกสารลา
- School Calendar -> สร้าง checklist ก่อนกิจกรรม/สอบ
- Student Care -> สร้างงานติดตามโดยไม่คัดลอกข้อมูลอ่อนไหว
- Daily Brief -> ดึงจำนวนงานสำเร็จ/ค้างและเหตุการณ์สำคัญ
- Notifications/Automation -> เตือนกำหนดส่งและผู้ปกครองที่ยังไม่ตอบ
- Reports -> เพิ่มหมวด `งานธุรการ` โดยใช้ query/RPC เดียวกับ Hub
- Period Locks -> ล็อกเอกสาร/คำร้องตามเดือน โดย request unlock ตามระบบเดิม
- Academic Year -> snapshot งาน เอกสาร และ consent ที่ต้องเก็บถาวร
- Data Safety -> ตรวจ orphan attachment, duplicate document_no และ task ที่อ้าง record หาย

## 12. แผนสร้างแบบเป็นระยะ

### Phase 0 — Contract และ Migration

- เพิ่ม ModuleKey/capabilities/navigation
- migration ตาราง task/event/checklist + RLS + indexes
- SQL regression tests และ seed/demo fixtures

### Phase 1 — Admin Inbox MVP

- Inbox, create/edit/assign/complete task
- Filter ห้อง/นักเรียน/ผู้รับผิดชอบ/กำหนดส่ง
- Checklist template/run
- CSV export และ Daily Brief integration

### Phase 2 — Requests และ Documents

- request workflow + approval
- template/document snapshot/version
- PDF รายคนและ batch
- period lock/audit integration

### Phase 3 — Consent และ Parent Portal

- send/response/reminder
- parent portal response screen
- consent matrix XLSX/PDF

### Phase 4 — Meetings และ Assets

- contact/meeting follow-up
- distribution/loan/return
- executive aggregate report

### Phase 5 — Hardening

- accessibility/mobile QA
- quota/entitlement tests
- outsider/cross-school RLS tests
- backup/restore/delete impact
- production authenticated role matrix

## 13. Definition of Done

- ไม่มี query/write ที่ขาด `workspace_id`
- ครูร่วมไม่อ่านหรือแก้ข้อมูลห้องอื่นผ่าน UI, direct URL หรือ API
- readonly controls disabled และ backend ปฏิเสธ write
- Viewer ไม่ได้รับ student-level payload
- Free ถูกจำกัดทั้ง UI และ backend
- PDF/CSV/XLSX เปิดได้จริงและภาษาไทยไม่เสีย
- ทุก approval/status transition มี audit
- archive/restore ทำได้ก่อน permanent delete
- `npm run lint`, `npm run build`, `npm run check:deploy`, `npm run check:supabase`, DB lint และ SQL tests ผ่าน
- Browser QA ครบ owner/member/readonly/viewer/free/expired/parent/superadmin/signed-out

## 14. จุดเริ่มอ่านโค้ดสำหรับผู้รับช่วง

1. `src/App.tsx` — role routes และการประกอบหน้า
2. `src/routes/appRoutes.ts` — navigation/module mapping
3. `src/lib/roles.ts` — capability defaults
4. `src/lib/entitlements.ts` — Free/Trial/VIP
5. `src/pages/app/ClassroomOperationsPage.tsx` — ตัวอย่าง workflow, RPC, print report
6. `src/pages/app/DailySchoolBriefPage.tsx` — approval/timeline/attachments
7. `src/pages/app/ReportsPage.tsx` — PDF/CSV/XLSX patterns
8. `supabase/migrations/0034_classroom_year_operations.sql`
9. `supabase/migrations/0044_daily_school_briefs.sql`
10. `supabase/migrations/0051_teacher_invitations_and_classroom_rls.sql`
11. `supabase/migrations/0061_permission_boundary_hardening.sql`

## 15. Prompt สำหรับเริ่มงานต่อในแชทใหม่

```text
อ่าน docs/CLASSROOM_ADMINISTRATION_BLUEPRINT.md ทั้งไฟล์ แล้วตรวจสถานะ git และโค้ดปัจจุบันก่อนแก้
เริ่ม Phase 0 และ Phase 1 ของ Classroom Administration Hub โดยยึด workspace_id + classroom assignment + capability + plan entitlement เป็นขอบเขตสิทธิ์
ห้ามสร้างข้อมูลนักเรียน/attendance/report ซ้ำ ให้เชื่อมโมดูลเดิม
เพิ่ม migration, RLS, rollback SQL tests, demo fixtures, route/menu, Admin Inbox และ Checklist MVP
ทดสอบ owner, teacher_member, readonly, viewer, free, expired และ cross-school outsider
รัน lint/build/check:deploy/check:supabase/db lint และ browser interaction ก่อนสรุป
รักษาไฟล์ supabase/.temp/ ไว้และอย่า commit
```

## 16. การตัดสินใจที่ไม่ควรเปลี่ยนโดยไม่มีเหตุผล

- โรงเรียนหนึ่งแห่งเท่ากับหนึ่ง Workspace data boundary
- VIP/แพ็กเกจเป็นของ Workspace ไม่ใช่ครูรายคน
- ครูต่างโรงเรียนใช้ profile เดิม แต่ membership/capability/classroom scope แยกกัน
- Frontend guard เป็น UX; RLS/RPC คือ security boundary
- รายงานต้องสร้างจากข้อมูล canonical ไม่คัดลอกเป็นตารางรายงานแยก
- เก็บ snapshot เฉพาะเอกสารที่อนุมัติแล้วและต้องคงสภาพทางราชการ

