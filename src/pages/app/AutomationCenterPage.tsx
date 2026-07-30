import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Eye, FileSpreadsheet, LoaderCircle,
  MessageSquareText, Play, Send, ShieldCheck, Sparkles, Workflow, XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface AutomationCenterPageProps { session: AppSessionContext }
interface RuleRow {
  id: string; name: string; trigger_type: string; action_type: string;
  threshold: number; window_days: number; is_active: boolean; approval_required: boolean;
}
interface SignalRow {
  id: string; student_id: string; signal_type: string; severity: string;
  risk_score: number; reason: string; evidence: Record<string, unknown>; status: string;
}
interface QueueRow {
  id: string; student_id: string | null; recipient_profile_id: string | null;
  recipient_name: string | null; channels: string[]; title: string; body: string;
  reason: string; status: string; created_at: string;
}
interface StudentRow { id: string; student_code: string; first_name: string; last_name: string }

const triggerLabels: Record<string, string> = {
  attendance_absence: 'เวลาเรียน', low_score: 'คะแนน', negative_behavior: 'พฤติกรรม',
  attendance_today: 'ขาดเรียนวันนี้', savings_anomaly: 'เงินออม', home_visit_incomplete: 'เยี่ยมบ้าน',
};
const reportTemplates = [
  'สรุปผลการเรียน / ปพ.', 'รายงานเวลาเรียนรายเดือน', 'สรุปนักเรียนขาดเรียน',
  'รายงานเยี่ยมบ้าน', 'บันทึกพฤติกรรม', 'หนังสือแจ้งผู้ปกครอง', 'รายงานสำหรับฝ่ายบริหาร',
];

export function AutomationCenterPage({ session }: AutomationCenterPageProps) {
  const feedback = useSystemFeedback();
  const workspaceId = session.workspace?.id ?? '';
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId || !isSupabaseReady || !supabase) return;
    setBusy(true);
    const [rulesResult, signalsResult, queueResult, studentsResult] = await Promise.all([
      supabase.from('automation_rules').select('*').eq('workspace_id', workspaceId).order('created_at'),
      supabase.from('early_warning_signals').select('*').eq('workspace_id', workspaceId).order('risk_score', { ascending: false }),
      supabase.from('communication_approval_queue').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100),
      supabase.from('students').select('id,student_code,first_name,last_name').eq('workspace_id', workspaceId),
    ]);
    const error = rulesResult.error ?? signalsResult.error ?? queueResult.error ?? studentsResult.error;
    if (error) setNotice(`โหลดศูนย์ Automation ไม่สำเร็จ: ${error.message}`);
    else {
      setRules((rulesResult.data ?? []) as RuleRow[]);
      setSignals((signalsResult.data ?? []) as SignalRow[]);
      setQueue((queueResult.data ?? []) as QueueRow[]);
      setStudents((studentsResult.data ?? []) as StudentRow[]);
    }
    setBusy(false);
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);
  const studentMap = useMemo(() => new Map(students.map((row) => [row.id, row])), [students]);
  const openSignals = signals.filter((row) => row.status === 'open');
  const pendingMessages = queue.filter((row) => row.status === 'pending');

  async function seedRules() {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('seed_default_automation_rules', { target_workspace_id: workspaceId });
    if (error) feedback.error({ title: 'ตั้งค่ากฎไม่สำเร็จ', message: error.message });
    else feedback.success({ title: 'พร้อมใช้งาน', message: `เพิ่มกฎมาตรฐาน ${data ?? 0} กฎ` });
    await load();
  }

  async function evaluate() {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('evaluate_early_warning_signals', { target_workspace_id: workspaceId });
    if (error) feedback.error({ title: 'ประเมินความเสี่ยงไม่สำเร็จ', message: error.message });
    else {
      const result = data as { evaluated?: number; signals?: number };
      feedback.success({
        title: 'ประเมินนักเรียนเรียบร้อย',
        message: `ตรวจ ${result.evaluated ?? 0} คน พบ/อัปเดตสัญญาณ ${result.signals ?? 0} รายการ`,
      });
    }
    await load();
  }

  async function toggleRule(rule: RuleRow) {
    if (!supabase) return;
    const { error } = await supabase.from('automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id).eq('workspace_id', workspaceId);
    if (error) feedback.error({ title: 'เปลี่ยนสถานะกฎไม่สำเร็จ', message: error.message });
    else await load();
  }

  async function reviewMessage(item: QueueRow, status: 'approved' | 'rejected') {
    if (!supabase) return;
    const { error } = await supabase.from('communication_approval_queue').update({
      status, approved_by: session.profile.id, approved_at: new Date().toISOString(),
    }).eq('id', item.id).eq('workspace_id', workspaceId).eq('status', 'pending');
    if (error) feedback.error({ title: 'บันทึกคำตัดสินไม่สำเร็จ', message: error.message });
    else {
      feedback.success({ title: status === 'approved' ? 'อนุมัติข้อความแล้ว' : 'ปฏิเสธข้อความแล้ว', message: item.title });
      await load();
    }
  }

  async function sendApproved(item: QueueRow) {
    if (!supabase) return;
    if (!item.recipient_profile_id) {
      feedback.warning({ title: 'ยังส่งไม่ได้', message: 'ผู้ปกครองยังไม่มีบัญชี Portal ที่เชื่อมกับนักเรียน เก็บรายการไว้ในคิวอนุมัติแล้ว' });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('dispatch-notification', {
      body: {
        workspace_id: workspaceId, recipient_profile_id: item.recipient_profile_id,
        title: item.title, body: item.body, notification_type: 'automation',
      },
    });
    await supabase.from('communication_approval_queue').update({
      status: error ? 'failed' : 'sent', sent_at: error ? null : new Date().toISOString(),
      dispatch_result: error ? { error: error.message } : { response: data },
    }).eq('id', item.id).eq('workspace_id', workspaceId).eq('status', 'approved');
    if (error) feedback.error({ title: 'ส่งข้อความไม่สำเร็จ', message: error.message });
    else feedback.success({ title: 'ส่งข้อความเรียบร้อย', message: `${item.recipient_name ?? 'ผู้ปกครอง'} · ${item.title}` });
    await load();
  }

  return (
    <main className="page-shell automation-center">
      <section className="page-hero">
        <div>
          <span className="eyebrow"><Workflow size={16} /> Teacher Automation</span>
          <h1>Automation, Early Warning และ Communication Hub</h1>
          <p>ลดงานซ้ำด้วยกฎที่ตรวจสอบได้ ทุกข้อความถึงผู้ปกครองต้องผ่านครูอนุมัติก่อนส่ง</p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" disabled={busy} onClick={() => void seedRules()}><Sparkles size={17} /> ติดตั้งกฎมาตรฐาน</button>
          <button className="button button-primary" disabled={busy} onClick={() => void evaluate()}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />} ประเมินตอนนี้
          </button>
        </div>
      </section>

      {notice ? <div className="status-banner warning"><AlertTriangle size={18} />{notice}</div> : null}
      <section className="metric-grid">
        <article className="metric-card"><strong>{rules.filter((row) => row.is_active).length}</strong><span>กฎที่ทำงาน</span></article>
        <article className="metric-card"><strong>{openSignals.length}</strong><span>สัญญาณที่ต้องดูแล</span></article>
        <article className="metric-card"><strong>{pendingMessages.length}</strong><span>ข้อความรออนุมัติ</span></article>
        <article className="metric-card"><strong>{queue.filter((row) => row.status === 'sent').length}</strong><span>ส่งสำเร็จ</span></article>
      </section>

      <section className="content-card">
        <div className="section-heading"><div><span className="eyebrow"><Workflow size={15} /> Automation Rules</span><h2>กฎช่วยงานครู</h2></div><span className="status-pill safe"><ShieldCheck size={14} /> อนุมัติก่อนส่ง</span></div>
        <div className="automation-rule-grid">
          {rules.map((rule) => (
            <article className="automation-rule" key={rule.id}>
              <div><span className="status-pill">{triggerLabels[rule.trigger_type] ?? rule.trigger_type}</span><h3>{rule.name}</h3><p>ทำงาน: {rule.action_type} · ย้อนหลัง {rule.window_days} วัน</p></div>
              <button className={`toggle-button ${rule.is_active ? 'active' : ''}`} onClick={() => void toggleRule(rule)}>{rule.is_active ? 'เปิด' : 'ปิด'}</button>
            </article>
          ))}
          {!rules.length && !busy ? <div className="empty-state">ยังไม่มีกฎ กด “ติดตั้งกฎมาตรฐาน” เพื่อเริ่มต้น</div> : null}
        </div>
      </section>

      <section className="content-card">
        <div className="section-heading"><div><span className="eyebrow"><Eye size={15} /> Explainable Early Warning</span><h2>นักเรียนที่ควรดูแล พร้อมเหตุผล</h2></div></div>
        <div className="responsive-table"><table><thead><tr><th>นักเรียน</th><th>มิติ</th><th>ระดับ</th><th>เหตุผลที่ระบบจัดเป็นความเสี่ยง</th><th>สถานะ</th></tr></thead>
          <tbody>{signals.slice(0, 50).map((signal) => {
            const student = studentMap.get(signal.student_id);
            return <tr key={signal.id}><td><strong>{student ? `${student.first_name} ${student.last_name}` : signal.student_id}</strong><small>{student?.student_code}</small></td>
              <td>{triggerLabels[signal.signal_type] ?? signal.signal_type}</td><td><span className={`risk-pill ${signal.severity}`}>{signal.risk_score}%</span></td>
              <td>{signal.reason}</td><td>{signal.status}</td></tr>;
          })}</tbody></table>{!signals.length ? <div className="empty-state">ยังไม่มีสัญญาณ กด “ประเมินตอนนี้” เพื่อวิเคราะห์ข้อมูลจริง</div> : null}</div>
      </section>

      <section className="content-card">
        <div className="section-heading"><div><span className="eyebrow"><MessageSquareText size={15} /> Communication Approval Queue</span><h2>ข้อความถึงผู้ปกครอง</h2><p>ตรวจเนื้อหาและ Consent ก่อนอนุมัติ แล้วจึงกดส่งจริง</p></div></div>
        <div className="approval-list">{queue.slice(0, 30).map((item) => (
          <article className="approval-item" key={item.id}><div><div className="approval-meta"><span className={`status-pill ${item.status}`}>{item.status}</span><span>{item.recipient_name ?? 'ยังไม่ผูกผู้รับ'}</span><span>{item.channels.join(', ')}</span></div><h3>{item.title}</h3><p>{item.body}</p><small>เหตุผล: {item.reason}</small></div>
            <div className="approval-actions">
              {item.status === 'pending' ? <><button className="icon-button success" onClick={() => void reviewMessage(item, 'approved')}><CheckCircle2 size={17} /> อนุมัติ</button><button className="icon-button danger" onClick={() => void reviewMessage(item, 'rejected')}><XCircle size={17} /> ปฏิเสธ</button></> : null}
              {item.status === 'approved' ? <button className="button button-primary" onClick={() => void sendApproved(item)}><Send size={17} /> ส่งข้อความ</button> : null}
            </div></article>
        ))}{!queue.length ? <div className="empty-state">ยังไม่มีข้อความรออนุมัติ</div> : null}</div>
      </section>

      <section className="content-card">
        <div className="section-heading"><div><span className="eyebrow"><FileSpreadsheet size={15} /> Quick Workbench</span><h2>งานประจำหนึ่งห้องให้จบในไม่กี่นาที</h2></div></div>
        <div className="quick-work-grid">
          <Link to="/app/dashboard?view=teacher-work">มาทั้งหมด แล้วแก้เฉพาะคน</Link>
          <Link to="/app/dashboard?view=scores">วางคะแนนจาก Excel / กรอกต่อเนื่อง</Link>
          <Link to="/app/dashboard?view=students">จัดการนักเรียนหลายคน</Link>
          <Link to="/app/dashboard?view=reports&reportView=attendance">สร้าง PDF / Excel</Link>
        </div>
        <div className="template-grid">{reportTemplates.map((name) => <span key={name}>{name}</span>)}</div>
      </section>
    </main>
  );
}
