import { supabase, isSupabaseReady } from './supabaseClient';
import type { AppSessionContext } from '../types/core';
import { loadScheduleSettings } from './scheduleSettings';

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
    // Parallel fetch across all 7 school management dimensions
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
      supabase
        .from('attendance_records')
        .select('student_id, status, record_date')
        .eq('workspace_id', workspaceId)
        .order('record_date', { ascending: false })
        .limit(1000),

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
        .select('id, title, subject_name, max_score, weight, category')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20),

      // 5.2 Score Entries
      supabase
        .from('score_entries')
        .select('assessment_id, student_id, score')
        .eq('workspace_id', workspaceId)
        .limit(500),

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
        .select('student_id, balance')
        .eq('workspace_id', workspaceId)
        .limit(200),

      // 7.2 Calendar days
      supabase
        .from('school_calendar_days')
        .select('calendar_date, title, day_type, affects_attendance')
        .eq('workspace_id', workspaceId)
        .order('calendar_date', { ascending: true })
        .limit(100),
    ]);

    // Load timetable schedule settings from local/workspace configuration
    const scheduleSettings = loadScheduleSettings(workspaceId);

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
        .slice(0, 15)
        .map((s) => {
          const gInfo = guardianMap.get(s.id)?.[0];
          const gStr = gInfo ? ` [ผู้ปกครอง: ${gInfo.name} (${gInfo.relation}) โทร ${gInfo.phone || '-'}]` : '';
          return `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''} รหัส:${s.student_code || '-'}${gStr}`;
        })
        .join('; ');

      context += `  - ห้อง "${c.name}": มีนักเรียนทั้งหมด ${roomStudents.length} คน (ชาย ${boys} คน, หญิง ${girls} คน)\n`;
      if (roomStudents.length > 0) {
        context += `    รายชื่อตัวอย่าง: ${sample}${roomStudents.length > 15 ? ` และอีก ${roomStudents.length - 15} คน` : ''}\n`;
      }
    });

    if (unassignedStudents.length > 0) {
      context += `  - นักเรียนที่ยังไม่ได้จัดเข้าห้องเรียน: ${unassignedStudents.length} คน\n`;
    }

    // =========================================================================
    // มิติที่ 2: สถิติการมาเรียน & เช็คชื่อ (Attendance & Punctuality)
    // =========================================================================
    const statsMap = new Map<string, { absent: number; late: number; leave: number; present: number }>();
    (attendanceRecords || []).forEach((rec) => {
      if (!statsMap.has(rec.student_id)) {
        statsMap.set(rec.student_id, { absent: 0, late: 0, leave: 0, present: 0 });
      }
      const st = statsMap.get(rec.student_id)!;
      if (rec.status === 'absent') st.absent++;
      else if (rec.status === 'late') st.late++;
      else if (rec.status === 'leave' || rec.status === 'sick') st.leave++;
      else if (rec.status === 'present' || rec.status === 'activity') st.present++;
    });

    const absentees = studentList
      .map((s) => {
        const st = statsMap.get(s.id) || { absent: 0, late: 0, leave: 0, present: 0 };
        const cName = s.classroom_id ? classroomMap.get(s.classroom_id) || 'ไม่ระบุห้อง' : 'ไม่ระบุห้อง';
        return {
          id: s.id,
          name: `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''}`,
          classroom: cName,
          code: s.student_code || '-',
          ...st,
        };
      })
      .filter((item) => item.absent > 0 || item.late > 0)
      .sort((a, b) => b.absent - a.absent);

    context += `\n--- [มิติที่ 2: สถิติการมาเรียนและการขาดเรียน] ---\n`;
    if (absentees.length > 0) {
      context += `• นักเรียนที่มีประวัติขาดเรียนและมาสายสะสมสูงสุด:\n`;
      absentees.slice(0, 8).forEach((item, idx) => {
        context += `  ${idx + 1}. ${item.name} (${item.classroom}) ขาดเรียน: ${item.absent} วัน, มาสาย: ${item.late} วัน, ลา: ${item.leave} วัน\n`;
      });
    } else {
      if ((attendanceRecords || []).length === 0) {
        context += `• การเช็คชื่อ: ยังไม่มีบันทึกข้อมูลการเช็คชื่อในระบบเลย\n`;
      } else {
        context += `• การเช็คชื่อ: มีการเช็คชื่อแล้ว และไม่มีประวัติการขาดเรียนเลย (ทุกคนมาเรียนครบ 100%)\n`;
      }
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

    // =========================================================================
    // มิติที่ 5: ผลการเรียน คะแนนสอบ และคุณลักษณะ 8 ประการ (Scores & Evaluation)
    // =========================================================================
    context += `\n--- [มิติที่ 5: ระบบคะแนน ผลการเรียน และคุณลักษณะ 8 ประการ สพฐ.] ---\n`;
    const assessmentsList = scoreAssessments || [];
    if (assessmentsList.length > 0) {
      context += `• รายวิชาและรายการเก็บคะแนนล่าสุด (${assessmentsList.length} รายการ):\n`;
      assessmentsList.slice(0, 6).forEach((a, idx) => {
        context += `  ${idx + 1}. วิชา ${a.subject_name}: "${a.title}" (คะแนนเต็ม: ${a.max_score} คะแนน, น้ำหนัก: ${a.weight}%)\n`;
      });
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

    // =========================================================================
    // มิติที่ 7: เงินออมและปฏิทินกิจกรรมโรงเรียน (Savings & School Calendar)
    // =========================================================================
    context += `\n--- [มิติที่ 7: ยอดเงินออมนักเรียน และปฏิทินวันหยุดโรงเรียน] ---\n`;
    let totalSavingsBalance = 0;
    (savingsAccounts || []).forEach((sa) => {
      totalSavingsBalance += Number(sa.balance || 0);
    });
    context += `• ยอดเงินออมรวมของนักเรียน: ${totalSavingsBalance.toLocaleString('th-TH')} บาท (จาก ${(savingsAccounts || []).length} บัญชี)\n`;

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

    // --- Grounding & Action Guidelines for AI Assistant ---
    context += `\n[คำแนะนำสำคัญสำหรับ AI น้องแคร์]:\n`;
    context += `1. ข้อมูลทั้งหมดข้างต้นคือความจริง 100% จากฐานข้อมูล ClassCare 360 ของโรงเรียนนี้ คุณครูสามารถถามข้อมูลได้ครอบคลุมทั้ง 7 มิติ\n`;
    context += `2. เมื่อถามถึงห้องใดห้องหนึ่ง (เช่น ป.5/1) ให้ตอบเฉพาะจำนวนและรายชื่อของห้องนั้น อย่าสับสนกับยอดรวมทั้งโรงเรียน\n`;
    context += `3. เมื่อคุณครูขอให้ช่วยบันทึกวันหยุด/วันสอบ/กิจกรรม (เช่น "ช่วยบันทึกวันหยุด 23 ต.ค. วันปิยมหาราช") ให้สรุปรายละเอียดและสร้างปุ่มยืนยันบันทึกในรูปแบบ:\n   [CALENDAR:YYYY-MM-DD:holiday:ชื่อวัน:📅 บันทึกวันหยุดลงปฏิทินทันที]\n`;
    context += `4. รักษาความปลอดภัยของข้อมูล: ห้ามเปิดเผยข้อมูลที่ละเมิด PDPA เช่น ห้ามกุหรือสร้างเลขบัตรประชาชน\n`;
    context += `=== [สิ้นสุดข้อมูลจริง 7 มิติจากระบบ ClassCare 360] ===\n\n`;

    return context;
  } catch (error) {
    console.warn('Error fetching 7-dimension live school AI context:', error);
    return `[บริบท: โรงเรียน '${schoolName}' ห้อง '${currentClassroomName}' ปีการศึกษา '${academicYear}' หน้า '${activeView}']\n\n`;
  }
}
