export interface StudentCompetencyRecord {
  id: string;
  workspace_id: string;
  classroom_id: string;
  student_id: string;
  academic_year: string;
  term: '1' | '2' | 'yearly';
  comp_communication: 0 | 1 | 2 | 3;
  comp_thinking: 0 | 1 | 2 | 3;
  comp_problem_solving: 0 | 1 | 2 | 3;
  comp_life_skills: 0 | 1 | 2 | 3;
  comp_technology: 0 | 1 | 2 | 3;
  comp_summary: 0 | 1 | 2 | 3;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentActivityRecord {
  id: string;
  workspace_id: string;
  classroom_id: string;
  student_id: string;
  academic_year: string;
  term: '1' | '2' | 'yearly';
  act_guidance: 'pass' | 'fail' | 'exempt';
  act_scout: 'pass' | 'fail' | 'exempt';
  act_club: 'pass' | 'fail' | 'exempt';
  act_social: 'pass' | 'fail' | 'exempt';
  act_summary: 'pass' | 'fail' | 'exempt';
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export const OBEC_COMPETENCIES: { key: keyof Pick<StudentCompetencyRecord, 'comp_communication' | 'comp_thinking' | 'comp_problem_solving' | 'comp_life_skills' | 'comp_technology'>; label: string; desc: string }[] = [
  { key: 'comp_communication', label: '1. ความสามารถในการสื่อสาร', desc: 'การใช้ภาษาถ่ายทอดความคิด ความรู้ ความเข้าใจ และความรู้สึก' },
  { key: 'comp_thinking', label: '2. ความสามารถในการคิด', desc: 'การคิดวิเคราะห์ คิดสังเคราะห์ คิดสร้างสรรค์ และคิดอย่างมีวิจารณญาณ' },
  { key: 'comp_problem_solving', label: '3. ความสามารถในการแก้ปัญหา', desc: 'การแก้ปัญหาและอุปสรรคบนพื้นฐานของเหตุผลและคุณธรรม' },
  { key: 'comp_life_skills', label: '4. ความสามารถในการใช้ทักษะชีวิต', desc: 'การนำกระบวนการต่างๆ ไปใช้ในการดำเนินชีวิตประจำวันและการอยู่ร่วมกัน' },
  { key: 'comp_technology', label: '5. ความสามารถในการใช้เทคโนโลยี', desc: 'การเลือกและใช้เทคโนโลยีด้านต่างๆ ในการพัฒนาตนเองและการทำงาน' },
];

export const OBEC_ACTIVITIES: { key: keyof Pick<StudentActivityRecord, 'act_guidance' | 'act_scout' | 'act_club' | 'act_social'>; label: string; desc: string }[] = [
  { key: 'act_guidance', label: '1. กิจกรรมแนะแนว', desc: 'พัฒนาผู้เรียนให้รู้จักตนเอง เข้าใจสภาพแวดล้อม และปรับตัวได้อย่างเหมาะสม' },
  { key: 'act_scout', label: '2. กิจกรรมนักเรียน (ลูกเสือ/เนตรนารี/ยุวกาชาด)', desc: 'ปลูกฝังความเป็นระเบียบวินัย ความเสียสละ และความรับผิดชอบต่อสังคม' },
  { key: 'act_club', label: '3. กิจกรรมชุมนุม / ชมรม', desc: 'พัฒนาความถนัด ความสนใจ และความสามารถเฉพาะทางตามความสมัครใจ' },
  { key: 'act_social', label: '4. กิจกรรมเพื่อสังคมและสาธารณประโยชน์', desc: 'ส่งเสริมจิตสาธารณะ การมีส่วนร่วมและช่วยเหลือชุมชนสังคม' },
];
