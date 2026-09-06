import { supabase, isSupabaseReady } from './supabaseClient';
import type { AppSessionContext } from '../types/core';
import {
  buildSchedulePeriods,
  loadScheduleSettings,
  makeScheduleCellKey,
  type ScheduleSettings,
} from './scheduleSettings';

/**
 * Compiles comprehensive real-time 7-dimension school context directly from Supabase
 * to ground Carey AI in actual factual database records, enabling teachers to ask
 * any question across all ClassCare 360 features without hallucinations.
 */
export async function fetchLiveSchoolDataContext(
  session: AppSessionContext | null | undefined,
  activeView: string = 'dashboard'
): Promise<string> {
  if (!session?.workspace?.id || !isSupabaseReady || !supabase) {
    return `[บริบทปัจจุบัน: คุณครูกำลังเปิดหน้า '${activeView}' ห้องเรียน: '${session?.workspace?.classroomName || 'ไม่ได้เลือก'}' ปีการศึกษา: '${session?.workspace?.academicYear || '2569'}']\n(หมายเหตุ: ระบบทำงานในโหมดออฟไลน์หรือยังไม่ได้เชื่อมต่อฐานข้อมูล)`;
  }

  const workspaceId = session.workspace.id;
  const currentClassroomName = session.workspace.classroomName || 'ห้องเรียนปัจจุบัน';
  const academicYear = session.workspace.academicYear || '2569';
  const schoolName = session.workspace.schoolName || session.workspace.name || 'โรงเรียน';
  const workspaceTitle = session.workspace.name || '';

  try {
    // Parallel fetch across all school management dimensions
    const [
      { data: classrooms },
      { data: students },
      { data: guardians },
      { data: attendanceRecords },
      { data: behaviorRecords },
      { data: healthRecords },
      { data: scoreAssessments },
      { data: scoreEntries },
      { data: desirableRecords },
      { data: dutyTasks },
      { data: dutyAssignments },
      { data: savingsAccounts },
      { data: calendarDays },
      { data: careCases },
      { data: homeVisits },
      { data: earlyWarnings },
      { data: dailyBriefs },
      { data: periodLocks },
    ] = await Promise.all([
      // 1. Classrooms
      supabase
        .from('classrooms')
        .select('id, name, grade_level, academic_year')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('name', { ascending: true }),

      // 1.1 Students
      supabase
        .from('students')
        .select('id, student_code, first_name, last_name, nickname, gender, classroom_id, health_flags, care_flags')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('student_code', { ascending: true }),

      // 1.2 Guardians
      supabase
        .from('student_guardians')
        .select('student_id, display_name, relation, phone')
        .eq('workspace_id', workspaceId)
        .limit(200),

      // 2. Attendance
      (async () => {
        try {
          // Attempt join with attendance_sessions to get attendance_date & classroom_id
          const { data, error } = await supabase
            .from('attendance_records')
            .select('student_id, status, session_id, created_at, attendance_sessions(attendance_date, classroom_id, period_label)')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(5000);

          if (!error && data) {
            return { data };
          }

          // Fallback to simple select without join if relationship query has schema cache delay
          console.warn('[SchoolContext] attendance join warning, falling back to flat select:', error?.message);
          const fallback = await supabase
            .from('attendance_records')
            .select('student_id, status, session_id, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(5000);

          return { data: fallback.data || [] };
        } catch (e) {
          console.error('[SchoolContext] Attendance fetch exception:', e);
          return { data: [] };
        }
      })(),

      // 3. Behavior
      supabase
        .from('behavior_records')
        .select('student_id, points, tone, category, description, follow_up_status, behavior_date')
        .eq('workspace_id', workspaceId)
        .order('behavior_date', { ascending: false })
        .limit(200),

      // 4. Health
      supabase
        .from('student_health_records')
        .select('student_id, record_type, weight_kg, height_cm, bmi, status, note, record_date')
        .eq('workspace_id', workspaceId)
        .order('record_date', { ascending: false })
        .limit(200),

      // 5.1 Score Assessments
      supabase
        .from('score_assessments')
        .select('id, title, subject_name, max_score, weight, category, classroom_id')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(100),

      // 5.2 Score Entries
      (async () => {
        try {
          const { data, error } = await supabase
            .from('score_entries')
            .select('assessment_id, student_id, score, note')
            .eq('workspace_id', workspaceId)
            .limit(5000);

          if (!error && data && data.length > 0) {
            return { data };
          }

          if (error) {
            console.warn('[SchoolContext] score_entries query warning:', error.message);
          }

          // Fallback query without workspace_id filter if RLS already scopes to current workspace
          const fallback = await supabase
            .from('score_entries')
            .select('assessment_id, student_id, score, note')
            .limit(5000);

          return { data: fallback.data || [] };
        } catch (e) {
          console.error('[SchoolContext] score_entries query exception:', e);
          return { data: [] };
        }
      })(),

      // 5.3 Desirable characteristics 8 traits
      supabase
        .from('student_desirable_records')
        .select('student_id, trait_summary, reading_summary, note')
        .eq('workspace_id', workspaceId)
        .limit(200),

      // 6.1 Duty tasks
      supabase
        .from('duty_tasks')
        .select('id, name, is_active')
        .eq('workspace_id', workspaceId)
        .limit(50),

      // 6.2 Duty assignments
      supabase
        .from('duty_assignments')
        .select('duty_task_id, student_id, duty_date, status')
        .eq('workspace_id', workspaceId)
        .limit(100),

      // 7.1 Savings
      supabase
        .from('savings_accounts')
        .select('student_id, balance, metadata')
        .eq('workspace_id', workspaceId)
        .limit(200),

      // 7.2 Calendar days
      supabase
        .from('school_calendar_days')
        .select('calendar_date, title, day_type, affects_attendance')
        .eq('workspace_id', workspaceId)
        .order('calendar_date', { ascending: true })
        .limit(100),

      // 8. Student Care Cases
      (async () => {
        try {
          const { data } = await supabase
            .from('student_care_cases')
            .select('student_id, case_type, risk_level, status, summary, next_action')
            .eq('workspace_id', workspaceId)
            .limit(50);
          return { data: data || [] };
        } catch {
          return { data: [] };
        }
      })(),

      // 9. Home Visits
      (async () => {
        try {
          const { data } = await supabase
            .from('student_home_visits')
            .select('student_id, status, completion_percent, visited_at, household_income_monthly, distance_km')
            .eq('workspace_id', workspaceId)
            .limit(100);
          return { data: data || [] };
        } catch {
          return { data: [] };
        }
      })(),

      // 10. Early Warning Signals
      (async () => {
        try {
          const { data } = await supabase
            .from('early_warning_signals')
            .select('student_id, signal_type, severity, risk_score, reason, status')
            .eq('workspace_id', workspaceId)
            .eq('status', 'open')
            .limit(50);
          return { data: data || [] };
        } catch {
          return { data: [] };
        }
      })(),

      // 11. Daily School Briefs
      (async () => {
        try {
          const { data } = await supabase
            .from('daily_school_briefs')
            .select('brief_date, report_type, title, summary, highlights, tomorrow_plan, status')
            .eq('workspace_id', workspaceId)
            .order('brief_date', { ascending: false })
            .limit(5);
          return { data: data || [] };
        } catch {
          return { data: [] };
        }
      })(),

      // 12. Period Locks
      (async () => {
        try {
          const { data } = await supabase
            .from('data_period_locks')
            .select('module_key, period_name, is_locked, locked_reason')
            .eq('workspace_id', workspaceId)
            .limit(20);
          return { data: data || [] };
        } catch {
          return { data: [] };
        }
      })(),
    ]);

    // Load timetable schedule settings from local/workspace configuration
    const scheduleSettings = loadScheduleSettings(currentClassroomName, workspaceId);

    const studentList = students || [];
    const classroomList = classrooms || [];

    // Map classroom ID -> name
    const classroomMap = new Map<string, string>();
    classroomList.forEach((c) => classroomMap.set(c.id, c.name));

    // Map student ID -> student object
    const studentMap = new Map<string, (typeof studentList)[0]>();
    studentList.forEach((s) => studentMap.set(s.id, s));

    // Map student ID -> guardians
    const guardianMap = new Map<string, Array<{ name: string; relation: string; phone?: string }>>();
    (guardians || []).forEach((g) => {
      if (!guardianMap.has(g.student_id)) guardianMap.set(g.student_id, []);
      guardianMap.get(g.student_id)!.push({
        name: g.display_name,
        relation: g.relation,
        phone: g.phone || undefined,
      });
    });

    // Group students by classroom
    const studentsByClassroom = new Map<string, typeof studentList>();
    const unassignedStudents: typeof studentList = [];

    studentList.forEach((s) => {
      if (s.classroom_id && classroomMap.has(s.classroom_id)) {
        const cName = classroomMap.get(s.classroom_id)!;
        if (!studentsByClassroom.has(cName)) studentsByClassroom.set(cName, []);
        studentsByClassroom.get(cName)!.push(s);
      } else {
        unassignedStudents.push(s);
      }
    });

    // --- Build Header Context ---
    let context = `=== [ข้อมูลจริงจากฐานข้อมูลระบบ ClassCare 360 (เชื่อมโยง 7 มิติ)] ===\n`;
    context += `• โรงเรียน: ${schoolName}${workspaceTitle && workspaceTitle !== schoolName ? ` (ห้อง/Workspace: ${workspaceTitle})` : ''}\n`;
    context += `• ห้องเรียนที่คุณครูกำลังโฟกัสอยู่ในปัจจุบัน: ${currentClassroomName}\n`;
    context += `• ปีการศึกษาปัจจุบัน: ${academicYear}\n`;
    context += `• เมนูที่คุณครูกำลังเปิดดูอยู่: ${activeView}\n\n`;

    // =========================================================================
    // มิติที่ 1: ข้อมูลห้องเรียนและทะเบียนนักเรียน (Student Roster & Demographics)
    // =========================================================================
    context += `--- [มิติที่ 1: ข้อมูลห้องเรียน ทะเบียนนักเรียน และผู้ปกครอง] ---\n`;
    context += `• จำนวนนักเรียนรวมทั้งโรงเรียน: ${studentList.length} คน จากทั้งหมด ${classroomList.length} ห้องเรียน\n`;

    classroomList.forEach((c) => {
      const roomStudents = studentsByClassroom.get(c.name) || [];
      const boys = roomStudents.filter((s) => s.gender === 'male').length;
      const girls = roomStudents.filter((s) => s.gender === 'female').length;
      const sample = roomStudents
        .slice(0, 35)
        .map((s) => {
          const gInfo = guardianMap.get(s.id)?.[0];
          const gStr = gInfo ? ` [ผู้ปกครอง: ${gInfo.name} (${gInfo.relation}) โทร ${gInfo.phone || '-'}]` : '';
          return `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''} รหัส:${s.student_code || '-'}${gStr}`;
        })
        .join('; ');

      context += `  - ห้อง "${c.name}": มีนักเรียนทั้งหมด ${roomStudents.length} คน (ชาย ${boys} คน, หญิง ${girls} คน)\n`;
      if (roomStudents.length > 0) {
        context += `    รายชื่อนักเรียนในห้อง: ${sample}${roomStudents.length > 35 ? ` และอีก ${roomStudents.length - 35} คน` : ''}\n`;
      }
    });

    if (unassignedStudents.length > 0) {
      context += `  - นักเรียนที่ยังไม่ได้จัดเข้าห้องเรียน: ${unassignedStudents.length} คน\n`;
    }

    // =========================================================================
    // มิติที่ 2: สถิติการมาเรียน & เช็คชื่อ (Attendance & Punctuality)
    // =========================================================================
    let totalPresent = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalAbsent = 0;

    const statsMap = new Map<string, { absent: number; late: number; leave: number; present: number }>();
    ((attendanceRecords as any[]) || []).forEach((rec) => {
      if (!statsMap.has(rec.student_id)) {
        statsMap.set(rec.student_id, { absent: 0, late: 0, leave: 0, present: 0 });
      }
      const st = statsMap.get(rec.student_id)!;
      if (rec.status === 'absent') {
        st.absent++;
        totalAbsent++;
      } else if (rec.status === 'late') {
        st.late++;
        totalLate++;
      } else if (rec.status === 'leave' || rec.status === 'sick') {
        st.leave++;
        totalLeave++;
      } else if (rec.status === 'present' || rec.status === 'activity') {
        st.present++;
        totalPresent++;
      }
    });

    const totalRecords = ((attendanceRecords as any[]) || []).length;

    const absentees = studentList
      .map((s) => {
        const st = statsMap.get(s.id) || { absent: 0, late: 0, leave: 0, present: 0 };
        const cName = s.classroom_id ? classroomMap.get(s.classroom_id) || 'ไม่ระบุห้อง' : 'ไม่ระบุห้อง';
        return {
          id: s.id,
          name: `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''}`,
          classroom: cName,
          classroomId: s.classroom_id,
          code: s.student_code || '-',
          ...st,
        };
      })
      .filter((item) => item.absent > 0 || item.late > 0 || item.leave > 0)
      .sort((a, b) => b.absent - a.absent || b.leave - a.leave);

    const pureAbsentStudents = absentees.filter((item) => item.absent > 0);
    const lateOrLeaveStudents = absentees.filter((item) => item.absent === 0 && (item.late > 0 || item.leave > 0));

    context += `\n--- [มิติที่ 2: สถิติการมาเรียนและการขาดเรียน (ข้อมูลจริงจากฐานข้อมูล)] ---\n`;
    if (totalRecords > 0) {
      context += `• สรุปภาพรวมการเช็คชื่อทั้งหมดในระบบ: บันทึกข้อมูลแล้ว ${totalRecords} รายการ (มาเรียน: ${totalPresent} ครั้ง, ขาดเรียน: ${totalAbsent} ครั้ง, ลา: ${totalLeave} ครั้ง, มาสาย: ${totalLate} ครั้ง)\n`;

      if (pureAbsentStudents.length > 0) {
        context += `• รายชื่อนักเรียนที่มีสถิติขาดเรียน (เรียงตามจำนวนวันที่ขาดมากที่สุด):\n`;
        pureAbsentStudents.slice(0, 20).forEach((item, idx) => {
          context += `  ${idx + 1}. ${item.name} (${item.classroom}) -> ขาดเรียน ${item.absent} วัน, ลา ${item.leave} วัน, มาสาย ${item.late} วัน (มาเรียน ${item.present} วัน)\n`;
        });
        if (pureAbsentStudents.length > 20) {
          context += `  (และมีนักเรียนขาดเรียนอีก ${pureAbsentStudents.length - 20} คน)\n`;
        }
      } else {
        context += `• ไม่มีนักเรียนที่มีประวัติขาดเรียนเลยในข้อมูลที่บันทึก (ทุกคนเข้าเรียนหรือมีเพียงการลา/สาย)\n`;
      }

      if (lateOrLeaveStudents.length > 0) {
        context += `• นักเรียนที่มีประวัติลาหรือมาสาย (แต่ไม่ขาดเรียน):\n`;
        lateOrLeaveStudents.slice(0, 10).forEach((item, idx) => {
          context += `  - ${item.name} (${item.classroom}) -> ลา ${item.leave} วัน, มาสาย ${item.late} วัน\n`;
        });
      }
    } else {
      context += `• การเช็คชื่อ: ยังไม่มีบันทึกข้อมูลการเช็คชื่อในระบบเลย\n`;
    }

    // =========================================================================
    // มิติที่ 3: สุขภาพและโภชนาการนักเรียน (Student Health & Daily Hygiene)
    // =========================================================================
    context += `\n--- [มิติที่ 3: สุขภาพ โภชนาการ และการแพ้อาหาร] ---\n`;
    const healthCases: string[] = [];
    studentList.forEach((s) => {
      const hFlags = (s.health_flags as Record<string, any>) || {};
      if (hFlags.allergies || hFlags.chronic_illness || hFlags.blood_group) {
        healthCases.push(
          `${s.first_name} ${s.last_name}: ${hFlags.chronic_illness ? `โรคประจำตัว (${hFlags.chronic_illness}) ` : ''}${hFlags.allergies ? `แพ้อาหาร/ยา (${hFlags.allergies}) ` : ''}${hFlags.blood_group ? `กรุ๊ปเลือด ${hFlags.blood_group}` : ''}`.trim()
        );
      }
    });

    if (healthCases.length > 0) {
      context += `• นักเรียนที่มีข้อมูลโรคประจำตัวหรือแพ้อาหาร:\n`;
      healthCases.slice(0, 8).forEach((h, idx) => {
        context += `  ${idx + 1}. ${h}\n`;
      });
    } else {
      context += `• ข้อมูลโรคประจำตัว/แพ้อาหาร: ไม่มีนักเรียนแจ้งข้อมูลการแพ้อาหารหรือโรคประจำตัวอันตราย\n`;
    }

    const growthRecords = (healthRecords || []).filter((r) => r.record_type === 'growth' && r.bmi);
    if (growthRecords.length > 0) {
      context += `• การตรวจวัดสุขภาพและ BMI: บันทึกไว้แล้ว ${growthRecords.length} รายการ (มีข้อมูลน้ำหนัก-ส่วนสูงพร้อมวิเคราะห์เกณฑ์การเจริญเติบโต)\n`;
    }

    const milkRecords = (healthRecords || []).filter((r) => r.record_type === 'milk');
    const toothRecords = (healthRecords || []).filter((r) => r.record_type === 'toothbrushing');
    if (milkRecords.length > 0 || toothRecords.length > 0) {
      context += `• บันทึกสุขนิสัยประจำวัน: ดื่มนมแล้ว ${milkRecords.length} รายการ, แปรงฟันหลังอาหารแล้ว ${toothRecords.length} รายการ\n`;
    }

    // =========================================================================
    // มิติที่ 4: บันทึกพฤติกรรม & การดูแลช่วยเหลือ (Behavior & Pastoral Care)
    // =========================================================================
    context += `\n--- [มิติที่ 4: บันทึกพฤติกรรม คะแนนความประพฤติ และเคสดูแลช่วยเหลือ] ---\n`;
    const studentScoreMap = new Map<string, number>();
    const watchList: string[] = [];

    (behaviorRecords || []).forEach((b) => {
      const cur = studentScoreMap.get(b.student_id) || 0;
      studentScoreMap.set(b.student_id, cur + (b.points || 0));
      if (b.follow_up_status && b.follow_up_status !== 'none') {
        const s = studentMap.get(b.student_id);
        if (s) watchList.push(`${s.first_name} ${s.last_name}: ${b.description} (สถานะ: ${b.follow_up_status})`);
      }
    });

    const topBehavior = Array.from(studentScoreMap.entries())
      .map(([sId, points]) => ({ s: studentMap.get(sId), points }))
      .filter((item) => item.s && item.points > 0)
      .sort((a, b) => b.points - a.points);

    if (topBehavior.length > 0) {
      context += `• นักเรียนที่มีคะแนนความประพฤติ/ทำความดีสูงสุด:\n`;
      topBehavior.slice(0, 5).forEach((item, idx) => {
        context += `  ${idx + 1}. ${item.s?.first_name} ${item.s?.last_name}: ${item.points} คะแนน\n`;
      });
    } else {
      context += `• บันทึกพฤติกรรม: มีการบันทึก ${(behaviorRecords || []).length} รายการ\n`;
    }

    if (watchList.length > 0) {
      context += `• นักเรียนที่อยู่ในสถานะต้องเฝ้าระวังหรือติดตามดูแลพิเศษ (Watch List):\n`;
      watchList.slice(0, 5).forEach((w, idx) => {
        context += `  ${idx + 1}. ${w}\n`;
      });
    }

    // Care Cases
    const careList = (careCases || []) as any[];
    const urgentCare = careList.filter((c) => c.risk_level === 'urgent' || c.status === 'open');
    if (careList.length > 0) {
      context += `• ระบบดูแลช่วยเหลือนักเรียน: มีเคสบันทึก ${careList.length} เคส (${urgentCare.length > 0 ? `เคสต้องติดตามเร่งด่วน: ${urgentCare.length} เคส` : 'ไม่มีเคสด่วน'})\n`;
      urgentCare.slice(0, 5).forEach((c, idx) => {
        const s = studentMap.get(c.student_id);
        const sName = s ? `${s.first_name} ${s.last_name}` : 'นักเรียน';
        context += `  ${idx + 1}. ${sName}: [${c.case_type}] ${c.summary} (การดำเนินการ: ${c.next_action || 'รอติดตาม'})\n`;
      });
    }

    // Home Visits
    const visitsList = (homeVisits || []) as any[];
    if (visitsList.length > 0) {
      const completedVisits = visitsList.filter(
        (v) => v.status === 'certified' || v.status === 'submitted' || v.completion_percent === 100
      );
      const pct = studentList.length > 0 ? ((completedVisits.length / studentList.length) * 100).toFixed(1) : '0';
      context += `• สถิติการเยี่ยมบ้านนักเรียน: เยี่ยมแล้ว ${visitsList.length} คน (สมบูรณ์ ${completedVisits.length}/${studentList.length} คน คิดเป็น ${pct}%)\n`;

      const lowIncome = visitsList.filter((v) => v.household_income_monthly && Number(v.household_income_monthly) < 5000);
      if (lowIncome.length > 0) {
        context += `  - นักเรียนที่ครอบครัวมีรายได้น้อย (ควรพิจารณาทุนการศึกษา/ช่วยเหลือกองทุน): ${lowIncome.length} คน\n`;
      }
    }

    // Early Warning Signals
    const warningsList = (earlyWarnings || []) as any[];
    if (warningsList.length > 0) {
      context += `• สัญญาณเตือนความเสี่ยงล่วงหน้า (Early Warning Signals) ${warningsList.length} รายการ:\n`;
      warningsList.slice(0, 5).forEach((w, idx) => {
        const s = studentMap.get(w.student_id);
        const sName = s ? `${s.first_name} ${s.last_name}` : 'นักเรียน';
        context += `  ${idx + 1}. ${sName} [ระดับ: ${w.severity}]: ${w.reason}\n`;
      });
    }

    // =========================================================================
    // มิติที่ 5: ผลการเรียน คะแนนสอบ และคุณลักษณะ 8 ประการ (Scores & Evaluation)
    // =========================================================================
    context += `\n--- [มิติที่ 5: ระบบคะแนน ผลการเรียน และคุณลักษณะ 8 ประการ สพฐ. (ข้อมูลจริงจากฐานข้อมูล)] ---\n`;
    const assessmentsList = (scoreAssessments || []) as Array<{
      id: string;
      title: string;
      subject_name: string;
      max_score: number;
      weight: number;
      category: string;
      classroom_id?: string;
    }>;

    const rawEntries = (scoreEntries as any[]) || [];
    const entriesList = rawEntries.filter(
      (e) => e.score !== null && e.score !== undefined && !isNaN(Number(e.score))
    );

    const assessmentMap = new Map<string, (typeof assessmentsList)[0]>();
    assessmentsList.forEach((a) => assessmentMap.set(a.id, a));

    // Map assessment_id -> list of student score entries
    const entriesByAssessment = new Map<string, Array<{ student_id: string; score: number; note?: string }>>();
    // Map student_id -> list of scores
    const scoresByStudent = new Map<string, Array<{ assessmentId: string; subject: string; title: string; score: number; maxScore: number }>>();

    entriesList.forEach((entry) => {
      const aId = entry.assessment_id;
      const sId = entry.student_id;
      const score = Number(entry.score);

      if (!entriesByAssessment.has(aId)) entriesByAssessment.set(aId, []);
      entriesByAssessment.get(aId)!.push({ student_id: sId, score, note: entry.note });

      const a = assessmentMap.get(aId);
      if (a) {
        if (!scoresByStudent.has(sId)) scoresByStudent.set(sId, []);
        scoresByStudent.get(sId)!.push({
          assessmentId: aId,
          subject: a.subject_name,
          title: a.title,
          score,
          maxScore: Number(a.max_score) || 100,
        });
      }
    });

    if (assessmentsList.length > 0) {
      context += `• รายการเก็บคะแนนในระบบ (${assessmentsList.length} รายการ) และมีคะแนนที่บันทึกแล้ว ${entriesList.length} รายการ:\n`;

      assessmentsList.slice(0, 10).forEach((a, idx) => {
        const entries = entriesByAssessment.get(a.id) || [];
        const roomName = a.classroom_id ? classroomMap.get(a.classroom_id) || '' : '';
        const roomStr = roomName ? ` [ห้อง: ${roomName}]` : '';
        context += `  ${idx + 1}. วิชา ${a.subject_name}: "${a.title}"${roomStr} (เต็ม: ${a.max_score} คะแนน, น้ำหนัก: ${a.weight}%)\n`;

        if (entries.length > 0) {
          // Sort entries by score ascending to identify lowest and highest
          const sortedEntries = [...entries].sort((x, y) => x.score - y.score);
          const minEntry = sortedEntries[0];
          const maxEntry = sortedEntries[sortedEntries.length - 1];
          const avg = (sortedEntries.reduce((sum, item) => sum + item.score, 0) / sortedEntries.length).toFixed(1);

          const minStudents = sortedEntries
            .filter((e) => e.score === minEntry.score)
            .map((e) => {
              const s = studentMap.get(e.student_id);
              return s ? `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''}` : 'นักเรียน';
            })
            .join(', ');

          const maxStudents = sortedEntries
            .filter((e) => e.score === maxEntry.score)
            .map((e) => {
              const s = studentMap.get(e.student_id);
              return s ? `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''}` : 'นักเรียน';
            })
            .join(', ');

          context += `     -> บันทึกคะแนนแล้ว ${entries.length} คน (คะแนนเฉลี่ย: ${avg}, ต่ำสุด: ${minEntry.score}, สูงสุด: ${maxEntry.score})\n`;
          context += `     -> ⭐ ได้คะแนนน้อยที่สุด: ${minStudents} ได้ ${minEntry.score}/${a.max_score} คะแนน\n`;
          context += `     -> 🏆 ได้คะแนนมากที่สุด: ${maxStudents} ได้ ${maxEntry.score}/${a.max_score} คะแนน\n`;

          // Detail list of student scores for this assessment
          const rosterScores = sortedEntries
            .map((e) => {
              const s = studentMap.get(e.student_id);
              const name = s ? `${s.first_name} ${s.last_name}` : 'นักเรียน';
              return `${name}: ${e.score}`;
            })
            .join(', ');
          context += `     -> คะแนนรายบุคคล: ${rosterScores}\n`;
        } else {
          context += `     -> (ยังไม่มีการกรอกคะแนนในช่องนี้)\n`;
        }
      });

      // Overall student score standing across all assessments
      if (entriesList.length > 0) {
        const studentAggregates = Array.from(scoresByStudent.entries())
          .map(([sId, sScores]) => {
            const s = studentMap.get(sId);
            const totalEarned = sScores.reduce((sum, sc) => sum + sc.score, 0);
            const totalMax = sScores.reduce((sum, sc) => sum + sc.maxScore, 0);
            const percent = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
            const cName = s?.classroom_id ? classroomMap.get(s.classroom_id) || '' : '';
            return {
              id: sId,
              name: s ? `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''}` : 'นักเรียน',
              classroom: cName,
              totalEarned,
              totalMax,
              percent,
              scoresCount: sScores.length,
            };
          })
          .sort((a, b) => a.percent - b.percent);

        if (studentAggregates.length > 0) {
          context += `\n• ภาพรวมคะแนนสะสมของนักเรียนในห้อง:\n`;
          context += `  - นักเรียนที่ได้คะแนนสะสมน้อยที่สุด (ควรได้รับการดูแลหรือสอนซ่อมเสริม):\n`;
          studentAggregates.slice(0, 5).forEach((item, idx) => {
            context += `    ${idx + 1}. ${item.name} (${item.classroom}) รวม ${item.totalEarned}/${item.totalMax} คะแนน (${item.percent.toFixed(1)}%)\n`;
          });

          context += `  - นักเรียนที่ได้คะแนนสะสมสูงสุด:\n`;
          studentAggregates.slice(-3).reverse().forEach((item, idx) => {
            context += `    ${idx + 1}. ${item.name} (${item.classroom}) รวม ${item.totalEarned}/${item.totalMax} คะแนน (${item.percent.toFixed(1)}%)\n`;
          });
        }
      }
    } else {
      context += `• ระบบคะแนน: ยังไม่มีการสร้างชุดเก็บคะแนนในระบบ\n`;
    }

    const desirableList = desirableRecords || [];
    if (desirableList.length > 0) {
      context += `• การประเมินคุณลักษณะ 8 ประการ (สพฐ.): มีการประเมินแล้ว ${desirableList.length} คน (ระดับ 3=ดีเยี่ยม, 2=ดี, 1=ผ่าน)\n`;
    }

    // =========================================================================
    // มิติที่ 6: ตารางเวรและตารางสอน (Classroom Duty & Timetable)
    // =========================================================================
    context += `\n--- [มิติที่ 6: ตารางเวรทำความสะอาด และตารางสอนของครู] ---\n`;
    const activeTasks = (dutyTasks || []).filter((t) => t.is_active);
    if (activeTasks.length > 0) {
      context += `• งานเวรประจำวันของห้องเรียน: ${activeTasks.map((t) => t.name).join(', ')}\n`;
    }

    if (scheduleSettings.subjects && scheduleSettings.subjects.length > 0) {
      const subjNames = scheduleSettings.subjects.map((s) => `${s.name} (${s.code})`).join(', ');
      context += `• รายวิชาตามตารางสอน: ${subjNames}\n`;
      context += `• เวลาเริ่มเรียน: ${scheduleSettings.startTime} น. คาบละ ${scheduleSettings.periodMinutes} นาที พักกลางวัน: ${scheduleSettings.lunchStart} - ${scheduleSettings.lunchEnd} น.\n`;
    }

    const schedulePeriods = buildSchedulePeriods(scheduleSettings);
    if (scheduleSettings.activeDays && scheduleSettings.activeDays.length > 0) {
      context += `• ตารางสอนรายสัปดาห์ (ข้อมูลคาบเรียนและห้องเรียนจริงจากระบบ):\n`;
      scheduleSettings.activeDays.forEach((day) => {
        const dayClasses: string[] = [];
        schedulePeriods.forEach((period) => {
          const cellKey = makeScheduleCellKey(day, period.index);
          const cell = scheduleSettings.cells[cellKey];
          if (cell && cell.subject) {
            const roomStr = cell.classroom ? ` [ห้อง ${cell.classroom}]` : '';
            const codeStr = cell.subjectCode ? ` (${cell.subjectCode})` : '';
            dayClasses.push(`คาบ ${period.index} (${period.start}-${period.end} น.): ${cell.subject}${codeStr}${roomStr}`);
          }
        });
        if (dayClasses.length > 0) {
          context += `  - วัน${day}: ${dayClasses.join(' | ')}\n`;
        } else {
          context += `  - วัน${day}: ไม่มีคาบสอนในระบบ\n`;
        }
      });
    }

    // =========================================================================
    // มิติที่ 7: เงินออมและปฏิทินกิจกรรมโรงเรียน (Savings & School Calendar)
    // =========================================================================
    context += `\n--- [มิติที่ 7: ยอดเงินออมนักเรียน และปฏิทินวันหยุดโรงเรียน] ---\n`;
    let totalSavingsBalance = 0;
    let totalOpeningBalance = 0;
    (savingsAccounts || []).forEach((sa: any) => {
      totalSavingsBalance += Number(sa.balance || 0);
      if (sa.metadata?.opening_balance) {
        totalOpeningBalance += Number(sa.metadata.opening_balance || 0);
      }
    });
    context += `• ยอดเงินออมรวมของนักเรียน: ${totalSavingsBalance.toLocaleString('th-TH')} บาท (จาก ${(savingsAccounts || []).length} บัญชี)${totalOpeningBalance > 0 ? ` โดยเป็นยอดยกมาจากชั้นเรียนก่อนหน้า ${totalOpeningBalance.toLocaleString('th-TH')} บาท` : ''}\n`;

    const eventsList = calendarDays || [];
    if (eventsList.length > 0) {
      context += `• วันหยุดและกิจกรรมโรงเรียนในปฏิทิน (${eventsList.length} วัน):\n`;
      eventsList.slice(0, 15).forEach((ev) => {
        const typeThai = ev.day_type === 'holiday' ? 'วันหยุด' : ev.day_type === 'exam' ? 'วันสอบ' : ev.day_type === 'activity' ? 'กิจกรรม' : ev.day_type === 'makeup' ? 'เรียนชดเชย' : 'วันพิเศษ';
        context += `  - วันที่ ${ev.calendar_date}: ${ev.title} (${typeThai}${ev.affects_attendance === false ? ' / ไม่นับเป็นวันเรียน' : ''})\n`;
      });
      if (eventsList.length > 15) {
        context += `  และอีก ${eventsList.length - 15} วันในระบบ\n`;
      }
    } else {
      context += `• ปฏิทินโรงเรียน: ยังไม่มีการบันทึกวันหยุดพิเศษในระบบ\n`;
    }

    // Daily Briefs & Period Locks
    const briefsList = (dailyBriefs || []) as any[];
    if (briefsList.length > 0) {
      context += `• บันทึกสรุปประจำวันล่าสุดของโรงเรียน (Daily School Brief):\n`;
      briefsList.slice(0, 3).forEach((b) => {
        context += `  - วันที่ ${b.brief_date} [${b.title}]: ${b.summary || b.highlights || '-'}${b.tomorrow_plan ? ` (แผนพรุ่งนี้: ${b.tomorrow_plan})` : ''}\n`;
      });
    }

    const locksList = (periodLocks || []) as any[];
    const activeLocks = locksList.filter((l) => l.is_locked);
    if (activeLocks.length > 0) {
      context += `• การล็อกงวดเวลาข้อมูล (Period Locks): มีการล็อกงวดเวลาข้อมูล ${activeLocks.length} รายการ (${activeLocks.map((l) => `${l.module_key}:${l.period_name}`).join(', ')})\n`;
    }

    // --- Grounding & Action Guidelines for AI Assistant ---
    context += `\n[คำแนะนำสำคัญสำหรับ AI น้องแคร์]:\n`;
    context += `1. ข้อมูลทั้งหมดข้างต้นคือความจริง 100% จากฐานข้อมูล ClassCare 360 ของโรงเรียนนี้ คุณครูสามารถถามข้อมูลได้ครอบคลุมทั้ง 7 มิติ\n`;
    context += `2. เมื่อถามถึงห้องใดห้องหนึ่ง (เช่น ป.5/1) ให้ตอบเฉพาะจำนวนและรายชื่อของห้องนั้น อย่าสับสนกับยอดรวมทั้งโรงเรียน\n`;
    context += `3. เมื่อคุณครูขอให้ช่วยบันทึกวันหยุด/วันสอบ/กิจกรรม (เช่น "ช่วยบันทึกวันหยุด 23 ต.ค. วันปิยมหาราช") ให้สรุปรายละเอียดและสร้างปุ่มยืนยันบันทึกในรูปแบบ:\n   [CALENDAR:YYYY-MM-DD:holiday:ชื่อวัน:📅 บันทึกวันหยุดลงปฏิทินทันที]\n   และหากคุณครูขอให้บันทึกวันหยุดทั้งปี หรือวันหยุดราชการประจำปี 2569 ให้สรุปรายชื่อวันหยุดและสร้างปุ่มเดียวในรูปแบบ:\n   [CALENDAR_BATCH:2026:📅 บันทึกวันหยุดราชการทั้งปี 2569 (20 วัน) ลงปฏิทินทันที]\n`;
    context += `4. รักษาความปลอดภัยของข้อมูล: ห้ามเปิดเผยข้อมูลที่ละเมิด PDPA เช่น ห้ามกุหรือสร้างเลขบัตรประชาชน\n`;
    context += `=== [สิ้นสุดข้อมูลจริง 7 มิติจากระบบ ClassCare 360] ===\n\n`;

    return context;
  } catch (error) {
    console.warn('Error fetching 7-dimension live school AI context:', error);
    return `[บริบท: โรงเรียน '${schoolName}' ห้อง '${currentClassroomName}' ปีการศึกษา '${academicYear}' หน้า '${activeView}']\n\n`;
  }
}
