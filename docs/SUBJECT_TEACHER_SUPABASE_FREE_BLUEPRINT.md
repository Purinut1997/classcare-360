# ClassCare 360: Subject Teacher Blueprint for Supabase Free Plan

สถานะเอกสาร: แบบพร้อมส่งต่อเพื่อพัฒนา  
ปรับปรุงล่าสุด: 21 สิงหาคม 2026  
ขอบเขต: งานครูประจำวิชา โดยใช้ Supabase Free Plan เป็นโครงสร้างพื้นฐาน

## 1. ข้อสรุปที่ควรสร้างตอนนี้

เพิ่มเมนู **งานครูประจำวิชา** โดยเรียงลำดับดังนี้

1. **รายวิชาของฉัน** — หน้าเริ่มต้นที่รวมวิชา ห้อง ตารางสอน งานค้าง และทางลัดไปเช็กชื่อ/คะแนน
2. **งานมอบหมายและติดตามการส่งงาน** — เก็บเฉพาะสถานะที่เกิดขึ้นจริง ไม่สร้างแถว “ยังไม่ส่ง” ล่วงหน้าทุกคน
3. **บันทึกหลังสอน** — ผูกกับรายวิชา ห้อง วันที่ และคาบจากตารางสอนเดิม
4. **ส่งผลการเรียน** — ตรวจความครบถ้วน ล็อก และส่งอนุมัติ โดยอ้างอิงคะแนนเดิม ไม่คัดลอกคะแนนซ้ำ

ยังไม่ควรสร้างในรอบแรก:

- ตารางสอนใหม่ เพราะระบบมี `workspace_schedule_settings` อยู่แล้ว
- สมุดคะแนนใหม่ เพราะระบบมี `score_assessments` และ `score_entries` อยู่แล้ว
- คลังไฟล์ขนาดใหญ่ วิดีโอ หรือ LMS เต็มรูปแบบบน Supabase Storage
- แชตและสถานะออนไลน์แบบ Realtime ตลอดเวลา
- ตารางสมาชิกนักเรียนต่อรายวิชา หากรายวิชายังอิงสมาชิกของห้องเรียนได้

## 2. เป้าหมายและข้อจำกัดจริงของ Free Plan

Supabase Free Plan ณ วันที่จัดทำเอกสารมีโควตาหลัก ได้แก่ ฐานข้อมูล 500 MB, Storage 1 GB, ผู้ใช้รายเดือน 50,000 MAU, Realtime พร้อมกัน 200 connections, Realtime 2 ล้าน messages, Edge Functions 500,000 ครั้ง และ egress แบบ uncached 5 GB ต่อเดือน

ดังนั้นคำว่า “รองรับผู้ใช้จำนวนมาก” ในเอกสารนี้หมายถึง:

- ผู้ใช้จำนวนมากเข้าใช้งานแบบเป็นช่วง ไม่ใช่หลายหมื่นคนออนไลน์พร้อมกัน
- หน้าจอหนึ่งหน้าใช้คำขอจำนวนน้อยและผลลัพธ์ขนาดเล็ก
- ข้อมูลหลักเป็นข้อความและตัวเลข ไม่เก็บไฟล์งานนักเรียนจำนวนมากใน Supabase
- ไม่มีการเปิด Realtime subscription แยกตามห้อง รายวิชา หรือแถวนักเรียน
- วัดการใช้ทรัพยากรจริงและอัปเกรดก่อนชนเพดาน ไม่รับประกันจำนวนโรงเรียนตายตัวจาก MAU เพียงตัวเดียว

Free Plan เหมาะกับ pilot และการเริ่มใช้งานจริงขนาดควบคุม แต่ข้อมูลโรงเรียนที่เป็นระบบหลักระยะยาวควรมีแผนสำรองข้อมูลภายนอกและเกณฑ์อัปเกรด เพราะ Free Plan ไม่มี automatic backups และโครงการที่ไม่มีกิจกรรมอาจถูก pause ได้

แหล่งอ้างอิงทางการ:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/realtime/limits
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/free-project-pausing

## 3. สถาปัตยกรรมที่เหมาะกับระบบนี้

ใช้ Supabase project เดียวแบบ multi-tenant และให้ `workspace_id` เป็นขอบเขตข้อมูลโรงเรียน ห้ามสร้าง Supabase project แยกหนึ่งโครงการต่อหนึ่งโรงเรียน เพราะ Free Plan มีจำนวน active projects จำกัดและดูแลสิทธิ์/การย้าย schema ยาก

```text
Workspace (โรงเรียน)
  ├─ Classroom (ห้องเรียนเดิม)
  ├─ Workspace member + classroom assignment (สิทธิ์เดิม)
  ├─ Schedule JSON (ตารางสอนเดิม)
  └─ Subject offering (ตัวเชื่อมใหม่)
       ├─ ใช้คาบจาก Schedule เดิม
       ├─ ใช้นักเรียนจาก Classroom เดิม
       ├─ ใช้คะแนนจาก Score Center เดิม
       ├─ Assignment + sparse submission (ใหม่)
       ├─ Lesson log (ใหม่)
       └─ Grade submission (ใหม่)
```

หลักสำคัญคือสร้าง **ตัวตนของการสอนหนึ่งรายวิชา** เพียงครั้งเดียว แล้วให้ทุกโมดูลอ้าง `subject_offering_id` เดียวกัน

## 4. แบบข้อมูลขั้นต่ำ

### 4.1 `subject_offerings`

ตัวเชื่อมรายวิชา ห้อง ครู ปีการศึกษา และภาคเรียน ไม่ใช่ตารางสอนชุดใหม่

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid | primary key |
| `workspace_id` | uuid | ขอบเขตโรงเรียน |
| `classroom_id` | uuid | ห้องเรียนเดิม |
| `teacher_profile_id` | uuid | ครูผู้สอนหลัก |
| `subject_code` | text | รหัสวิชา |
| `subject_name` | text | ชื่อวิชา |
| `academic_year` | text | ปีการศึกษา |
| `term_key` | text | เช่น `1`, `2`, `summer` |
| `status` | text | `active`, `closed`, `archived` |
| `created_at`, `updated_at` | timestamptz | เวลาระบบ |

ข้อกำหนด:

- unique `(workspace_id, classroom_id, teacher_profile_id, subject_code, academic_year, term_key)`
- ระยะแรก owner เลือกวิชา/ห้อง/ครูจาก catalogue ในตารางสอนเดิม แล้วระบบสร้างหรืออัปเดต offering
- ระยะต่อไปค่อยปรับ `workspace_schedule_settings` ให้ cell อ้าง `subject_offering_id`; ระหว่างเปลี่ยนผ่านยังจับคู่ด้วย `subject_code + classroom name`
- ครูร่วมสอนให้เพิ่ม `subject_offering_teachers` ภายหลังเมื่อมีกรณีใช้งานจริง อย่าเพิ่มตั้งแต่ MVP

### 4.2 `subject_assignments`

เก็บหัวข้องานหนึ่งแถว ไม่เก็บไฟล์งานจริง

| คอลัมน์สำคัญ | หมายเหตุ |
|---|---|
| `workspace_id`, `subject_offering_id` | scope และเจ้าของรายวิชา |
| `title`, `description_short` | จำกัดข้อความ เช่น 160 และ 2,000 ตัวอักษร |
| `assigned_at`, `due_at` | ใช้แสดง/เรียงด้วย cursor |
| `max_score` | nullable; ถ้ามีคะแนนให้เชื่อม Score Center |
| `score_assessment_id` | nullable FK ไป `score_assessments` |
| `resource_url` | ลิงก์ Drive/OneDrive/แหล่งภายนอก |
| `status` | `draft`, `open`, `closed`, `archived` |
| `created_by`, timestamps | audit ขั้นต่ำ |

อย่าเก็บ rich text ขนาดใหญ่หรือ base64 ในฐานข้อมูล

### 4.3 `subject_assignment_submissions` แบบ sparse

สร้างแถวเฉพาะเมื่อมีสถานะที่ไม่ใช่ค่าเริ่มต้น เช่น นักเรียนส่งงาน ครูยกเว้น ครูคืนแก้ หรือครูบันทึกผล

| คอลัมน์สำคัญ | หมายเหตุ |
|---|---|
| `workspace_id`, `assignment_id`, `student_id` | unique ต่อคนต่องาน |
| `status` | `submitted`, `late`, `returned`, `accepted`, `exempt` |
| `submitted_at` | nullable |
| `submission_url` | ลิงก์ภายนอก ไม่ใช่ไฟล์ blob |
| `feedback_short` | จำกัดความยาว |
| `score_entry_id` | nullable FK ไปคะแนนเดิม |
| `graded_by`, `updated_at` | ผู้ตรวจและเวลาล่าสุด |

สถานะ “ยังไม่ส่ง” คำนวณด้วย active students ในห้อง `LEFT JOIN` submission แล้วหาแถวที่ไม่มีข้อมูล วิธีนี้หลีกเลี่ยงการสร้าง `จำนวนนักเรียน × จำนวนงาน` ตั้งแต่มอบหมายงาน

### 4.4 `subject_lesson_logs`

หนึ่งแถวต่อการสอนจริงหนึ่งครั้ง

| คอลัมน์สำคัญ | หมายเหตุ |
|---|---|
| `workspace_id`, `subject_offering_id` | scope |
| `lesson_date`, `period_key` | วันที่และคาบจากตารางเดิม |
| `attendance_session_id` | nullable FK ไปการเช็กชื่อเดิม |
| `topic` | หัวข้อ |
| `outcome_status` | `complete`, `partial`, `reschedule`, `cancelled` |
| `summary_short`, `follow_up_short` | จำกัดข้อความสั้น |
| `created_by`, timestamps | audit |

ไม่สร้างแถวล่วงหน้าทุกคาบ ระบบแสดงคาบจากตารางสอน แล้วค่อย insert เมื่อครูกดบันทึก

### 4.5 `subject_grade_submissions`

เก็บ workflow การส่งผล ไม่เก็บสำเนาคะแนนนักเรียนทุกคน

| คอลัมน์สำคัญ | หมายเหตุ |
|---|---|
| `workspace_id`, `subject_offering_id`, `period_key` | unique ต่อรอบส่ง |
| `status` | `draft`, `submitted`, `returned`, `approved`, `locked` |
| `assessment_count`, `graded_student_count`, `missing_count` | snapshot เป็นตัวเลขขนาดเล็ก |
| `score_snapshot_hash` | ตรวจว่าคะแนนถูกแก้หลังส่งหรือไม่ |
| `submitted_by`, `reviewed_by`, timestamps | workflow |
| `review_note_short` | เหตุผลส่งกลับ |

เมื่อต้องดูรายละเอียด ให้ query `score_assessments`/`score_entries` ชุดจริง ไม่ทำ duplicate score ledger

## 5. สิทธิ์การใช้งาน

### ครูประจำวิชา (`teacher_member`)

- เห็น offering ที่ตนเป็นครู และห้องที่ถูกมอบหมายใน `workspace_member_classrooms`
- สร้าง/แก้งาน บันทึกหลังสอน และคะแนนของ offering ตนเอง
- ส่งผลการเรียนได้ แต่อนุมัติหรือล็อกเองไม่ได้
- ห้ามอ่านรายวิชาของโรงเรียนอื่น แม้เดา UUID ได้

### เจ้าของโรงเรียน (`teacher_owner`)

- จัดคู่ครู–รายวิชา–ห้อง
- ดูทุก offering ใน workspace
- ส่งกลับ อนุมัติ และล็อกผลการเรียน
- เปิดรายงานรวมระดับโรงเรียน

### Superadmin

- ตรวจสุขภาพระบบและโควตาได้
- การเข้าถึงข้อมูลโรงเรียนต้องเป็นเส้นทางพิเศษที่มี audit ไม่ใช่สิทธิ์แฝงใน UI ทั่วไป

### Parent/Student portal ในอนาคต

- อ่านเฉพาะ assignment ที่ publish และ submission ของนักเรียนที่เชื่อมกับบัญชี
- ห้ามใช้ service-role key ใน browser

### RLS ที่ต้องใช้

- ทุกตารางใหม่มี `workspace_id NOT NULL`, FK และ RLS
- ตรวจทั้งสมาชิก workspace, ห้องที่ถูกมอบหมาย และ teacher ของ offering
- ใช้ helper function แบบ `security definer` เช่น `can_access_subject_offering(offering_id, write_mode)` เพื่อลด policy join ซ้ำ
- helper ต้องกำหนด `set search_path = ''` และระบุ schema ทุก object
- ใน policy ใช้ `(select auth.uid())` แทนการเรียก `auth.uid()` ต่อทุกแถว
- trigger ตรวจว่า FK ทุกตัวอยู่ workspace เดียวกัน เพื่อกัน client ปลอม `workspace_id`
- plan entitlement ต้องบังคับที่ RLS/RPC/trigger ไม่ใช่ซ่อนเมนูอย่างเดียว

## 6. Index ที่จำเป็น

```sql
-- offering ของครูในเทอมปัจจุบัน
(workspace_id, teacher_profile_id, academic_year, term_key, status)

-- offering ของห้อง
(workspace_id, classroom_id, academic_year, term_key, status)

-- งานล่าสุด/ใกล้กำหนด ใช้ keyset pagination
(workspace_id, subject_offering_id, status, due_at, id)

-- หนึ่งคนต่องาน และค้นงานของนักเรียน
unique (assignment_id, student_id)
(workspace_id, student_id, status, updated_at desc)

-- บันทึกหลังสอนล่าสุด
(workspace_id, subject_offering_id, lesson_date desc, id)

-- รอบส่งผล
unique (workspace_id, subject_offering_id, period_key)
(workspace_id, status, submitted_at desc)
```

FK ที่ไม่ได้ขึ้นต้นอยู่ใน composite index ต้องมี index แยก โดยเฉพาะ `teacher_profile_id`, `score_assessment_id`, `score_entry_id` และ `attendance_session_id`

## 7. งบประมาณต่อหน้าจอ

ใช้ตัวเลขนี้เป็น acceptance target ของแอป ไม่ใช่โควตารับประกันจาก Supabase

| หน้าจอ/เหตุการณ์ | เป้าหมาย |
|---|---|
| เปิด “รายวิชาของฉัน” | 1 RPC + ไม่เกิน 50 KB compressed |
| เปิดรายวิชาหนึ่งวิชา | 1–2 requests, ไม่โหลดรายชื่อนักเรียนจนเปิดแท็บ |
| รายการงาน | 25 รายการ/หน้า, keyset cursor `(due_at,id)` |
| รายชื่อนักเรียน/สถานะส่งงาน | 50–100 คน/หน้า หรือ virtualized table |
| บันทึกสถานะทั้งห้อง | batch upsert/RPC ครั้งเดียว ไม่ยิงคนละ request |
| Dashboard ผู้บริหาร | RPC aggregate 1 ครั้ง ไม่ดาวน์โหลด score entries ทั้ง workspace |
| Realtime | ปิดเป็นค่าเริ่มต้น; refresh หลังเขียน, focus, หรือ manual |
| ค้นหา | debounce 300–500 ms, ขั้นต่ำ 2 ตัวอักษร, limit 20 |

ห้ามใช้ `OFFSET` กับรายการที่โตต่อเนื่อง ให้ใช้ cursor/keyset pagination และเลือกเฉพาะคอลัมน์ที่จะแสดง หลีกเลี่ยง `.select('*')`

## 8. การลดพื้นที่และ bandwidth

### ไฟล์

- ค่าเริ่มต้นคือเก็บ `resource_url`/`submission_url` จาก Google Drive, OneDrive หรือระบบภายนอก
- ถ้าจำเป็นต้องใช้ Supabase Storage ให้ใช้ private bucket, signed URL อายุสั้น และ app limit ต่ำกว่า provider limit
- รูปภาพควรบีบอัดไม่เกินประมาณ 1 MB; เอกสารทั่วไปไม่เกินประมาณ 5 MB ตาม policy ของแอป
- ห้ามเก็บ base64, thumbnail ซ้ำหลายขนาด หรือวิดีโอในฐานข้อมูล
- ลบไฟล์ draft/orphan ตาม retention policy

### ข้อมูล

- จำกัดข้อความ note/feedback ทุกช่อง
- JSONB ใช้เฉพาะ metadata ที่ไม่ filter/sort บ่อย
- ไม่เก็บ read-event และ page-view ทุกครั้งใน audit log
- current term เป็น hot data; ปีเก่าส่งออกเป็น CSV/XLSX/PDF และ archive
- คะแนนทางการยังเก็บเป็น relational data ส่วน event/history รายละเอียดเกินความจำเป็นให้สรุปก่อน archive

### รายงาน

- CSV/XLSX รายบุคคลหรือรายห้อง: สร้างฝั่ง browser จากข้อมูลที่ผู้ใช้มีสิทธิ์แล้ว
- PDF แบบพิมพ์: ใช้ print template ฝั่ง browser เมื่อไม่มีข้อมูลลับที่ต้องประมวลผล server-side
- รายงานรวม: RPC aggregate ส่งเฉพาะ totals/percentages
- งาน batch ข้ามหลายห้องค่อยใช้ Edge Function และตั้ง idempotency key

## 9. Dashboard และ aggregate โดยไม่สแกนข้อมูลทั้งระบบ

RPC `get_subject_teacher_home(term_key)` ควรคืน payload เดียว:

- offerings ของครูสูงสุดตามเทอมปัจจุบัน
- คาบวันนี้จาก schedule settings
- จำนวนงานเปิด/ใกล้กำหนด/รอตรวจต่อ offering
- บันทึกหลังสอนที่ยังขาดเฉพาะ 7–14 วันล่าสุด
- สถานะการส่งผลการเรียน

เริ่มจาก aggregate query ที่มี index ก่อน ยังไม่ต้องสร้าง materialized view หาก P95 ช้าจริงค่อยเพิ่ม `subject_offering_counters` หนึ่งแถวต่อ offering และอัปเดตผ่าน RPC หลัง write ไม่ใช้ trigger ซ้อนหลายชั้นตั้งแต่วันแรก

Dashboard โรงเรียนต้องไม่ทำแบบหน้าเดิมที่โหลด assessments และ entries ทั้ง workspace แล้วคำนวณใน browser ควรย้ายยอดรวมเป็น RPC ที่รับ `workspace_id`, `academic_year`, `term_key` และคืนชุดข้อมูลเล็ก

## 10. แนวทาง Realtime และการเชื่อมต่อ

- โมดูลนี้ไม่ต้องใช้ Realtime เพื่อทำงานถูกต้อง
- หลัง save ให้ปรับ local cache แล้ว revalidate query ที่เกี่ยวข้อง
- refresh เมื่อกลับมา focus หรือกดปุ่มรีเฟรช
- ถ้าภายหลังต้องแจ้งเตือน ให้หนึ่ง user ใช้ channel รวมระดับ workspace/ผู้ใช้ ไม่สร้าง channel ต่อ assignment หรือ student
- ห้ามใช้ presence สำหรับรายชื่อผู้ใช้ออนไลน์ใน MVP

แนวทางนี้สำคัญเพราะ Free Plan รองรับ peak Realtime connections จำกัดกว่าจำนวน MAU มาก

## 11. Quota guardrail

เพิ่มหน้า Superadmin “Supabase Capacity” โดยอ่าน metric จาก Supabase dashboard/API ที่ได้รับอนุญาต หรือบันทึกค่าตรวจสอบรายวันนอกฐานข้อมูลหลัก

| ระดับ | การใช้โควตา | การดำเนินการ |
|---|---:|---|
| ปกติ | < 60% | ทำงานตามปกติ |
| เฝ้าระวัง | 60–74% | ตรวจ top tables, egress, orphan files |
| เตรียมย้าย/อัปเกรด | 75–84% | หยุดฟีเจอร์ไฟล์ใหม่, archive, วางแผนอัปเกรด |
| ฉุกเฉิน | ≥ 85% | อัปเกรดก่อนชน quota; ห้ามรอให้ DB read-only |

เป้าหมายภายในที่ปลอดภัยกว่าเพดาน:

- database ไม่เกิน 350 MB ในการดำเนินงานปกติ
- Storage ไม่เกิน 700 MB
- peak Realtime ไม่เกิน 100 และ MVP ควรใกล้ศูนย์
- egress แต่ละประเภทไม่เกิน 70% ของโควตารายเดือน
- P95 ของ RPC หน้าหลักไม่เกิน 500 ms จาก region ของผู้ใช้เป้าหมาย

ตัวเลขเหล่านี้เป็น engineering guardrail เพื่อเหลือพื้นที่รับ spike ไม่ใช่ข้อจำกัดทางการของ Supabase

## 12. แผนสำรองและ retention

- สำรอง schema และข้อมูลสำคัญด้วย `pg_dump` จาก CI/เครื่องที่ปลอดภัยไปยัง external encrypted storage ตามรอบที่โรงเรียนยอมรับได้
- สำรองไม่ควรรวม secrets และต้องทดสอบ restore เป็นระยะ
- เก็บคะแนนและเอกสารผลการเรียนตามนโยบายโรงเรียน
- assignment submission metadata และ lesson logs ปีเก่าให้ export/archive ตามรอบปีการศึกษา
- ช่วงปิดเทอมต้องมีผู้ดูแลตรวจสถานะ project เพราะ Free project ที่ inactivity อาจ pause

## 13. ลำดับพัฒนา

### Phase 0 — Schema audit และ migration bridge

- ยืนยัน schema remote ล่าสุดและ RLS migrations
- สร้าง `subject_offerings`
- ทำ owner UI สำหรับจับคู่ schedule subject + classroom + teacher
- ห้ามย้าย schedule JSON ใน migration เดียว ให้ทำ bridge แบบอ่านของเก่าได้ก่อน

### Phase 1 — รายวิชาของฉัน

- สร้างหน้า dashboard จาก offering + schedule เดิม
- ทางลัดไป `AttendancePage` และ `ScoresPage` พร้อม query params ที่มีอยู่
- สร้าง RPC compact payload

### Phase 2 — งานมอบหมาย

- สร้าง assignment + sparse submission
- batch save ผ่าน RPC transaction
- เชื่อม assessment เดิมเมื่อมีคะแนน
- CSV/XLSX export ฝั่ง client

### Phase 3 — บันทึกหลังสอน

- prefill จาก schedule และ attendance session เดิม
- บันทึกเฉพาะเมื่อครูยืนยัน
- รายงานรายสัปดาห์/รายเดือนแบบ aggregate

### Phase 4 — ส่งผลการเรียน

- completeness check จาก score tables เดิม
- workflow submit/return/approve/lock
- snapshot เฉพาะ counts + hash

### Phase 5 — Capacity, archive, backup

- quota dashboard/alerts
- yearly export + archive procedure
- restore drill และ performance test

## 14. Acceptance tests ที่ต้องผ่าน

### สิทธิ์และ isolation

- ครูโรงเรียน A อ่าน/เขียน offering โรงเรียน B ไม่ได้ แม้ส่ง UUID ตรง
- ครูใน workspace เดียวกันแต่ไม่ได้รับมอบหมายห้อง อ่านข้อมูลนักเรียน/งานของห้องนั้นไม่ได้
- ครูวิชา A แก้ assignment/ผลส่งวิชา B ไม่ได้
- owner อนุมัติได้ แต่ teacher member ล็อกผลเองไม่ได้
- trigger ปฏิเสธ FK ข้าม workspace

### ความถูกต้อง

- schedule แก้แล้ว My Courses แสดงคาบใหม่โดยไม่สร้างตารางสอนซ้ำ
- คะแนนจาก assignment เขียนไป `score_entries` ชุดเดียว
- ลบนักเรียน/ย้ายห้องใช้พฤติกรรม archive และ period lock เดิม
- แก้คะแนนหลัง submitted แล้ว hash เปลี่ยนและสถานะแสดงว่า “ข้อมูลเปลี่ยนหลังส่ง”

### ประสิทธิภาพ

- ไม่มี N+1 ต่อรายชื่อนักเรียน
- save ทั้งห้องเป็น request เดียว
- list ทุกหน้ามี limit และ cursor
- query plan ใช้ index สำหรับ offering, assignment, submission, lesson log
- หน้าหลักไม่ select score entries ทั้ง workspace
- เปิด 100–200 browser sessions จำลองโดยไม่มี Realtime subscriptions แล้ว error rate/latency อยู่ในเกณฑ์ที่กำหนด

### โควตา

- ไฟล์เกิน app limit ถูกปฏิเสธก่อน upload
- มีรายงานขนาดฐานข้อมูลและ storage
- ทดสอบเข้าโหมดเตือน 60/75/85% โดยไม่ต้องใช้โควตาจริง
- restore จาก backup ตัวอย่างได้

## 15. สิ่งที่ต้องตรวจใน repository ก่อนเริ่มเขียน migration

- `supabase/migrations/0028_workspace_schedule_settings.sql`
- `supabase/migrations/0007_scorebook_foundation.sql`
- migrations ล่าสุดที่ harden RLS/entitlements (`0051` เป็นต้นไป)
- `src/pages/app/SchedulePage.tsx`
- `src/pages/app/ScoresPage.tsx`
- `src/pages/app/AttendancePage.tsx`
- `src/lib/scheduleSettings.ts`
- `src/lib/entitlements.ts`
- route/nav definitions ใน `src/App.tsx` และ dashboard components

ห้ามอิงเฉพาะ migration เก่า เพราะ policy ถูกแก้ซ้ำใน migrations หลังจากนั้น และต้องตรวจ remote Supabase ก่อนกล่าวว่าสิทธิ์ production ตรงกับ local

## 16. Definition of Done

งานถือว่าเสร็จเมื่อ:

- ครูเห็นเฉพาะวิชา/ห้องที่ตนได้รับมอบหมาย
- ไม่สร้าง schedule หรือ score data ซ้ำ
- assignment, submission, lesson log และ grade workflow ใช้ข้อมูลจริงจาก Supabase
- ทุก write เป็น workspace-scoped, classroom-scoped และผ่าน RLS/trigger
- รายการโตได้ด้วย cursor pagination และ batch writes
- ไม่มีไฟล์ใหญ่/base64 ใน database
- รายงาน CSV/XLSX/PDF สร้างได้ตามสิทธิ์
- มี quota alert, archive plan และ external backup plan
- ผ่าน lint, build, deploy checks, Supabase checks, RLS outsider tests และ authenticated browser flows ทุกบทบาท

## 17. คำสั่งส่งต่องานให้ AI/นักพัฒนาคนถัดไป

> พัฒนาโมดูล “งานครูประจำวิชา” ตาม `docs/SUBJECT_TEACHER_SUPABASE_FREE_BLUEPRINT.md` โดยเริ่ม Phase 0–1 ก่อน ตรวจ migration และ remote Supabase ล่าสุด ห้ามสร้างตารางสอนหรือคะแนนซ้ำ ใช้ `workspace_id` + classroom assignment + subject offering เป็นขอบเขตสิทธิ์ ทุกตารางต้องมี RLS, cross-workspace validation และ index ตาม query จริง หน้า My Courses ต้องใช้ compact RPC และเชื่อมไป Attendance/Scores เดิม จากนั้นรัน lint, build, deploy checks, Supabase checks และทดสอบ owner, teacher same school assigned/unassigned, teacher other school, parent/student portal และ superadmin พร้อมรายงานข้อจำกัดที่ยังไม่ได้ยืนยันจาก authenticated production session

