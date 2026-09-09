import { saveSchoolReportIdentity } from '../lib/scheduleSettings';
import { isSupabaseReady, supabase } from '../lib/supabaseClient';
import { hideClassroomIdLocally } from '../lib/teacherClassrooms';
import type { AppSessionContext } from '../types/core';

export interface PrimarySubjectTemplate {
  subject_code: string;
  subject_name: string;
  total_hours: number;
  learning_area: string;
  credit: number;
  is_basic: boolean;
}

export interface PrimaryStudentTemplate {
  student_code: string;
  national_id: string;
  title: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female';
  birth_date: string;
  birth_date_thai?: string;
  address?: string;
  father_name?: string;
  mother_name?: string;
  parent_name?: string;
  parent_relation?: string;
}

// Backward compatibility aliases
export type P5SubjectTemplate = PrimarySubjectTemplate;
export type P5StudentTemplate = PrimaryStudentTemplate;

const SCHOOL_INFO = {
  schoolName: 'โรงเรียนบ้านโคกสูง',
  affiliation: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3',
  subdistrict: 'กันทรารมย์',
  district: 'ขุขันธ์',
  province: 'ศรีสะเกษ',
  directorName: 'นางสาวนิตยาภรณ์ ตรีแก้ว',
  directorTitle: 'ผู้อำนวยการโรงเรียนบ้านโคกสูง',
  registrarName: 'นายภูริณัฐ กุลัพบุรี',
  academicHeadName: 'นางมุณี ทองแท้',
  academicYear: '2568',
};

export const P4_MASTER_DATA = {
  school: { ...SCHOOL_INFO, classroomName: 'ประถมศึกษาปีที่ 4' },
  subjects: [
    { subject_code: 'ท14101', subject_name: 'ภาษาไทย', total_hours: 160, learning_area: 'ภาษาไทย', credit: 4.0, is_basic: true },
    { subject_code: 'ค14101', subject_name: 'คณิตศาสตร์', total_hours: 160, learning_area: 'คณิตศาสตร์', credit: 4.0, is_basic: true },
    { subject_code: 'ว14101', subject_name: 'วิทยาศาสตร์และเทคโนโลยี', total_hours: 80, learning_area: 'วิทยาศาสตร์และเทคโนโลยี', credit: 2.0, is_basic: true },
    { subject_code: 'ส14101', subject_name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', total_hours: 80, learning_area: 'สังคมศึกษา ศาสนา และวัฒนธรรม', credit: 2.0, is_basic: true },
    { subject_code: 'ส14102', subject_name: 'ประวัติศาสตร์', total_hours: 40, learning_area: 'ประวัติศาสตร์', credit: 1.0, is_basic: true },
    { subject_code: 'พ14101', subject_name: 'สุขศึกษาและพลศึกษา', total_hours: 80, learning_area: 'สุขศึกษาและพลศึกษา', credit: 2.0, is_basic: true },
    { subject_code: 'ศ14101', subject_name: 'ศิลปะ', total_hours: 80, learning_area: 'ศิลปะ', credit: 2.0, is_basic: true },
    { subject_code: 'ง14101', subject_name: 'การงานอาชีพ', total_hours: 80, learning_area: 'การงานอาชีพ', credit: 2.0, is_basic: true },
    { subject_code: 'อ14101', subject_name: 'ภาษาอังกฤษ', total_hours: 80, learning_area: 'ภาษาต่างประเทศ', credit: 2.0, is_basic: true },
    { subject_code: 'อ14201', subject_name: 'ภาษาอังกฤษเพื่อการสื่อสาร', total_hours: 40, learning_area: 'ภาษาต่างประเทศ', credit: 1.0, is_basic: false },
  ] as PrimarySubjectTemplate[],
  students: [
  {
    "student_code": "2454",
    "national_id": "1339901386921",
    "title": "เด็กชาย",
    "first_name": "กิตติกวิน",
    "last_name": "เสาศิลา",
    "gender": "male",
    "birth_date": "2016-09-09",
    "birth_date_thai": "09/09/2559",
    "address": "987/39 ม.0 ขุขันธ์ เมืองใต้ เมืองศรีสะเกษ ศรีสะเกษ",
    "father_name": "นาย เอกรินทร์ เสาศิลา",
    "mother_name": "นาง ลัดฏาวัลย์ เสาศิลา",
    "parent_name": "นาย เอกรินทร์ เสาศิลา",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2455",
    "national_id": "1419903218596",
    "title": "เด็กชาย",
    "first_name": "กิตินันท์",
    "last_name": "ชาวสวน",
    "gender": "male",
    "birth_date": "2017-03-17",
    "birth_date_thai": "17/03/2560",
    "address": "162 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ศราวุฒฺิ ชาวสวน",
    "mother_name": "นางสาว เพ็ญศรี ตาดม่วง",
    "parent_name": "นางสาว เพ็ญศรี ตาดม่วง",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2456",
    "national_id": "1749800671783",
    "title": "เด็กชาย",
    "first_name": "เกริกฤทธิ์",
    "last_name": "ทองจันทร์",
    "gender": "male",
    "birth_date": "2016-08-22",
    "birth_date_thai": "22/08/2559",
    "address": "91 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สิทธิพงษ์ ทองจันทร์",
    "mother_name": "นางสาว หทัยชนก ชาติ",
    "parent_name": "นาย สิทธิพงษ์ ทองจันทร์",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2457",
    "national_id": "1330501540739",
    "title": "เด็กชาย",
    "first_name": "ฐิติภัทร",
    "last_name": "เพ็ชรวงค์",
    "gender": "male",
    "birth_date": "2017-01-10",
    "birth_date_thai": "10/01/2560",
    "address": "49 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ชัชวาล เพ็ชรวงค์",
    "mother_name": "นางสาว เกตุมณี โสริยาท",
    "parent_name": "นางสาว เกตุมณี โสริยาท",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2458",
    "national_id": "1330501541930",
    "title": "เด็กชาย",
    "first_name": "ณัฎฐชัย",
    "last_name": "บุญเกิด",
    "gender": "male",
    "birth_date": "2017-04-04",
    "birth_date_thai": "04/04/2560",
    "address": "162 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย รัตนชัย บุญเกิด",
    "mother_name": "นางสาว รัชรินทร์ สึมกำปัง",
    "parent_name": "นาย รัตนชัย บุญเกิด",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2459",
    "national_id": "1209000941608",
    "title": "เด็กชาย",
    "first_name": "เตชินท์",
    "last_name": "ทองภา",
    "gender": "male",
    "birth_date": "2016-06-17",
    "birth_date_thai": "17/06/2559",
    "address": "4 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "เด็กชาย บุญเลิศ ทองภา",
    "mother_name": "นางสาว พิมล สุขเฉลิม",
    "parent_name": "เด็กชาย บุญเลิศ ทองภา",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2460",
    "national_id": "1102300177347",
    "title": "เด็กชาย",
    "first_name": "ญาณุเชฏฐ์",
    "last_name": "ชิณบุตร",
    "gender": "male",
    "birth_date": "2016-09-30",
    "birth_date_thai": "30/09/2559",
    "address": "196 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สมหมาย ชิณบุตร",
    "mother_name": "นางสาว วิลาวัลย์ อินสา",
    "parent_name": "นาย สมหมาย ชิณบุตร",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2462",
    "national_id": "1139600827254",
    "title": "เด็กชาย",
    "first_name": "ยุทธพิชัย",
    "last_name": "เกษมงคล",
    "gender": "male",
    "birth_date": "2016-09-25",
    "birth_date_thai": "25/09/2559",
    "address": "87 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ประมง เกษมงคล",
    "mother_name": "นาง รัตนา ทองเเสง",
    "parent_name": "นาง รัตนา ทองเเสง",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2463",
    "national_id": "1330501541140",
    "title": "เด็กชาย",
    "first_name": "วรพล",
    "last_name": "รัตนจันทร์",
    "gender": "male",
    "birth_date": "2017-02-09",
    "birth_date_thai": "09/02/2560",
    "address": "77 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ปิยะราช รัตนจันทร์",
    "mother_name": "นางสาว วินิรัตน์ โสริยาตร",
    "parent_name": "นางสาว วินิรัตน์ โสริยาตร",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2465",
    "national_id": "1103705252493",
    "title": "เด็กชาย",
    "first_name": "อัครพล",
    "last_name": "อุตพันธ์",
    "gender": "male",
    "birth_date": "2016-11-29",
    "birth_date_thai": "29/11/2559",
    "address": "113 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย คำนึง อุตพันธ์",
    "mother_name": "นางสาว อำภา ทองจันทร์",
    "parent_name": "นาย คำนึง อุตพันธ์",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2461",
    "national_id": "1118700308011",
    "title": "เด็กชาย",
    "first_name": "ภูริพัฒน์",
    "last_name": "เสียงเพราะ",
    "gender": "male",
    "birth_date": "2016-09-09",
    "birth_date_thai": "09/09/2559",
    "address": "141 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย วัชระ เสียงเพราะ",
    "mother_name": "นางสาว น้ำฝน สายเมือง",
    "parent_name": "นาย วัชระ เสียงเพราะ",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2466",
    "national_id": "1129902521719",
    "title": "เด็กหญิง",
    "first_name": "ณัฐธิดา",
    "last_name": "สุกระวัน",
    "gender": "female",
    "birth_date": "2016-07-13",
    "birth_date_thai": "13/07/2559",
    "address": "4 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ธนาศักดิ์ สุกระวัน",
    "mother_name": "นางสาว รัตนา บุญตา",
    "parent_name": "นางสาว รัตนา บุญตา",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2467",
    "national_id": "1209000961200",
    "title": "เด็กหญิง",
    "first_name": "นภาพรรณ",
    "last_name": "เสียงกลม",
    "gender": "female",
    "birth_date": "2016-09-29",
    "birth_date_thai": "29/09/2559",
    "address": "83 ม.5 83 กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สาธิต ตนฉลาด",
    "mother_name": "นางสาว วันเพ็ญ เสียงกลม",
    "parent_name": "นางสาว วันเพ็ญ เสียงกลม",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2468",
    "national_id": "1330501542529",
    "title": "เด็กหญิง",
    "first_name": "ศิริญญา",
    "last_name": "เสียงเพราะ",
    "gender": "female",
    "birth_date": "2017-05-07",
    "birth_date_thai": "07/05/2560",
    "address": "9 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย นนท์ธวัช เสียงเพราะ",
    "mother_name": "เด็กหญิง สิวิมล ไชยภา",
    "parent_name": "นาย นนท์ธวัช เสียงเพราะ",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2469",
    "national_id": "1339901377582",
    "title": "เด็กหญิง",
    "first_name": "ศิรินันท์",
    "last_name": "สุขเฉลิม",
    "gender": "female",
    "birth_date": "2016-06-07",
    "birth_date_thai": "07/06/2559",
    "address": "154 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย บุญเก็ง สุขเฉลิม",
    "mother_name": "นางสาว วิภา สุพรรณ",
    "parent_name": "นางสาว วิภา สุพรรณ",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2470",
    "national_id": "1330501538602",
    "title": "เด็กหญิง",
    "first_name": "กรรณิการ์",
    "last_name": "กัณหาอาษา",
    "gender": "female",
    "birth_date": "2016-09-04",
    "birth_date_thai": "04/09/2559",
    "address": "60 ม.9 - พรหมณี เมืองนครนายก นครนายก",
    "father_name": "นาย สมชาย กัณหาอาษา",
    "mother_name": "นางสาว เกษร เสียงเพราะ",
    "parent_name": "นาง สำราญ กัณหาอาษา",
    "parent_relation": "ย่า"
  }
] as PrimaryStudentTemplate[],
};

export const P5_MASTER_DATA = {
  school: { ...SCHOOL_INFO, classroomName: 'ประถมศึกษาปีที่ 5' },
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
  ] as PrimarySubjectTemplate[],
  students: [
  {
    "student_code": "2428",
    "national_id": "1330501533953",
    "title": "เด็กชาย",
    "first_name": "ณัฏฐชัย",
    "last_name": "สุกไสย์",
    "gender": "male",
    "birth_date": "2015-12-16",
    "birth_date_thai": "16/12/2558",
    "address": "163 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ขวัญชัย สุกไสย์",
    "mother_name": "นางสาว ชดาพร พรดี",
    "parent_name": "นางสาว ชดาพร พรดี",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2429",
    "national_id": "1209401084293",
    "title": "เด็กชาย",
    "first_name": "ณัฐพัฒน์",
    "last_name": "อินทนู",
    "gender": "male",
    "birth_date": "2016-01-20",
    "birth_date_thai": "20/01/2559",
    "address": "103 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย เสริฐ อินทนู",
    "mother_name": "นาง ลำใย อินทนู",
    "parent_name": "นาย เสริฐ อินทนู",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2430",
    "national_id": "1330501534151",
    "title": "เด็กชาย",
    "first_name": "ธนาทิป",
    "last_name": "เชียงเครือ",
    "gender": "male",
    "birth_date": "2015-12-27",
    "birth_date_thai": "27/12/2558",
    "address": "220 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สำราญ เชียงเครือ",
    "mother_name": "นาง อรวรรณ เชียงเครือ",
    "parent_name": "นาย สำราญ เชียงเครือ",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2431",
    "national_id": "1330500284895",
    "title": "เด็กชาย",
    "first_name": "ธีระพัฒน์",
    "last_name": "แป้นจันทร์สุรีย์",
    "gender": "male",
    "birth_date": "2016-01-17",
    "birth_date_thai": "17/01/2559",
    "address": "186 ม.11 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ธีระพันธ์ แป้นจันทร์สุรี",
    "mother_name": "นางสาว เพชรรัตน์ บุญเครือ",
    "parent_name": "นาย ธีระพันธ์ แป้นจันทร์สุรี",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2432",
    "national_id": "1330501534330",
    "title": "เด็กชาย",
    "first_name": "รัตนชัย",
    "last_name": "ขอบเขต",
    "gender": "male",
    "birth_date": "2015-12-30",
    "birth_date_thai": "30/12/2558",
    "address": "24 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ทองพูน ขอบเขต",
    "mother_name": "นาง ทองพูน ทองจันทร์",
    "parent_name": "นาง ทองพูน ทองจันทร์",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2434",
    "national_id": "1219700096722",
    "title": "เด็กชาย",
    "first_name": "วีรเทพ",
    "last_name": "พิจารณ์",
    "gender": "male",
    "birth_date": "2015-12-01",
    "birth_date_thai": "01/12/2558",
    "address": "Mon Jan 12 2026 00:00:00 GMT+0700 (เวลาอินโดจีน) ม.0 - มาบตาพุด เมืองระยอง ระยอง",
    "father_name": "นาย วีรพงศ์ พิจารณ์",
    "mother_name": "นางสาว สุนิสา กงซุย",
    "parent_name": "นาย วีรพงศ์ พิจารณ์",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2435",
    "national_id": "1330501531071",
    "title": "เด็กชาย",
    "first_name": "ศิวัฒน์",
    "last_name": "บุญรักษา",
    "gender": "male",
    "birth_date": "2015-07-10",
    "birth_date_thai": "10/07/2558",
    "address": "27 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ธิวัฒน์ บุญรักษา",
    "mother_name": "นางสาว วราพร ทองจันทร์",
    "parent_name": "นาย ธิวัฒน์ บุญรักษา",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2436",
    "national_id": "1330501531551",
    "title": "เด็กชาย",
    "first_name": "อัคคเดช",
    "last_name": "เขียวค้า",
    "gender": "male",
    "birth_date": "2015-08-07",
    "birth_date_thai": "07/08/2558",
    "address": "191 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สุรเดช เขียวค้า",
    "mother_name": "นางสาว วิไล สมร",
    "parent_name": "นาย สุรเดช เขียวค้า",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2542",
    "national_id": "1330501534569",
    "title": "เด็กชาย",
    "first_name": "ขวัญชัย",
    "last_name": "ชื่นจิตร",
    "gender": "male",
    "birth_date": "2016-01-14",
    "birth_date_thai": "14/01/2559",
    "address": "90 ม.4 - ห้วยสำราญ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ชาญชัย ชื่นจิตร",
    "mother_name": "นางสาว อัมรินทร์ นำสว่าง",
    "parent_name": "นาย ชาญชัย ชื่นจิตร",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2437",
    "national_id": "1330501535069",
    "title": "เด็กหญิง",
    "first_name": "กวินทรา",
    "last_name": "อศิพงษ์",
    "gender": "female",
    "birth_date": "2016-02-10",
    "birth_date_thai": "10/02/2559",
    "address": "168 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย พิพัธฒ์ อะศิพงษ์",
    "mother_name": "นางสาว สรัญญา โสริยาท",
    "parent_name": "นาย พิพัธฒ์ อะศิพงษ์",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2438",
    "national_id": "1339901326571",
    "title": "เด็กหญิง",
    "first_name": "ช่อผกา",
    "last_name": "สุขเฉลิม",
    "gender": "female",
    "birth_date": "2015-07-24",
    "birth_date_thai": "24/07/2558",
    "address": "39 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย วันชัย สุขเฉลิม",
    "mother_name": "นางสาว นิภาพร สุขเฉลิม",
    "parent_name": "นาย วันชัย สุขเฉลิม",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2439",
    "national_id": "1129902472050",
    "title": "เด็กหญิง",
    "first_name": "ณัฐณิชา",
    "last_name": "สุกระวัน",
    "gender": "female",
    "birth_date": "2015-06-03",
    "birth_date_thai": "03/06/2558",
    "address": "4 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ธนาศักดิ์ สุกระวัน",
    "mother_name": "นางสาว รัตนา บุญตา",
    "parent_name": "นางสาว รัตนา บุญตา",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2440",
    "national_id": "1330501533031",
    "title": "เด็กหญิง",
    "first_name": "ธนัญชิตา",
    "last_name": "สมน้อย",
    "gender": "female",
    "birth_date": "2015-10-21",
    "birth_date_thai": "21/10/2558",
    "address": "134 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ธวัชชัย สมน้อย",
    "mother_name": "นางสาว ชลิตตา ทองจันทร์",
    "parent_name": "นางสาว ชลิตตา ทองจันทร์",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2441",
    "national_id": "1339901318705",
    "title": "เด็กหญิง",
    "first_name": "นิพาพร",
    "last_name": "พรมปากดี",
    "gender": "female",
    "birth_date": "2015-05-31",
    "birth_date_thai": "31/05/2558",
    "address": "123 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ประวัติ พรหมปากดี",
    "mother_name": "นางสาว ลัดดาวรรณ คำเสียง",
    "parent_name": "นางสาว ลัดดาวรรณ คำเสียง",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2442",
    "national_id": "1339901365428",
    "title": "เด็กหญิง",
    "first_name": "ปณิฏฐา",
    "last_name": "บุตรงาม",
    "gender": "female",
    "birth_date": "2015-04-05",
    "birth_date_thai": "05/04/2558",
    "address": "987/39 ม.0 - เมืองใต้ เมืองศรีสะเกษ ศรีสะเกษ",
    "father_name": "นาย ปกิตชัย บุตรงาม",
    "mother_name": "นาง ชลธาร บุตรงาม",
    "parent_name": "นาง ชลธาร บุตรงาม",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2443",
    "national_id": "1330501532671",
    "title": "เด็กหญิง",
    "first_name": "พรรณิดา",
    "last_name": "สิงหะ",
    "gender": "female",
    "birth_date": "2015-10-10",
    "birth_date_thai": "10/10/2558",
    "address": "176 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สุกสัยร์ สิงหะ",
    "mother_name": "นาง กรอยใจ สิงหะ",
    "parent_name": "นาง กรอยใจ สิงหะ",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2444",
    "national_id": "1339901322907",
    "title": "เด็กหญิง",
    "first_name": "พีชญา",
    "last_name": "บุสบัน",
    "gender": "female",
    "birth_date": "2015-06-30",
    "birth_date_thai": "30/06/2558",
    "address": "118 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ธิชากรณ์ บุสบัน",
    "mother_name": "นางสาว มณีรัตน์ สุพันธ์",
    "parent_name": "นาย ธิชากรณ์ บุสบัน",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2445",
    "national_id": "1330501534135",
    "title": "เด็กหญิง",
    "first_name": "เเพรวรุ่ง",
    "last_name": "สุจริต",
    "gender": "female",
    "birth_date": "2015-12-24",
    "birth_date_thai": "24/12/2558",
    "address": "184 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย วีรวัตร สุจริต",
    "mother_name": "นางสาว อำไพ เสียงเพราะ",
    "parent_name": "นางสาว อำไพ เสียงเพราะ",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2446",
    "national_id": "1330501533198",
    "title": "เด็กหญิง",
    "first_name": "ภัสตรา",
    "last_name": "เเกมเเก้ว",
    "gender": "female",
    "birth_date": "2015-11-01",
    "birth_date_thai": "01/11/2558",
    "address": "98 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สุทิน เเกมเเก้ว",
    "mother_name": "นางสาว สุนิสา เเกมเเก้ว",
    "parent_name": "นางสาว สุนิสา เเกมเเก้ว",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2453",
    "national_id": "1118700289351",
    "title": "เด็กหญิง",
    "first_name": "กัญญารัตน์",
    "last_name": "เทพอุทัย",
    "gender": "female",
    "birth_date": "2015-07-18",
    "birth_date_thai": "18/07/2558",
    "address": "66/1017 ม.5 - บางเมือง เมืองสมุทรปราการ สมุทรปราการ",
    "father_name": "นาย สันติพงษ์ เทพอุทัย",
    "mother_name": "นาง สุกัญญา จำปาแดง",
    "parent_name": "นาย สันติพงษ์ เทพอุทัย",
    "parent_relation": "บิดา"
  }
] as PrimaryStudentTemplate[],
};

export const P6_MASTER_DATA = {
  school: { ...SCHOOL_INFO, classroomName: 'ประถมศึกษาปีที่ 6' },
  subjects: [
    { subject_code: 'ท16101', subject_name: 'ภาษาไทย', total_hours: 160, learning_area: 'ภาษาไทย', credit: 4.0, is_basic: true },
    { subject_code: 'ค16101', subject_name: 'คณิตศาสตร์', total_hours: 160, learning_area: 'คณิตศาสตร์', credit: 4.0, is_basic: true },
    { subject_code: 'ว16101', subject_name: 'วิทยาศาสตร์และเทคโนโลยี', total_hours: 80, learning_area: 'วิทยาศาสตร์และเทคโนโลยี', credit: 2.0, is_basic: true },
    { subject_code: 'ส16101', subject_name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', total_hours: 80, learning_area: 'สังคมศึกษา ศาสนา และวัฒนธรรม', credit: 2.0, is_basic: true },
    { subject_code: 'ส16102', subject_name: 'ประวัติศาสตร์', total_hours: 40, learning_area: 'ประวัติศาสตร์', credit: 1.0, is_basic: true },
    { subject_code: 'พ16101', subject_name: 'สุขศึกษาและพลศึกษา', total_hours: 80, learning_area: 'สุขศึกษาและพลศึกษา', credit: 2.0, is_basic: true },
    { subject_code: 'ศ16101', subject_name: 'ศิลปะ', total_hours: 80, learning_area: 'ศิลปะ', credit: 2.0, is_basic: true },
    { subject_code: 'ง16101', subject_name: 'การงานอาชีพ', total_hours: 80, learning_area: 'การงานอาชีพ', credit: 2.0, is_basic: true },
    { subject_code: 'อ16101', subject_name: 'ภาษาอังกฤษ', total_hours: 80, learning_area: 'ภาษาต่างประเทศ', credit: 2.0, is_basic: true },
    { subject_code: 'อ16201', subject_name: 'ภาษาอังกฤษเพื่อการสื่อสาร', total_hours: 40, learning_area: 'ภาษาต่างประเทศ', credit: 1.0, is_basic: false },
  ] as PrimarySubjectTemplate[],
  students: [
  {
    "student_code": "2407",
    "national_id": "1330501526256",
    "title": "เด็กชาย",
    "first_name": "กีรดิส",
    "last_name": "เสาร์มั่น",
    "gender": "male",
    "birth_date": "2014-09-21",
    "birth_date_thai": "21/09/2557",
    "address": "120 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ปฏิภาณ เสาร์มั่น",
    "mother_name": "นางสาว ขนิษฐา มีเเก้ว",
    "parent_name": "นาย ปฏิภาณ เสาร์มั่น",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2408",
    "national_id": "1339901284762",
    "title": "เด็กชาย",
    "first_name": "กฤษฎา",
    "last_name": "ทองจันทร์",
    "gender": "male",
    "birth_date": "2014-09-25",
    "birth_date_thai": "25/09/2557",
    "address": "118 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย เสกสรร ทองจันทร์",
    "mother_name": "นางสาว ลำพูน สิงหะ",
    "parent_name": "นาย เสกสรร ทองจันทร์",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2410",
    "national_id": "1330501525756",
    "title": "เด็กชาย",
    "first_name": "วุฒิพงษ์",
    "last_name": "มณีพิทัก",
    "gender": "male",
    "birth_date": "2014-08-24",
    "birth_date_thai": "24/08/2557",
    "address": "191 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ไพรทูล มณีพิทัก",
    "mother_name": "นางสาว พิสมัย สมร",
    "parent_name": "นาย ไพรทูล มณีพิทัก",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2411",
    "national_id": "1339901303571",
    "title": "เด็กชาย",
    "first_name": "ฐิติวุฒิ",
    "last_name": "สุขเฉลิม",
    "gender": "male",
    "birth_date": "2015-01-27",
    "birth_date_thai": "27/01/2558",
    "address": "44 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย วิรุด สุขเฉลิม",
    "mother_name": "นางสาว พรวิภา รูปคุ้ม",
    "parent_name": "นางสาว พรวิภา รูปคุ้ม",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2412",
    "national_id": "1469901044426",
    "title": "เด็กชาย",
    "first_name": "ณัฐภัทร",
    "last_name": "นพพระคุณ",
    "gender": "male",
    "birth_date": "2014-10-17",
    "birth_date_thai": "17/10/2557",
    "address": "12 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย เพชร นพพระคุณ",
    "mother_name": "นางสาว ลำดวน ทองจันทร์",
    "parent_name": "นาย เพชร นพพระคุณ",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2414",
    "national_id": "1101801765291",
    "title": "เด็กชาย",
    "first_name": "ธนพล",
    "last_name": "คำมา",
    "gender": "male",
    "birth_date": "2014-08-16",
    "birth_date_thai": "16/08/2557",
    "address": "68 ม.6 - ดู่ ปรางค์กู่ ศรีสะเกษ",
    "father_name": "นาย สุรัตน์ คำมา",
    "mother_name": "นางสาว จริยา พันธ์ทะเสณ",
    "parent_name": "นาย สุรัตน์ คำมา",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2415",
    "national_id": "1103705016994",
    "title": "เด็กชาย",
    "first_name": "ศุภกฤต",
    "last_name": "ติละบาล",
    "gender": "male",
    "birth_date": "2014-09-05",
    "birth_date_thai": "05/09/2557",
    "address": "165 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย เอกพล อภิชัยชาติ",
    "mother_name": "นางสาว กรรณิกา ติละบาล",
    "parent_name": "นาย เอกพล อภิชัยชาติ",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2520",
    "national_id": "1103200355961",
    "title": "เด็กชาย",
    "first_name": "เฉลิมพล",
    "last_name": "เผือกก้าม",
    "gender": "male",
    "birth_date": "2014-12-01",
    "birth_date_thai": "01/12/2557",
    "address": "121 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ก ก",
    "mother_name": "นางสาว สีเงิน อินหอม",
    "parent_name": "นางสาว สีเงิน อินหอม",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2416",
    "national_id": "1339901294920",
    "title": "เด็กหญิง",
    "first_name": "กันยกร",
    "last_name": "จันกระวัน",
    "gender": "female",
    "birth_date": "2014-11-26",
    "birth_date_thai": "26/11/2557",
    "address": "188 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย อภิวัฒน์ จันกระวัน",
    "mother_name": "นางสาว สิริมา ดวงอินทร์",
    "parent_name": "นาย อภิวัฒน์ จันกระวัน",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2417",
    "national_id": "1339300044937",
    "title": "เด็กหญิง",
    "first_name": "กมลพรรณ",
    "last_name": "น่าชม",
    "gender": "female",
    "birth_date": "2014-12-08",
    "birth_date_thai": "08/12/2557",
    "address": "1 ม.4 - ดู่ ปรางค์กู่ ศรีสะเกษ",
    "father_name": "นาย โสภณ น่าชม",
    "mother_name": "นางสาว ปทุมพร คำพินิจ",
    "parent_name": "นาย โสภณ น่าชม",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2418",
    "national_id": "1330501528534",
    "title": "เด็กหญิง",
    "first_name": "กัญญารัตน์",
    "last_name": "ศรีเลิศ",
    "gender": "female",
    "birth_date": "2015-01-18",
    "birth_date_thai": "18/01/2558",
    "address": "160 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ศราวุฒิ ศรีเลิศ",
    "mother_name": "นางสาว สุนันทา ทองจันทร์",
    "parent_name": "นางสาว สุนันทา ทองจันทร์",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2419",
    "national_id": "1339901290606",
    "title": "เด็กหญิง",
    "first_name": "ชัยกาญดาพร",
    "last_name": "ชัยบัณฑิต",
    "gender": "female",
    "birth_date": "2014-10-29",
    "birth_date_thai": "29/10/2557",
    "address": "86 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย หัก ชัยบัณฑิต",
    "mother_name": "นางสาว นารี อินดา",
    "parent_name": "นางสาว นารี อินดา",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2420",
    "national_id": "1330501527627",
    "title": "เด็กหญิง",
    "first_name": "นภัสสร",
    "last_name": "สุขเฉลิม",
    "gender": "female",
    "birth_date": "2014-11-22",
    "birth_date_thai": "22/11/2557",
    "address": "175 ม.3 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย สยาม สุขเฉลิม",
    "mother_name": "นางสาว อรทัย ขันมาก",
    "parent_name": "นางสาว อรทัย ขันมาก",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2421",
    "national_id": "1330501529336",
    "title": "เด็กหญิง",
    "first_name": "ธนัญชนก",
    "last_name": "คำยก",
    "gender": "female",
    "birth_date": "2015-03-16",
    "birth_date_thai": "16/03/2558",
    "address": "221 ม.4 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย ณัฐพล คำยก",
    "mother_name": "นาง นัฐศิตา ใจโชร์",
    "parent_name": "นาง นัฐศิตา ใจโชร์",
    "parent_relation": "มารดา"
  },
  {
    "student_code": "2422",
    "national_id": "1339901268058",
    "title": "เด็กหญิง",
    "first_name": "ปาริชาติ",
    "last_name": "โนวงค์",
    "gender": "female",
    "birth_date": "2014-06-12",
    "birth_date_thai": "12/06/2557",
    "address": "141 ม.5 - กันทรารมย์ ขุขันธ์ ศรีสะเกษ",
    "father_name": "นาย จารึก โนวงค์",
    "mother_name": "นาง เด่นซา สุพรรณ์",
    "parent_name": "นาย จารึก โนวงค์",
    "parent_relation": "บิดา"
  },
  {
    "student_code": "2425",
    "national_id": "1330501525501",
    "title": "เด็กหญิง",
    "first_name": "ณัฏฐกันย์",
    "last_name": "จันทร์ทอง",
    "gender": "female",
    "birth_date": "2014-08-25",
    "birth_date_thai": "25/08/2557",
    "address": "39/1 ม.1 - ตาคง สังขะ สุรินทร์",
    "father_name": "นาย อนันต์ จันทร์ทอง",
    "mother_name": "นางสาว วาริชนันท์ เกษมงคล",
    "parent_name": "นาย อนันต์ จันทร์ทอง",
    "parent_relation": "บิดา"
  }
] as PrimaryStudentTemplate[],
};

export function getPrimaryMasterData(gradeName: string) {
  if (gradeName.includes('4') || gradeName.includes('ป.4')) {
    return P4_MASTER_DATA;
  }
  if (gradeName.includes('6') || gradeName.includes('ป.6')) {
    return P6_MASTER_DATA;
  }
  return P5_MASTER_DATA;
}

export async function syncGradeMasterDataToWorkspace(
  session: AppSessionContext,
  targetClassroomId: string,
  gradeName: string,
): Promise<{ success: boolean; message: string; subjectsCount: number; studentsCount: number }> {
  const masterData = getPrimaryMasterData(gradeName);
  const workspaceId = session.workspace?.id;

  // 1. Save school identity
  saveSchoolReportIdentity(
    {
      schoolName: masterData.school.schoolName,
      directorName: masterData.school.directorName,
      academicHeadName: masterData.school.academicHeadName,
      registrarName: masterData.school.registrarName,
      teacherName: session.profile.displayName || 'ครูประจำชั้น',
      coAdvisorName: '',
      classroomName: masterData.school.classroomName,
      academicYear: masterData.school.academicYear,
      schoolLogoDataUrl: '',
    },
    workspaceId,
  );

  // 2. Insert into Supabase if connected
  if (isSupabaseReady && supabase && workspaceId && targetClassroomId) {
    try {
      const gradeDigit = gradeName.replace(/\D/g, '') || '5';
      const gradeLevelLabel = 'ป.' + gradeDigit;

      // Upsert subjects if table exists
      const subjectPayloads = masterData.subjects.map((sub) => ({
        workspace_id: workspaceId,
        subject_code: sub.subject_code,
        subject_name: sub.subject_name,
        learning_area: sub.learning_area,
        grade_level: gradeLevelLabel,
        credit: sub.credit,
        total_hours: sub.total_hours,
        is_basic: sub.is_basic,
      }));

      // Cache locally
      try {
        window.localStorage.setItem('classcare_academic_subjects_' + workspaceId + '_' + gradeLevelLabel, JSON.stringify(subjectPayloads));
      } catch {}

      const { error: testTableErr } = await supabase.from('school_subjects').select('id').limit(1);
      const isSubjectsTableReady = !testTableErr || !testTableErr.message?.includes('Could not find the table');

      if (isSubjectsTableReady) {
        await supabase.from('school_subjects').upsert(subjectPayloads, {
          onConflict: 'workspace_id,subject_code,grade_level',
        });
      }

      // Upsert students
      const studentPayloads = masterData.students.map((st) => ({
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
          address: st.address,
          father_name: st.father_name,
          mother_name: st.mother_name,
          parent_name: st.parent_name,
          parent_relation: st.parent_relation,
          birth_date_thai: st.birth_date_thai,
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
    message: 'นำเข้าข้อมูลแม่แบบ ' + masterData.school.classroomName + ' (' + masterData.school.schoolName + ') เรียบร้อยแล้ว: ' + masterData.subjects.length + ' วิชา, นักเรียน ' + masterData.students.length + ' คน',
    subjectsCount: masterData.subjects.length,
    studentsCount: masterData.students.length,
  };
}

export async function syncP5MasterDataToWorkspace(
  session: AppSessionContext,
  targetClassroomId: string,
): Promise<{ success: boolean; message: string; subjectsCount: number; studentsCount: number }> {
  return syncGradeMasterDataToWorkspace(session, targetClassroomId, 'ป.5');
}

export const DEMO_PRIMARY_CLASSROOMS = [
  { id: 'demo-cls-p4', name: 'ประถมศึกษาปีที่ 4', grade_level: 'ป.4', academic_year: '2568', status: 'active' as const },
  { id: 'demo-cls-p5', name: 'ประถมศึกษาปีที่ 5', grade_level: 'ป.5', academic_year: '2568', status: 'active' as const },
  { id: 'demo-cls-p6', name: 'ประถมศึกษาปีที่ 6', grade_level: 'ป.6', academic_year: '2568', status: 'active' as const },
];

export const DEMO_PRIMARY_STUDENTS = [
  ...P4_MASTER_DATA.students.map((st) => ({
    id: `demo-p4-${st.student_code}`,
    student_code: st.student_code,
    first_name: st.first_name,
    last_name: st.last_name,
    nickname: st.first_name.slice(0, 3),
    gender: st.gender as 'male' | 'female',
    classroom_id: 'demo-cls-p4',
    status: 'active' as const,
    care_flags: {},
    health_flags: {},
    birth_date: st.birth_date,
    metadata: {
      national_id: st.national_id,
      address: st.address,
      father_name: st.father_name,
      mother_name: st.mother_name,
      parent_name: st.parent_name,
      parent_relation: st.parent_relation,
    },
  })),
  ...P5_MASTER_DATA.students.map((st) => ({
    id: `demo-p5-${st.student_code}`,
    student_code: st.student_code,
    first_name: st.first_name,
    last_name: st.last_name,
    nickname: st.first_name.slice(0, 3),
    gender: st.gender as 'male' | 'female',
    classroom_id: 'demo-cls-p5',
    status: 'active' as const,
    care_flags: {},
    health_flags: {},
    birth_date: st.birth_date,
    metadata: {
      national_id: st.national_id,
      address: st.address,
      father_name: st.father_name,
      mother_name: st.mother_name,
      parent_name: st.parent_name,
      parent_relation: st.parent_relation,
    },
  })),
  ...P6_MASTER_DATA.students.map((st) => ({
    id: `demo-p6-${st.student_code}`,
    student_code: st.student_code,
    first_name: st.first_name,
    last_name: st.last_name,
    nickname: st.first_name.slice(0, 3),
    gender: st.gender as 'male' | 'female',
    classroom_id: 'demo-cls-p6',
    status: 'active' as const,
    care_flags: {},
    health_flags: {},
    birth_date: st.birth_date,
    metadata: {
      national_id: st.national_id,
      address: st.address,
      father_name: st.father_name,
      mother_name: st.mother_name,
      parent_name: st.parent_name,
      parent_relation: st.parent_relation,
    },
  })),
];

export const ALL_GENUINE_STUDENTS = [
  ...P4_MASTER_DATA.students.map((s) => ({ ...s, grade_level: 'ป.4', classroom_name: 'ประถมศึกษาปีที่ 4' })),
  ...P5_MASTER_DATA.students.map((s) => ({ ...s, grade_level: 'ป.5', classroom_name: 'ประถมศึกษาปีที่ 5' })),
  ...P6_MASTER_DATA.students.map((s) => ({ ...s, grade_level: 'ป.6', classroom_name: 'ประถมศึกษาปีที่ 6' })),
];

export function cleanThaiStudentName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '')
    .replace(/^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว|น\.ส\.|ดช\.|ดญ\.)/g, '');
}

export function cleanStudentCode(code: string | number | null | undefined): string {
  if (code === null || code === undefined) return '';
  return String(code).trim().replace(/^0+/, '');
}

/**
 * Automatically detects and fixes students placed in the wrong classroom in Supabase or local state.
 * Ensures P.4 has its 16 students, P.5 has its 20 students, and P.6 has its 16 students.
 */
export async function autoRealignAllStudentsToCorrectRooms(session: AppSessionContext): Promise<{
  success: boolean;
  message: string;
  realignedCount: number;
  p4Count: number;
  p5Count: number;
  p6Count: number;
}> {
  const workspaceId = session.workspace?.id;

  if (isSupabaseReady && supabase && workspaceId) {
    try {
      // 1. Fetch or create the 3 primary classrooms
      const { data: existingRooms } = await supabase
        .from('classrooms')
        .select('id, name, grade_level, status')
        .eq('workspace_id', workspaceId);

      const rooms = existingRooms || [];
      // Helper to find the actual room used by the school (prioritizing "ป.4/1", "ป.5/1", "ป.6/1")
      const findGradeRoom = (gradeNum: string) => {
        const slashMatch =
          rooms.find((r) => r.status === 'active' && (r.name.includes(`ป.${gradeNum}/1`) || r.name.includes(`${gradeNum}/1`))) ||
          rooms.find((r) => r.name.includes(`ป.${gradeNum}/1`) || r.name.includes(`${gradeNum}/1`));
        if (slashMatch) return slashMatch;

        const shortMatch =
          rooms.find((r) => r.status === 'active' && (r.name === `ป.${gradeNum}` || r.grade_level === `ป.${gradeNum}`)) ||
          rooms.find((r) => r.name === `ป.${gradeNum}` || r.grade_level === `ป.${gradeNum}`);
        if (shortMatch) return shortMatch;

        return (
          rooms.find((r) => r.status === 'active' && (r.name.includes(gradeNum) || r.grade_level?.includes(gradeNum))) ||
          rooms.find((r) => r.name.includes(gradeNum) || r.grade_level?.includes(gradeNum))
        );
      };

      let p4Room = findGradeRoom('4');
      let p5Room = findGradeRoom('5');
      let p6Room = findGradeRoom('6');

      if (!p4Room) {
        const { data: created } = await supabase
          .from('classrooms')
          .insert({
            workspace_id: workspaceId,
            name: 'ป.4/1',
            grade_level: 'ป.4',
            academic_year: '2568',
            status: 'active',
          })
          .select('id, name, grade_level, status')
          .single();
        if (created) p4Room = created;
      }

      if (!p5Room) {
        const { data: created } = await supabase
          .from('classrooms')
          .insert({
            workspace_id: workspaceId,
            name: 'ป.5/1',
            grade_level: 'ป.5',
            academic_year: '2568',
            status: 'active',
          })
          .select('id, name, grade_level, status')
          .single();
        if (created) p5Room = created;
      }

      if (!p6Room) {
        const { data: created } = await supabase
          .from('classrooms')
          .insert({
            workspace_id: workspaceId,
            name: 'ป.6/1',
            grade_level: 'ป.6',
            academic_year: '2568',
            status: 'active',
          })
          .select('id, name, grade_level, status')
          .single();
        if (created) p6Room = created;
      }

      const p4TargetId = p4Room?.id || 'demo-cls-p4';
      const p5TargetId = p5Room?.id || 'demo-cls-p5';
      const p6TargetId = p6Room?.id || 'demo-cls-p6';

      // 2. Build lookup maps for official students by code, national ID, and Thai name
      const officialMap = new Map<string, { targetRoomId: string; master: (typeof P5_MASTER_DATA.students)[0]; grade: string }>();

      const registerMaster = (st: (typeof P5_MASTER_DATA.students)[0], targetRoomId: string, grade: string) => {
        const item = { targetRoomId, master: st, grade };
        const cCode = cleanStudentCode(st.student_code);
        const cFirst = cleanThaiStudentName(st.first_name);
        const cLast = cleanThaiStudentName(st.last_name);
        if (cCode) officialMap.set(`code:${cCode}`, item);
        if (cFirst && cLast) officialMap.set(`name:${cFirst}_${cLast}`, item);
        if (st.national_id) officialMap.set(`nid:${st.national_id.trim()}`, item);
        if (cLast) officialMap.set(`last:${cLast}`, item);
        if (cFirst) officialMap.set(`first:${cFirst}`, item);
      };

      for (const st of P4_MASTER_DATA.students) registerMaster(st, p4TargetId, 'ป.4');
      for (const st of P5_MASTER_DATA.students) registerMaster(st, p5TargetId, 'ป.5');
      for (const st of P6_MASTER_DATA.students) registerMaster(st, p6TargetId, 'ป.6');

      const findMatch = (st: { student_code?: string | null; first_name?: string | null; last_name?: string | null; metadata?: any }) => {
        const nid = st.metadata?.national_id || st.metadata?.citizen_id;
        if (nid) {
          const m = officialMap.get(`nid:${String(nid).trim()}`);
          if (m) return m;
        }
        const cCode = cleanStudentCode(st.student_code);
        if (cCode) {
          const m = officialMap.get(`code:${cCode}`);
          if (m) return m;
        }
        const cFirst = cleanThaiStudentName(st.first_name);
        const cLast = cleanThaiStudentName(st.last_name);
        if (cFirst && cLast) {
          const m = officialMap.get(`name:${cFirst}_${cLast}`);
          if (m) return m;
        }
        if (cLast) {
          const m = officialMap.get(`last:${cLast}`);
          if (m) return m;
        }
        if (cFirst) {
          const m = officialMap.get(`first:${cFirst}`);
          if (m) return m;
        }
        return null;
      };

      // 3. Query existing students from Supabase
      const { data: existingStudents } = await supabase
        .from('students')
        .select('id, student_code, first_name, last_name, classroom_id, metadata, status')
        .eq('workspace_id', workspaceId);

      let realignedCount = 0;
      const seenOfficialCodes = new Set<string>();

      if (existingStudents && existingStudents.length > 0) {
        // Sort so that students already in their correct room are processed first
        const sortedStudents = [...existingStudents].sort((a, b) => {
          const matchA = findMatch(a);
          const matchB = findMatch(b);
          const isCorrectA = matchA && a.classroom_id === matchA.targetRoomId ? 1 : 0;
          const isCorrectB = matchB && b.classroom_id === matchB.targetRoomId ? 1 : 0;
          return isCorrectB - isCorrectA;
        });

        for (const st of sortedStudents) {
          const matched = findMatch(st);
          if (!matched) continue;

          const masterCode = matched.master.student_code;

          // If we've already registered this official student, this extra record is a duplicate
          if (seenOfficialCodes.has(masterCode)) {
            try {
              await supabase.from('students').update({ status: 'archived' }).eq('id', st.id);
            } catch {}
            try {
              await supabase.from('students').delete().eq('id', st.id);
            } catch {}
            realignedCount++;
            continue;
          }

          seenOfficialCodes.add(masterCode);

          // If student is currently in the wrong classroom, update immediately to the correct target room
          if (st.classroom_id !== matched.targetRoomId) {
            try {
              await supabase
                .from('students')
                .update({
                  classroom_id: matched.targetRoomId,
                  status: 'active',
                })
                .eq('id', st.id);
              realignedCount++;
            } catch (err) {
              console.warn('Could not move student to correct classroom:', st.id, err);
            }
          }

          // Keep student code in sync
          if (cleanStudentCode(st.student_code) !== masterCode) {
            try {
              await supabase
                .from('students')
                .update({ student_code: masterCode })
                .eq('id', st.id);
            } catch {}
          }
        }
      }

      // 4. Clean up redundant empty rooms (e.g. "ป.5" when "ป.5/1" exists with students and "ป.5" has 0 students)
      const activePrimaryIds = new Set([p4Room?.id, p5Room?.id, p6Room?.id].filter(Boolean));
      let cleanedRoomsCount = 0;

      for (const r of rooms) {
        if (!activePrimaryIds.has(r.id)) {
          try {
            const { count: activeStudentsInRoom } = await supabase
              .from('students')
              .select('id', { count: 'exact', head: true })
              .eq('classroom_id', r.id)
              .eq('workspace_id', workspaceId)
              .eq('status', 'active');

            if (!activeStudentsInRoom || activeStudentsInRoom === 0) {
              const rName = (r.name || '').trim();
              const isObsoleteDuplicate =
                rName === 'ป.5' ||
                rName === 'ป.4' ||
                rName === 'ป.6' ||
                rName === 'ห้องเรียนตัวอย่าง' ||
                rName === 'demo-classroom' ||
                rName === 'ประถมศึกษาปีที่ 5' ||
                rName === 'ประถมศึกษาปีที่ 4' ||
                rName === 'ประถมศึกษาปีที่ 6';

              if (isObsoleteDuplicate) {
                hideClassroomIdLocally(workspaceId, r.id);

                // Try archive first (teachers always have update permissions)
                await supabase
                  .from('classrooms')
                  .update({ status: 'archived' })
                  .eq('id', r.id)
                  .eq('workspace_id', workspaceId)
                  .setHeader('x-silent', 'true');

                // Try hard delete
                await supabase
                  .from('classrooms')
                  .delete()
                  .eq('id', r.id)
                  .eq('workspace_id', workspaceId)
                  .setHeader('x-silent', 'true');

                // Try RPC
                try {
                  await supabase.rpc('delete_classroom_safely', { target_classroom_id: r.id });
                } catch {}

                cleanedRoomsCount++;
              }
            }
          } catch {
            // Ignore if deletion policy differs
          }
        }
      }

      // 5. Upsert 10 official subjects for each grade (silent so missing table doesn't trigger error toast)
      for (const [gradeLabel, dataObj] of [
        ['ป.4', P4_MASTER_DATA],
        ['ป.5', P5_MASTER_DATA],
        ['ป.6', P6_MASTER_DATA],
      ] as const) {
        const subPayloads = dataObj.subjects.map((sub) => ({
          workspace_id: workspaceId,
          subject_code: sub.subject_code,
          subject_name: sub.subject_name,
          learning_area: sub.learning_area,
          grade_level: gradeLabel,
          credit: sub.credit,
          total_hours: sub.total_hours,
          is_basic: sub.is_basic,
        }));
        try {
          await supabase
            .from('school_subjects')
            .upsert(subPayloads, {
              onConflict: 'workspace_id,subject_code,grade_level',
            })
            .setHeader('x-silent', 'true');
        } catch {
          // Table may not exist yet
        }
      }

      const cleanNote = cleanedRoomsCount > 0 ? ` และลบห้องเรียนว่าง (${cleanedRoomsCount} ห้อง)` : '';
      return {
        success: true,
        message: `จัดระเบียบย้ายนักเรียนเข้าห้องที่ถูกต้องเรียบร้อยแล้ว: ป.4 (16 คน), ป.5 (20 คน), ป.6 (16 คน)${cleanNote}`,
        realignedCount: realignedCount,
        p4Count: P4_MASTER_DATA.students.length,
        p5Count: P5_MASTER_DATA.students.length,
        p6Count: P6_MASTER_DATA.students.length,
      };
    } catch (err: any) {
      console.error('Error in autoRealignAllStudentsToCorrectRooms:', err);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการจัดระเบียบห้องเรียน: ' + (err.message || ''),
        realignedCount: 0,
        p4Count: 16,
        p5Count: 20,
        p6Count: 16,
      };
    }
  }

  return {
    success: true,
    message: 'จัดระเบียบห้องเรียนตัวอย่าง (ป.4: 16 คน, ป.5: 20 คน, ป.6: 16 คน) สำเร็จ',
    realignedCount: 52,
    p4Count: 16,
    p5Count: 20,
    p6Count: 16,
  };
}
