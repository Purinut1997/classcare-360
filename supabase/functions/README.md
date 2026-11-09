# Supabase Edge Functions

## Encrypted R2 backup control

The `r2-backup-control` function lists encrypted backup object metadata from a private Cloudflare R2 bucket and lets an authenticated Superadmin dispatch the protected GitHub recovery workflow. It never returns backup contents or asks the browser to handle cloud credentials.

Deploy with GitHub Actions → **Deploy R2 backup control function** after setting `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` in repository secrets/variables. Configure function secrets as described in [the R2 backup runbook](../../docs/07-offsite-backup-r2.md). Recovery runs restore into a separate Supabase recovery project, not production.

## `system-backup-control` (Supabase-managed backup status)

This older function queries the Supabase Management API and can request PITR restoration. It is not used by the R2 off-site backup workflow. Supabase plan availability and PITR billing still apply; do not enable paid PITR without the project owner's explicit decision.

## System backup and PITR control

`system-backup-control` exposes backup status, a guarded daily-backup schedule control, and a guarded Point-in-Time restore action to the Superadmin dashboard. It calls the Supabase Management API from the Edge Function; the Management API token must never be placed in frontend environment variables.

Before deploying this function:

1. Deploy the Edge Function to the Supabase project used by ClassCare 360.
2. Add `SUPABASE_PROJECT_REF` and a fine-grained `SUPABASE_ACCESS_TOKEN` as Edge Function secrets. Grant the token only the backup read/write permissions required by the Management API. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are supplied to Supabase Edge Functions.
3. Open Superadmin → **Backup & Rollback** → **ตรวจสถานะล่าสุด** to confirm that the Management API returns backup status.
4. For PITR restores, first enable PITR in the Supabase Dashboard and verify its recovery window. PITR may have a separate recurring charge. This application does not enable or purchase PITR automatically.

Daily database backups are automatic on Supabase Pro, Team, and Enterprise plans; Free projects do not receive them. Supabase's Management API for reading/changing the daily backup time is Enterprise-only. The in-app schedule form therefore appears only when the API grants access; it sets a UTC time, allows at most three changes per 24 hours, and records the reason and request/result in Edge Function provider logs. Backups do not include objects stored through the Storage API. Restoring the production database can discard later writes and cause downtime. For a daily-backup restore when PITR is disabled, use the Supabase Dashboard. Use the in-app restore only for an incident that warrants a whole-project rollback. Each request requires Superadmin authentication, an incident reason, an exact confirmation phrase, and a second browser confirmation. Database audit rows themselves may be reverted by a point-in-time database restore.

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
  - `telegram`: ส่งถึงบัญชี Telegram ที่ครูผู้รับเชื่อมและยืนยันไว้ โดยอ่าน token/ปลายทางจากตารางฝั่ง server และตรวจตัวเลือกของครู
  - `line`: ปิดการส่งจริง และจะถูกบันทึกเป็น `skipped`; หน้าแจ้งเตือนไม่แสดง LINE ให้ตั้งค่า

Environment ที่ต้องมีใน Supabase Functions:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Environment เสริมสำหรับส่งออกนอกระบบ:

```text
TELEGRAM_CONNECTION_ENCRYPTION_KEY
```

`TELEGRAM_CONNECTION_ENCRYPTION_KEY` ต้องเป็นคีย์สุ่ม 32 ไบต์ที่เข้ารหัส Base64 และตั้งเป็น Secret ของ Supabase Edge Functions เท่านั้น ห้ามใส่ใน Vite environment หรือส่งให้ browser

Deploy:

```bash
supabase functions deploy dispatch-notification
supabase functions deploy manage-telegram-account
```

## manage-telegram-account

Path: `supabase/functions/manage-telegram-account/index.ts`

ให้ครูเชื่อม Telegram ส่วนตัวในหน้าแจ้งเตือน: ตรวจ Bot Token กับ Telegram, สร้าง deep link ที่มี nonce เฉพาะบัญชี, ให้ครูกด Start, ส่งรหัสยืนยัน 6 หลัก และจำกัดการลองรหัสผิด 5 ครั้ง Token และ chat ID ถูกเข้ารหัส AES-GCM และอ่านได้จาก Edge Function เท่านั้น ครูแต่ละคนมีข้อมูลแยกตาม `(workspace_id, profile_id)`

ก่อน deploy ต้องใช้ migrations ตามลำดับจนถึง `0082_teacher_telegram_connections.sql` และตั้ง secret `TELEGRAM_CONNECTION_ENCRYPTION_KEY` ใน Supabase Function Secrets จากนั้น deploy สอง functions ด้านบน การเชื่อมบัญชีไม่ทำงานหากบอตตั้ง webhook หรือใช้ร่วมกับระบบ polling อื่น

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
  "data": {
    "source_ui": "notifications_page"
  }
}
```

ข้อควรระวัง:

- ห้ามใส่ `TELEGRAM_BOT_TOKEN`, `LINE_CHANNEL_ACCESS_TOKEN` หรือ `SUPABASE_SERVICE_ROLE_KEY` ใน frontend
- ห้ามส่งข้อความโดยรับ Telegram chat ID หรือ LINE user ID จาก payload ของ browser; ต้องอ่านปลายทางที่จับคู่และยืนยันกับ `workspace_id + profile_id` จากฝั่ง server เท่านั้น
- ก่อนเปิด production ต้องทดสอบ log, audit, rate limit, retry และกรณี provider ตอบ error
