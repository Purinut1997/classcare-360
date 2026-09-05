import { supabase, isSupabaseReady } from './supabaseClient';
import type { AppSessionContext } from '../types/core';

/**
 * Compiles real-time school context directly from Supabase (Students, Attendance, Classroom)
 * to ground Carey AI in actual factual database records, preventing any hallucinations.
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
    // 1. Fetch classrooms, students, attendance, behavior, savings, and calendar in parallel
    const [
      { data: classrooms },
      { data: students },
      { data: attendanceRecords },
      { data: behaviorRecords },
      { data: savingsAccounts },
      { data: calendarDays },
    ] = await Promise.all([
      supabase
        .from('classrooms')
        .select('id, name, grade_level, academic_year')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('name', { ascending: true }),
      supabase
        .from('students')
        .select('id, student_code, first_name, last_name, nickname, gender, classroom_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('student_code', { ascending: true }),
      supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('workspace_id', workspaceId),
      supabase
        .from('behavior_records')
        .select('student_id, points, tone, category, description')
        .eq('workspace_id', workspaceId)
        .limit(100),
      supabase
        .from('savings_accounts')
        .select('student_id, balance')
        .eq('workspace_id', workspaceId)
        .limit(100),
      supabase
        .from('school_calendar_days')
        .select('calendar_date, title, day_type, affects_attendance')
        .eq('workspace_id', workspaceId)
        .order('calendar_date', { ascending: true }),
    ]);

    const studentList = students || [];
    const classroomList = classrooms || [];

    // Map classroom ID to classroom name
    const classroomMap = new Map<string, string>();
    classroomList.forEach((c) => classroomMap.set(c.id, c.name));

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

    // Attendance stats per student
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

    // Top absentees
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
      .filter((item) => item.absent > 0)
      .sort((a, b) => b.absent - a.absent);

    // Behavior points per student
    const studentScoreMap = new Map<string, number>();
    (behaviorRecords || []).forEach((b) => {
      const current = studentScoreMap.get(b.student_id) || 0;
      studentScoreMap.set(b.student_id, current + (b.points || 0));
    });

    // Savings sum
    let totalSavingsBalance = 0;
    (savingsAccounts || []).forEach((sa) => {
      totalSavingsBalance += Number(sa.balance || 0);
    });

    // Build highly factual, grounded context text
    let context = `=== [ข้อมูลจริงจากฐานข้อมูลระบบ ClassCare 360 - อัปเดตล่าสุด] ===\n`;
    context += `• ชื่อโรงเรียน: ${schoolName}${workspaceTitle && workspaceTitle !== schoolName ? ` (Workspace: ${workspaceTitle})` : ''}\n`;
    context += `• ห้องเรียนที่คุณครูกำลังโฟกัสอยู่ในปัจจุบัน: ${currentClassroomName}\n`;
    context += `• ปีการศึกษาปัจจุบัน: ${academicYear}\n`;
    context += `• หน้าเมนูที่คุณครูกำลังเปิดดูอยู่: ${activeView}\n\n`;

    context += `--- [สถิตินักเรียนแยกรายห้องอย่างแม่นยำ (ห้ามตอบสับสนกับยอดรวมทั้งโรงเรียน)] ---\n`;
    context += `• จำนวนนักเรียนรวมทั้งโรงเรียน: ${studentList.length} คน จากทั้งหมด ${classroomList.length} ห้องเรียน\n`;

    classroomList.forEach((c) => {
      const roomStudents = studentsByClassroom.get(c.name) || [];
      const boys = roomStudents.filter((s) => s.gender === 'male').length;
      const girls = roomStudents.filter((s) => s.gender === 'female').length;
      const sample = roomStudents
        .slice(0, 10)
        .map((s) => `${s.first_name}${s.nickname ? `(${s.nickname})` : ''}`)
        .join(', ');

      context += `  - ห้อง "${c.name}": มีนักเรียนทั้งหมด ${roomStudents.length} คน (ชาย ${boys} คน, หญิง ${girls} คน)${sample ? ` [ตัวอย่าง: ${sample}${roomStudents.length > 10 ? ` และอีก ${roomStudents.length - 10} คน` : ''}]` : ''}\n`;
    });

    if (unassignedStudents.length > 0) {
      context += `  - นักเรียนที่ยังไม่ได้จัดเข้าห้อง: ${unassignedStudents.length} คน\n`;
    }

    // Attendance summary
    context += `\n--- [สถิติการเช็คชื่อและการขาดเรียน] ---\n`;
    if (absentees.length > 0) {
      context += `• นักเรียนที่มีประวัติขาดเรียนสูงสุด:\n`;
      absentees.slice(0, 8).forEach((item, idx) => {
        context += `  ${idx + 1}. ${item.name} (${item.classroom}) ขาดเรียน: ${item.absent} วัน (มาสาย: ${item.late} วัน, ลา: ${item.leave} วัน)\n`;
      });
    } else {
      if ((attendanceRecords || []).length === 0) {
        context += `• การเช็คชื่อ: ยังไม่มีการบันทึกการเช็คชื่อในระบบ\n`;
      } else {
        context += `• การเช็คชื่อ: มีการเช็คชื่อแล้ว และไม่มีนักเรียนคนใดขาดเรียน (มาเรียนครบ 100%)\n`;
      }
    }

    // Behavior & Savings quick facts
    context += `\n--- [สถิติพฤติกรรมและการออมเงิน] ---\n`;
    context += `• บันทึกพฤติกรรมในระบบ: มีการบันทึก ${(behaviorRecords || []).length} รายการ\n`;
    context += `• ยอดเงินออมรวมของนักเรียน: ${totalSavingsBalance.toLocaleString('th-TH')} บาท (จาก ${(savingsAccounts || []).length} บัญชี)\n`;

    // School Calendar & Holidays
    context += `\n--- [ปฏิทินโรงเรียน วันหยุด และวันสำคัญจริง] ---\n`;
    const eventsList = calendarDays || [];
    if (eventsList.length > 0) {
      context += `• มีวันพิเศษ/วันหยุดบันทึกในระบบทั้งหมด: ${eventsList.length} วัน ได้แก่:\n`;
      eventsList.slice(0, 20).forEach((ev) => {
        const typeThai = ev.day_type === 'holiday' ? 'วันหยุด' : ev.day_type === 'exam' ? 'วันสอบ' : ev.day_type === 'activity' ? 'กิจกรรม' : ev.day_type === 'makeup' ? 'เรียนชดเชย' : 'วันพิเศษ';
        context += `  - วันที่ ${ev.calendar_date}: ${ev.title} (${typeThai}${ev.affects_attendance === false ? ' / ไม่นับเป็นวันเรียน' : ''})\n`;
      });
      if (eventsList.length > 20) {
        context += `  และอีก ${eventsList.length - 20} วันในระบบ\n`;
      }
    } else {
      context += `• ปฏิทินโรงเรียน: ยังไม่มีการบันทึกวันหยุดพิเศษในระบบ\n`;
    }

    context += `\n[คำแนะนำสำคัญสำหรับ AI]:\n`;
    context += `1. เมื่อคุณครูถามจำนวนนักเรียนในห้องใด ให้ตอบเฉพาะจำนวนของห้องนั้น (เช่น ถ้าถามห้อง ป.5/1 ให้ตอบว่ามี ${studentsByClassroom.get('ป.5/1')?.length ?? 0} คน) อย่าตอบด้วยยอดรวมทั้งโรงเรียนเด็ดขาด!\n`;
    context += `2. เมื่อคุณครูขอให้บันทึกวันหยุด, วันสอบ, หรือกิจกรรมลงปฏิทินโรงเรียน (เช่น "บันทึกวันหยุด 23 ต.ค. วันปิยมหาราช") ให้สรุปรายละเอียดวันและสร้างปุ่มยืนยันบันทึกในรูปแบบ:\n   [CALENDAR:YYYY-MM-DD:holiday:ชื่อวันหยุด:📅 บันทึกวันหยุดลงปฏิทินทันที]\n   (โดย type ได้แก่ holiday, exam, activity, makeup) เพื่อให้คุณครูกดบันทึกลงฐานข้อมูลได้ทันทีใน 1 คลิก!\n`;
    context += `=== [สิ้นสุดข้อมูลจริงจากระบบ ClassCare 360] ===\n\n`;

    return context;
  } catch (error) {
    console.warn('Error fetching live school AI context:', error);
    return `[บริบท: โรงเรียน '${schoolName}' ห้อง '${currentClassroomName}' ปีการศึกษา '${academicYear}' หน้า '${activeView}']\n\n`;
  }
}
