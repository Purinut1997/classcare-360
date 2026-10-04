# Safe System Updates & Zero-Downtime Rule (กฎเหล็กการปรับปรุงระบบโดยไม่กระทบผู้ใช้งาน)

> **MANDATORY INSTRUCTION FOR AI AGENTS:**
> ทุกครั้งที่มีการแก้ไข ปรับปรุง เพิ่มเติมฟีเจอร์ หรือสร้าง Database Migration ในโปรเจกต์ ClassCare 360 คุณ **ต้องอ่านและปฏิบัติตามกฎนี้อย่างเคร่งครัด** ห้ามละเมิดเด็ดขาด เพื่อป้องกันข้อมูลสูญหาย ข้อมูลข้ามโรงเรียน หรือระบบขัดข้องขณะมีผู้ใช้งานจริง

---

## 1. กฎเหล็กการแยกข้อมูลรายโรงเรียน (Multi-Tenancy & Data Isolation)
**ป้องกันปัญหาข้อมูลนักเรียนหลุดข้ามโรงเรียน 100%:**
1. **ทุกตารางใหม่ ต้องมี `workspace_id` เสมอ:**
   - ต้องประกาศเป็น `workspace_id uuid not null references public.workspaces(id) on delete cascade`
2. **Foreign Key ต้องผูกแบบ Composite Key เสมอ:**
   - **ห้าม** ผูก Foreign Key เดี่ยว เช่น `references public.classrooms(id)`
   - **ต้อง** ผูกคู่กับ `workspace_id` เสมอ เช่น:
     ```sql
     foreign key (classroom_id, workspace_id) references public.classrooms (id, workspace_id)
     ```
     *(ใช้หลักการเดียวกันกับ `student_id`, `guardian_id` ฯลฯ เพื่อไม่ให้ข้อมูลข้ามโรงเรียนได้เด็ดขาด)*
3. **เปิดใช้งาน RLS ทันทีในไฟล์เดียวกัน:**
   - ทุกตารางใหม่ต้องมี `alter table public.<table_name> enable row level security;`
   - ต้องสร้าง Policies ให้รัดกุม (SELECT, INSERT, UPDATE, DELETE) โดยตรวจสอบสิทธิ์ผ่าน `workspace_id` เสมอ

---

## 2. กฎการปรับปรุงโครงสร้างฐานข้อมูล (Expand-and-Contract Migration)
**ห้ามทำให้เกิด Breaking Changes กับผู้ใช้งานที่กำลังเปิดระบบอยู่:**
1. **ห้ามลบหรือเปลี่ยนชื่อคอลัมน์ทันที (No Instant Drop/Rename):**
   - ห้าม `DROP COLUMN` หรือ `RENAME COLUMN` ในตารางที่มีการใช้งาน
   - หากต้องการเปลี่ยนชื่อ ให้ใช้วิธี **Expand and Contract**:
     - *Phase 1 (Expand):* เพิ่มคอลัมน์ใหม่ (อนุญาตให้เป็น `NULL` หรือมี `DEFAULT`)
     - *Phase 2 (Deploy Code):* เขียนโค้ดให้อ่านคอลัมน์ใหม่ หากไม่มีให้ fallback ไปหาคอลัมน์เก่า และบันทึกลงทั้งสองคอลัมน์
     - *Phase 3 (Contract):* หลังจากทุกคนใช้เวอร์ชันใหม่แล้ว จึงค่อยรัน Migration ลบคอลัมน์เก่าในอนาคต
2. **ห้ามเพิ่ม `NOT NULL` ลอยๆ:**
   - คอลัมน์ที่เพิ่มใหม่ต้องมีค่า `DEFAULT` เสมอ เพื่อป้องกันไม่ให้คำสั่ง Insert เดิมจากหน้าเว็บที่เปิดค้างอยู่ พังทันที
3. **ห้ามสร้างหรืออัปเดตข้อมูลทับข้อมูลจริงของโรงเรียน:**
   - ฟังก์ชัน Seed หรือ Auto-Realign ใดๆ ห้ามยัดข้อมูลแม่แบบ (Master Template) เข้าทับโรงเรียนจริง เว้นแต่ผู้ใช้จะกดยืนยันเฉพาะเจาะจง

---

## 3. กฎความเข้ากันได้ย้อนหลังของหน้าเว็บ (Frontend Backward Compatibility)
**คุณครูมักเปิดแท็บเบราว์เซอร์ทิ้งไว้ข้ามวัน:**
1. **รองรับ Data Payload ทั้งสองแบบเสมอ (Safe Parsing & Fallback):**
   - ในโค้ด Frontend เมื่ออ่านข้อมูลจากฐานข้อมูล ให้ใช้ Optional Chaining (`?.`) และ Nullish Coalescing (`??`) เสมอ เช่น:
     ```typescript
     const score = item.total_score ?? item.score ?? 0;
     ```
2. **ห้ามเปลี่ยน Function / RPC Signature แบบหักดิบ:**
   - หากต้องแก้ RPC ใน Supabase ให้เพิ่มพารามิเตอร์แบบมีค่า Default หรือสร้างฟังก์ชันเวอร์ชันใหม่แทนการแก้พารามิเตอร์เดิมที่ Frontend ตัวเก่ากำลังยิงเรียกอยู่

---

## 4. กฎความปลอดภัยของการลบข้อมูล (Destructive Action Safety)
1. **ห้าม Hard Delete โดยไม่มีเงื่อนไขชัดเจน:**
   - คำสั่ง `DELETE FROM` ต้องระบุ `workspace_id` และ ID เฉพาะเจาะจงเสมอ
2. **ใช้ Soft Delete หรือ RPC ที่ตรวจสอบ Cascade:**
   - ข้อมูลสำคัญของโรงเรียน (นักเรียน, คะแนน, การเช็คชื่อ) ให้ใช้สถานะ `status = 'archived'` หรือเรียกผ่าน RPC ที่ปลอดภัยที่มี Audit Log กำกับ
3. **ตรวจสอบสิทธิ์ก่อนลบเสมอ:**
   - ตรวจสอบสิทธิ์ว่าผู้เรียกเป็น `teacher_owner` หรือได้รับอนุญาตใน `workspace_id` นั้นจริง

---

## 5. Checklist ตรวจสอบทุกครั้งก่อนส่งมอบงาน (Pre-delivery Checklist)
ก่อนสรุปงานหรือแจ้งผู้ใช้ว่าดำเนินการเสร็จแล้ว ให้ตรวจเช็ก 5 ข้อนี้เสมอ:
- [ ] มีตารางใหม่หรือไม่? ถ้ามี ได้ใส่ `workspace_id NOT NULL` และ `ENABLE ROW LEVEL SECURITY` แล้วหรือยัง?
- [ ] มี Foreign Key หรือไม่? ผูกแบบ Composite `(id, workspace_id)` แล้วหรือยัง?
- [ ] มีคำสั่งที่ทำให้หน้าเว็บเดิมที่เปิดค้างอยู่ Error หรือไม่?
- [ ] มีการ Hardcode หรือเผลอผูกข้อมูลข้ามโรงเรียนหรือไม่?
- [ ] ฟังก์ชัน AI และ UI ได้ถูกอัปเดต Showcase และเอกสารที่เกี่ยวข้องเรียบร้อยแล้วหรือไม่?
