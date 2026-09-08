import { saveSchoolReportIdentity } from '../lib/scheduleSettings';
import { isSupabaseReady, supabase } from '../lib/supabaseClient';
import type { AppSessionContext } from '../types/core';

export interface P5SubjectTemplate {
  subject_code: string;
  subject_name: string;
  total_hours: number;
  learning_area: string;
  credit: number;
  is_basic: boolean;
}

export interface P5StudentTemplate {
  student_code: string;
  national_id: string;
  title: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female';
  birth_date: string;
}

export const P5_MASTER_DATA = {
  school: {
    schoolName: 'โรงเรียนบ้านโคกสูง',
    affiliation: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3',
    subdistrict: 'กันทรารมย์',
    district: 'ขุขันธ์',
    province: 'ศรีสะเกษ',
    directorName: 'นางสาวนิตยาภรณ์ ตรีแก้ว',
    directorTitle: 'ผู้อำนวยการโรงเรียนบ้านโคกสูง',
    registrarName: 'นายภูริณัฐ กุลัพบุรี',
    academicHeadName: 'นางมุณี ทองแท้',
    classroomName: 'ประถมศึกษาปีที่ 5/1',
    academicYear: '2568',
  },
  subjects: [
    { subject_code: 'ท15101', subject_name: 'ภาษาไทย', total_hours: 160, learning_area: 'ภาษาไทย', credit: 4.0, is_basic: true },
    { subject_code: 'ค15101', subject_name: 'คณิตศาสตร์', total_hours: 160, learning_area: 'คณิตศาสตร์', credit: 4.0, is_basic: true },
    { subject_code: 'ว15101', subject_name: 'วิทยาศาสตร์และเทคโนโลยี', total_hours: 80, learning_area: 'วิทยาศาสตร์และเทคโนโลยี', credit: 2.0, is_basic: true },
    { subject_code: 'ส15101', subject_name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', total_hours: 80, learning_area: 'สังคมศึกษา ศาสนา และวัฒนธรรม', credit: 2.0, is_basic: true },
    { subject_code: 'ส15102', subject_name: 'ประวัติศาสตร์', total_hours: 40, learning_area: 'ประวัติศาสตร์', credit: 1.0, is_basic: true },
    { subject_code: 'พ15101', subject_name: 'สุขศึกษาและพลศึกษา', total_hours: 80, learning_area: 'สุขศึกษาและพลศึกษา', credit: 2.0, is_basic: true },
    { subject_code: 'ศ15101', subject_name: 'ศิลปะ', total_hours: 80, learning_area: 'ศิลปะ', credit: 2.0, is_basic: true },
    { subject_code: 'ง15101', subject_name: 'การงานอาชีพ', total_hours: 80, learning_area: 'การงานอาชีพ', credit: 2.0, is_basic: true },
    { subject_code: 'อ15101', subject_name: 'ภาษาอังกฤษ', total_hours: 80, learning_area: 'ภาษาต่างประเทศ', credit: 2.0, is_basic: true },
    { subject_code: 'อ15201', subject_name: 'ภาษาอังกฤษเพื่อการสื่อสาร', total_hours: 40, learning_area: 'ภาษาต่างประเทศ', credit: 1.0, is_basic: false },
  ] as P5SubjectTemplate[],
  students: [
    { student_code: '2407', national_id: '1330501526256', title: 'เด็กชาย', first_name: 'กีรดิส', last_name: 'เสาร์มั่น', gender: 'male', birth_date: '2014-09-21' },
    { student_code: '2408', national_id: '1339901284762', title: 'เด็กชาย', first_name: 'กฤษฎา', last_name: 'ทองจันทร์', gender: 'male', birth_date: '2014-09-25' },
    { student_code: '2410', national_id: '1330501525756', title: 'เด็กชาย', first_name: 'วุฒิพงษ์', last_name: 'มณีพิทัก', gender: 'male', birth_date: '2014-08-24' },
    { student_code: '2411', national_id: '1339901303571', title: 'เด็กชาย', first_name: 'ฐิติวุฒิ', last_name: 'สุขเฉลิม', gender: 'male', birth_date: '2015-01-27' },
    { student_code: '2412', national_id: '1469901044426', title: 'เด็กชาย', first_name: 'ณัฐภัทร', last_name: 'นพพระคุณ', gender: 'male', birth_date: '2014-10-17' },
    { student_code: '2414', national_id: '1101801765291', title: 'เด็กชาย', first_name: 'ธนพล', last_name: 'บรรเทา', gender: 'male', birth_date: '2014-11-20' },
    { student_code: '2415', national_id: '1103705016994', title: 'เด็กชาย', first_name: 'อภิสิทธิ์', last_name: 'ลาศรี', gender: 'male', birth_date: '2014-07-09' },
    { student_code: '2416', national_id: '1339901294920', title: 'เด็กหญิง', first_name: 'ปริฉัตร', last_name: 'สอนคำ', gender: 'female', birth_date: '2014-09-03' },
    { student_code: '2417', national_id: '1339901294954', title: 'เด็กหญิง', first_name: 'นิรชรา', last_name: 'คำใส', gender: 'female', birth_date: '2014-08-16' },
    { student_code: '2418', national_id: '1339901298453', title: 'เด็กหญิง', first_name: 'พรพิมล', last_name: 'โสภา', gender: 'female', birth_date: '2014-12-05' },
    { student_code: '2419', national_id: '1339901301039', title: 'เด็กหญิง', first_name: 'ณภัทรสร', last_name: 'ทัศนีย์', gender: 'female', birth_date: '2014-12-29' },
    { student_code: '2420', national_id: '1339901301497', title: 'เด็กหญิง', first_name: 'ชวัลลักษณ์', last_name: 'สุระโคตร', gender: 'female', birth_date: '2014-12-14' },
    { student_code: '2421', national_id: '1339901304560', title: 'เด็กหญิง', first_name: 'วิชิตา', last_name: 'นวลสาย', gender: 'female', birth_date: '2015-02-12' },
    { student_code: '2422', national_id: '1339901305485', title: 'เด็กหญิง', first_name: 'วรรณิศา', last_name: 'ทิพย์สุวรรณ', gender: 'female', birth_date: '2015-03-03' },
    { student_code: '2423', national_id: '1339901306350', title: 'เด็กหญิง', first_name: 'จิราภรณ์', last_name: 'วงษ์คำมูล', gender: 'female', birth_date: '2015-03-15' },
    { student_code: '2424', national_id: '1339901308336', title: 'เด็กหญิง', first_name: 'ชญานิศ', last_name: 'ไพรศรี', gender: 'female', birth_date: '2015-04-18' },
  ] as P5StudentTemplate[],
};

export async function syncP5MasterDataToWorkspace(
  session: AppSessionContext,
  targetClassroomId: string,
): Promise<{ success: boolean; message: string; subjectsCount: number; studentsCount: number }> {
  const workspaceId = session.workspace?.id;

  // 1. Save school identity
  saveSchoolReportIdentity(
    {
      schoolName: P5_MASTER_DATA.school.schoolName,
      directorName: P5_MASTER_DATA.school.directorName,
      academicHeadName: P5_MASTER_DATA.school.academicHeadName,
      registrarName: P5_MASTER_DATA.school.registrarName,
      teacherName: session.profile.displayName || 'ครูประจำชั้น',
      coAdvisorName: '',
      classroomName: P5_MASTER_DATA.school.classroomName,
      academicYear: P5_MASTER_DATA.school.academicYear,
      schoolLogoDataUrl: '',
    },
    workspaceId,
  );

  // 2. Insert into Supabase if connected
  if (isSupabaseReady && supabase && workspaceId && targetClassroomId) {
    try {
      // Upsert subjects if table exists
      const subjectPayloads = P5_MASTER_DATA.subjects.map((sub) => ({
        workspace_id: workspaceId,
        subject_code: sub.subject_code,
        subject_name: sub.subject_name,
        learning_area: sub.learning_area,
        grade_level: 'ป.5',
        credit: sub.credit,
        total_hours: sub.total_hours,
        is_basic: sub.is_basic,
      }));

      // Cache locally so it works immediately offline / before SQL migration
      try {
        window.localStorage.setItem(`classcare_academic_subjects_${workspaceId}_ป.5`, JSON.stringify(subjectPayloads));
      } catch {}

      // Safe check if table school_subjects exists before issuing mutation
      const { error: testTableErr } = await supabase.from('school_subjects').select('id').limit(1);
      const isSubjectsTableReady = !testTableErr || !testTableErr.message?.includes('Could not find the table');

      if (isSubjectsTableReady) {
        await supabase.from('school_subjects').upsert(subjectPayloads, {
          onConflict: 'workspace_id,subject_code,grade_level',
        });
      }

      // Upsert students (store national_id in metadata per schema standard)
      const studentPayloads = P5_MASTER_DATA.students.map((st) => ({
        workspace_id: workspaceId,
        classroom_id: targetClassroomId,
        student_code: st.student_code,
        first_name: st.first_name,
        last_name: st.last_name,
        gender: st.gender,
        birth_date: st.birth_date,
        status: 'active' as const,
        metadata: {
          national_id: st.national_id,
          citizen_id: st.national_id,
        },
      }));

      await supabase.from('students').upsert(studentPayloads, {
        onConflict: 'workspace_id,student_code',
      });
    } catch (err) {
      console.warn('Sync to Supabase encountered an error, falling back to local state:', err);
    }
  }

  return {
    success: true,
    message: `นำเข้าข้อมูลแม่แบบ ป.5 (โรงเรียนบ้านโคกสูง) เรียบร้อยแล้ว: ${P5_MASTER_DATA.subjects.length} วิชา, นักเรียน ${P5_MASTER_DATA.students.length} คน`,
    subjectsCount: P5_MASTER_DATA.subjects.length,
    studentsCount: P5_MASTER_DATA.students.length,
  };
}
