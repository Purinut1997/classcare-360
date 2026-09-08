# System Specification — ระบบทะเบียนและงานวิชาการโรงเรียน

## 1. วัตถุประสงค์

สร้าง Web Application เพื่อทดแทนระบบ Excel งานทะเบียนและงานวิชาการโรงเรียนระดับประถมศึกษา โดยคงตรรกะและผลลัพธ์หลักของระบบเดิม แต่ปรับโครงสร้างให้เป็นฐานข้อมูลกลาง ใช้งานง่าย รองรับหลายปีการศึกษา หลายภาคเรียน หลายชั้นเรียน หลายวิชา และผู้ใช้งานหลายระดับ

แนวคิดหลัก:

```text
ตั้งค่าระบบ
  ↓
ข้อมูลโรงเรียน
  ↓
ข้อมูลนักเรียน
  ↓
ข้อมูลผู้ปกครอง
  ↓
ข้อมูลชั้นเรียน / รายวิชา / ครู
  ↓
คะแนน / ตัวชี้วัด / เวลาเรียน
  ↓
คุณลักษณะ / สมรรถนะ / กิจกรรม
  ↓
น้ำหนัก / ส่วนสูง / โภชนาการ
  ↓
ประมวลผล
  ↓
รายงาน / ปพ.5 / ปพ.6 / ใบรับรอง
```

> หลักสำคัญ: กรอกข้อมูลต้นทางครั้งเดียว แล้วนำข้อมูลไปใช้ในทุกโมดูลและเอกสารที่เกี่ยวข้อง

---

# 2. หลักการออกแบบ

## 2.1 Database-Centric

ระบบต้องใช้ฐานข้อมูลกลาง ไม่จำลองโครงสร้าง Excel แบบ 1 Sheet = 1 หน้า

ห้ามสร้างโครงสร้างแบบ:

```text
วิชาที่ 1
วิชาที่ 2
...
วิชาที่ 20
```

แต่ให้ใช้:

```text
subjects
  ├── subject_id
  ├── code
  ├── name
  └── ...
```

จำนวนวิชาจึงเพิ่มหรือลดได้โดยไม่ต้องแก้โค้ดหลัก

## 2.2 Student-Centric

นักเรียนแต่ละคนต้องมีรหัสอ้างอิงถาวร เช่น `student_id`

ห้ามใช้ชื่อ-นามสกุลเป็น Primary Key

ข้อมูลของนักเรียนหนึ่งคนต้องเชื่อมไปยัง:

- ข้อมูลส่วนตัว
- บิดามารดา
- ผู้ปกครอง
- ชั้นเรียน
- รายวิชา
- คะแนน
- เกรด
- เวลาเรียน
- คุณลักษณะ
- สมรรถนะ
- กิจกรรม
- สุขภาพ
- โภชนาการ
- รายงาน
- ปพ.6

---

# 3. โมดูลระบบทั้งหมด

## 3.1 Dashboard

แสดง:

- จำนวนนักเรียน
- จำนวนครู
- จำนวนรายวิชา
- จำนวนห้องเรียน
- สถานะการบันทึกคะแนน
- สถานะเวลาเรียน
- ผลการเรียนโดยรวม
- การเข้าเรียน
- คุณลักษณะ
- สมรรถนะ
- โภชนาการ
- เมนูด่วน

ตัวอย่าง:

```text
┌─────────────────────────────────────────────┐
│ 🏫 ระบบทะเบียนและงานวิชาการ                 │
│ โรงเรียนบ้านโคกสูง                          │
│ ปีการศึกษา [2569 ▼] ภาคเรียน [1 ▼]        │
├─────────────────────────────────────────────┤
│ นักเรียน │ ครู │ รายวิชา │ ห้องเรียน        │
│   152    │ 12  │   18    │    8             │
├────────────────────┬────────────────────────┤
│ ผลการเรียน          │ เวลาเรียน              │
│ ค่าเฉลี่ย xx        │ มาเรียน xx%            │
│ ผ่าน xx คน          │ ขาด xx คน              │
├────────────────────┴────────────────────────┤
│ เมนูด่วน                                    │
│ [เพิ่มนักเรียน] [บันทึกคะแนน] [เวลาเรียน]   │
│ [ประเมิน] [สร้าง ปพ.5] [สร้าง ปพ.6]        │
└─────────────────────────────────────────────┘
```

---

# 4. ข้อมูลพื้นฐานโรงเรียน

## Fields

- school_id
- school_code
- school_name
- affiliation
- district
- province
- education_area
- address
- phone
- email
- director_name
- registrar_name
- academic_head_name
- logo
- active

## UI

```text
ข้อมูลโรงเรียน

ชื่อโรงเรียน      [________________]
รหัสโรงเรียน      [________________]
สังกัด            [________________]
ตำบล              [________________]
อำเภอ              [________________]
จังหวัด             [________________]
เขตพื้นที่          [________________]

ผู้อำนวยการ        [________________]
นายทะเบียน         [________________]
หัวหน้าวิชาการ      [________________]

[บันทึก]
```

---

# 5. ปีการศึกษาและภาคเรียน

## Academic Year

Fields:

- academic_year_id
- year
- start_date
- end_date
- status

## Term

Fields:

- term_id
- academic_year_id
- term_number
- start_date
- end_date
- status
- locked

สถานะ:

```text
DRAFT
ACTIVE
CLOSED
LOCKED
```

เมื่อ Lock แล้ว การแก้ไขข้อมูลสำคัญต้องใช้สิทธิ์พิเศษ

---

# 6. ชั้นเรียน / ห้องเรียน

## Classes

Fields:

- classroom_id
- academic_year_id
- grade_level
- room_number
- homeroom_teacher_id
- active

ตัวอย่าง:

```text
ป.1/1
ป.1/2
ป.2/1
...
ป.6/2
```

ระบบต้องไม่จำกัดจำนวนห้อง

---

# 7. บุคลากร / ครู

Fields:

- teacher_id
- prefix
- first_name
- last_name
- position
- employee_code
- phone
- email
- active

ความสัมพันธ์:

```text
Teacher
   ↓
Subject
   ↓
Classroom
```

ครูหนึ่งคนสามารถสอนหลายวิชาและหลายห้องได้

---

# 8. ข้อมูลนักเรียน

## Student Table

Fields หลัก:

- student_id
- school_id
- student_code
- citizen_id
- prefix
- first_name
- last_name
- english_first_name
- english_last_name
- gender
- birth_date
- classroom_id
- admission_date
- status
- photo

สถานะ:

```text
ACTIVE
TRANSFERRED
GRADUATED
DROPPED
INACTIVE
```

## หน้ารายการนักเรียน

ต้องมี:

- Search
- Filter ชั้น
- Filter ห้อง
- Filter เพศ
- Pagination
- เพิ่ม
- แก้ไข
- ดูรายละเอียด
- ลบ/ปิดสถานะ

---

# 9. Student Profile

หน้า Profile ต้องเป็นศูนย์กลางของข้อมูลนักเรียน

```text
┌──────────────────────────────────────┐
│ รูปนักเรียน                          │
│ ชื่อ-นามสกุล                         │
│ รหัสนักเรียน                         │
│ ชั้น / ห้อง                          │
├──────────────────────────────────────┤
│ [ข้อมูลส่วนตัว]                      │
│ [บิดามารดา]                          │
│ [ผู้ปกครอง]                          │
│ [ผลการเรียน]                         │
│ [เวลาเรียน]                          │
│ [คุณลักษณะ]                         │
│ [สมรรถนะ]                            │
│ [กิจกรรม]                            │
│ [สุขภาพ]                             │
│ [โภชนาการ]                           │
│ [เอกสาร]                             │
└──────────────────────────────────────┘
```

---

# 10. ข้อมูลบิดามารดา

ตาราง `parents`

Fields:

- parent_id
- student_id
- father_prefix
- father_first_name
- father_last_name
- father_citizen_id
- father_occupation
- mother_prefix
- mother_first_name
- mother_last_name
- mother_citizen_id
- mother_occupation

---

# 11. ข้อมูลผู้ปกครอง

ตาราง `guardians`

Fields:

- guardian_id
- student_id
- prefix
- first_name
- last_name
- relationship
- occupation
- phone
- address
- remark

นักเรียนหนึ่งคนสามารถมีผู้ปกครองมากกว่าหนึ่งคนได้

---

# 12. รายวิชา

ตาราง `subjects`

Fields:

- subject_id
- subject_code
- subject_name
- learning_area
- grade_level
- hours_per_year
- credit
- teacher_id
- active

ตัวอย่างกลุ่มสาระ:

- ภาษาไทย
- คณิตศาสตร์
- วิทยาศาสตร์และเทคโนโลยี
- สังคมศึกษา ศาสนาและวัฒนธรรม
- สุขศึกษาและพลศึกษา
- ศิลปะ
- การงานอาชีพ
- ภาษาต่างประเทศ

ระบบต้องรองรับรายวิชาเพิ่มเติม

---

# 13. การลงทะเบียนเรียน

ตาราง `enrollments`

Fields:

- enrollment_id
- student_id
- subject_id
- classroom_id
- academic_year_id
- term_id
- teacher_id
- status

ใช้เชื่อม:

```text
นักเรียน + วิชา + ห้อง + ครู + ปีการศึกษา + ภาคเรียน
```

---

# 14. มาตรฐานและตัวชี้วัด

ตาราง `subject_indicators`

Fields:

- indicator_id
- subject_id
- standard_code
- standard_name
- indicator_code
- indicator_name
- term
- active

ความสัมพันธ์:

```text
Subject
 ↓
Standard
 ↓
Indicator
 ↓
Student Assessment
```

---

# 15. ผลการประเมินตัวชี้วัด

ตาราง `indicator_assessments`

Fields:

- assessment_id
- student_id
- subject_id
- indicator_id
- academic_year_id
- term_id
- result
- score
- remark

ผลอาจกำหนดเป็น:

```text
ผ = ผ่าน
มผ = ไม่ผ่าน
```

และสามารถรองรับระบบคะแนนถ้าโรงเรียนต้องการ

---

# 16. ระบบคะแนน

ตาราง `scores`

Fields:

- score_id
- student_id
- subject_id
- academic_year_id
- term_id
- assessment_type
- score
- max_score
- remark

Assessment Type เช่น:

```text
CONTINUOUS
MIDTERM
FINAL
OTHER
```

ระบบต้องคำนวณ:

```text
คะแนนดิบ
↓
คะแนนรวม
↓
คะแนนร้อยละ
↓
ระดับผลการเรียน
```

---

# 17. เกณฑ์การให้เกรด

ตาราง `grade_rules`

Fields:

- grade_rule_id
- school_id
- min_score
- max_score
- grade
- description
- active

ตัวอย่างค่าเริ่มต้นที่สามารถตั้งค่าได้:

```text
80–100 = 4
75–79  = 3.5
70–74  = 3
65–69  = 2.5
60–64  = 2
55–59  = 1.5
50–54  = 1
0–49   = 0
```

> ต้องอนุญาตให้โรงเรียนแก้ไขเกณฑ์ได้ ไม่ควร Hard-code

---

# 18. ผลการเรียน

ตาราง `grades`

Fields:

- grade_id
- student_id
- subject_id
- academic_year_id
- term_id
- total_score
- percentage
- grade
- status
- calculated_at
- approved_by

ระบบต้องคำนวณจากข้อมูลต้นทาง ไม่ควรให้ผู้ใช้พิมพ์เกรดโดยตรง

---

# 19. เวลาเรียน

ตาราง `attendance`

Fields:

- attendance_id
- student_id
- classroom_id
- academic_year_id
- term_id
- date
- status
- remark
- recorded_by

Status:

```text
PRESENT = มา
ABSENT = ขาด
LEAVE = ลา
LATE = สาย
OTHER = อื่น ๆ
```

ระบบคำนวณ:

- จำนวนวันเรียน
- มาเรียน
- ขาด
- ลา
- สาย
- ร้อยละการเข้าเรียน

---

# 20. UI เวลาเรียน

```text
📅 เวลาเรียน

ชั้น [ป.5 ▼]
ห้อง [1 ▼]
เดือน [กันยายน ▼]

        1  2  3  4  5  6
กีรดิส  ✓  ✓  ✓  ข  ✓  ✓
กฤษฎา  ✓  ล  ✓  ✓  ✓  ✓

สรุป:
มาเรียน  92
ขาด       3
ลา        2
ร้อยละ  94.8%

[บันทึก]
```

---

# 21. สุขภาพ

ตาราง `health_measurements`

Fields:

- measurement_id
- student_id
- academic_year_id
- term_id
- assessment_round
- date
- weight
- height
- age
- remark

Assessment Round:

```text
1
2
```

รองรับ:

```text
ภาคเรียน 1 ครั้งที่ 1
ภาคเรียน 1 ครั้งที่ 2
ภาคเรียน 2 ครั้งที่ 1
ภาคเรียน 2 ครั้งที่ 2
```

---

# 22. อายุ / HT

ระบบต้องคำนวณอายุจาก:

```text
วันเกิด
+
วันที่ประเมิน
↓
อายุ
```

ไม่ควรให้ผู้ใช้คีย์อายุเองถ้าสามารถคำนวณจากวันเกิดได้

---

# 23. โภชนาการ

ตาราง `nutrition_assessments`

Fields:

- nutrition_id
- student_id
- measurement_id
- academic_year_id
- term_id
- assessment_round
- category
- value
- remark

Category ต้องสามารถกำหนดได้จากเกณฑ์ของโรงเรียน/หน่วยงาน

ตัวอย่าง:

```text
ปกติ
ผอม
ค่อนข้างผอม
ท้วม
เริ่มอ้วน
อ้วน
```

---

# 24. ความชุก

ระบบต้องสรุป:

```text
นักเรียนทั้งหมด
├── ปกติ
├── ผอม
├── ค่อนข้างผอม
├── ท้วม
├── เริ่มอ้วน
└── อ้วน
```

แสดง:

- จำนวน
- ร้อยละ
- ตาราง
- กราฟ

---

# 25. คุณลักษณะอันพึงประสงค์

ตาราง `characteristic_items`

Fields:

- characteristic_id
- code
- name
- description
- active

ตัวอย่างรายการ:

- รักชาติ ศาสน์ กษัตริย์
- ซื่อสัตย์สุจริต
- มีวินัย
- ใฝ่เรียนรู้
- อยู่อย่างพอเพียง
- มุ่งมั่นในการทำงาน
- รักความเป็นไทย
- มีจิตสาธารณะ

ตาราง `characteristic_assessments`

Fields:

- assessment_id
- student_id
- characteristic_id
- academic_year_id
- term_id
- score
- level
- remark

---

# 26. สมรรถนะสำคัญ

ตาราง `competency_items`

Fields:

- competency_id
- code
- name
- description
- active

ตาราง `competency_assessments`

Fields:

- assessment_id
- student_id
- competency_id
- academic_year_id
- term_id
- score
- level
- remark

จำนวนสมรรถนะต้องกำหนดค่าได้

---

# 27. กิจกรรมพัฒนาผู้เรียน

ตาราง `activities`

Fields:

- activity_id
- name
- type
- description
- active

ตัวอย่าง:

```text
แนะแนว
ลูกเสือ-เนตรนารี
ชุมนุม
กิจกรรมเพื่อสังคมและสาธารณประโยชน์
```

ตาราง `activity_assessments`

Fields:

- assessment_id
- student_id
- activity_id
- academic_year_id
- term_id
- result
- remark

Result:

```text
ผ่าน
ไม่ผ่าน
```

---

# 28. ปพ.5

ต้องมี 2 รูปแบบ

## ปพ.5 รายชั้น

Flow:

```text
ชั้น
 ↓
นักเรียน
 ↓
รายวิชา
 ↓
คะแนน
 ↓
ผลการเรียน
```

## ปพ.5 รายวิชา

Flow:

```text
รายวิชา
 ↓
นักเรียน
 ↓
มาตรฐาน / ตัวชี้วัด
 ↓
ผลการประเมิน
 ↓
คะแนน
 ↓
ผลการเรียน
```

ระบบต้องสร้าง:

- ปก ปพ.5 รายชั้น
- ปก ปพ.5 รายวิชา
- เนื้อหา
- เอกสารแนบท้าย
- คำชี้แจง ปพ.5

---

# 29. ปพ.6

ต้องรองรับ:

```text
ปพ.6 ภาคเรียนที่ 1
ปพ.6 ภาคเรียนที่ 2
ปพ.6 รวม
เล่ม ปพ.6
```

ข้อมูลต้องดึงจากฐานข้อมูลกลาง:

- ข้อมูลนักเรียน
- ผลการเรียน
- เวลาเรียน
- คุณลักษณะ
- สมรรถนะ
- กิจกรรม
- ข้อมูลอื่นที่กำหนดในแบบฟอร์ม

ห้ามกรอกข้อมูลซ้ำ

---

# 30. ใบรับรอง

Flow:

```text
เลือกนักเรียน
 ↓
ดึงข้อมูลนักเรียน
 ↓
ดึงข้อมูลโรงเรียน
 ↓
ดึงผลการเรียน/ข้อมูลที่จำเป็น
 ↓
สร้างเอกสาร
 ↓
Preview
 ↓
PDF / Print
```

---

# 31. ระบบรายงาน

หน้า Reports:

```text
📊 รายงาน

ผลการเรียน
├─ รายบุคคล
├─ รายห้อง
├─ รายวิชา
└─ รายชั้น

เวลาเรียน
├─ รายบุคคล
├─ รายห้อง
└─ สรุปทั้งโรงเรียน

คุณลักษณะ
สมรรถนะ
กิจกรรม
สุขภาพ
โภชนาการ

เอกสาร
├─ ปพ.5
├─ ปพ.6
└─ ใบรับรอง
```

ทุก Report ควรมี:

- Filter
- Preview
- Print
- PDF
- Excel

---

# 32. Import Excel

เนื่องจากระบบเดิมอยู่ใน Excel ต้องรองรับการนำเข้าข้อมูล

Workflow:

```text
Upload Excel
 ↓
ตรวจสอบ Header
 ↓
Map Column
 ↓
Preview
 ↓
Validation
 ↓
ตรวจข้อมูลซ้ำ
 ↓
แสดง Error
 ↓
ยืนยัน Import
 ↓
บันทึกฐานข้อมูล
```

ต้องมี Template สำหรับ:

```text
นักเรียน
รายวิชา
คะแนน
เวลาเรียน
```

ตัวอย่าง Validation:

- รหัสนักเรียนซ้ำ
- เลขประชาชนรูปแบบไม่ถูกต้อง
- ไม่มีชั้นเรียน
- ไม่มีวิชา
- คะแนนเกิน Maximum
- วันที่ไม่ถูกต้อง
- ข้อมูลบังคับว่าง

---

# 33. Export

รองรับ:

```text
Excel
CSV
PDF
Print
```

---

# 34. ระบบผู้ใช้งาน

## Roles

### ADMIN

สิทธิ์ทั้งหมด

### DIRECTOR

- Dashboard
- รายงาน
- ตรวจสอบผล
- อนุมัติ
- ดูข้อมูลทั้งหมด

### TEACHER

- นักเรียนที่ได้รับมอบหมาย
- รายวิชาที่สอน
- คะแนน
- เวลาเรียน
- ตัวชี้วัด
- คุณลักษณะ
- สมรรถนะ
- กิจกรรม

### REGISTRAR

- ข้อมูลนักเรียน
- ผู้ปกครอง
- รายวิชา
- ปพ.5
- ปพ.6
- ใบรับรอง

---

# 35. Audit Log

ทุกการแก้ไขข้อมูลสำคัญต้องบันทึก:

- log_id
- user_id
- action
- module
- record_id
- old_value
- new_value
- timestamp
- ip/device ถ้าระบบรองรับ

ตัวอย่าง:

```text
ครู A
แก้คะแนน
นักเรียน 2407
คณิตศาสตร์
72 → 75
8/9/2569 09:25
```

---

# 36. Backup / Restore

ต้องรองรับ:

- Backup Database
- Download Backup
- Restore
- Backup ตามกำหนดเวลา
- ตรวจสอบวันเวลาของ Backup

---

# 37. UI/UX

## Desktop

```text
┌───────────────┬──────────────────────────────┐
│ LOGO          │ Topbar                       │
│               ├──────────────────────────────┤
│ Dashboard     │                              │
│ นักเรียน       │          CONTENT              │
│ รายวิชา        │                              │
│ คะแนน         │                              │
│ เวลาเรียน      │                              │
│ ประเมิน        │                              │
│ สุขภาพ         │                              │
│ เอกสาร         │                              │
│ รายงาน         │                              │
│ ตั้งค่า        │                              │
└───────────────┴──────────────────────────────┘
```

## Mobile

```text
┌──────────────────────┐
│ ☰ ระบบวิชาการ   🔔  │
├──────────────────────┤
│                      │
│       CONTENT        │
│                      │
├──────────────────────┤
│ 🏠 👨‍🎓 📝 📊 ☰      │
└──────────────────────┘
```

## UI Components

ต้องใช้:

- Sidebar
- Topbar
- Card
- Data Table
- Search
- Filter
- Tabs
- Modal
- Dropdown
- Date Picker
- Pagination
- Toast
- Confirmation Dialog
- Loading
- Empty State
- Error State

---

# 38. Design System

แนวทาง:

- Modern School Management
- สะอาด
- อ่านง่าย
- เป็นมิตรกับครู
- ไม่แน่นเหมือน Spreadsheet
- Responsive
- ใช้งานได้บน Desktop / Tablet / Mobile
- ปุ่มมีขนาดเหมาะกับ Touch
- ตารางรองรับ Horizontal Scroll
- ใช้สีเพื่อสื่อสถานะ แต่ต้องไม่พึ่งสีอย่างเดียว

สถานะ:

```text
สำเร็จ
กำลังดำเนินการ
รอดำเนินการ
ผิดพลาด
ล็อก
```

---

# 39. Navigation

Sidebar:

```text
🏠 Dashboard

📚 งานทะเบียน
  ├─ นักเรียน
  ├─ บิดามารดา
  ├─ ผู้ปกครอง
  └─ ค้นหา

📖 งานวิชาการ
  ├─ รายวิชา
  ├─ ตัวชี้วัด
  ├─ คะแนน
  └─ ผลการเรียน

📅 เวลาเรียน

⭐ การประเมิน
  ├─ คุณลักษณะ
  ├─ สมรรถนะ
  └─ กิจกรรม

🥗 สุขภาพ
  ├─ น้ำหนัก/ส่วนสูง
  ├─ โภชนาการ
  └─ ความชุก

📄 เอกสาร
  ├─ ปพ.5
  ├─ ปพ.6
  └─ ใบรับรอง

📊 รายงาน

⚙️ ตั้งค่า
```

---

# 40. Database Schema

ตารางหลัก:

```text
schools
academic_years
terms
users
roles
teachers
classrooms

students
student_additional_info
parents
guardians

subjects
enrollments
subject_indicators
indicator_assessments

scores
grade_rules
grades

attendance

health_measurements
nutrition_assessments

characteristic_items
characteristic_assessments

competency_items
competency_assessments

activities
activity_assessments

reports
report_templates
audit_logs
backups
```

---

# 41. Relationship

```text
SCHOOL
 │
 ├── ACADEMIC_YEAR
 │      └── TERM
 │
 ├── TEACHER
 │
 ├── CLASSROOM
 │      └── STUDENT
 │             ├── PARENT
 │             ├── GUARDIAN
 │             ├── ATTENDANCE
 │             ├── HEALTH
 │             ├── NUTRITION
 │             ├── SCORE
 │             ├── GRADE
 │             ├── CHARACTERISTIC
 │             ├── COMPETENCY
 │             └── ACTIVITY
 │
 └── SUBJECT
        ├── INDICATOR
        └── ENROLLMENT
```

---

# 42. Workflow การใช้งานจริง

## เปิดปีการศึกษา

```text
ตั้งค่าปีการศึกษา
 ↓
สร้างภาคเรียน
 ↓
สร้างชั้นเรียน
 ↓
เพิ่มครู
 ↓
เพิ่มรายวิชา
```

## นำนักเรียนเข้า

```text
Import Excel
 ↓
ตรวจสอบ
 ↓
สร้าง Student
 ↓
Assign ห้องเรียน
```

## เปิดภาคเรียน

```text
เลือกวิชา
 ↓
กำหนดครู
 ↓
กำหนดตัวชี้วัด
 ↓
สร้าง Enrollment
```

## ระหว่างภาคเรียน

```text
เวลาเรียน
+
คะแนน
+
ตัวชี้วัด
+
คุณลักษณะ
+
สมรรถนะ
+
กิจกรรม
+
สุขภาพ
```

## ปิดภาคเรียน

```text
ตรวจความครบถ้วน
 ↓
คำนวณคะแนน
 ↓
คำนวณเกรด
 ↓
ตรวจสอบ
 ↓
อนุมัติ
 ↓
Lock
 ↓
สร้าง ปพ.5
 ↓
สร้าง ปพ.6
```

---

# 43. Validation ก่อนปิดภาคเรียน

ระบบต้องตรวจ:

- นักเรียนมีห้องเรียน
- รายวิชามีครู
- นักเรียนมี Enrollment
- คะแนนครบ
- คะแนนไม่เกิน Maximum
- ตัวชี้วัดครบ
- เวลาเรียนครบ
- คุณลักษณะครบ
- สมรรถนะครบ
- กิจกรรมครบ
- ข้อมูลสุขภาพครบตามรอบที่กำหนด
- เกรดคำนวณแล้ว
- ไม่มี Error สำคัญ

แสดง:

```text
ตรวจสอบภาคเรียน

✓ ข้อมูลนักเรียน
✓ รายวิชา
✓ คะแนน
✓ เกรด
✓ เวลาเรียน
⚠ คุณลักษณะ 3 คนยังไม่ครบ
⚠ สมรรถนะ 2 คนยังไม่ครบ

[ดูรายการที่มีปัญหา]
[ปิดภาคเรียน]
```

หากยังมี Error ที่กำหนดเป็น Critical ต้องไม่อนุญาตให้ Lock

---

# 44. Business Rules

1. Student ID ต้องไม่ซ้ำภายในโรงเรียน
2. นักเรียนต้องสังกัดห้องเรียน
3. วิชาต้องมีรหัสวิชา
4. คะแนนต้องไม่เกิน Maximum Score
5. เกรดต้องคำนวณจาก Grade Rule
6. คะแนนร้อยละต้องคำนวณอัตโนมัติ
7. เวลาเรียนต้องผูกกับวันที่
8. การประเมินต้องผูกกับปีการศึกษาและภาคเรียน
9. สุขภาพต้องผูกกับรอบการประเมิน
10. ปพ.5/ปพ.6 ต้องสร้างจากข้อมูลจริง
11. ห้ามกรอกข้อมูลซ้ำในเอกสาร
12. ข้อมูลที่ Lock แล้วแก้ไขไม่ได้สำหรับ Role ปกติ
13. การแก้ไขข้อมูลสำคัญต้องมี Audit Log
14. การลบข้อมูลสำคัญควรเป็น Soft Delete
15. ทุกข้อมูลต้องมี Created At / Updated At
16. ข้อมูลที่เกี่ยวกับปีการศึกษาต้องสามารถแยกประวัติย้อนหลังได้

---

# 45. การแยกข้อมูลตามปีการศึกษา

ระบบต้องเก็บข้อมูลย้อนหลัง เช่น:

```text
นักเรียนคนเดียวกัน

2567
 └── ป.3

2568
 └── ป.4

2569
 └── ป.5
```

ห้ามเขียนทับข้อมูลเก่า

---

# 46. การเลื่อนชั้น

ต้องมี Workflow:

```text
ป.4/1
 ↓
สิ้นปี
 ↓
ตรวจผล
 ↓
เลื่อนชั้น
 ↓
ป.5/1
```

ระบบควรสามารถสร้างปีการศึกษาใหม่โดย Copy โครงสร้าง:

- ห้องเรียน
- รายวิชา
- ครู
- นักเรียน

แต่ไม่ Copy คะแนน/เกรดเก่าไปทับปีใหม่

---

# 47. การสร้างเอกสาร

ระบบเอกสารควรมี Template Engine

```text
Database
 ↓
Data Mapping
 ↓
Report Template
 ↓
Preview
 ↓
PDF
 ↓
Print
```

Template ต้องสามารถกำหนด:

- กระดาษ A4
- แนวตั้ง/แนวนอน
- Header
- Footer
- Logo
- ตาราง
- เลขหน้า
- ลายเซ็น
- ชื่อผู้รับผิดชอบ

---

# 48. ระบบพิมพ์

ต้องมี Print Preview ก่อนพิมพ์

ตัวเลือก:

```text
กระดาษ A4
แนวตั้ง
แนวนอน
จำนวนสำเนา
ช่วงหน้า
```

และควบคุม Page Break เพื่อไม่ให้ตารางถูกตัดผิดตำแหน่ง

---

# 49. ความปลอดภัย

ต้องมี:

- Authentication
- Password Hashing
- Role-Based Access Control
- Session Management
- CSRF Protection
- Input Validation
- SQL Injection Protection
- XSS Protection
- Audit Log
- Backup
- Rate Limiting
- HTTPS เมื่อ Deploy จริง

ข้อมูลส่วนบุคคลของนักเรียนต้องจำกัดการเข้าถึงตาม Role

---

# 50. API Architecture

แนะนำ REST API หรือ API Layer ที่มีโครงสร้าง:

```text
/api/auth
/api/schools
/api/academic-years
/api/terms
/api/teachers
/api/classrooms
/api/students
/api/parents
/api/guardians
/api/subjects
/api/enrollments
/api/indicators
/api/assessments
/api/scores
/api/grades
/api/attendance
/api/health
/api/nutrition
/api/characteristics
/api/competencies
/api/activities
/api/reports
/api/documents
/api/import
/api/export
/api/audit
```

---

# 51. ตัวอย่าง API

## Student

```http
GET /api/students
GET /api/students/:id
POST /api/students
PUT /api/students/:id
DELETE /api/students/:id
```

## Score

```http
GET /api/scores
POST /api/scores
PUT /api/scores/:id
```

## Grade

```http
POST /api/grades/calculate
GET /api/grades
```

## Report

```http
GET /api/reports/student/:id
GET /api/reports/pp5/class/:id
GET /api/reports/pp6/student/:id
```

---

# 52. Technology Recommendation

ตัวอย่าง Stack ที่เหมาะ:

## Frontend

```text
React / Next.js
TypeScript
Tailwind CSS
```

## Backend

```text
Node.js
NestJS หรือ Express
TypeScript
```

## Database

```text
PostgreSQL
```

## Authentication

```text
JWT
หรือ Session-based Authentication
```

## File Storage

```text
Object Storage
หรือ Local Storage ในระบบภายใน
```

## PDF

ใช้ PDF generation library ที่รองรับภาษาไทยและฟอนต์ราชการได้ดี

---

# 53. Responsive Requirement

ต้องทดสอบอย่างน้อย:

```text
Desktop
1920×1080
1366×768

Tablet
1024×768
768×1024

Mobile
390×844
430×932
```

ตารางข้อมูลต้องไม่ทำให้หน้าจอล้นโดยไม่ควบคุม

---

# 54. Accessibility

ควรมี:

- Keyboard navigation
- Label ของ Input
- Contrast ที่เหมาะสม
- Focus State
- Error Message
- ไม่ใช้สีเพียงอย่างเดียวในการบอกสถานะ
- รองรับ Font ภาษาไทย

---

# 55. ระบบค้นหา

Global Search ต้องค้นหา:

```text
รหัสนักเรียน
เลขประชาชน
ชื่อ
นามสกุล
ชั้น
ห้อง
```

ผลลัพธ์:

```text
กีรดิส เสาร์มั่น
รหัส 2407
ป.5/1

[ดูข้อมูล]
[ผลการเรียน]
[เวลาเรียน]
[ปพ.6]
```

---

# 56. Dashboard สำหรับผู้บริหาร

ควรมี:

- จำนวนนักเรียนรายชั้น
- นักเรียนชาย/หญิง
- ผลการเรียนเฉลี่ย
- นักเรียนที่มีผลการเรียนต่ำกว่าเกณฑ์
- การเข้าเรียน
- คุณลักษณะ
- สมรรถนะ
- กิจกรรม
- โภชนาการ
- สถานะการบันทึกข้อมูลของครู

---

# 57. Dashboard สำหรับครู

แสดงเฉพาะงานที่เกี่ยวข้อง:

```text
วิชาที่สอน
ห้องที่รับผิดชอบ
นักเรียน
คะแนนที่ยังไม่ครบ
ตัวชี้วัดที่ยังไม่ประเมิน
เวลาเรียนที่ยังไม่บันทึก
คุณลักษณะที่ยังไม่ประเมิน
สมรรถนะที่ยังไม่ประเมิน
```

---

# 58. Dashboard สำหรับงานทะเบียน

```text
นักเรียนทั้งหมด
นักเรียนใหม่
นักเรียนย้ายเข้า
นักเรียนย้ายออก
ข้อมูลที่ยังไม่ครบ
ปพ.5
ปพ.6
ใบรับรอง
```

---

# 59. Error Handling

ทุกหน้าให้มี:

```text
Loading
Empty
Success
Error
```

ตัวอย่าง:

```text
ไม่พบข้อมูลนักเรียน

ลองเปลี่ยนตัวกรองหรือค้นหาด้วยข้อมูลอื่น
[เพิ่มนักเรียน]
```

---

# 60. จุดที่ต้องระวังในการสร้างระบบ

ห้าม:

- Hard-code จำนวนวิชา
- Hard-code จำนวนห้อง
- Hard-code ปีการศึกษา
- Hard-code นักเรียน
- Hard-code คะแนน
- Hard-code เกณฑ์เกรด
- เก็บข้อมูลนักเรียนซ้ำหลายตารางโดยไม่มีเหตุผล
- ใช้ชื่อเป็น Key
- สร้างเอกสารโดยให้กรอกข้อมูลซ้ำ
- ลบข้อมูลสำคัญแบบ Hard Delete โดยไม่มี Audit
- Lock ข้อมูลโดยไม่มีสิทธิ์ Override

---

# 61. เป้าหมายสุดท้าย

ระบบ Web ที่สร้างต้องทำให้ผู้ใช้สามารถทำงานตามลำดับนี้:

```text
LOGIN
 ↓
เลือกโรงเรียน
 ↓
เลือกปีการศึกษา
 ↓
เลือกภาคเรียน
 ↓
จัดการนักเรียน
 ↓
จัดการชั้นเรียน
 ↓
จัดการรายวิชา
 ↓
กำหนดครู
 ↓
บันทึกเวลาเรียน
 ↓
บันทึกคะแนน
 ↓
ประเมินตัวชี้วัด
 ↓
ประเมินคุณลักษณะ
 ↓
ประเมินสมรรถนะ
 ↓
ประเมินกิจกรรม
 ↓
บันทึกสุขภาพ
 ↓
คำนวณผล
 ↓
ตรวจสอบข้อมูล
 ↓
อนุมัติ
 ↓
Lock
 ↓
สร้าง ปพ.5
 ↓
สร้าง ปพ.6
 ↓
สร้างใบรับรอง
 ↓
Export / Print
```

---

# 62. Definition of Done

ถือว่าระบบพร้อมใช้งานเมื่อ:

- [ ] Login ใช้งานได้
- [ ] Role ใช้งานได้
- [ ] ข้อมูลโรงเรียนใช้งานได้
- [ ] ปีการศึกษาใช้งานได้
- [ ] ภาคเรียนใช้งานได้
- [ ] ชั้นเรียนใช้งานได้
- [ ] ครูใช้งานได้
- [ ] นักเรียนใช้งานได้
- [ ] ผู้ปกครองใช้งานได้
- [ ] รายวิชาใช้งานได้
- [ ] ตัวชี้วัดใช้งานได้
- [ ] คะแนนใช้งานได้
- [ ] เกรดคำนวณได้
- [ ] เวลาเรียนใช้งานได้
- [ ] คุณลักษณะใช้งานได้
- [ ] สมรรถนะใช้งานได้
- [ ] กิจกรรมใช้งานได้
- [ ] สุขภาพใช้งานได้
- [ ] โภชนาการใช้งานได้
- [ ] ปพ.5 สร้างได้
- [ ] ปพ.6 สร้างได้
- [ ] ใบรับรองสร้างได้
- [ ] Import Excel ได้
- [ ] Export Excel ได้
- [ ] PDF ได้
- [ ] Print ได้
- [ ] Audit Log ได้
- [ ] Backup/Restore ได้
- [ ] Lock ภาคเรียนได้
- [ ] Responsive
- [ ] Validation ครบ
- [ ] ไม่มีข้อมูลซ้ำโดยไม่จำเป็น
- [ ] สามารถเก็บข้อมูลย้อนหลังหลายปีได้

---

# 63. หลักการสรุป

ระบบนี้ควรถูกพัฒนาเป็น:

**School Academic Information System**

โดยมี:

```text
             ┌──────────────┐
             │   SCHOOL     │
             └──────┬───────┘
                    │
          ┌─────────▼─────────┐
          │  ACADEMIC YEAR    │
          └─────────┬─────────┘
                    │
          ┌─────────▼─────────┐
          │      STUDENT      │
          └─────────┬─────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
    ACADEMIC     ATTENDANCE    HEALTH
       │
       ├── SUBJECT
       ├── SCORE
       ├── GRADE
       ├── INDICATOR
       ├── CHARACTERISTIC
       ├── COMPETENCY
       └── ACTIVITY
                    │
                    ▼
              REPORT ENGINE
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        ปพ.5      ปพ.6     ใบรับรอง
```

เป้าหมายคือ **“กรอกครั้งเดียว → คำนวณอัตโนมัติ → ตรวจสอบ → สร้างเอกสารได้ทันที”**
