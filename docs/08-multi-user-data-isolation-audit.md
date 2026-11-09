# ตรวจสอบการแยกข้อมูลผู้ใช้และ Workspace

ตรวจเมื่อ: 9 พฤศจิกายน 2026
ขอบเขต: โค้ดใน repository และ schema/RLS บน Supabase project ที่เชื่อมอยู่
สถานะ: พบการแยก Workspace เป็นฐาน แต่ยังไม่พร้อมยืนยันว่า multi-user production สมบูรณ์

## ข้อสรุป

ระบบนี้ควรแยกข้อมูลเป็น 2 ระดับ ไม่ใช่ทำข้อมูลโรงเรียนทั้งหมดให้เป็นของครูคนเดียว:

1. **ข้อมูลร่วมของโรงเรียน (Workspace):** รายชื่อนักเรียน ห้องเรียน เวลาเรียน คะแนน เงินออม การดูแลนักเรียน และรายงาน ใช้ร่วมกันตาม role, สิทธิ์ และขอบเขตห้องเรียนของสมาชิก
2. **ข้อมูลส่วนตัวของบัญชี (Profile + Workspace):** ตั้งค่ารายงาน ช่องทางแจ้งเตือน การจับคู่บัญชีปลายทาง และค่าการใช้งานส่วนตัว ต้องอ่าน/แก้ได้เฉพาะบัญชีเจ้าของใน Workspace นั้น

ไม่ควรสร้างสำเนารายชื่อนักเรียนหรือบัญชีเงินออมแยกตามครู เพราะข้อมูลซ้ำจะไม่ตรงกันและทำให้รายงานโรงเรียนผิด ระบบต้องจำกัดว่าใครอ่านหรือแก้ข้อมูลร่วมใดได้ แทนการคัดลอกข้อมูลให้เป็นส่วนตัวทุกชุด

## ผลตรวจจาก Supabase จริง

- ตรวจพบตารางใน `public` จำนวน 68 ตาราง และตารางที่ตรวจมี RLS เปิดใช้งานพร้อม policy อย่างน้อยหนึ่งข้อ
- migration ล่าสุดที่บันทึกในฐานข้อมูลจริงคือ `0064 runtime_logic_lint_repairs`
- repository มี migration ถึง `0082_teacher_telegram_connections` แต่ migration history ของ production ที่ตรวจได้ก่อนหน้าอยู่ที่ `0064`; การเชื่อม Telegram และการซิงก์ค่าตั้งรายครูจึงยังต้องรอการตรวจและใช้ migrations ตามลำดับ
- หน้าตั้งค่ารายงานรายครูบันทึกลง `teacher_notification_preferences` โดยแยก `(workspace_id, profile_id)` และมี fallback เฉพาะอุปกรณ์เมื่อพบว่าตารางยังไม่มี
- ตารางบางกลุ่มไม่มี `workspace_id` แบบ `NOT NULL` โดยมีเหตุผลต่างกัน เช่น ข้อมูลบัญชี, catalog กลาง, ข้อมูลเรียกเก็บเงิน หรือข้อมูลระบบ จึงไม่ควรเพิ่ม `workspace_id` แบบเหมารวมโดยไม่วิเคราะห์ความหมายและข้อมูลเดิม

## ข้อมูลรายครูและ Telegram

- migration `0081` ออกแบบค่ารายงานเป็น `(workspace_id, profile_id)` และอ้างสมาชิก Workspace แบบคู่ เป็นทิศทางที่ถูกต้องสำหรับค่าตั้งเฉพาะครูในแต่ละโรงเรียน
- ผู้ใช้กรอก Bot Token ของบอตส่วนตัวจากหน้า Notifications; browser ส่งผ่าน HTTPS ไปยัง Edge Function เท่านั้น และฟังก์ชันเข้ารหัส AES-GCM ก่อนจัดเก็บใน `teacher_telegram_connections` แยก `(workspace_id, profile_id)`
- การยืนยันใช้ deep link nonce เฉพาะบัญชีและรหัส 6 หลักที่หมดอายุใน 10 นาที พร้อมจำกัดการลองผิด 5 ครั้ง; `dispatch-notification` อ่านปลายทางจากข้อมูลฝั่ง server แทน payload
- LINE ถูกเอาออกจากตัวเลือกหน้าแจ้งเตือนเพราะยังไม่มีระบบจับคู่บัญชีที่ปลอดภัย; backend จะบันทึกเป็น skipped หากมี payload เก่าร้องขอส่ง LINE
- ความสามารถใหม่นี้อยู่ใน repository แต่ยังไม่เปิดใช้ production จนกว่า migrations `0065–0082` จะผ่านการทบทวน/ใช้งาน และ deploy Edge Functions พร้อมตั้ง `TELEGRAM_CONNECTION_ENCRYPTION_KEY`

### P1 — migration ที่ค้างมีชื่อคอลัมน์สมาชิกไม่ตรง schema

ตรวจพบ migration `0068` และ `0076` อ้าง `workspace_memberships.user_id` แต่ schema หลักใช้ `profile_id` หากรันตามลำดับ migration จะล้มเหลวเมื่อสร้าง policy ในไฟล์เหล่านี้ จึงแก้ชื่อคอลัมน์ใน repository ให้ตรงกับ schema แล้ว ทั้งสองไฟล์ยังไม่ได้รันกับฐานข้อมูล production

### P2 — กุญแจ AI ที่แชร์ใน Workspace

migration `0067` วาง `gemini_api_key` ใน `workspaces` และโค้ดเดิมอ่านจากตาราง/`settings` ของ Workspace การตั้งค่านี้มีขอบเขตเป็นโรงเรียน ไม่ใช่ส่วนตัวรายครู และสมาชิกที่อ่าน Workspace ได้อาจอ่านค่าดังกล่าวได้ด้วย ควรตรวจ role/policy และตัดสินใจว่าจะคงเป็นกุญแจที่โรงเรียนแชร์ หรือเปลี่ยนเป็น Edge Function proxy/secret store ก่อนเปิด migration นี้ใน production; อย่าเก็บกุญแจที่ต้องการซ่อนจากครูสมาชิกในแถวที่สมาชิกอ่านได้

## จุดที่ควรแก้หรือทบทวน

### P1 — schema production ตามหลังโค้ด

ฐานข้อมูลจริงอยู่ที่ migration `0064` แต่ repository เดินต่อถึง `0081` การ deploy frontend/Edge Function ที่พึ่งพา migration ใหม่อาจเจอ table/RPC ไม่มีอยู่ และการรัน migration ทีละไฟล์แบบไม่ตรวจข้อมูลเดิมอาจกระทบข้อมูลจริง

**แนวทาง:** ทำรายการ migration ที่ยังไม่ใช้, ตรวจ SQL และผลกระทบต่อข้อมูล, สำรองฐานข้อมูล, ใช้ migration ตามลำดับในช่วงที่เฝ้าระวังได้ แล้วตรวจ policy/คอลัมน์/RPC หลังจบ ก่อน deploy โค้ดที่อ้าง schema ใหม่

### P1 — Telegram ต้อง deploy schema และ Edge Function ก่อนเปิดใช้ production

โค้ดสำหรับ pairing แยกบัญชีและยืนยันปลายทางแล้วใน branch ปัจจุบัน แต่ production ยังไม่มี migration `0082` หรือ secret ที่จำเป็น จึงยังใช้ไม่ได้กับเว็บจริง

**แนวทาง:** ตรวจ migrations `0065–0082` และใช้ตามลำดับหลังสำรองข้อมูล, ตั้งคีย์เข้ารหัสใน Function Secrets, deploy `manage-telegram-account` และ `dispatch-notification`, แล้วทดลองเชื่อม/ส่งข้อความด้วยบัญชีครูทดสอบก่อนเปิดให้ครูทั้งหมด

### P2 — Foreign key เดี่ยวในข้อมูลหลายชุด

migration รุ่นเก่าหลายตารางอ้าง `students(id)` หรือ `classrooms(id)` โดยไม่จับคู่ `workspace_id` ใน foreign key เดียวกัน แม้ RLS และ trigger ของบางโมดูลช่วยตรวจขอบเขตแล้ว แต่ข้อบังคับเชิงฐานข้อมูลยังไม่สม่ำเสมอ

**แนวทาง:** สำรวจข้อมูลที่มีอยู่และ constraint ปัจจุบันก่อน จากนั้นเพิ่ม unique key `(id, workspace_id)` และ composite foreign keys แบบ expand-and-contract เป็นชุดย่อย โดยเริ่มจากตารางที่มีข้อมูลสุขภาพ/การเงิน/การเข้าเรียน ห้ามลบหรือเปลี่ยน constraint เดิมจนกว่าจะตรวจข้อมูลและ deploy ผ่าน

### P2 — ขอบเขตการอ่าน audit log

policy ปัจจุบันมีทั้งการอ่าน audit log ของสมาชิกครูใน Workspace และ policy สำหรับเจ้าของ Workspace ดังนั้นครูสมาชิกที่มีสิทธิ์ใน Workspace อาจเห็น log มากกว่ารายการของตนเอง หาก metadata มีรายละเอียดการดำเนินการ ควรจำกัดการอ่านตามความจำเป็นของงาน

### ข้อมูลที่ดูแยกผู้ใช้ถูกทางแล้ว

- `notifications` จำกัดการอ่านตาม `profile_id` (และ superadmin)
- `teacher_notification_preferences` ใน migration `0081` จำกัดด้วย `profile_id = auth.uid()` และ role ใน Workspace
- `profile_workspace_preferences` แยกตาม `profile_id` และมี policy เฉพาะเจ้าของบัญชี

## แบบที่ควรใช้เป็นมาตรฐาน

| ข้อมูล | ขอบเขตหลัก | ใครควรเข้าถึง |
|---|---|---|
| นักเรียน/ห้อง/เวลาเรียน/คะแนน/เงินออม | Workspace + ห้องเรียน | สมาชิกตาม role, capability และ classroom scope |
| การตั้งค่ารายงาน/เวลารับแจ้งเตือน | Workspace + Profile | เจ้าของบัญชีเท่านั้น |
| บัญชี Telegram ที่จับคู่แล้ว | Workspace + Profile, server-managed | เจ้าของดูสถานะ/ยกเลิก; Edge Function ใช้ปลายทางส่ง |
| notification ในกล่องข้อความ | Profile | เจ้าของผู้รับเท่านั้น |
| แผนราคา/รายการ module | ระบบกลาง | อ่านได้ตาม policy; แก้ได้เฉพาะ superadmin |
| billing และ support | ตาม workspace/ผู้ยื่น/ทีมสนับสนุน | จำกัดตามหน้าที่และ policy เฉพาะ |

## สถานะการดำเนินการ

- ตรวจ schema และ policy บน Supabase แบบอ่านอย่างเดียวแล้ว
- ยืนยันว่า production ยังไม่ได้บันทึก migration หลัง `0064` ใน migration history
- แก้ชื่อคอลัมน์ที่ทำให้ migration `0068` และ `0076` ล้มเหลวใน repository แล้ว
- เพิ่ม fallback ของค่ารายงานส่วนตัวแบบแยกบัญชี/โรงเรียน เมื่อ production ยังไม่มีตาราง migration `0081`; ข้อมูล fallback อยู่เฉพาะอุปกรณ์และไม่ถือว่า sync ข้ามเครื่อง
- เพิ่มโค้ด pairing Telegram, token encryption, การตั้งค่าจากหน้าเว็บ และ migration `0082`; ยังไม่ได้แก้ schema production, เพิ่ม secret หรือ deploy function
- เอาตัวเลือก LINE และแผงสถานะช่องทางที่ไม่ทำงานออกจากเมนูแจ้งเตือน; เหลือรายการงาน, Inbox และการตั้งค่าบัญชี Telegram
- ขั้นถัดไปที่ปลอดภัยคือทบทวน migration `0065–0081` ทั้งชุดเทียบกับ schema production, สำรองข้อมูล และวางแผนแก้ constraint/RLS ก่อนนำ migrations ไปใช้จริง
