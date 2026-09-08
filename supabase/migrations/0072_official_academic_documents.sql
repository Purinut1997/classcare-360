-- 0072_official_academic_documents.sql
-- Implements Phase 4 of the School Registration & Academic System Specification:
-- Audit log and issuance ledger for official school certificates:
-- - Student status certification (ใบรับรองการเป็นนักเรียน)
-- - Academic record transcript (ใบรับรองผลการเรียน)
-- - Graduation completion certificate (ใบรับรองการจบหลักสูตร)

create table if not exists public.official_certificates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  certificate_type text not null check (certificate_type in ('student_status', 'academic_record', 'completion', 'custom')),
  document_number text not null, -- e.g. 'ที่ ศธ 04123/ว.045'
  issue_date date not null default current_date,
  purpose text, -- วัตถุประสงค์ในการขอ เช่น สมัครเรียนต่อ, เบิกเงินสวัสดิการ
  signatory_title text not null default 'ผู้อำนวยการโรงเรียน',
  signatory_name text,
  metadata jsonb not null default '{}',
  issued_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_official_certificates_lookup
  on public.official_certificates(workspace_id, student_id, issue_date desc);

create index if not exists idx_official_certificates_doc_no
  on public.official_certificates(workspace_id, document_number);

drop trigger if exists official_certificates_touch_updated_at on public.official_certificates;
create trigger official_certificates_touch_updated_at
before update on public.official_certificates
for each row execute function public.touch_updated_at();

alter table public.official_certificates enable row level security;

create policy "official_certificates_select_staff"
on public.official_certificates for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "official_certificates_insert_staff"
on public.official_certificates for insert to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "official_certificates_update_staff"
on public.official_certificates for update to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
