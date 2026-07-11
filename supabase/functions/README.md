# Supabase Edge Functions

โฟลเดอร์นี้เก็บ server-side workflow ที่ห้ามทำจาก frontend โดยตรง

## approve-payment-request

Path:

```text
supabase/functions/approve-payment-request/index.ts
```

หน้าที่:

- รับคำสั่ง `approve` หรือ `reject` สำหรับ `payment_requests`
- ตรวจ `Authorization` bearer token ของผู้เรียก
- ตรวจว่าผู้เรียกเป็น active superadmin ใน `superadmin_profiles`
- ถ้า `reject` จะเปลี่ยน `payment_requests.status` เป็น `rejected` และบันทึก `audit_logs`
- ถ้า `approve` จะ:
  - ตรวจว่า payment request อยู่สถานะ `pending_review`
  - ตรวจว่ามีสลิปถ้ามียอดชำระจริงมากกว่า 0 บาท
  - เปลี่ยน `payment_requests.status` เป็น `approved`
  - ปิด subscription `trial`/`active` เดิมของ workspace เป็น `cancelled`
  - สร้าง subscription ใหม่สถานะ `active`
  - บันทึก `audit_logs` ระดับ `critical`

Environment ที่ต้องมีใน Supabase Functions:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Deploy:

```bash
supabase functions deploy approve-payment-request
```

ตัวอย่าง body:

```json
{
  "paymentRequestId": "uuid",
  "action": "approve",
  "reviewNote": "ตรวจสลิปแล้วถูกต้อง"
}
```

ข้อควรระวัง:

- ห้ามเรียก logic เปิด subscription จาก frontend โดยตรง
- ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local` ของ frontend หรือ env ที่ขึ้นต้น `VITE_`
- ควรทดสอบกับ Supabase project จริงและตรวจ `audit_logs` ทุกครั้งก่อนใช้ production

## accept-portal-invitation

Path:

```text
supabase/functions/accept-portal-invitation/index.ts
```

หน้าที่:

- รับคำเชิญจาก `portal_invitations`
- ตรวจ `Authorization` bearer token ของผู้เรียก
- ตรวจว่า email ของ profile ตรงกับ `invite_email`
- สร้าง profile พื้นฐานให้ได้ถ้าผู้ใช้ auth ยังไม่มี row ใน `profiles`
- ตรวจว่า invitation ยังเป็น `invited` และยังไม่หมดอายุ
- สร้าง/เปิด `workspace_memberships` role `parent` หรือ `student`
- ถ้าเป็น parent จะสร้างหรืออัปเดต `student_guardians` พร้อม `consent_status = granted`
- ถ้าเป็น student จะสร้างหรือเปิด `student_profile_links.status = active`
- กันกรณี student ถูก link กับ profile อื่น หรือ profile ถูก link กับ student อื่นแล้ว
- อัปเดต invitation เป็น `accepted`
- บันทึก `audit_logs`

Deploy:

```bash
supabase functions deploy accept-portal-invitation
```

ตัวอย่าง body:

```json
{
  "invitationId": "uuid"
}
```

ข้อควรระวัง:

- Function นี้ต้องใช้ `SUPABASE_SERVICE_ROLE_KEY` เฉพาะใน Supabase Functions เท่านั้น
- Frontend ห้ามสร้าง `student_guardians` หรือ `student_profile_links` แทนการ accept แบบ production
- ก่อนใช้จริงควรทดสอบเคส email ไม่ตรง, invite หมดอายุ, student ถูก link กับ profile อื่นแล้ว และ audit log

## dispatch-notification

Path:

```text
supabase/functions/dispatch-notification/index.ts
```

หน้าที่:

- รับคำสั่งสร้าง notification จาก frontend หรือ workflow อื่น
- ตรวจ `Authorization` bearer token ของผู้เรียก
- อนุญาตเฉพาะ active superadmin หรือสมาชิก workspace role `teacher_owner` / `teacher_member`
- Insert `notifications` โดยผูก `workspace_id`, `profile_id`, `privacy_level` และ metadata `data.channels`
- บันทึกผลแต่ละ channel ลง `notification_dispatch_logs`
- บันทึก `audit_logs` action `notification.dispatched`
- รองรับ channel:
  - `in_app`: สร้าง notification และ log สถานะ `queued`
  - `telegram`: ส่งผ่าน Telegram Bot API เมื่อมี `TELEGRAM_BOT_TOKEN` และ `telegramChatId`
  - `line`: ส่งผ่าน LINE Messaging API เมื่อมี `LINE_CHANNEL_ACCESS_TOKEN` และ `lineUserId`

Environment ที่ต้องมีใน Supabase Functions:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Environment เสริมสำหรับส่งออกนอกระบบ:

```text
TELEGRAM_BOT_TOKEN
LINE_CHANNEL_ACCESS_TOKEN
```

Deploy:

```bash
supabase functions deploy dispatch-notification
```

ตัวอย่าง body:

```json
{
  "workspaceId": "uuid",
  "profileId": "uuid",
  "type": "manual_test",
  "title": "แจ้งเตือนทดสอบ",
  "body": "ข้อความแจ้งเตือน",
  "privacyLevel": "normal",
  "channels": ["in_app", "telegram"],
  "telegramChatId": "123456789",
  "data": {
    "source_ui": "notifications_page"
  }
}
```

ข้อควรระวัง:

- ห้ามใส่ `TELEGRAM_BOT_TOKEN`, `LINE_CHANNEL_ACCESS_TOKEN` หรือ `SUPABASE_SERVICE_ROLE_KEY` ใน frontend
- `telegramChatId` และ `lineUserId` เป็นข้อมูลผู้รับ ควรมาจาก consent/setting ที่ตรวจสิทธิ์แล้ว
- ก่อนเปิด production ต้องทดสอบ log, audit, rate limit, retry และกรณี provider ตอบ error
