import { formatThaiOfficialDate } from './officialReport';
import type { SchoolReportIdentity } from './scheduleSettings';

export interface PhorPhor5ClassMeta {
  schoolName: string;
  affiliation?: string; // เช่น สพป.ขอนแก่น เขต 1
  academicYear: string;
  gradeLevel: string;
  classroomName: string;
  homeroomTeacher: string;
  academicHead?: string;
  directorName?: string;
  studentCount: number;
}

export interface PhorPhor5SubjectMeta {
  schoolName: string;
  academicYear: string;
  term: string;
  subjectCode: string;
  subjectName: string;
  learningArea: string;
  gradeLevel: string;
  credit: number;
  hoursPerYear: number;
  teacherName: string;
  subjectHead?: string;
  academicHead?: string;
  directorName?: string;
}

export interface StudentPhorPhor6Data {
  studentCode: string;
  citizenId?: string;
  fullName: string;
  nickname?: string;
  birthDate?: string;
  classroomName: string;
  academicYear: string;
  attendance: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    leaveDays: number;
    absentDays: number;
    percentage: number;
  };
  subjects: {
    code: string;
    name: string;
    credit: number;
    score: number;
    grade: string;
    result: string;
  }[];
  characteristics: { trait: string; level: number; label: string }[];
  competencies: { name: string; level: number; label: string }[];
  activities: { name: string; status: 'pass' | 'fail' | 'exempt' }[];
  health?: {
    weightKg: number;
    heightCm: number;
    nutritionResult: string;
  };
  teacherComment?: string;
}

/**
 * Builds standard print CSS for Thai Ministry of Education PhorPhor documents (A4 size).
 */
export function buildPhorPhorDocumentCss(): string {
  return `
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    @page landscape {
      size: A4 landscape;
      margin: 12mm 12mm 12mm 12mm;
    }
    body {
      font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.4;
      font-size: 14px;
      margin: 0;
      padding: 0;
    }
    .page {
      page-break-after: always;
      position: relative;
      min-height: 260mm;
      box-sizing: border-box;
    }
    .page.landscape {
      min-height: 180mm;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .border-frame {
      border: 2px solid #1e293b;
      padding: 24px;
      min-height: 250mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .table-official {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }
    .table-official th, .table-official td {
      border: 1px solid #334155;
      padding: 6px 8px;
    }
    .table-official th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      text-align: center;
    }
    .sig-box {
      width: 45%;
    }
    .sig-line {
      margin-top: 40px;
      border-top: 1px dotted #334155;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
  `;
}

/**
 * Generates Front Cover for ปพ.5 รายชั้น (Classroom Quality Record Book)
 */
export function buildPhorPhor5ClassCoverHtml(meta: PhorPhor5ClassMeta, identity?: SchoolReportIdentity): string {
  const logoHtml = identity?.schoolLogoDataUrl
    ? `<img src="${identity.schoolLogoDataUrl}" style="max-height: 110px; max-width: 140px; margin-bottom: 16px; object-fit: contain;" alt="ตราโรงเรียน" />`
    : `<div style="font-size: 52px; margin-bottom: 16px;">🏫</div>`;

  return `
    <div class="page">
      <div class="border-frame">
        <div class="text-center" style="margin-top: 20px;">
          ${logoHtml}
          <div style="font-size: 26px; font-weight: bold; letter-spacing: 1px; color: #0f172a;">แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน</div>
          <div style="font-size: 20px; font-weight: bold; margin-top: 4px; color: #334155;">( ปพ.๕ ) รายชั้นเรียน</div>
          <div style="font-size: 16px; margin-top: 12px; color: #475569;">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
        </div>

        <div style="margin: 40px auto; width: 85%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; font-size: 16px; line-height: 2;">
          <div><strong>ระดับชั้น:</strong> ${meta.gradeLevel} &nbsp;&nbsp;&nbsp;&nbsp; <strong>ห้องเรียน:</strong> ${meta.classroomName}</div>
          <div><strong>ปีการศึกษา:</strong> ${meta.academicYear}</div>
          <div><strong>สถานศึกษา:</strong> ${meta.schoolName}</div>
          <div><strong>สังกัด:</strong> ${meta.affiliation || 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน'}</div>
          <div><strong>จำนวนนักเรียน:</strong> ${meta.studentCount} คน</div>
          <div><strong>ครูประจำชั้น:</strong> ${meta.homeroomTeacher || '..........................................................'}</div>
        </div>

        <div class="sig-row" style="margin-bottom: 20px;">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="margin-top: 6px;">( ${meta.homeroomTeacher || '..........................................................'} )</div>
            <div style="color: #64748b;">ครูประจำชั้น</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="margin-top: 6px;">( ${meta.directorName || identity?.directorName || '..........................................................'} )</div>
            <div style="color: #64748b;">ผู้อำนวยการสถานศึกษา</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates Front Cover for ปพ.5 รายวิชา (Subject Quality Record Book)
 */
export function buildPhorPhor5SubjectCoverHtml(meta: PhorPhor5SubjectMeta, identity?: SchoolReportIdentity): string {
  const logoHtml = identity?.schoolLogoDataUrl
    ? `<img src="${identity.schoolLogoDataUrl}" style="max-height: 110px; max-width: 140px; margin-bottom: 16px; object-fit: contain;" alt="ตราโรงเรียน" />`
    : `<div style="font-size: 52px; margin-bottom: 16px;">📚</div>`;

  return `
    <div class="page">
      <div class="border-frame">
        <div class="text-center" style="margin-top: 20px;">
          ${logoHtml}
          <div style="font-size: 26px; font-weight: bold; letter-spacing: 1px; color: #0f172a;">แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน</div>
          <div style="font-size: 20px; font-weight: bold; margin-top: 4px; color: #334155;">( ปพ.๕ ) รายวิชา</div>
          <div style="font-size: 16px; margin-top: 12px; color: #475569;">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
        </div>

        <div style="margin: 30px auto; width: 85%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; font-size: 16px; line-height: 2;">
          <div><strong>รหัสวิชา:</strong> ${meta.subjectCode} &nbsp;&nbsp;&nbsp;&nbsp; <strong>รายวิชา:</strong> ${meta.subjectName}</div>
          <div><strong>กลุ่มสาระการเรียนรู้:</strong> ${meta.learningArea}</div>
          <div><strong>ระดับชั้น:</strong> ${meta.gradeLevel} &nbsp;&nbsp;&nbsp;&nbsp; <strong>ภาคเรียนที่:</strong> ${meta.term} <strong>ปีการศึกษา:</strong> ${meta.academicYear}</div>
          <div><strong>เวลาเรียน:</strong> ${meta.hoursPerYear} ชั่วโมง/ปี &nbsp;&nbsp;&nbsp;&nbsp; <strong>หน่วยกิต:</strong> ${meta.credit} หน่วยกิต</div>
          <div><strong>สถานศึกษา:</strong> ${meta.schoolName}</div>
          <div><strong>ครูผู้สอน:</strong> ${meta.teacherName}</div>
        </div>

        <div class="sig-row" style="margin-bottom: 20px;">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="margin-top: 6px;">( ${meta.teacherName} )</div>
            <div style="color: #64748b;">ครูผู้สอน</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="margin-top: 6px;">( ${meta.directorName || identity?.directorName || '..........................................................'} )</div>
            <div style="color: #64748b;">ผู้อำนวยการสถานศึกษา</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates Official School Certificate (ใบรับรองการเป็นนักเรียน)
 */
export function buildOfficialStudentCertificateHtml(params: {
  schoolName: string;
  affiliation?: string;
  documentNumber: string;
  studentName: string;
  studentCode: string;
  citizenId?: string;
  gradeLevel: string;
  classroomName: string;
  academicYear: string;
  issueDateStr?: string;
  purpose?: string;
  directorName: string;
  directorTitle?: string;
  logoUrl?: string;
}): string {
  const thaiDate = formatThaiOfficialDate(params.issueDateStr || new Date().toISOString());
  const logoHtml = params.logoUrl
    ? `<img src="${params.logoUrl}" style="height: 85px; width: auto; object-fit: contain; margin-bottom: 8px;" alt="ตราโรงเรียน" />`
    : `<div style="font-size: 42px; margin-bottom: 8px;">🏛️</div>`;

  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8" />
      <title>ใบรับรองการเป็นนักเรียน - ${params.studentName}</title>
      <style>
        ${buildPhorPhorDocumentCss()}
        body { padding: 40px; font-size: 16px; line-height: 1.8; }
        .cert-container { max-width: 800px; margin: 0 auto; }
        .cert-header { text-align: center; margin-bottom: 30px; }
        .cert-title { font-size: 24px; font-weight: bold; margin-top: 10px; }
        .cert-body { text-indent: 50px; margin-top: 24px; text-align: justify; }
        .cert-sig { margin-top: 60px; float: right; text-align: center; width: 300px; }
      </style>
    </head>
    <body>
      <div class="cert-container">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>ที่ ${params.documentNumber}</div>
          <div class="cert-header">
            ${logoHtml}
            <div class="cert-title">ใบรับรอง</div>
            <div>${params.schoolName}</div>
          </div>
          <div style="width: 100px;"></div>
        </div>

        <div class="cert-body">
          หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong>${params.studentName}</strong> รหัสประจำตัวนักเรียน <strong>${params.studentCode}</strong>
          ${params.citizenId ? `เลขประจำตัวประชาชน <strong>${params.citizenId}</strong>` : ''} 
          เป็นนักเรียนของ <strong>${params.schoolName}</strong> ${params.affiliation ? `สังกัด ${params.affiliation}` : ''}
          กำลังศึกษาอยู่ในระดับชั้น <strong>${params.gradeLevel} (${params.classroomName})</strong> ประจำปีการศึกษา <strong>${params.academicYear}</strong> จริง
        </div>

        ${params.purpose ? `
          <div class="cert-body">
            ออกให้ ณ วันที่ขอ เพื่อใช้สำหรับ${params.purpose}
          </div>
        ` : ''}

        <div style="margin-top: 30px; text-align: center;">
          ให้ไว้ ณ ${thaiDate}
        </div>

        <div class="cert-sig">
          <div style="height: 50px;"></div>
          <div>( ${params.directorName || '..........................................................'} )</div>
          <div style="margin-top: 4px; color: #475569;">${params.directorTitle || 'ผู้อำนวยการสถานศึกษา'}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}
