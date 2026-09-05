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
  const classroomName = session.workspace.classroomName || 'ห้องเรียน';
  const academicYear = session.workspace.academicYear || '2569';
  const schoolName = session.workspace.name || 'โรงเรียน';

  try {
    // 1. Fetch classrooms & students in parallel
    const [{ data: classrooms }, { data: students }] = await Promise.all([
      supabase
        .from('classrooms')
        .select('id, name, academic_year')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
      supabase
        .from('students')
        .select('id, student_code, first_name, last_name, nickname, classroom_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('student_code', { ascending: true }),
    ]);

    const studentList = students || [];

    // 2. Fetch attendance records
    const { data: attendanceRecords } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('workspace_id', workspaceId);

    // Calculate attendance stats per student
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
        return {
          id: s.id,
          name: `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ''}`,
          code: s.student_code || '-',
          ...st,
        };
      })
      .filter((item) => item.absent > 0)
      .sort((a, b) => b.absent - a.absent);

    // Build context text
    let context = `=== [ข้อมูลจริงจากฐานข้อมูลระบบ ClassCare 360] ===\n`;
    context += `• โรงเรียน: ${schoolName}\n`;
    context += `• ห้องเรียนปัจจุบัน: ${classroomName}\n`;
    context += `• ปีการศึกษา: ${academicYear}\n`;
    context += `• เมนู/หน้าที่ครูกำลังเปิดดูอยู่: ${activeView}\n`;
    context += `• ห้องเรียนทั้งหมดในโรงเรียน: ${(classrooms || []).map((c) => c.name).join(', ') || classroomName}\n`;
    context += `• จำนวนนักเรียนทั้งหมดในโรงเรียน: ${studentList.length} คน\n`;

    if (studentList.length > 0) {
      const sampleNames = studentList
        .slice(0, 20)
        .map((s, idx) => `${idx + 1}. ${s.first_name} ${s.last_name} (${s.student_code || 'ไม่มีรหัส'})`)
        .join(', ');
      context += `• รายชื่อนักเรียนจริงในระบบ: ${sampleNames}${studentList.length > 20 ? ` และอีก ${studentList.length - 20} คน` : ''}\n`;
    } else {
      context += `• รายชื่อนักเรียน: ยังไม่มีรายชื่อนักเรียนบันทึกในระบบของโรงเรียนนี้\n`;
    }

    if (absentees.length > 0) {
      context += `• สถิตินักเรียนที่ขาดเรียนสะสมจริง (เรียงจากขาดมากสุดไปหาน้อยสุด):\n`;
      absentees.slice(0, 10).forEach((item, idx) => {
        context += `  ${idx + 1}. ${item.name} [รหัส: ${item.code}] ขาดเรียนสะสม: ${item.absent} วัน (มาสาย: ${item.late} วัน, ลา/ป่วย: ${item.leave} วัน)\n`;
      });
    } else {
      if ((attendanceRecords || []).length === 0) {
        context += `• สถิติการเช็คชื่อ: "ยังไม่มีบันทึกข้อมูลการเช็คชื่อในระบบเลย" (ไม่มีประวัติการขาดเรียน)\n`;
      } else {
        context += `• สถิติการเช็คชื่อ: มีการเช็คชื่อแล้ว แต่ "ไม่มีนักเรียนคนใดขาดเรียนเลย" (ทุกคนมาเรียนครบ 100%)\n`;
      }
    }

    context += `=== [สิ้นสุดข้อมูลจริงจากระบบ ClassCare 360] ===\n\n`;
    return context;
  } catch (error) {
    console.warn('Error fetching live school AI context:', error);
    return `[บริบท: โรงเรียน '${schoolName}' ห้อง '${classroomName}' ปีการศึกษา '${academicYear}' หน้า '${activeView}']\n\n`;
  }
}
