import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Eye, FileSpreadsheet,
  MessageSquareText, Play, Send, ShieldCheck, Sparkles, XCircle,
  Sliders, Settings2, Bell, Clock, Search, Filter, RefreshCw,
  ChevronRight, User, ShieldAlert, ArrowRight, Activity, Zap,
  ExternalLink, Calendar, Check, X, BookOpen, HeartPulse,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { isDemoSession } from '../../lib/auth';
import { hasWorkspaceCapability } from '../../lib/roles';
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
  attendance_absence: 'เวลาเรียน / ขาดเรียน',
  attendance_today: 'ขาดเรียนวันนี้',
  low_score: 'ผลการเรียน / คะแนน',
  negative_behavior: 'พฤติกรรมสะสม',
  savings_anomaly: 'เงินออมผิดปกติ',
  home_visit_incomplete: 'แบบเยี่ยมบ้าน',
};

const triggerBadgeColor: Record<string, { bg: string; text: string; border: string }> = {
  attendance_absence: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  attendance_today: { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
  low_score: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  negative_behavior: { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  savings_anomaly: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  home_visit_incomplete: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
};

function getRuleThresholdDisplay(rule: RuleRow): string {
  if (rule.trigger_type === 'home_visit_incomplete') {
    return rule.config?.deadline ? `ส่งภายใน ${String(rule.config.deadline)}` : 'ยังไม่ได้กำหนดวันสิ้นสุด';
  }
  if (rule.trigger_type === 'attendance_today') {
    return 'บันทึกขาดเรียนในวันปัจจุบัน';
  }
  if (rule.trigger_type === 'low_score') {
    return `คะแนนเฉลี่ย < ${rule.threshold}% (ย้อนหลัง ${rule.window_days} วัน)`;
  }
  if (rule.trigger_type === 'attendance_absence') {
    return `ขาดเรียน ≥ ${rule.threshold} ครั้ง (ย้อนหลัง ${rule.window_days} วัน)`;
  }
  if (rule.trigger_type === 'negative_behavior') {
    return `พฤติกรรมสะสม ≥ ${rule.threshold} ครั้ง (ย้อนหลัง ${rule.window_days} วัน)`;
  }
  return `เกณฑ์ ≥ ${rule.threshold} (ย้อนหลัง ${rule.window_days} วัน)`;
}

export function AutomationCenterPage({ session }: AutomationCenterPageProps) {
  const feedback = useSystemFeedback();
  const workspaceId = session.workspace?.id ?? '';
  const demoMode = isDemoSession(session);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(demoMode ? 'โหมดตัวอย่าง: แสดงโครงสร้าง Automation โดยไม่เขียนข้อมูลจริง' : '');
  
  // Interactive Filter & Search States
  const [signalFilter, setSignalFilter] = useState<string>('all');
  const [searchStudent, setSearchStudent] = useState('');
  const [queueTab, setQueueTab] = useState<'pending' | 'all'>('pending');

  // Modal State for Rule Configuration
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [editThreshold, setEditThreshold] = useState<number>(0);
  const [editWindowDays, setEditWindowDays] = useState<number>(7);
  const [editDeadline, setEditDeadline] = useState<string>('');
  const [isSavingRule, setIsSavingRule] = useState(false);

  const canManageRules = hasWorkspaceCapability(session, 'automation.manage');
  const canPrepareMessages = hasWorkspaceCapability(session, 'communications.prepare');
  const canApproveMessages = hasWorkspaceCapability(session, 'communications.approve');

  const load = useCallback(async () => {
    if (!workspaceId || !isSupabaseReady || !supabase || demoMode) return;
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
  }, [demoMode, workspaceId]);

  useEffect(() => { void load(); }, [load]);
  const studentMap = useMemo(() => new Map(students.map((row) => [row.id, row])), [students]);
  
  const openSignals = useMemo(() => signals.filter((row) => row.status === 'open'), [signals]);
  const pendingMessages = useMemo(() => queue.filter((row) => row.status === 'pending'), [queue]);
  const sentCount = useMemo(() => queue.filter((row) => row.status === 'sent').length, [queue]);
  const activeRulesCount = useMemo(() => rules.filter((r) => r.is_active).length, [rules]);

  // Filtered signals based on selected pill & search query
  const filteredSignals = useMemo(() => {
    return openSignals.filter((signal) => {
      const matchType = signalFilter === 'all' || signal.signal_type === signalFilter;
      if (!matchType) return false;
      if (!searchStudent.trim()) return true;
      const student = studentMap.get(signal.student_id);
      const query = searchStudent.toLowerCase().trim();
      const name = student ? `${student.first_name} ${student.last_name}`.toLowerCase() : '';
      const code = student?.student_code?.toLowerCase() ?? '';
      return name.includes(query) || code.includes(query) || signal.reason.toLowerCase().includes(query);
    });
  }, [openSignals, signalFilter, searchStudent, studentMap]);

  // Filtered queue based on tab
  const displayedQueue = useMemo(() => {
    if (queueTab === 'pending') return pendingMessages;
    return queue;
  }, [queue, queueTab, pendingMessages]);

  const ruleGroups = [
    {
      key: 'learning',
      label: 'การเรียนและเวลาเรียน',
      icon: <BookOpen size={16} className="text-blue-500" />,
      types: ['attendance_absence', 'low_score'],
      description: 'ตรวจจับการขาดเรียนซ้ำ และผลคะแนนการเรียนรู้ที่ลดลงอย่างมีนัยสำคัญ',
    },
    {
      key: 'care',
      label: 'การดูแลช่วยเหลือและพฤติกรรม',
      icon: <HeartPulse size={16} className="text-rose-500" />,
      types: ['negative_behavior', 'savings_anomaly', 'home_visit_incomplete'],
      description: 'เฝ้าระวังพฤติกรรม ความพร้อมในครอบครัว และการบันทึกเยี่ยมบ้าน',
    },
    {
      key: 'communication',
      label: 'การสื่อสารและแจ้งเตือนผู้ปกครอง',
      icon: <Bell size={16} className="text-amber-500" />,
      types: ['attendance_today'],
      description: 'ส่งข้อความเตือนไปยังผู้ปกครองทันทีเมื่อพบการขาดเรียนหรือความเร่งด่วน',
    },
  ];

  async function seedRules() {
    if (!supabase || !canManageRules || isDemoSession(session)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('seed_default_automation_rules', { target_workspace_id: workspaceId });
    if (error) feedback.error({ title: 'ตั้งค่ากฎไม่สำเร็จ', message: error.message });
    else feedback.success({ title: 'พร้อมใช้งาน', message: `เพิ่มกฎมาตรฐาน ${data ?? 0} กฎ` });
    await load();
  }

  async function evaluate() {
    if (!supabase || !canManageRules || isDemoSession(session)) return;
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
    if (!supabase || !canManageRules || isDemoSession(session)) return;
    const nextState = !rule.is_active;
    const { error } = await supabase.from('automation_rules').update({ is_active: nextState }).eq('id', rule.id).eq('workspace_id', workspaceId);
    if (error) feedback.error({ title: 'เปลี่ยนสถานะกฎไม่สำเร็จ', message: error.message });
    else {
      feedback.success({
        title: nextState ? 'เปิดใช้งานกฎแล้ว' : 'ปิดใช้งานกฎแล้ว',
        message: rule.name,
      });
      await load();
    }
  }

  function openRuleModal(rule: RuleRow) {
    setEditingRule(rule);
    setEditThreshold(rule.threshold);
    setEditWindowDays(rule.window_days);
    setEditDeadline(String(rule.config?.deadline ?? ''));
  }

  async function handleSaveRule() {
    if (!editingRule || !supabase || !canManageRules || isDemoSession(session)) return;
    setIsSavingRule(true);

    if (editingRule.trigger_type === 'home_visit_incomplete') {
      const { error } = await supabase.from('automation_rules').update({
        config: { ...editingRule.config, deadline: editDeadline.trim() || null },
      }).eq('id', editingRule.id).eq('workspace_id', workspaceId);
      setIsSavingRule(false);
      if (error) feedback.error({ title: 'บันทึกกำหนดส่งไม่สำเร็จ', message: error.message });
      else {
        feedback.success({ title: 'บันทึกสำเร็จ', message: `กำหนดส่งแบบเยี่ยมบ้าน: ${editDeadline || 'ไม่ระบุ'}` });
        setEditingRule(null);
        await load();
      }
      return;
    }

    if (!Number.isFinite(editThreshold) || editThreshold < 0 || !Number.isInteger(editWindowDays) || editWindowDays < 1 || editWindowDays > 365) {
      setIsSavingRule(false);
      feedback.warning({ title: 'ค่ากฎไม่ถูกต้อง', message: 'เกณฑ์ต้องเป็นตัวเลข และจำนวนวันต้องอยู่ระหว่าง 1–365' });
      return;
    }

    const { error } = await supabase.from('automation_rules').update({
      threshold: editThreshold,
      window_days: editWindowDays,
    }).eq('id', editingRule.id).eq('workspace_id', workspaceId);
    setIsSavingRule(false);
    if (error) feedback.error({ title: 'บันทึกกฎไม่สำเร็จ', message: error.message });
    else {
      feedback.success({ title: 'บันทึกกฎสำเร็จ', message: `${editingRule.name} อัปเดตแล้ว` });
      setEditingRule(null);
      await load();
    }
  }

  async function reviewMessage(item: QueueRow, status: 'approved' | 'rejected') {
    if (!supabase || !canApproveMessages || isDemoSession(session)) return;
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
    if (!supabase || !canPrepareMessages || isDemoSession(session)) return;
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
      {/* 1. Executive Dark Navy Header */}
      <header className="automation-header-card">
        <div className="automation-header-info">
          <div className="automation-status-badge">
            <span className="live-radar-dot"></span>
            <span>ระบบเฝ้าระวังอัตโนมัติ (Early Warning Engine) • ตรวจจับ 24/7</span>
            <span className="automation-badge-sep">•</span>
            <span className="automation-school-tag">{session.workspace?.name ?? 'ClassCare 360'}</span>
          </div>
          <h1>ระบบช่วยติดตาม & แจ้งเตือนนักเรียนเชิงรุก</h1>
          <p>
            ตรวจจับความเสี่ยงรอบด้าน (เวลาเรียน • ผลการเรียน • พฤติกรรม • เยี่ยมบ้าน)
            พร้อมระบบกลั่นกรองและอนุมัติก่อนสื่อสารกับผู้ปกครอง
          </p>
        </div>

        <div className="automation-header-actions">
          <button
            className="auto-btn auto-btn-secondary"
            disabled={busy || !canManageRules || demoMode}
            onClick={() => void seedRules()}
            title="รีเซ็ตและติดตั้ง 6 กฎมาตรฐานของ สพฐ."
          >
            <Sparkles size={16} />
            <span>ติดตั้งกฎมาตรฐาน</span>
          </button>
          <button
            className="auto-btn auto-btn-primary"
            disabled={busy || !canManageRules || demoMode}
            onClick={() => void evaluate()}
          >
            {busy ? (
              <NexusAuroraInline label="กำลังประเมิน..." />
            ) : (
              <>
                <Zap size={16} className="fill-current" />
                <span>ประเมินความเสี่ยงตอนนี้</span>
              </>
            )}
          </button>
        </div>
      </header>

      {notice ? (
        <div className="status-banner warning">
          <AlertTriangle size={18} />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* 2. Modern 4-Card KPI Overview */}
      <section className="automation-kpi-grid">
        <article className="auto-kpi-card kpi-indigo">
          <div className="auto-kpi-header">
            <span className="auto-kpi-icon"><ShieldCheck size={22} /></span>
            <span className="auto-kpi-tag success">ระบบพร้อม</span>
          </div>
          <div className="auto-kpi-body">
            <div className="auto-kpi-value">{activeRulesCount} <small>/ {rules.length}</small></div>
            <div className="auto-kpi-label">กฎกำลังเฝ้าระวัง</div>
          </div>
          <div className="auto-kpi-footer">เฝ้าระวังครอบคลุม 3 มิติหลัก</div>
        </article>

        <article className={`auto-kpi-card ${openSignals.length > 0 ? 'kpi-rose' : 'kpi-emerald'}`}>
          <div className="auto-kpi-header">
            <span className="auto-kpi-icon"><AlertTriangle size={22} /></span>
            <span className={`auto-kpi-tag ${openSignals.length > 0 ? 'danger' : 'safe'}`}>
              {openSignals.length > 0 ? 'ต้องดูแลเร่งด่วน' : 'ปกติ ทุกคนปลอดภัย'}
            </span>
          </div>
          <div className="auto-kpi-body">
            <div className="auto-kpi-value">{openSignals.length} <small>คน</small></div>
            <div className="auto-kpi-label">สัญญาณความเสี่ยงที่พบ</div>
          </div>
          <div className="auto-kpi-footer">
            {openSignals.length > 0 ? 'ควรดำเนินการช่วยเหลือทันที' : 'ไม่พบนักเรียนกลุ่มเสี่ยงวิกฤต'}
          </div>
        </article>

        <article className="auto-kpi-card kpi-cyan">
          <div className="auto-kpi-header">
            <span className="auto-kpi-icon"><MessageSquareText size={22} /></span>
            <span className="auto-kpi-tag info">Guardrail</span>
          </div>
          <div className="auto-kpi-body">
            <div className="auto-kpi-value">{pendingMessages.length} <small>ฉบับ</small></div>
            <div className="auto-kpi-label">ข้อความรอครูอนุมัติ</div>
          </div>
          <div className="auto-kpi-footer">ระบบปลอดภัย ครูตรวจสอบก่อนส่งจริง</div>
        </article>

        <article className="auto-kpi-card kpi-emerald">
          <div className="auto-kpi-header">
            <span className="auto-kpi-icon"><Send size={22} /></span>
            <span className="auto-kpi-tag safe">สำเร็จ</span>
          </div>
          <div className="auto-kpi-body">
            <div className="auto-kpi-value">{sentCount} <small>รายการ</small></div>
            <div className="auto-kpi-label">ส่งแจ้งเตือนสำเร็จ</div>
          </div>
          <div className="auto-kpi-footer">จัดส่งผ่าน Portal, SMS และ LINE</div>
        </article>
      </section>

      {/* 3. Main Workflow Grid (2 Columns: Signals & Approvals) */}
      <div className="automation-two-col">
        {/* Left Column: นักเรียนที่ต้องดูแลเชิงรุก */}
        <section className="content-card signals-card">
          <div className="card-top-header">
            <div>
              <div className="card-title-group">
                <h2><Eye size={20} className="text-cyan-500" /> นักเรียนที่ต้องดูแลเชิงรุก</h2>
                <span className="count-pill danger">{openSignals.length} คน</span>
              </div>
              <p className="card-subtitle">เรียงลำดับตามความเร่งด่วน พร้อมวิเคราะห์สาเหตุและหลักฐานอ้างอิง</p>
            </div>
          </div>

          {/* Filter Pills & Student Search */}
          <div className="signals-filter-toolbar">
            <div className="filter-pill-list">
              <button
                className={`filter-pill-btn ${signalFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSignalFilter('all')}
              >
                ทั้งหมด ({openSignals.length})
              </button>
              <button
                className={`filter-pill-btn ${signalFilter === 'attendance_absence' ? 'active' : ''}`}
                onClick={() => setSignalFilter('attendance_absence')}
              >
                เวลาเรียน
              </button>
              <button
                className={`filter-pill-btn ${signalFilter === 'low_score' ? 'active' : ''}`}
                onClick={() => setSignalFilter('low_score')}
              >
                คะแนนสอบ
              </button>
              <button
                className={`filter-pill-btn ${signalFilter === 'negative_behavior' ? 'active' : ''}`}
                onClick={() => setSignalFilter('negative_behavior')}
              >
                พฤติกรรม
              </button>
              <button
                className={`filter-pill-btn ${signalFilter === 'home_visit_incomplete' ? 'active' : ''}`}
                onClick={() => setSignalFilter('home_visit_incomplete')}
              >
                เยี่ยมบ้าน
              </button>
            </div>

            <div className="signals-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
              />
              {searchStudent ? (
                <button className="search-clear" onClick={() => setSearchStudent('')}><X size={13} /></button>
              ) : null}
            </div>
          </div>

          {/* Table or Empty State */}
          <div className="signals-table-container">
            {filteredSignals.length > 0 ? (
              <table className="signals-table">
                <thead>
                  <tr>
                    <th>นักเรียน</th>
                    <th>มิติความเสี่ยง</th>
                    <th>ระดับคะแนนเสี่ยง</th>
                    <th>สาเหตุที่ตรวจพบ</th>
                    <th>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.map((signal) => {
                    const student = studentMap.get(signal.student_id);
                    const badge = triggerBadgeColor[signal.signal_type] ?? { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
                    const isHigh = signal.risk_score >= 80;
                    const isMed = signal.risk_score >= 50 && signal.risk_score < 80;

                    return (
                      <tr key={signal.id}>
                        <td>
                          <div className="student-profile-cell">
                            <div className="student-avatar-circle">
                              {student ? student.first_name.slice(0, 1) : 'S'}
                            </div>
                            <div>
                              <strong>{student ? `${student.first_name} ${student.last_name}` : signal.student_id}</strong>
                              <span className="student-code-text">{student?.student_code || 'ไม่มีรหัส'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className="signal-type-tag"
                            style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
                          >
                            {triggerLabels[signal.signal_type] ?? signal.signal_type}
                          </span>
                        </td>
                        <td>
                          <div className="risk-score-wrapper">
                            <span className={`risk-level-badge ${isHigh ? 'critical' : isMed ? 'medium' : 'low'}`}>
                              {isHigh ? 'วิกฤต' : isMed ? 'เฝ้าระวัง' : 'เตือน'} {signal.risk_score}%
                            </span>
                            <div className="risk-bar-track">
                              <div
                                className={`risk-bar-fill ${isHigh ? 'critical' : isMed ? 'medium' : 'low'}`}
                                style={{ width: `${Math.min(100, Math.max(15, signal.risk_score))}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="reason-cell">
                          <p title={signal.reason}>{signal.reason}</p>
                        </td>
                        <td>
                          <Link
                            to="/app/dashboard?view=students&studentView=care"
                            className="signal-action-btn"
                          >
                            <span>ดูแล</span>
                            <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="auto-empty-state">
                <div className="empty-icon-shield">
                  <ShieldCheck size={38} className="text-emerald-500" />
                </div>
                <h3>{searchStudent || signalFilter !== 'all' ? 'ไม่พบนักเรียนตามเงื่อนไขที่ค้นหา' : 'ไม่พบสัญญาณความเสี่ยงในชั้นเรียนนี้'}</h3>
                <p>
                  {searchStudent || signalFilter !== 'all'
                    ? 'ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองเป็น "ทั้งหมด"'
                    : 'ข้อมูลการเข้าเรียน ผลการเรียน และพฤติกรรมของนักเรียนทุกคนอยู่ในเกณฑ์ปกติ'}
                </p>
                {!searchStudent && signalFilter === 'all' ? (
                  <button
                    className="auto-btn auto-btn-secondary mt-3"
                    disabled={busy || !canManageRules || demoMode}
                    onClick={() => void evaluate()}
                  >
                    <RefreshCw size={15} className={busy ? 'spin' : ''} />
                    <span>ประเมินข้อมูลล่าสุดอีกครั้ง</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: คิวข้อความรอตรวจทานก่อนส่ง */}
        <section className="content-card approvals-card">
          <div className="card-top-header">
            <div>
              <div className="card-title-group">
                <h2><MessageSquareText size={20} className="text-amber-500" /> คิวข้อความรออนุมัติ</h2>
                <span className="count-pill warning">{pendingMessages.length} ฉบับ</span>
              </div>
              <p className="card-subtitle">ตรวจผู้รับ ช่องทาง และเนื้อหาก่อนส่งถึงผู้ปกครอง</p>
            </div>
          </div>

          <div className="guardrail-notice-box">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <span><strong>ความปลอดภัย:</strong> ระบบจะไม่ส่งข้อความใดๆ ไปยังผู้ปกครองโดยตรงจนกว่าครูจะกดอนุมัติ</span>
          </div>

          {/* Tabs: รออนุมัติ vs ทั้งหมด */}
          <div className="queue-tabs-bar">
            <button
              className={`queue-tab-btn ${queueTab === 'pending' ? 'active' : ''}`}
              onClick={() => setQueueTab('pending')}
            >
              รออนุมัติ ({pendingMessages.length})
            </button>
            <button
              className={`queue-tab-btn ${queueTab === 'all' ? 'active' : ''}`}
              onClick={() => setQueueTab('all')}
            >
              ประวัติทั้งหมด ({queue.length})
            </button>
          </div>

          {/* Approval List */}
          <div className="approval-feed">
            {displayedQueue.length > 0 ? (
              displayedQueue.slice(0, 8).map((item) => (
                <article className="approval-card-item" key={item.id}>
                  <div className="approval-card-header">
                    <div className="recipient-info">
                      <User size={14} className="text-slate-400" />
                      <strong>{item.recipient_name ?? 'ผู้ปกครองนักเรียน'}</strong>
                      {item.channels && item.channels.length > 0 ? (
                        <div className="channel-tags-list">
                          {item.channels.map((ch) => (
                            <span key={ch} className="channel-tag">{ch.toUpperCase()}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className={`approval-status-tag ${item.status}`}>
                      {item.status === 'pending' ? 'รออนุมัติ' : item.status === 'approved' ? 'อนุมัติแล้ว' : item.status === 'sent' ? 'ส่งแล้ว' : 'ปฏิเสธ'}
                    </span>
                  </div>

                  <h3 className="approval-msg-title">{item.title}</h3>
                  <div className="approval-quote-bubble">
                    <p>{item.body}</p>
                  </div>
                  <div className="approval-reason-meta">
                    <span>💡 เหตุผล: {item.reason}</span>
                  </div>

                  {/* Actions */}
                  <div className="approval-button-row">
                    {item.status === 'pending' && canApproveMessages ? (
                      <>
                        <button
                          className="auto-action-btn reject"
                          onClick={() => void reviewMessage(item, 'rejected')}
                          title="ปฏิเสธ ไม่ส่งข้อความนี้"
                        >
                          <XCircle size={15} />
                          <span>ไม่อนุมัติ</span>
                        </button>
                        <button
                          className="auto-action-btn approve"
                          onClick={() => void reviewMessage(item, 'approved')}
                          title="อนุมัติเพื่อส่งให้ผู้ปกครอง"
                        >
                          <CheckCircle2 size={15} />
                          <span>อนุมัติข้อความ</span>
                        </button>
                      </>
                    ) : null}

                    {item.status === 'approved' && canPrepareMessages ? (
                      <button
                        className="auto-btn auto-btn-primary w-full"
                        onClick={() => void sendApproved(item)}
                      >
                        <Send size={15} />
                        <span>จัดส่งข้อความทันที</span>
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="auto-empty-state">
                <div className="empty-icon-shield">
                  <CheckCircle2 size={36} className="text-emerald-500" />
                </div>
                <h3>ไม่มีข้อความค้างรออนุมัติ</h3>
                <p>เมื่อระบบตรวจพบความเสี่ยง จะจัดทำร่างข้อความแจ้งเตือนมาให้ครูพิจารณาที่นี่</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 4. Automation Rules Deck (3 Categories) */}
      <section className="content-card rules-card">
        <div className="card-top-header">
          <div>
            <div className="card-title-group">
              <h2><Sliders size={20} className="text-indigo-500" /> กฎการตรวจจับอัตโนมัติ (Early Warning Rules)</h2>
              <span className="count-pill info">{activeRulesCount} จาก {rules.length} เปิดใช้งาน</span>
            </div>
            <p className="card-subtitle">
              กำหนดเงื่อนไขการแจ้งเตือนตามบริบทของโรงเรียน ปรับเปลี่ยนเกณฑ์และช่วงวันย้อนหลังได้ตลอดเวลา
            </p>
          </div>
          <span className="human-loop-pill">
            <ShieldCheck size={15} />
            <span>ครูอนุมัติก่อนส่งเสมอ</span>
          </span>
        </div>

        <div className="rules-deck-grid">
          {ruleGroups.map((group) => {
            const rows = rules.filter((rule) => group.types.includes(rule.trigger_type));
            const groupActiveCount = rows.filter((r) => r.is_active).length;

            return (
              <div className="rule-column-deck" key={group.key}>
                <div className="deck-header">
                  <div className="deck-title-area">
                    {group.icon}
                    <h3>{group.label}</h3>
                  </div>
                  <span className="deck-count-badge">
                    {groupActiveCount}/{rows.length} เปิด
                  </span>
                </div>
                <p className="deck-desc">{group.description}</p>

                <div className="deck-rule-list">
                  {rows.map((rule) => (
                    <article className={`rule-tile-card ${rule.is_active ? 'active' : 'inactive'}`} key={rule.id}>
                      <div className="rule-tile-content">
                        <div className="rule-tile-title-row">
                          <h4>{rule.name}</h4>
                          <span className={`rule-status-dot ${rule.is_active ? 'active' : ''}`}></span>
                        </div>
                        <div className="rule-threshold-pill">
                          <Clock size={12} className="shrink-0" />
                          <span>{getRuleThresholdDisplay(rule)}</span>
                        </div>
                      </div>

                      <div className="rule-tile-actions">
                        <button
                          className="rule-config-btn"
                          disabled={!canManageRules}
                          onClick={() => openRuleModal(rule)}
                          title="ปรับแต่งเกณฑ์และจำนวนวัน"
                        >
                          <Settings2 size={14} />
                          <span>ตั้งค่า</span>
                        </button>
                        <button
                          aria-pressed={rule.is_active}
                          className={`rule-toggle-switch ${rule.is_active ? 'active' : ''}`}
                          disabled={!canManageRules}
                          onClick={() => void toggleRule(rule)}
                          title={rule.is_active ? 'คลิกเพื่อปิดกฎ' : 'คลิกเพื่อเปิดกฎ'}
                        >
                          <span className="toggle-thumb"></span>
                        </button>
                      </div>
                    </article>
                  ))}
                  {!rows.length ? <p className="rule-empty-text">ยังไม่มีกฎในหมวดหมู่นี้</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Quick Workbench Shortcuts */}
      <section className="content-card workbench-card">
        <div className="card-top-header">
          <div>
            <div className="card-title-group">
              <h2><FileSpreadsheet size={20} className="text-emerald-500" /> ทางลัดการทำงานสำหรับครู (Daily Teacher Shortcuts)</h2>
            </div>
            <p className="card-subtitle">เข้าถึงเมนูบันทึกข้อมูลและออกเอกสารสำคัญของระบบได้อย่างรวดเร็ว</p>
          </div>
        </div>

        <div className="workbench-grid-cards">
          <div className="workbench-group-box">
            <div className="wb-box-header">
              <Clock size={16} className="text-blue-500" />
              <h3>บันทึกข้อมูลประจำวัน</h3>
            </div>
            <div className="wb-link-list">
              <Link to="/app/dashboard?view=teacher-work" className="wb-link-item">
                <span>เช็กชื่อมาเรียนแบบเร็ว (มาทั้งหมด)</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/dashboard?view=scores" className="wb-link-item">
                <span>วางคะแนนสอบจาก Excel</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/dashboard?view=behavior" className="wb-link-item">
                <span>บันทึกคะแนนพฤติกรรม</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="workbench-group-box">
            <div className="wb-box-header">
              <User size={16} className="text-rose-500" />
              <h3>ระบบดูแลช่วยเหลือนักเรียน</h3>
            </div>
            <div className="wb-link-list">
              <Link to="/app/dashboard?view=students" className="wb-link-item">
                <span>จัดการข้อมูลนักเรียนหลายคน</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/dashboard?view=students&studentView=care" className="wb-link-item">
                <span>เปิดรายการติดตามความเสี่ยง</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/dashboard?view=students&studentView=home-visit" className="wb-link-item">
                <span>ติดตามการเยี่ยมบ้านและภาพถ่าย</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="workbench-group-box">
            <div className="wb-box-header">
              <FileSpreadsheet size={16} className="text-emerald-500" />
              <h3>เอกสารและรายงานทางการศึกษา</h3>
            </div>
            <div className="wb-link-list">
              <Link to="/app/dashboard?view=reports&reportView=attendance" className="wb-link-item">
                <span>ส่งออกรายงานเวลาเรียน (Excel / PDF)</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/dashboard?view=academic-hub" className="wb-link-item">
                <span>สรุปผลการเรียนและพิมพ์แบบ ปพ.</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/app/dashboard?view=reports" className="wb-link-item">
                <span>หนังสือแจ้งผู้ปกครองและรายงานฝ่ายบริหาร</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Rule Configuration Modal */}
      {editingRule ? (
        <div className="rule-modal-backdrop" onClick={() => setEditingRule(null)}>
          <div className="rule-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="rule-modal-header">
              <div>
                <span className="rule-modal-subtitle">ตั้งค่าเงื่อนไขการตรวจจับ</span>
                <h2>{editingRule.name}</h2>
              </div>
              <button
                className="rule-modal-close"
                onClick={() => setEditingRule(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rule-modal-body">
              <div className="modal-info-alert">
                <ShieldAlert size={18} className="shrink-0 text-blue-500" />
                <p>
                  ประเภทการตรวจจับ: <strong>{triggerLabels[editingRule.trigger_type] ?? editingRule.trigger_type}</strong>
                  <br />
                  ระบบจะประมวลผลข้อมูลและตรวจหานักเรียนที่มีแนวโน้มตรงตามเงื่อนไขนี้เพื่อแจ้งเตือน
                </p>
              </div>

              {editingRule.trigger_type === 'home_visit_incomplete' ? (
                <div className="form-field-group">
                  <label>กำหนดวันสิ้นสุดการส่งแบบเยี่ยมบ้าน (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="modal-input"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                  />
                  <small className="field-hint">หากเลยวันที่นี้แล้วนักเรียนยังไม่มีบันทึกเยี่ยมบ้าน ระบบจะเตือนทันที</small>
                </div>
              ) : (
                <>
                  <div className="form-field-group">
                    <label>
                      {editingRule.trigger_type === 'low_score'
                        ? 'เกณฑ์คะแนนเฉลี่ยขั้นต่ำ (%)'
                        : editingRule.trigger_type === 'negative_behavior'
                        ? 'เกณฑ์คะแนนพฤติกรรมสะสม (คะแนน)'
                        : 'เกณฑ์จำนวนครั้ง (Threshold)'}
                    </label>
                    <input
                      type="number"
                      className="modal-input"
                      min="0"
                      max="1000"
                      value={editThreshold}
                      onChange={(e) => setEditThreshold(Number(e.target.value))}
                    />
                    <small className="field-hint">
                      {editingRule.trigger_type === 'low_score'
                        ? 'หากคะแนนเฉลี่ยของนักเรียนต่ำกว่าค่านี้ จะถูกจัดเป็นกลุ่มเสี่ยง'
                        : 'เมื่อนักเรียนมีรายการสะสมเกินหรือเท่ากับเกณฑ์นี้ ระบบจะสร้างสัญญาณความเสี่ยง'}
                    </small>
                  </div>

                  <div className="form-field-group">
                    <label>ระยะเวลาประเมินย้อนหลัง (จำนวนวัน)</label>
                    <input
                      type="number"
                      className="modal-input"
                      min="1"
                      max="365"
                      value={editWindowDays}
                      onChange={(e) => setEditWindowDays(Number(e.target.value))}
                    />
                    <small className="field-hint">กรอบเวลาย้อนหลังที่นำข้อมูลมาคำนวณ (1 - 365 วัน)</small>
                  </div>
                </>
              )}

              <div className="modal-preview-box">
                <span className="preview-tag">ตัวอย่างเงื่อนไข</span>
                <p>
                  {editingRule.trigger_type === 'home_visit_incomplete'
                    ? `ระบบจะแจ้งเตือนนักเรียนที่ยังไม่ได้ส่งแบบเยี่ยมบ้านเมื่อเลยกำหนด ${editDeadline || '(ยังไม่ได้ระบุวัน)'}`
                    : `ระบบจะตรวจจับนักเรียนที่มีค่าเข้าเกณฑ์ ${editThreshold} ภายในช่วงเวลาย้อนหลัง ${editWindowDays} วัน`}
                </p>
              </div>
            </div>

            <div className="rule-modal-footer">
              <button
                className="auto-btn auto-btn-secondary"
                disabled={isSavingRule}
                onClick={() => setEditingRule(null)}
              >
                ยกเลิก
              </button>
              <button
                className="auto-btn auto-btn-primary"
                disabled={isSavingRule}
                onClick={() => void handleSaveRule()}
              >
                {isSavingRule ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
