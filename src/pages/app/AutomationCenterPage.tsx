import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Eye, FileSpreadsheet,
  MessageSquareText, Play, Send, ShieldCheck, Sparkles, XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface AutomationCenterPageProps { session: AppSessionContext }
interface RuleRow {
  id: string; name: string; trigger_type: string; action_type: string;
  threshold: number; window_days: number; is_active: boolean; approval_required: boolean;
  config: Record<string, unknown>;
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
  const ruleGroups = [
    { key: 'learning', label: 'การเรียน', types: ['attendance_absence', 'low_score'] },
    { key: 'care', label: 'การดูแล', types: ['negative_behavior', 'savings_anomaly', 'home_visit_incomplete'] },
    { key: 'communication', label: 'การสื่อสาร', types: ['attendance_today'] },
  ];

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

  async function configureRule(rule: RuleRow) {
    if (!supabase) return;
    if (rule.trigger_type === 'home_visit_incomplete') {
      const deadline = window.prompt('กำหนดส่งแบบเยี่ยมบ้าน (YYYY-MM-DD)', String(rule.config?.deadline ?? ''));
      if (deadline === null) return;
      const { error } = await supabase.from('automation_rules').update({
        config: { ...rule.config, deadline: deadline.trim() || null },
      }).eq('id', rule.id).eq('workspace_id', workspaceId);
      if (error) feedback.error({ title: 'บันทึกกำหนดส่งไม่สำเร็จ', message: error.message });
      else await load();
      return;
    }
    const thresholdText = window.prompt('ค่าเกณฑ์ของกฎ', String(rule.threshold));
    if (thresholdText === null) return;
    const windowText = window.prompt('จำนวนวันที่ใช้ประเมินย้อนหลัง', String(rule.window_days));
    if (windowText === null) return;
    const threshold = Number(thresholdText);
    const windowDays = Number(windowText);
    if (!Number.isFinite(threshold) || threshold < 0 || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
      feedback.warning({ title: 'ค่ากฎไม่ถูกต้อง', message: 'เกณฑ์ต้องเป็นตัวเลข และจำนวนวันต้องอยู่ระหว่าง 1–365' });
      return;
    }
    const { error } = await supabase.from('automation_rules').update({
      threshold, window_days: windowDays,
    }).eq('id', rule.id).eq('workspace_id', workspaceId);
    if (error) feedback.error({ title: 'บันทึกกฎไม่สำเร็จ', message: error.message });
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
    const { error } = await supabase.functions.invoke('dispatch-notification', {
      body: {
        queueId: item.id,
        workspaceId,
      },
    });
    if (error) feedback.error({ title: 'ส่งข้อความไม่สำเร็จ', message: error.message });
    else feedback.success({ title: 'ส่งข้อความเรียบร้อย', message: `${item.recipient_name ?? 'ผู้ปกครอง'} · ${item.title}` });
    await load();
  }

  return (
    <main className="page-shell automation-center">
      <section className="page-hero">
        <div>
          <h1>ระบบช่วยติดตามนักเรียน</h1>
          <p>ติดตามความเสี่ยง ดูแลเชิงรุก และสื่อสารกับผู้ปกครองอย่างเป็นขั้นตอน</p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" disabled={busy} onClick={() => void seedRules()}><Sparkles size={17} /> ติดตั้งกฎมาตรฐาน</button>
          <button className="button button-primary" disabled={busy} onClick={() => void evaluate()}>
            {busy ? <NexusAuroraInline label="กำลังประเมิน" /> : <><Play size={17} /> ประเมินตอนนี้</>}
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

      <section className="content-card rules-panel">
        <div className="section-heading"><div><h2>กฎอัตโนมัติ</h2><p>แบ่งตามงานจริงเพื่อค้นหาและตั้งค่าได้เร็ว</p></div><span className="status-pill safe"><ShieldCheck size={14} /> ครูอนุมัติก่อนส่ง</span></div>
        <div className="automation-rule-groups">
          {ruleGroups.map((group) => {
            const rows = rules.filter((rule) => group.types.includes(rule.trigger_type));
            return <div className="rule-group" key={group.key}>
              <h3>{group.label}<span>{rows.filter((rule) => rule.is_active).length}/{rows.length} เปิดใช้งาน</span></h3>
              <div className="rule-group-list">
                {rows.map((rule) => <article className="automation-rule" key={rule.id}>
                  <div><strong>{rule.name}</strong><p>{triggerLabels[rule.trigger_type] ?? rule.trigger_type} · ย้อนหลัง {rule.window_days} วัน</p></div>
                  <div className="approval-actions">
                    <button aria-label={`ตั้งค่า ${rule.name}`} className="rule-settings" onClick={() => void configureRule(rule)}>ตั้งค่า</button>
                    <button aria-pressed={rule.is_active} className={`rule-switch ${rule.is_active ? 'active' : ''}`} onClick={() => void toggleRule(rule)}>{rule.is_active ? 'เปิด' : 'ปิด'}</button>
                  </div>
                </article>)}
                {!rows.length ? <p className="rule-empty">ยังไม่มีกฎในหมวดนี้</p> : null}
              </div>
            </div>;
          })}
          {!rules.length && !busy ? <div className="empty-state">ยังไม่มีกฎ กด “ติดตั้งกฎมาตรฐาน” เพื่อเริ่มต้น</div> : null}
        </div>
      </section>

      <section className="content-card signals-panel">
        <div className="section-heading"><div><h2><Eye size={18} /> นักเรียนที่ต้องดูแล</h2><p>เรียงตามความเร่งด่วน พร้อมเหตุผลที่ตรวจสอบได้</p></div><span className="section-count">{openSignals.length} คน</span></div>
        <div className="responsive-table"><table><thead><tr><th>นักเรียน</th><th>มิติ</th><th>ระดับ</th><th>เหตุผลที่ระบบจัดเป็นความเสี่ยง</th><th>สถานะ</th></tr></thead>
          <tbody>{signals.slice(0, 10).map((signal) => {
            const student = studentMap.get(signal.student_id);
            return <tr key={signal.id}><td><strong>{student ? `${student.first_name} ${student.last_name}` : signal.student_id}</strong><small>{student?.student_code}</small></td>
              <td>{triggerLabels[signal.signal_type] ?? signal.signal_type}</td><td><span className={`risk-pill ${signal.severity}`}>{signal.risk_score}%</span></td>
              <td>{signal.reason}</td><td>{signal.status}</td></tr>;
          })}</tbody></table>{!signals.length ? <div className="empty-state">ยังไม่มีสัญญาณ กด “ประเมินตอนนี้” เพื่อวิเคราะห์ข้อมูลจริง</div> : null}</div>
      </section>

      <section className="content-card approvals-panel">
        <div className="section-heading"><div><h2><MessageSquareText size={18} /> ข้อความรออนุมัติ</h2><p>ตรวจผู้รับ ช่องทาง และเนื้อหาก่อนส่งจริง</p></div><span className="section-count">{pendingMessages.length} รายการ</span></div>
        <div className="approval-list">{queue.slice(0, 8).map((item) => (
          <article className="approval-item" key={item.id}><div><div className="approval-meta"><span className={`status-pill ${item.status}`}>{item.status}</span><span>{item.recipient_name ?? 'ยังไม่ผูกผู้รับ'}</span><span>{item.channels.join(', ')}</span></div><h3>{item.title}</h3><p>{item.body}</p><small>เหตุผล: {item.reason}</small></div>
            <div className="approval-actions">
              {item.status === 'pending' ? <><button className="icon-button success" onClick={() => void reviewMessage(item, 'approved')}><CheckCircle2 size={17} /> อนุมัติ</button><button className="icon-button danger" onClick={() => void reviewMessage(item, 'rejected')}><XCircle size={17} /> ปฏิเสธ</button></> : null}
              {item.status === 'approved' ? <button className="button button-primary" onClick={() => void sendApproved(item)}><Send size={17} /> ส่งข้อความ</button> : null}
            </div></article>
        ))}{!queue.length ? <div className="empty-state">ยังไม่มีข้อความรออนุมัติ</div> : null}</div>
      </section>

      <section className="content-card workbench-panel">
        <div className="section-heading"><div><h2><FileSpreadsheet size={18} /> เครื่องมือทำงานด่วน</h2><p>ทางลัดที่ครูใช้บ่อย แยกตามประเภทงาน</p></div></div>
        <div className="quick-work-groups">
          <div><h3>บันทึกข้อมูล</h3><Link to="/app/dashboard?view=teacher-work">เช็กชื่อแบบมาทั้งหมด</Link><Link to="/app/dashboard?view=scores">วางคะแนนจาก Excel</Link><Link to="/app/dashboard?view=behavior">บันทึกพฤติกรรม</Link></div>
          <div><h3>จัดการนักเรียน</h3><Link to="/app/dashboard?view=students">จัดการนักเรียนหลายคน</Link><Link to="/app/dashboard?view=students&studentView=care">เปิดรายการติดตาม</Link><Link to="/app/dashboard?view=students&studentView=home-visit">ติดตามการเยี่ยมบ้าน</Link></div>
          <div><h3>เอกสารและรายงาน</h3><Link to="/app/dashboard?view=reports&reportView=attendance">สร้าง PDF / Excel</Link>{reportTemplates.slice(0, 3).map((name) => <span key={name}>{name}</span>)}</div>
        </div>
      </section>
    </main>
  );
}
