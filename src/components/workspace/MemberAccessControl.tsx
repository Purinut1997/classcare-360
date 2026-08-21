import { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface ClassroomOption {
  id: string;
  name: string;
}

interface MemberAccess {
  classroom_ids: string[];
  display_name: string;
  email: string;
  permissions: Record<string, boolean>;
  profile_id: string;
  role: string;
  status: string;
}

const capabilities = [
  ['students.write', 'เพิ่มและแก้ไขรายชื่อนักเรียน'],
  ['attendance.write', 'บันทึกเวลาเรียน'],
  ['scores.write', 'บันทึกคะแนน'],
  ['behavior.write', 'บันทึกพฤติกรรม'],
  ['student_care.write', 'จัดการเคสดูแล'],
  ['home_visits.write', 'บันทึกเยี่ยมบ้าน'],
  ['savings.write', 'จัดการเงินออม'],
  ['duty.manage', 'จัดการตารางเวร'],
  ['daily_brief.write', 'เขียนสรุปประจำวัน'],
  ['reports.export', 'ส่งออกรายงาน'],
  ['communications.prepare', 'เตรียมข้อความผู้ปกครอง'],
  ['communications.approve', 'อนุมัติและส่งข้อความ'],
  ['automation.manage', 'จัดการกฎอัตโนมัติ'],
  ['data.bulk', 'ทำรายการแบบชุด'],
  ['recovery.restore', 'กู้คืนข้อมูล'],
] as const;

export function MemberAccessControl({
  classrooms,
  session,
}: {
  classrooms: ClassroomOption[];
  session: AppSessionContext;
}) {
  const [members, setMembers] = useState<MemberAccess[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !session.workspace) return;
      const { data, error } = await supabase.rpc('get_workspace_member_access', {
        target_workspace_id: session.workspace.id,
      });
      if (!active) return;
      if (error) {
        setNotice(error.message.includes('Could not find the function')
          ? 'กรุณาติดตั้ง migration 0033 เพื่อเปิดใช้ระบบกำหนดสิทธิ์'
          : error.message);
        return;
      }
      setMembers((data || []) as MemberAccess[]);
    }
    void load();
    return () => {
      active = false;
    };
  }, [session.workspace]);

  function updateMember(profileId: string, updater: (member: MemberAccess) => MemberAccess) {
    setMembers((current) => current.map((member) => (member.profile_id === profileId ? updater(member) : member)));
  }

  async function save(member: MemberAccess) {
    if (!supabase || !session.workspace) return;
    setBusyId(member.profile_id);
    setNotice(null);
    const { error } = await supabase.rpc('set_workspace_member_access', {
      assigned_classroom_ids: member.permissions['scope.all_classrooms'] ? [] : member.classroom_ids,
      capability_overrides: member.permissions,
      target_profile_id: member.profile_id,
      target_workspace_id: session.workspace.id,
    });
    if (error) {
      setNotice(error.message);
      setBusyId(null);
      return;
    }
    await writeAuditLog(session, {
      action: 'workspace_member.access_updated',
      entityId: member.profile_id,
      entityTable: 'workspace_memberships',
      metadata: { classroomIds: member.classroom_ids, permissions: member.permissions },
      riskLevel: 'high',
      source: 'member_access_control',
    });
    setNotice(`บันทึกขอบเขตของ ${member.display_name} เรียบร้อย`);
    setBusyId(null);
  }

  const configurableMembers = members.filter((member) => member.role === 'teacher_member' || member.role === 'viewer');

  return (
    <section className="nexus-card mt-5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black text-cyan-700">Role & Classroom Scope</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">กำหนดสิทธิ์ครูตามหน้าที่และห้องเรียน</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
            สิทธิ์เจ้าของ Workspace ถูกป้องกันไว้ ครูจะทำงานได้เฉพาะความสามารถและห้องที่ได้รับมอบหมาย
          </p>
        </div>
      </div>

      {notice ? <div className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">{notice}</div> : null}

      <div className="mt-5 grid gap-4">
        {configurableMembers.map((member) => (
          <article className="rounded-3xl border border-slate-200 bg-white/80 p-4" key={member.profile_id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-slate-950">{member.display_name}</p>
                <p className="text-xs font-bold text-slate-500">{member.email} · {member.role === 'viewer' ? 'ผู้ดูรายงาน' : 'ครูผู้ใช้งาน'}</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-black text-slate-700">
                <input
                  checked={Boolean(member.permissions['scope.all_classrooms'])}
                  className="h-4 w-4 accent-cyan-600"
                  onChange={(event) => updateMember(member.profile_id, (current) => ({
                    ...current,
                    permissions: { ...current.permissions, 'scope.all_classrooms': event.target.checked },
                  }))}
                  type="checkbox"
                />
                ทุกห้องเรียน
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(([key, label]) => (
                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700" key={key}>
                  <input
                    checked={Boolean(member.permissions[key])}
                    className="h-4 w-4 accent-cyan-600"
                    onChange={(event) => updateMember(member.profile_id, (current) => ({
                      ...current,
                      permissions: { ...current.permissions, [key]: event.target.checked },
                    }))}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>

            {!member.permissions['scope.all_classrooms'] ? (
              <div className="mt-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">ห้องเรียนที่รับผิดชอบ</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {classrooms.map((classroom) => (
                    <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" key={classroom.id}>
                      <input
                        checked={member.classroom_ids.includes(classroom.id)}
                        className="h-4 w-4 accent-cyan-600"
                        onChange={(event) => updateMember(member.profile_id, (current) => ({
                          ...current,
                          classroom_ids: event.target.checked
                            ? [...new Set([...current.classroom_ids, classroom.id])]
                            : current.classroom_ids.filter((id) => id !== classroom.id),
                        }))}
                        type="checkbox"
                      />
                      {classroom.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              className="blue-action mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:opacity-50"
              disabled={busyId === member.profile_id}
              onClick={() => void save(member)}
              type="button"
            >
              <Save size={16} aria-hidden="true" />
              {busyId === member.profile_id ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
            </button>
          </article>
        ))}
        {configurableMembers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
            เพิ่มครูหรือผู้ดูรายงานก่อน แล้วจึงกำหนดสิทธิ์และห้องเรียนได้
          </div>
        ) : null}
      </div>
    </section>
  );
}
