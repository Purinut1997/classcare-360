# ClassCare 360 — System Status

อัปเดต: 2026-08-21

## โครงสร้างปัจจุบัน

- React/Vite/TypeScript + Supabase Auth/Postgres/RLS
- `workspace_id` เป็นขอบเขตข้อมูลโรงเรียน; 1 Workspace มีหลายห้อง
- สมาชิกใช้ `workspace_memberships`; สิทธิ์รายห้องใช้ `workspace_member_classrooms`
- แพ็กเกจอยู่ที่ Workspace ผ่าน `subscriptions`

## สถานะ

- ✅ แยก cache ตารางสอน/รายงานตาม Workspace
- ✅ บังคับนักเรียน–ห้องและผู้ปกครอง–นักเรียนให้อยู่ Workspace เดียวกัน (`0047`)
- ✅ Primary Workspace + onboarding แบบ transaction ขึ้น Supabase แล้ว (`0048`)
- ✅ ซ่อนการสลับ Workspace เมื่อมีแห่งเดียว + ล็อก preference ด้วย RLS (`0049`)
- ✅ Trial ปรับวันได้ + VIP code แบบเพิ่มวัน + entitlement ledger (`0050`)
- ✅ คำเชิญครูไม่บังคับ VIP + กำหนดห้องล่วงหน้า + RLS ห้อง/นักเรียน (`0051`)
- ✅ RLS รายห้อง + integrity ของเวลาเรียน คะแนน พฤติกรรม เงินออม สุขภาพ เยี่ยมบ้าน (`0052`)
- ✅ ปิดข้อมูลดิบอ่อนไหวจาก Viewer + ตรวจบัญชีออมทรัพย์ตรงเด็ก/Workspace (`0053`)
- ✅ Free/Trial/VIP เป็นกฎกลาง + บังคับเพดานห้อง นักเรียน ผู้ร่วมงาน และโมดูลจาก backend (`0054`)
- ✅ แสดงโควตาใน Workspace/Student 360 + ป้องกันเพิ่มและ import เกินเพดานด้วยข้อความภาษาไทย
- ✅ Superadmin ปรับราคา/จำนวนวัน VIP ได้จากผู้ใช้จริงและมี audit log (`0055`)
- ✅ Demo ไม่เขียนฐานข้อมูลจริง + หน้าถูกจำกัดสิทธิ์พาไปหน้าแพ็กเกจโดยตรง
- ✅ หน้าราคาสาธารณะไม่ฝังราคาตายตัวที่อาจไม่ตรงค่าจาก Superadmin
- ✅ แยกสิทธิ์ `students.write`: Teacher ปรับเป็นอ่านอย่างเดียวได้ และ Viewer เขียนรายชื่อนักเรียนไม่ได้ (`0056`)
- ✅ แก้ trigger โควตาหลายตารางที่อ้างคอลัมน์ข้ามตารางจนเพิ่มห้องจริงล้มเหลว (`0057`)
- ✅ Remote RLS smoke test ผ่าน Owner / Teacher / Teacher read-only / Viewer / คนนอก และ rollback fixture ทั้งหมด
- ✅ คะแนน เงินออม พฤติกรรม สุขภาพ เยี่ยมบ้านผ่าน RLS ตามห้อง/capability และ trigger กันข้อมูลผูกผิด
- ✅ Viewer และ Free เรียกข้อมูลสุขภาพดิบผ่าน API ไม่ได้ (`0058`)
- ✅ Invitation lifecycle ผ่าน สร้าง/แสดง/รับ/กำหนดห้อง/รับ VIP จาก Workspace/ถอนคำเชิญ (`0059`)
- ✅ คิวตรวจรายชื่อเก็บถาวร: จัดประเภท/ใส่หมายเหตุ/กรองผลตรวจ และลบถาวรได้เฉพาะรายการซ้ำที่เก็บถาวรแล้ว (`0060`)
- ✅ ก่อนลบรายการซ้ำ ระบบเก็บ student snapshot + ผลตรวจลง `trash_items` และ audit log
- ✅ Roster safety smoke test ผ่าน: active ลบไม่ได้, ข้าม Workspace ไม่ได้, Teacher member แก้ผลตรวจไม่ได้, และ rollback fixture ทั้งหมด
- ✅ Duty roster, Daily Brief, Automation และคิวอนุมัติข้อความบังคับแพ็กเกจ + capability + ห้องเรียนจาก RLS (`0061`)
- ✅ `workspace_member_classrooms` มี trigger ป้องกันนำสมาชิกกับห้องคนละ Workspace มาผูกกัน (`0061`)
- ✅ `dispatch-notification` ตรวจ `communications.approve`, ขอบเขตนักเรียน และผู้รับที่เป็นสมาชิก/ผู้ปกครองที่ยินยอม ก่อนเปลี่ยนคิวเป็น `sending` (Edge Function v4)
- ✅ ปิดสิทธิ์สร้าง object ใน schema `public` สำหรับ `anon`/`authenticated` และถอน default function execute จาก anonymous ยกเว้น public RPC ที่ตั้งใจเปิด (`0061`)
- ✅ นำ trigger-only functions ออกจาก RPC surface และล็อก `search_path` ของ utility functions (`0062`)
- ✅ Permission-boundary regression บน Remote ผ่านและ rollback fixture ทั้งหมด; migration Remote ตรงกับ Local ถึง `0062`
- ✅ Readiness checker ครอบคลุม migration `0001–0062` และ SQL regression 5 ชุด; ผ่าน 83/83 required checks
- ✅ Supabase project กลับมา `ACTIVE_HEALTHY`; anon connection และ schema checks ผ่าน
- ℹ️ คิวข้อมูลจริงล่าสุด: active 20, archived รอตรวจ 32, ยังไม่มีรายการถูกลบหรือถูกจัดว่าซ้ำ/มาจากอีกโรงเรียน
- ✅ หน้าเลือก Workspace แสดงสมาชิกทุกโรงเรียนที่ได้รับสิทธิ์ ไม่กรองทิ้งตามชื่อโรงเรียนใน profile แล้ว
- ✅ เอาระบบเก่า “ค้นหาแล้วขอเข้า Workspace” ออกจาก UI; เข้าร่วมได้ผ่านคำเชิญจากเจ้าของเท่านั้น
- ✅ แยกป้าย Workspace หลัก / เข้าร่วมผ่านคำเชิญ และซ่อนฟอร์มสร้างเมื่อมี Workspace หลักแล้ว
- ✅ Browser QA โหมดตัวอย่างผ่าน: แสดง Workspace หลัก+ที่เข้าร่วม, รับคำเชิญ, อธิบายการใช้ VIP ร่วม และไม่มี console error
- ✅ แก้ Route Guard ไม่ให้ปุ่มกลับแดชบอร์ด/ตั้งค่าพาวนหน้าเดิม; Owner ไปศูนย์จัดการโรงเรียน และ System Readiness สงวนให้ Superadmin
- ✅ Production build ซ่อนเครื่องมือทดสอบ demo; Browser QA คลิกทางกลับภาพรวมและศูนย์จัดการโรงเรียนผ่าน
- ℹ️ ข้อมูลจริงยังไม่มี pending teacher invitation และยังไม่มีบัญชีใดเป็นสมาชิกมากกว่า 1 Workspace
- ⚠️ Security Advisor ทำงานแล้ว; public/authenticated `SECURITY DEFINER` ที่เหลือเป็น RPC ที่ตั้งใจเปิดและตรวจสิทธิ์ภายใน แต่ Leaked Password Protection ยังปิดอยู่
- 🚧 ถัดไป: เจ้าของตรวจและจัดประเภท 32 รายการ; จากนั้นส่งคำเชิญให้บัญชีจริงอีกบัญชี แล้วทดสอบสอง session

## หลักระบบใหม่

ผู้ใช้มี Workspace หลัก 1 แห่ง, เข้าร่วมแห่งอื่นผ่านคำเชิญ, VIP เป็นของ Workspace และสิทธิ์จริง = แพ็กเกจ + บทบาท + ห้องที่ได้รับมอบหมาย
