insert into public.plans (code, name, price_thb, duration_days, features, limits)
values
  (
    'FREE_LOGIN',
    'Free Login',
    0,
    null,
    '{"modules":[],"description":"Login ได้อย่างเดียว ดูแพ็กเกจ บัญชี ชำระเงิน และติดต่อผู้ดูแล"}',
    '{"workspaces":1}'
  ),
  (
    'TRIAL_30',
    'ทดลองใช้งาน 30 วัน',
    0,
    30,
    '{"modules":["dashboard","students","attendance","reports_limited"],"description":"ทดลองใช้แบบจำกัด 30 วัน"}',
    '{"trial_per_workspace":1}'
  ),
  (
    'VIP_YEARLY',
    'ClassCare 360 VIP',
    100,
    365,
    '{"modules":["all"],"description":"เปิดทุกโมดูลหลักของ ClassCare 360"}',
    '{"history_years":3}'
  )
on conflict (code) do update
set
  name = excluded.name,
  price_thb = excluded.price_thb,
  duration_days = excluded.duration_days,
  features = excluded.features,
  limits = excluded.limits,
  is_active = true,
  updated_at = now();

insert into public.module_entitlements (plan_id, module_key, is_enabled)
select p.id, module_key, true
from public.plans p
cross join (
  values
    ('dashboard'),
    ('students'),
    ('attendance'),
    ('scores'),
    ('savings'),
    ('behavior'),
    ('student_care'),
    ('home_visits'),
    ('reports'),
    ('import_export'),
    ('notifications'),
    ('parent_portal'),
    ('student_portal'),
    ('google_drive_cold_storage'),
    ('teacher_backup'),
    ('classroom_randomizer')
) as modules(module_key)
where p.code = 'VIP_YEARLY'
on conflict (plan_id, module_key) do update
set is_enabled = excluded.is_enabled;

insert into public.module_entitlements (plan_id, module_key, is_enabled, limits)
select p.id, modules.module_key, true, modules.module_limits::jsonb
from public.plans p
cross join (
  values
    ('dashboard', '{"limited":true}'),
    ('students', '{"limited":true}'),
    ('attendance', '{"limited":true}'),
    ('reports', '{"limited":true,"pdf":false,"xlsx":false}')
) as modules(module_key, module_limits)
where p.code = 'TRIAL_30'
on conflict (plan_id, module_key) do update
set
  is_enabled = excluded.is_enabled,
  limits = excluded.limits;
