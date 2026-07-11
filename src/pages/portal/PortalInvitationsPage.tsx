import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

type PortalInviteRole = 'parent' | 'student';
type PortalInviteStatus = 'invited' | 'accepted' | 'revoked' | 'expired';

interface PortalInvitationRow {
  created_at: string | null;
  id: string;
  invite_email: string;
  portal_role: PortalInviteRole;
  relation: string | null;
  status: PortalInviteStatus;
  student_id: string;
  workspace_id: string;
}

interface AcceptResponse {
  destination?: string;
  error?: string;
  ok?: boolean;
  portalRole?: PortalInviteRole;
  status?: string;
}

interface PortalInvitationsPageProps {
  session: AppSessionContext;
}

const roleLabels: Record<PortalInviteRole, string> = {
  parent: 'ผู้ปกครอง',
  student: 'นักเรียน',
};

const statusLabels: Record<PortalInviteStatus, string> = {
  accepted: 'รับสิทธิ์แล้ว',
  expired: 'หมดอายุ',
  invited: 'รอรับสิทธิ์',
  revoked: 'ถูกยกเลิก',
};

const demoInvitations: PortalInvitationRow[] = [
  {
    created_at: '2026-06-28T09:30:00.000Z',
    id: 'demo-portal-invitation-student',
    invite_email: 'student@classcare.local',
    portal_role: 'student',
    relation: 'บัญชีนักเรียน',
    status: 'invited',
    student_id: 'demo-student-1',
    workspace_id: 'demo-workspace',
  },
  {
    created_at: '2026-06-28T10:00:00.000Z',
    id: 'demo-portal-invitation-parent',
    invite_email: 'parent@classcare.local',
    portal_role: 'parent',
    relation: 'มารดา',
    status: 'invited',
    student_id: 'demo-student-1',
    workspace_id: 'demo-workspace',
  },
];

function formatDate(value: string | null) {
  if (!value) return 'ยังไม่ระบุวันที่';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}

function getDestination(role: PortalInviteRole) {
  return role === 'parent' ? '/portal/parent' : '/portal/student';
}

export function PortalInvitationsPage({ session }: PortalInvitationsPageProps) {
  const [invitations, setInvitations] = useState<PortalInvitationRow[]>(() =>
    demoInvitations.filter((invite) => invite.invite_email === session.profile.email),
  );
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedDestination, setAcceptedDestination] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อรับคำเชิญผ่าน Supabase Edge Function จริง',
  );

  const invitedCount = useMemo(
    () => invitations.filter((invite) => invite.status === 'invited').length,
    [invitations],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInvitations() {
      if (!supabase) {
        setInvitations(demoInvitations.filter((invite) => invite.invite_email === session.profile.email));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const { data, error } = await supabase
        .from('portal_invitations')
        .select('id,workspace_id,student_id,portal_role,invite_email,relation,status,created_at')
        .eq('invite_email', session.profile.email)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setNotice(error.message);
        setIsLoading(false);
        return;
      }

      setInvitations((data || []) as PortalInvitationRow[]);
      setIsLoading(false);
    }

    void loadInvitations();

    return () => {
      isMounted = false;
    };
  }, [session.profile.email]);

  async function acceptInvitation(invitation: PortalInvitationRow) {
    setAcceptingId(invitation.id);
    setNotice(null);
    setAcceptedDestination(null);

    if (!supabase) {
      const destination = getDestination(invitation.portal_role);
      setInvitations((current) =>
        current.map((item) => (item.id === invitation.id ? { ...item, status: 'accepted' } : item)),
      );
      setAcceptedDestination(destination);
      setNotice('รับคำเชิญในโหมดตัวอย่างแล้ว ตอนใช้จริง Edge Function จะสร้างสิทธิ์และ membership ให้บัญชีนี้');
      setAcceptingId(null);
      return;
    }

    const { data, error } = await supabase.functions.invoke<AcceptResponse>('accept-portal-invitation', {
      body: { invitationId: invitation.id },
    });

    if (error || data?.error || !data?.ok) {
      setNotice(error?.message || data?.error || 'รับคำเชิญไม่สำเร็จ');
      setAcceptingId(null);
      return;
    }

    setInvitations((current) =>
      current.map((item) => (item.id === invitation.id ? { ...item, status: 'accepted' } : item)),
    );
    setAcceptedDestination(data.destination || getDestination(invitation.portal_role));
    setNotice('รับคำเชิญสำเร็จ ระบบสร้างสิทธิ์ Portal ให้บัญชีนี้แล้ว');
    setAcceptingId(null);
  }

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="nexus-card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="p-6 sm:p-8">
              <div className="nexus-kicker">
                <Inbox size={18} aria-hidden="true" />
                Portal Invitation
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
                คำเชิญเข้าใช้งาน Portal
              </h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-600">
                รับคำเชิญจากโรงเรียนเพื่อเปิดสิทธิ์ Parent Portal หรือ Student Portal ให้บัญชีนี้ โดยระบบจะสร้างสิทธิ์ผ่าน Edge Function ฝั่ง server
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <span className="nexus-pill inline-flex h-11 items-center gap-2 px-4 text-sm font-black text-slate-700">
                  <UserRound size={17} aria-hidden="true" />
                  {session.profile.email}
                </span>
                <span className="blue-action inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black">
                  <MailCheck size={17} aria-hidden="true" />
                  {invitedCount} คำเชิญรอรับ
                </span>
              </div>
            </div>

            <aside className="relative overflow-hidden border-t border-slate-100 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-300/20 blur-2xl" />
              <p className="relative text-sm font-black text-cyan-200">Server-side accept</p>
              <div className="relative mt-5 grid gap-3">
                {[
                  'ตรวจ email ตรงกับบัญชี',
                  'สร้าง membership ตาม role',
                  'สร้าง guardian/student link จริง',
                ].map((item) => (
                  <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur" key={item}>
                    <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden="true" />
                    <p className="text-sm font-bold leading-6 text-slate-100">{item}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>

        {notice ? (
          <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{notice}</p>
          </div>
        ) : null}

        {acceptedDestination ? (
          <div className="mt-5 nexus-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-teal-700">พร้อมเข้าใช้งาน</p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                ถ้าใช้ Supabase จริง ให้เข้า Portal หลังรับคำเชิญเพื่อให้ session โหลด membership ล่าสุด
              </p>
            </div>
            <Link
              className="blue-action inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black"
              to={acceptedDestination}
            >
              ไปหน้า Portal
            </Link>
          </div>
        ) : null}

        <section className="mt-5 grid gap-3">
          {invitations.map((invitation) => (
            <article className="nexus-card p-4 transition hover:-translate-y-1 sm:p-5" key={invitation.id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                      {roleLabels[invitation.portal_role]}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                      {statusLabels[invitation.status]}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-black text-slate-950">
                    {invitation.relation || roleLabels[invitation.portal_role]}
                  </h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                    ส่งถึง {invitation.invite_email} | สร้างเมื่อ {formatDate(invitation.created_at)}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-xs font-black text-teal-700">
                    <ShieldCheck size={15} aria-hidden="true" />
                    รับคำเชิญแล้วจะเปิดสิทธิ์เฉพาะนักเรียนที่ถูกเชิญ
                  </p>
                </div>

                <button
                  className="blue-action inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={acceptingId === invitation.id || invitation.status !== 'invited'}
                  onClick={() => acceptInvitation(invitation)}
                  type="button"
                >
                  {acceptingId === invitation.id ? 'กำลังรับสิทธิ์' : 'รับคำเชิญ'}
                </button>
              </div>
            </article>
          ))}

          {!isLoading && invitations.length === 0 ? (
            <div className="nexus-card p-6 text-center">
              <Inbox className="mx-auto text-slate-400" size={36} aria-hidden="true" />
              <h2 className="mt-3 text-2xl font-black text-slate-950">ยังไม่มีคำเชิญของบัญชีนี้</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                ให้ครูส่งคำเชิญด้วยอีเมลเดียวกับบัญชีที่เข้าสู่ระบบอยู่
              </p>
            </div>
          ) : null}
        </section>

        <footer className="mt-6 text-center text-xs font-bold text-slate-500">
          Created by MIKPURINUT
        </footer>
      </section>
    </main>
  );
}
