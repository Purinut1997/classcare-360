# แผนปรับปรุงระบบเวรทำความสะอาดและประสบการณ์ผู้ใช้งาน (Duty System & UX Overhaul)

> **เป้าหมาย:** 
> 1. แก้ไขสิทธิ์ฐานข้อมูลและตรรกะในระบบเวร เพื่อให้คุณครูสามารถสร้างเวร สุ่มจัดเวร มอบหมายรายคน และตรวจเวรประจำวันได้อย่างราบรื่น 100%
> 2. ยกเครื่องการจัดหมวดหมู่เมนู (Sidebar Navigation) และแยกหน้าจอขนาดยักษ์ (ClassroomOperationsPage) ให้เป็นสัดส่วน โหลดเร็ว และไม่ซับซ้อน

---

## 1. การแก้ไขระบบเวรและฐานข้อมูล (Database & Duty System Fixes)

### 1.1 สร้าง Migration คืนสิทธิ์ RPC Execution (`supabase/migrations/0077_restore_duty_system_permissions.sql`)
- **ปัญหาเดิม:** Migration `0061` มีคำสั่ง `revoke execute on all functions in schema public from public, anon;` ทำให้บทบาท `authenticated` ถูกถอดสิทธิ์ฟังก์ชันเวรและฟังก์ชันจัดการห้องเรียนทั้งหมด
- **การแก้ไข:**
  - `GRANT EXECUTE` บนฟังก์ชันงานเวร:
    - `generate_balanced_duty_range(uuid, uuid, date, date, text)`
    - `set_manual_duty_assignment(uuid, uuid, uuid, date, uuid)`
    - `record_duty_result_v2(uuid, text, uuid, text, jsonb, text[])`
    - `seed_default_duty_tasks(uuid, uuid)`
    - `record_duty_result(uuid, text, uuid, text)`
    - `generate_balanced_duty_week(uuid, uuid, date)`
  - `GRANT EXECUTE` บนฟังก์ชันงานบริหารห้องเรียนที่ขาดหายไป:
    - `set_period_lock`, `request_period_unlock`, `review_period_unlock`
    - `prepare_year_closure`, `approve_year_closure`, `execute_year_closure`, `undo_year_closure`, `set_year_transition`
  - ปรับปรุง RLS และ Capability ให้แผน Free/Standard สามารถจัดการหน้าที่เวรประจำวันในห้องเรียนของตนเองได้ โดยไม่ถูกบล็อกด้วยเงื่อนไขแพ็กเกจ `behavior`

### 1.2 เพิ่มระบบ Auto-Seed และ Empty State ในฝั่ง Frontend
- **ไฟล์เป้าหมาย:** `ClassroomOperationsPage.tsx` และ `DutyScheduleView.tsx`
- เพิ่มฟังก์ชัน `seedDefaultDutyTasks()`:
  - เรียก `supabase.rpc('seed_default_duty_tasks', ...)` เมื่อห้องเรียนยังไม่มีหน้าที่เวร
  - หน้าที่เวรเริ่มต้นที่จะถูกสร้าง: **กวาดพื้น, ทิ้งขยะ, ลบกระดาน, จัดโต๊ะเก้าอี้, รดน้ำต้นไม้**
- ในหน้า `DutyScheduleView`:
  - หาก `activeUniqueTasks.length === 0`: แสดงกล่องการ์ดแนะนำสีสันสะอาดตา แจ้งว่า *"ห้องเรียนนี้ยังไม่มีหน้าที่เวรทำความสะอาด"* พร้อมปุ่มกดคลิกเดียว **"✨ สร้างหน้าที่เวรมาตรฐานทันที"**
- ใน `DutyGenerationDialog`:
  - หากตรวจพบว่ายังไม่มีหน้าที่เวร ระบบจะแจ้งเตือนและ Auto-seed ให้อัตโนมัติก่อนเริ่มสุ่มตารางเวร เพื่อป้องกันไม่ให้เกิดกรณีสุ่มแล้วได้ 0 รายการ

### 1.3 ปรับปรุง Logic การเปลี่ยนตัวนักเรียนและการตรวจผล
- **ไฟล์เป้าหมาย:** `StudentAssignModal.tsx` และ `ClassroomOperationsPage.tsx`
- เมื่อครูกดเลือกนักเรียนคนใหม่เพื่อแทนที่คนเดิม: ให้ระบบลบ assignment เก่าออกก่อนทำการบันทึกคนใหม่ ป้องกันปัญหา Slot ซ้ำซ้อนและ Exception `student_already_assigned_today`
- เพิ่มปุ่ม Quick Action **"🎉 ทำเวรครบทุกคนวันนี้ (Mark All Complete)"** ทั้งบนหัวตารางและใน Modal ตรวจเวรรายวัน เพื่อให้ครูสามารถบันทึกตรวจเวรทั้งห้องได้ในคลิกเดียว

---

## 2. การปรับปรุง Information Architecture และความง่ายในการใช้งาน (UX/UI Streamlining)

### 2.1 จัดระเบียบ Sidebar ให้สอดคล้องกับกิจวัตรของครู (Teacher Daily Routine)
- **ไฟล์เป้าหมาย:** `Sidebar.tsx`
- ปรับโครงสร้างเมนูจากเดิม 25+ รายการที่กระจัดกระจาย ให้เหลือกลุ่มการทำงานหลักที่ชัดเจน 4 กลุ่ม:
  1. **กิจวัตร & หน้าที่ประจำวัน (Daily Routine)**: เช็กชื่อเข้าแถว/คาบเรียน, ตารางเวรทำความสะอาด, สุขภาพนักเรียน, สรุปบันทึกประจำวัน
  2. **การเรียน & สมุดคะแนน (Academic & Assessment)**: ตารางสอน, สมุดคะแนน & ตัดเกรด, ตรวจข้อสอบ OMR, ศูนย์วิชาการ & ปพ., พิมพ์รายงาน
  3. **ข้อมูลนักเรียน & ช่วยเหลือ (Student Care)**: รายชื่อนักเรียน, พฤติกรรม & บันทึกความดี, ประเมินคุณลักษณะ 8 ประการ, สมุดเงินออม, ระบบแจ้งเตือนเด็กเสี่ยง
  4. **เครื่องมือ & ตั้งค่าระบบ (Tools & Management)**: วงล้อสุ่ม, ปฏิทินโรงเรียน, ปิดชั้น/เลื่อนชั้น, สำรองข้อมูล, ศูนย์จัดการโรงเรียน

### 2.2 แยกภาระหน้าที่ของ `ClassroomOperationsPage` (Decoupling & Lazy Loading)
- **ปัญหาเดิม:** โหลดข้อมูล 11 ตารางพร้อมกันแม้ครูจะเข้ามาดูแค่ตารางเวร
- **การแก้ไข:**
  - แยกโหมดอย่างชัดเจน: เมื่ออยู่ในโหมด `duty` ให้ดึงเฉพาะข้อมูลห้องเรียน นักเรียน หน้าที่เวร และตารางเวร
  - ไม่โหลดข้อมูลการล็อกข้อมูลรายเดือน (Period Lock), การปิดปีการศึกษา (Year Rollover), หรือคลังย้อนหลัง (Archive) ในโหมดเวร
  - นำแท็บ "QR ผู้ปกครอง" ออกจากโหมดเวร โดยแยกให้อยู่ในโหมดของตนเอง เพื่อลดความสับสนในการใช้งาน

### 2.3 ปรับปรุงความสะอาดตาของหน้าจอ (Visual Polish)
- ลดความจัดจ้านของสีและกรอบที่ไม่จำเป็น
- เพิ่มช่องว่าง (Whitespace) ให้อ่านง่าย
- ปรับขนาดตัวหนังสือสำหรับข้อมูลสำคัญให้ใหญ่ขึ้น ชัดเจนขึ้น และเป็นมิตรกับผู้ใช้งานทุกวัย

---

## 3. ขั้นตอนการตรวจสอบผล (Verification Checklist)

1. ตรวจสอบไฟล์ Migration ใหม่: ตรวจสอบความสมบูรณ์ของ SQL syntax
2. ทดสอบการ Build ทั้งหมด: `npm run build` ต้องผ่าน 0 errors
3. ตรวจสอบระบบเวร:
   - ทดสอบสร้างหน้าที่เวรเริ่มต้นอัตโนมัติ (Seed Default Tasks)
   - ทดสอบการสุ่มจัดเวรอัตโนมัติ (Generate Balanced Duty Range)
   - ทดสอบการมอบหมายเวรรายบุคคล (Manual Assign & Replace)
   - ทดสอบการตรวจเวรแบบ 1-Click (Mark All Complete)
4. ตรวจสอบ Sidebar & เมนู: ความเร็วในการโหลดหน้าจอ และการจัดกลุ่มที่เป็นระเบียบเรียบร้อย
