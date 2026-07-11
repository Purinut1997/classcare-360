# ClassCare 360 Database Schema Draft

อัปเดตล่าสุด: 2026-06-24  
สถานะ: Phase 1 schema draft  
อ้างอิง: `Prompt.txt`

## Design Principles

- ใช้ Supabase PostgreSQL เป็นฐานข้อมูลหลัก
- ทุกตารางหลักที่เป็นข้อมูลโรงเรียน/ครูต้องมี `workspace_id`
- เปิด RLS ทุกตารางที่ frontend เข้าถึง
- ใช้ `auth.users.id` เป็น user identity และมี `profiles` เป็น app profile
- เก็บไฟล์ใน Storage ไม่เก็บ base64 ใน database
- เก็บ metadata ของไฟล์ใน database
- ใช้ `created_at`, `updated_at`, `created_by`, `updated_by` ในตารางหลัก
- ใช้ soft delete เฉพาะตารางที่ต้อง audit หรือ restore ได้
- ใช้ `audit_logs` และ `edit_history` กับ action สำคัญ
- ใช้ enum หรือ check constraint กับสถานะสำคัญ
- ใช้ `timestamptz` และแสดงผลตาม timezone `Asia/Bangkok`

## Naming Conventions

- ตารางใช้ plural snake_case
- Primary key เป็น `id uuid primary key default gen_random_uuid()`
- Foreign key ใช้ชื่อตารางเอกพจน์ เช่น `workspace_id`, `student_id`
- Boolean ขึ้นต้นด้วย `is_`, `has_`, `can_`
- Date-only ใช้ `date`
- Date-time ใช้ `timestamptz`
- Metadata ใช้ `jsonb` เมื่อโครงสร้างเปลี่ยนได้ แต่ข้อมูลหลักควรเป็น column ปกติ

## Core Identity Tables

### profiles

เก็บข้อมูลผู้ใช้ระดับ app

Columns:

- `id uuid primary key references auth.users(id)`
- `email text not null`
- `display_name text`
- `phone text`
- `avatar_url text`
- `account_status text not null`
- `referral_code text unique`
- `referred_by_profile_id uuid references profiles(id)`
- `first_login_at timestamptz`
- `last_login_at timestamptz`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `profiles_email_idx`
- `profiles_referral_code_idx`
- `profiles_account_status_idx`

### workspaces

แทนโรงเรียนหรือชุดข้อมูลของครู

Columns:

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `school_name text`
- `school_code text`
- `owner_profile_id uuid not null references profiles(id)`
- `academic_year text`
- `timezone text not null default 'Asia/Bangkok'`
- `school_lat numeric(10,7)`
- `school_lng numeric(10,7)`
- `school_location_updated_at timestamptz`
- `logo_file_id uuid`
- `settings jsonb not null default '{}'`
- `is_demo boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz`

Indexes:

- `workspaces_owner_profile_id_idx`
- `workspaces_school_code_idx`

### workspace_memberships

ผูกผู้ใช้กับ workspace และ role

Columns:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `profile_id uuid not null references profiles(id)`
- `role text not null`
- `status text not null default 'active'`
- `classroom_scope uuid[]`
- `subject_scope uuid[]`
- `permissions jsonb not null default '{}'`
- `invited_by uuid references profiles(id)`
- `joined_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `workspace_id, profile_id`
- role in `teacher_owner`, `teacher_member`, `parent`, `student`, `viewer`

Indexes:

- `workspace_memberships_workspace_id_idx`
- `workspace_memberships_profile_id_idx`
- `workspace_memberships_role_idx`

### superadmin_profiles

แยกสิทธิ์ superadmin ออกจาก membership ปกติ

Columns:

- `profile_id uuid primary key references profiles(id)`
- `level text not null default 'superadmin'`
- `is_active boolean not null default true`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

## Subscription and Entitlement Tables

### plans

Columns:

- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `name text not null`
- `price_thb integer not null default 0`
- `duration_days integer`
- `is_active boolean not null default true`
- `features jsonb not null default '{}'`
- `limits jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Seed:

- `FREE_LOGIN`
- `TRIAL_30`
- `VIP_YEARLY`

### subscriptions

Columns:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `profile_id uuid not null references profiles(id)`
- `plan_id uuid not null references plans(id)`
- `status text not null`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `trial_used boolean not null default false`
- `source text`
- `payment_request_id uuid`
- `cancelled_at timestamptz`
- `refunded_at timestamptz`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `subscriptions_workspace_status_idx`
- `subscriptions_profile_id_idx`
- partial unique active subscription ต่อ workspace ถ้าต้องการบังคับ 1 active ต่อ workspace

### module_entitlements

เก็บ mapping plan กับ module

Columns:

- `id uuid primary key default gen_random_uuid()`
- `plan_id uuid not null references plans(id)`
- `module_key text not null`
- `is_enabled boolean not null default true`
- `limits jsonb not null default '{}'`

Constraints:

- unique `plan_id, module_key`

## Payment, Refund, and Referral Tables

### payment_qr_codes

Columns:

- `id uuid primary key default gen_random_uuid()`
- `display_name text not null`
- `file_id uuid not null`
- `bank_name text`
- `account_name text`
- `account_hint text`
- `is_active boolean not null default false`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### payment_requests

Columns:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `profile_id uuid not null references profiles(id)`
- `plan_id uuid not null references plans(id)`
- `qr_code_id uuid references payment_qr_codes(id)`
- `status text not null default 'draft'`
- `base_amount_thb integer not null`
- `credit_amount_thb integer not null default 0`
- `payable_amount_thb integer not null`
- `slip_file_id uuid`
- `submitted_at timestamptz`
- `reviewed_by uuid references profiles(id)`
- `reviewed_at timestamptz`
- `review_note text`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Statuses:

- `draft`
- `pending_review`
- `approved`
- `rejected`
- `cancelled`
- `refunded`
- `expired`

### refund_requests

Columns:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `profile_id uuid not null references profiles(id)`
- `payment_request_id uuid not null references payment_requests(id)`
- `status text not null default 'pending_review'`
- `reason text not null`
- `refund_channel jsonb not null default '{}'`
- `reviewed_by uuid references profiles(id)`
- `reviewed_at timestamptz`
- `review_note text`
- `paid_back_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### referral_events

Columns:

- `id uuid primary key default gen_random_uuid()`
- `referrer_profile_id uuid not null references profiles(id)`
- `referred_profile_id uuid not null references profiles(id)`
- `payment_request_id uuid references payment_requests(id)`
- `status text not null`
- `created_at timestamptz not null default now()`

### referral_credits

Columns:

- `id uuid primary key default gen_random_uuid()`
- `profile_id uuid not null references profiles(id)`
- `source_referral_event_id uuid references referral_events(id)`
- `amount_thb integer not null`
- `status text not null`
- `used_payment_request_id uuid references payment_requests(id)`
- `reason text`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Statuses:

- `pending`
- `available`
- `used`
- `reversed`
- `expired`

## School and Classroom Tables

### academic_years

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `name text not null`
- `starts_on date`
- `ends_on date`
- `is_active boolean not null default false`
- `created_at timestamptz not null default now()`

### classrooms

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `academic_year_id uuid references academic_years(id)`
- `name text not null`
- `grade_level text`
- `room_number text`
- `homeroom_teacher_profile_id uuid references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz`

Indexes:

- `classrooms_workspace_year_idx`

### students

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `classroom_id uuid references classrooms(id)`
- `student_code text`
- `prefix text`
- `first_name text not null`
- `last_name text not null`
- `nickname text`
- `gender text`
- `birth_date date`
- `status text not null default 'active'`
- `parent_summary jsonb not null default '{}'`
- `health_flags jsonb not null default '{}'`
- `home_lat numeric(10,7)`
- `home_lng numeric(10,7)`
- `home_location_privacy_level text not null default 'restricted'`
- `home_distance_stale boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz`

Indexes:

- `students_workspace_classroom_idx`
- `students_workspace_code_idx`
- `students_name_search_idx`

### student_guardians

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `profile_id uuid references profiles(id)`
- `name text not null`
- `relationship text`
- `phone text`
- `line_user_id text`
- `is_primary boolean not null default false`
- `created_at timestamptz not null default now()`

### student_profile_links

ผูกบัญชี `profiles` role `student` กับ record นักเรียนจริง เพื่อให้ Student Portal อ่านได้เฉพาะข้อมูลของตนเอง

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `profile_id uuid not null references profiles(id)`
- `status text not null default 'active'`
- `linked_by uuid references profiles(id)`
- `linked_at timestamptz not null default now()`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `workspace_id, student_id`
- unique `workspace_id, profile_id`

### portal_invitations

คำเชิญสำหรับ Parent/Student Portal แบบ email-first เพื่อไม่ต้องให้ครูค้นหา/กรอก `profile_id` ตรง ๆ จาก frontend

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `portal_role text not null`
- `invite_email text not null`
- `relation text`
- `status text not null default 'invited'`
- `invited_by uuid references profiles(id)`
- `accepted_by uuid references profiles(id)`
- `accepted_at timestamptz`
- `expires_at timestamptz`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- ครูใน workspace สร้าง/ยกเลิกคำเชิญได้
- ผู้รับคำเชิญอ่านคำเชิญตัวเองได้จาก email ที่ตรงกับ profile
- ขั้น accept จริงควรทำผ่าน Edge Function เพื่อสร้าง `student_guardians` หรือ `student_profile_links` อย่างปลอดภัย

## Daily and Academic Tables

### attendance_records

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `classroom_id uuid not null references classrooms(id)`
- `student_id uuid not null references students(id)`
- `attendance_date date not null`
- `status text not null`
- `note text`
- `recorded_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `workspace_id, student_id, attendance_date`

### subjects

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `academic_year_id uuid references academic_years(id)`
- `code text`
- `name text not null`
- `teacher_profile_id uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### learning_units

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `subject_id uuid not null references subjects(id)`
- `name text not null`
- `sort_order integer not null default 0`

### indicators

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `subject_id uuid not null references subjects(id)`
- `learning_unit_id uuid references learning_units(id)`
- `code text`
- `description text not null`

### class_tasks

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `classroom_id uuid references classrooms(id)`
- `subject_id uuid references subjects(id)`
- `title text not null`
- `due_date date`
- `max_score numeric(8,2)`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### score_entries

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `task_id uuid references class_tasks(id)`
- `indicator_id uuid references indicators(id)`
- `score numeric(8,2)`
- `status text`
- `recorded_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Savings, Behavior, and Care Tables

### savings_accounts

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `academic_year_id uuid references academic_years(id)`
- `opening_balance_satangs integer not null default 0`
- `current_balance_satangs integer not null default 0`
- `created_at timestamptz not null default now()`

### savings_transactions

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `account_id uuid references savings_accounts(id)`
- `transaction_date date not null`
- `type text not null`
- `amount_satangs integer not null`
- `note text`
- `recorded_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### behavior_categories

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `name text not null`
- `kind text not null`
- `score_delta integer not null default 0`

### behavior_records

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `category_id uuid references behavior_categories(id)`
- `recorded_on date not null`
- `description text`
- `visibility text not null default 'teacher_only'`
- `recorded_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### student_care_cases

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `case_type text not null`
- `risk_level text`
- `status text not null default 'open'`
- `summary text not null`
- `sensitive_notes text`
- `next_action text`
- `assigned_to uuid references profiles(id)`
- `opened_by uuid references profiles(id)`
- `opened_at timestamptz not null default now()`
- `closed_at timestamptz`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Home Visit and Map Tables

### home_visits

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `visit_date date`
- `status text not null default 'planned'`
- `summary text`
- `sensitive_notes text`
- `visited_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### student_home_distances

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `school_lat numeric(10,7) not null`
- `school_lng numeric(10,7) not null`
- `home_lat numeric(10,7) not null`
- `home_lng numeric(10,7) not null`
- `straight_distance_meters integer`
- `route_distance_meters integer`
- `route_duration_seconds integer`
- `provider text`
- `calculated_at timestamptz not null default now()`
- `is_stale boolean not null default false`

## Parent Forms and Appointments

### parent_forms

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `title text not null`
- `description text`
- `status text not null default 'draft'`
- `schema jsonb not null default '{}'`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### parent_form_responses

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `form_id uuid not null references parent_forms(id)`
- `student_id uuid not null references students(id)`
- `guardian_id uuid references student_guardians(id)`
- `response jsonb not null default '{}'`
- `submitted_at timestamptz`

### parent_appointments

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid references students(id)`
- `guardian_id uuid references student_guardians(id)`
- `title text not null`
- `starts_at timestamptz not null`
- `ends_at timestamptz`
- `status text not null default 'scheduled'`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

## Notification Tables

### notification_channels

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id)`
- `profile_id uuid references profiles(id)`
- `channel text not null`
- `target_ref text`
- `encrypted_token text`
- `is_enabled boolean not null default true`
- `created_at timestamptz not null default now()`

### notifications

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id)`
- `profile_id uuid references profiles(id)`
- `type text not null`
- `title text not null`
- `body text not null`
- `data jsonb not null default '{}'`
- `privacy_level text not null default 'normal'`
- `read_at timestamptz`
- `created_at timestamptz not null default now()`

### notification_deliveries

- `id uuid primary key default gen_random_uuid()`
- `notification_id uuid not null references notifications(id)`
- `channel text not null`
- `status text not null default 'queued'`
- `attempt_count integer not null default 0`
- `last_error text`
- `sent_at timestamptz`
- `created_at timestamptz not null default now()`

## Files, Reports, Import, Backup

### app_files

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id)`
- `bucket text not null`
- `storage_path text not null`
- `original_filename text`
- `content_type text`
- `size_bytes bigint`
- `checksum text`
- `privacy_level text not null default 'private'`
- `owner_profile_id uuid references profiles(id)`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

### report_jobs

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `requested_by uuid not null references profiles(id)`
- `report_type text not null`
- `status text not null default 'queued'`
- `params jsonb not null default '{}'`
- `output_file_id uuid references app_files(id)`
- `error_message text`
- `created_at timestamptz not null default now()`
- `completed_at timestamptz`

### import_jobs

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `requested_by uuid not null references profiles(id)`
- `template_type text not null`
- `status text not null default 'uploaded'`
- `source_file_id uuid references app_files(id)`
- `summary jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `completed_at timestamptz`

### backup_jobs

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `requested_by uuid not null references profiles(id)`
- `scope jsonb not null default '{}'`
- `status text not null default 'queued'`
- `output_file_id uuid references app_files(id)`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`
- `completed_at timestamptz`

## Audit, Edit History, and System Tables

### audit_logs

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id)`
- `actor_profile_id uuid references profiles(id)`
- `actor_role text`
- `action text not null`
- `entity_table text`
- `entity_id uuid`
- `risk_level text not null default 'normal'`
- `ip_address inet`
- `user_agent text`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

### edit_history

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id)`
- `table_name text not null`
- `record_id uuid not null`
- `changed_by uuid references profiles(id)`
- `changed_at timestamptz not null default now()`
- `operation text not null`
- `old_values jsonb`
- `new_values jsonb`

### period_locks

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `academic_year_id uuid references academic_years(id)`
- `period_key text not null`
- `locked_by uuid references profiles(id)`
- `locked_at timestamptz not null default now()`
- `unlock_reason text`
- `unlocked_by uuid references profiles(id)`
- `unlocked_at timestamptz`

### system_announcements

- `id uuid primary key default gen_random_uuid()`
- `title text not null`
- `body text not null`
- `audience text not null default 'all'`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### maintenance_windows

- `id uuid primary key default gen_random_uuid()`
- `title text not null`
- `status text not null default 'scheduled'`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `message text`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

## Score Center Foundation

Migration `supabase/migrations/0007_scorebook_foundation.sql` adds the first scorebook tables:

### score_assessments

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `classroom_id uuid not null references classrooms(id)`
- `title text not null`
- `subject_name text not null`
- `category text not null`
- `max_score numeric(8,2) not null`
- `weight numeric(8,2) not null`
- `assessment_date date not null`
- `status text not null`
- `created_by uuid references profiles(id)`
- `metadata jsonb not null default '{}'`

### score_entries

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `assessment_id uuid not null references score_assessments(id)`
- `student_id uuid not null references students(id)`
- `score numeric(8,2)`
- `note text`
- `graded_by uuid references profiles(id)`
- `metadata jsonb not null default '{}'`
- `unique (assessment_id, student_id)`

## Savings And Behavior Foundation

Migration `supabase/migrations/0008_savings_behavior_foundation.sql` adds student savings and behavior tracking:

### savings_accounts

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `balance numeric(12,2) not null default 0`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'`
- `unique (workspace_id, student_id)`

### savings_transactions

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `account_id uuid references savings_accounts(id)`
- `student_id uuid not null references students(id)`
- `transaction_type text not null`
- `amount numeric(12,2) not null`
- `transaction_date date not null`
- `note text`
- `recorded_by uuid references profiles(id)`
- `metadata jsonb not null default '{}'`

### behavior_records

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `student_id uuid not null references students(id)`
- `tone text not null`
- `category text not null`
- `description text not null`
- `points integer not null default 0`
- `follow_up_status text not null default 'none'`
- `behavior_date date not null`
- `recorded_by uuid references profiles(id)`
- `metadata jsonb not null default '{}'`

## Classroom Randomizer Foundation

Migration `supabase/migrations/0009_randomizer_foundation.sql` adds classroom randomizer history:

### randomizer_sessions

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references workspaces(id)`
- `classroom_id uuid not null references classrooms(id)`
- `title text not null`
- `mode text not null`
- `result jsonb not null default '{}'`
- `created_by uuid references profiles(id)`
- `metadata jsonb not null default '{}'`

## Required Index Pattern

ควรเพิ่ม index แบบนี้ในทุกตารางใหญ่:

- `workspace_id`
- `workspace_id, created_at desc`
- `workspace_id, academic_year_id`
- `workspace_id, classroom_id`
- `workspace_id, student_id`
- `workspace_id, date_column`
- `workspace_id, status`

ตารางที่ต้องใส่ใจ performance:

- `attendance_records`
- `score_entries`
- `savings_transactions`
- `behavior_records`
- `notifications`
- `audit_logs`
- `edit_history`
- `report_jobs`
- `import_jobs`

## First Migration Scope

Migration แรกควรมี:

- extensions: `pgcrypto`
- profiles
- superadmin_profiles
- workspaces
- workspace_memberships
- plans
- module_entitlements
- subscriptions
- payment_qr_codes
- payment_requests
- refund_requests
- referral_events
- referral_credits
- app_files
- audit_logs
- helper functions สำหรับ RLS
- enable RLS ทุกตารางด้านบน
- seed plans เริ่มต้นใน `supabase/seed.sql`

Migration ถัดไปค่อยเพิ่ม student/classroom/teacher modules เพื่อลดความเสี่ยงจาก schema ใหญ่เกินไปในครั้งเดียว
