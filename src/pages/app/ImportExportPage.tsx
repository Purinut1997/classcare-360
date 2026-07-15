import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Download, FileUp, RotateCcw, Save, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { readSheet } from 'read-excel-file/browser';

import { writeAuditLog } from '../../lib/auditLog';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface ImportExportPageProps {
  session: AppSessionContext;
}

interface ClassroomRow {
  id: string;
  name: string;
}

interface StudentExportRow {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  status?: 'active' | 'transferred' | 'graduated' | 'inactive' | 'archived';
  student_code: string | null;
}

interface PreviewRow {
  careFlags?: Record<string, unknown>;
  classroomName: string;
  dmcGrade?: string;
  dmcRoom?: string;
  errors: string[];
  birthDate?: string | null;
  firstName: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  healthFlags?: Record<string, unknown>;
  lastName: string;
  metadata?: Record<string, unknown>;
  nickname: string;
  rowNumber: number;
  source?: 'csv' | 'dmc' | 'manual';
  studentCode: string;
  warnings: string[];
}

interface DmcClassOption {
  classroomName: string;
  count: number;
  grade: string;
  key: string;
  room: string;
}

interface GuardianPreviewRow {
  consentStatus: 'pending' | 'granted' | 'revoked';
  createPortalInvite: boolean;
  errors: string[];
  guardianEmail: string;
  guardianName: string;
  guardianPhone: string;
  relation: string;
  rowNumber: number;
  studentCode: string;
  studentId: string | null;
  studentName: string;
  warnings: string[];
}

interface BackupRow {
  created_at: string;
  id: string;
  row_counts: Record<string, number>;
  status: string;
}

interface WorkspaceBackupPackage {
  app: 'ClassCare 360';
  data: {
    classrooms: ClassroomRow[];
    guardianPreviewRows: GuardianPreviewRow[];
    previewRows: PreviewRow[];
    students: StudentExportRow[];
  };
  exportedAt: string;
  restoreNotes: string[];
  rowCounts: Record<string, number>;
  schemaVersion: 'classcare-workspace-backup-v1';
  workspace: {
    academicYear: string | null;
    id: string | null;
    name: string | null;
    schoolName: string | null;
  };
}

interface StudentInsertRow {
  birth_date?: string | null;
  care_flags?: Record<string, unknown>;
  classroom_id: string;
  first_name: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  health_flags?: Record<string, unknown>;
  last_name: string;
  metadata?: Record<string, unknown>;
  nickname: string | null;
  status: 'active';
  student_code: string | null;
  workspace_id: string;
}

const templateHeaders = ['student_code', 'first_name', 'last_name', 'nickname', 'classroom_name'];
const studentStatusLabels: Record<NonNullable<StudentExportRow['status']>, string> = {
  active: 'กำลังเรียน',
  archived: 'เก็บถาวร',
  graduated: 'จบแล้ว',
  inactive: 'พักใช้งาน',
  transferred: 'ย้ายออก',
};
const guardianTemplateHeaders = [
  'student_code',
  'relation',
  'guardian_name',
  'guardian_email',
  'guardian_phone',
  'consent_status',
  'create_portal_invite',
];

const demoClassrooms: ClassroomRow[] = [{ id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentExportRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
];

function escapeCsv(value: string | number | null) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseStudentCsv(text: string, existingCodes: Set<string>) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const [headerLine, ...rows] = lines;
  const headers = parseCsvLine(headerLine || '').map((header) => header.trim());

  return rows.map((line, index) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] || '']));
    const studentCode = String(record.student_code || '').trim();
    const firstName = String(record.first_name || '').trim();
    const lastName = String(record.last_name || '').trim();
    const classroomName = String(record.classroom_name || '').trim();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!firstName) errors.push('ไม่มี first_name');
    if (!lastName) errors.push('ไม่มี last_name');
    if (!classroomName) errors.push('ไม่มี classroom_name');
    if (studentCode && existingCodes.has(studentCode)) warnings.push('รหัสซ้ำกับข้อมูลเดิม จะถูกข้ามใน import จริง');

    return {
      classroomName,
      errors,
      firstName,
      lastName,
      nickname: String(record.nickname || '').trim(),
      rowNumber: index + 2,
      source: 'csv' as const,
      studentCode,
      warnings,
    };
  });
}

function normalizeCell(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeHeader(value: unknown) {
  return normalizeCell(value).replace(/\s+/g, '');
}

function normalizeGender(value: unknown): PreviewRow['gender'] {
  const text = normalizeCell(value);
  if (['ช', 'ชาย', 'เด็กชาย', 'นาย', 'male'].includes(text.toLowerCase())) return 'male';
  if (['ญ', 'หญิง', 'เด็กหญิง', 'นางสาว', 'female'].includes(text.toLowerCase())) return 'female';
  if (!text || text === '-') return 'unspecified';
  return 'other';
}

function normalizeDmcBirthDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = normalizeCell(value);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]) > 2400 ? Number(match[3]) - 543 : Number(match[3]);
  if (!day || !month || !year) return null;

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function nullableText(value: unknown) {
  const text = normalizeCell(value);
  return text && text !== '-' ? text : null;
}

function findHeaderIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('ชั้น') && headers.includes('ห้อง') && headers.includes('ชื่อ') && headers.includes('นามสกุล');
  });
}

function getColumnIndex(headers: string[], label: string, fallback = -1) {
  const index = headers.findIndex((header) => header === label);
  return index >= 0 ? index : fallback;
}

function parseDmcWorkbookRows(rows: unknown[][], existingCodes: Set<string>) {
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new Error('ไม่พบหัวตาราง DMC: ต้องมีคอลัมน์ ชั้น, ห้อง, ชื่อ, นามสกุล');
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const studentNumberIndexes = headers
    .map((header, index) => (header === 'เลขประจำตัวนักเรียน' ? index : -1))
    .filter((index) => index >= 0);
  const idCardIndex = studentNumberIndexes.length > 1 ? studentNumberIndexes[0] : -1;
  const studentCodeIndex = studentNumberIndexes.length > 1 ? studentNumberIndexes[1] : studentNumberIndexes[0] ?? -1;
  const schoolCodeIndex = getColumnIndex(headers, 'รหัสโรงเรียน');
  const schoolNameIndex = getColumnIndex(headers, 'ชื่อโรงเรียน');
  const gradeIndex = getColumnIndex(headers, 'ชั้น', 3);
  const roomIndex = getColumnIndex(headers, 'ห้อง', 4);
  const genderIndex = getColumnIndex(headers, 'เพศ');
  const prefixIndex = getColumnIndex(headers, 'คำนำหน้าชื่อ');
  const firstNameIndex = getColumnIndex(headers, 'ชื่อ', 8);
  const lastNameIndex = getColumnIndex(headers, 'นามสกุล', 9);
  const birthDateIndex = getColumnIndex(headers, 'วันเกิด');
  const ageIndex = getColumnIndex(headers, 'อายุ(ปี)');
  const weightIndex = getColumnIndex(headers, 'น้ำหนัก');
  const heightIndex = getColumnIndex(headers, 'ส่วนสูง');
  const bloodTypeIndex = getColumnIndex(headers, 'กลุ่มเลือด');
  const religionIndex = getColumnIndex(headers, 'ศาสนา');
  const ethnicityIndex = getColumnIndex(headers, 'เชื้อชาติ');
  const nationalityIndex = getColumnIndex(headers, 'สัญชาติ');
  const houseNoIndex = getColumnIndex(headers, 'บ้านเลขที่');
  const villageNoIndex = getColumnIndex(headers, 'หมู่');
  const roadIndex = getColumnIndex(headers, 'ถนน/ซอย');
  const subdistrictIndex = getColumnIndex(headers, 'ตำบล');
  const districtIndex = getColumnIndex(headers, 'อำเภอ');
  const provinceIndex = getColumnIndex(headers, 'จังหวัด');
  const guardianPrefixIndex = getColumnIndex(headers, 'คำนำหน้าชื่อผู้ปกครอง');
  const guardianFirstNameIndex = getColumnIndex(headers, 'ชื่อผู้ปกครอง');
  const guardianLastNameIndex = getColumnIndex(headers, 'นามสกุลผู้ปกครอง');
  const guardianJobIndex = getColumnIndex(headers, 'อาชีพของผู้ปกครอง');
  const guardianRelationIndex = getColumnIndex(headers, 'ความเกี่ยวข้องของผู้ปกครองกับนักเรียน');
  const fatherPrefixIndex = getColumnIndex(headers, 'คำนำหน้าชื่อบิดา');
  const fatherFirstNameIndex = getColumnIndex(headers, 'ชื่อบิดา');
  const fatherLastNameIndex = getColumnIndex(headers, 'นามสกุลบิดา');
  const fatherJobIndex = getColumnIndex(headers, 'อาชีพของบิดา');
  const motherPrefixIndex = getColumnIndex(headers, 'คำนำหน้าชื่อมารดา');
  const motherFirstNameIndex = getColumnIndex(headers, 'ชื่อมารดา');
  const motherLastNameIndex = getColumnIndex(headers, 'นามสกุลมารดา');
  const motherJobIndex = getColumnIndex(headers, 'อาชีพของมารดา');
  const disadvantageIndex = getColumnIndex(headers, 'ความด้อยโอกาส');
  const cannotDisposeIndex = getColumnIndex(headers, 'ยังไม่สามารถจำหน่ายได้(3.1.8)');

  const seenCodes = new Set<string>();
  const previewRows = rows.slice(headerIndex + 1).flatMap((row, index) => {
    const grade = normalizeCell(row[gradeIndex]);
    const room = normalizeCell(row[roomIndex]);
    const firstName = normalizeCell(row[firstNameIndex]);
    const lastName = normalizeCell(row[lastNameIndex]);
    const studentCode = normalizeCell(row[studentCodeIndex]);
    const prefix = normalizeCell(row[prefixIndex]);
    const birthDate = normalizeDmcBirthDate(row[birthDateIndex]);
    const classroomName = [grade, room].filter(Boolean).join('/') || grade || room;
    const address = {
      district: nullableText(row[districtIndex]),
      house_no: nullableText(row[houseNoIndex]),
      province: nullableText(row[provinceIndex]),
      road_or_soi: nullableText(row[roadIndex]),
      subdistrict: nullableText(row[subdistrictIndex]),
      village_no: nullableText(row[villageNoIndex]),
    };
    const guardian = {
      first_name: nullableText(row[guardianFirstNameIndex]),
      last_name: nullableText(row[guardianLastNameIndex]),
      occupation: nullableText(row[guardianJobIndex]),
      prefix: nullableText(row[guardianPrefixIndex]),
      relation: nullableText(row[guardianRelationIndex]),
    };
    const father = {
      first_name: nullableText(row[fatherFirstNameIndex]),
      last_name: nullableText(row[fatherLastNameIndex]),
      occupation: nullableText(row[fatherJobIndex]),
      prefix: nullableText(row[fatherPrefixIndex]),
    };
    const mother = {
      first_name: nullableText(row[motherFirstNameIndex]),
      last_name: nullableText(row[motherLastNameIndex]),
      occupation: nullableText(row[motherJobIndex]),
      prefix: nullableText(row[motherPrefixIndex]),
    };
    const healthFlags = {
      blood_type: nullableText(row[bloodTypeIndex]),
      height_cm: nullableText(row[heightIndex]),
      source: 'DMC',
      weight_kg: nullableText(row[weightIndex]),
    };
    const careFlags = {
      cannot_dispose_status: nullableText(row[cannotDisposeIndex]),
      disadvantage: nullableText(row[disadvantageIndex]),
      source: 'DMC',
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!grade && !room && !firstName && !lastName && !studentCode) return [];
    if (!grade) errors.push('ไม่มีชั้น');
    if (!room) errors.push('ไม่มีห้อง');
    if (!firstName) errors.push('ไม่มีชื่อ');
    if (!lastName) errors.push('ไม่มีนามสกุล');
    if (!studentCode) errors.push('ไม่มีเลขประจำตัวนักเรียน');
    if (studentCode && existingCodes.has(studentCode)) warnings.push('เลขประจำตัวซ้ำกับข้อมูลเดิม จะถูกข้ามใน import จริง');
    if (studentCode && seenCodes.has(studentCode)) warnings.push('เลขประจำตัวซ้ำในไฟล์ DMC เดียวกัน');
    if (studentCode) seenCodes.add(studentCode);

    return [{
      birthDate,
      careFlags,
      classroomName,
      dmcGrade: grade,
      dmcRoom: room,
      errors,
      firstName,
      gender: normalizeGender(row[genderIndex]),
      healthFlags,
      lastName,
      metadata: {
        dmc_address: address,
        dmc_age_years: nullableText(row[ageIndex]),
        dmc_birth_date_raw: normalizeCell(row[birthDateIndex]) || null,
        dmc_ethnicity: nullableText(row[ethnicityIndex]),
        dmc_father: father,
        dmc_grade: grade || null,
        dmc_guardian: guardian,
        dmc_id_card: idCardIndex >= 0 ? normalizeCell(row[idCardIndex]) || null : null,
        dmc_import_source: 'DMC',
        dmc_mother: mother,
        dmc_nationality: nullableText(row[nationalityIndex]),
        dmc_prefix: prefix || null,
        dmc_religion: nullableText(row[religionIndex]),
        dmc_room: room || null,
        dmc_school_code: normalizeCell(row[schoolCodeIndex]) || null,
        dmc_school_name: normalizeCell(row[schoolNameIndex]) || null,
      },
      nickname: '',
      rowNumber: headerIndex + index + 2,
      source: 'dmc' as const,
      studentCode,
      warnings,
    }];
  });

  const optionMap = new Map<string, DmcClassOption>();
  previewRows.forEach((row) => {
    const grade = row.dmcGrade || '';
    const room = row.dmcRoom || '';
    const key = `${grade}::${room}`;
    const existing = optionMap.get(key);
    optionMap.set(key, {
      classroomName: row.classroomName,
      count: (existing?.count || 0) + 1,
      grade,
      key,
      room,
    });
  });

  return {
    classOptions: Array.from(optionMap.values()).sort((a, b) => a.classroomName.localeCompare(b.classroomName, 'th')),
    previewRows,
  };
}

function parseBooleanCell(value: string) {
  return ['1', 'true', 'yes', 'y', 'invite', 'ส่ง', 'ใช่'].includes(value.trim().toLowerCase());
}

function normalizeConsent(value: string): GuardianPreviewRow['consentStatus'] {
  if (value === 'granted' || value === 'ยินยอมแล้ว') return 'granted';
  if (value === 'revoked' || value === 'ถอนยินยอม') return 'revoked';
  return 'pending';
}

function parseGuardianCsv(text: string, studentsByCode: Map<string, StudentExportRow>) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const [headerLine, ...rows] = lines;
  const headers = parseCsvLine(headerLine || '').map((header) => header.trim());
  const seenPairs = new Set<string>();

  return rows.map((line, index) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] || '']));
    const studentCode = String(record.student_code || '').trim();
    const relation = String(record.relation || '').trim() || 'ผู้ปกครอง';
    const guardianName = String(record.guardian_name || '').trim();
    const guardianEmail = String(record.guardian_email || '').trim().toLowerCase();
    const guardianPhone = String(record.guardian_phone || '').trim();
    const student = studentCode ? studentsByCode.get(studentCode) : null;
    const pairKey = `${studentCode}:${guardianEmail || guardianPhone || guardianName}`;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!studentCode) errors.push('ไม่มี student_code');
    if (!student) errors.push('ไม่พบนักเรียนตาม student_code');
    if (!guardianName) errors.push('ไม่มี guardian_name');
    if (!guardianEmail && !guardianPhone) warnings.push('ไม่มี email/phone อย่างน้อยควรมีช่องทางติดต่อ');
    if (guardianEmail && !guardianEmail.includes('@')) errors.push('guardian_email ไม่ถูกต้อง');
    if (seenPairs.has(pairKey)) warnings.push('ข้อมูลผู้ปกครองซ้ำในไฟล์เดียวกัน');
    seenPairs.add(pairKey);

    return {
      consentStatus: normalizeConsent(String(record.consent_status || 'pending').trim()),
      createPortalInvite: parseBooleanCell(String(record.create_portal_invite || '')),
      errors,
      guardianEmail,
      guardianName,
      guardianPhone,
      relation,
      rowNumber: index + 2,
      studentCode,
      studentId: student?.id || null,
      studentName: student ? `${student.first_name} ${student.last_name}` : '-',
      warnings,
    };
  });
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isWorkspaceBackupPackage(value: unknown): value is WorkspaceBackupPackage {
  if (!value || typeof value !== 'object') return false;
  const packageValue = value as Partial<WorkspaceBackupPackage>;
  return (
    packageValue.app === 'ClassCare 360' &&
    packageValue.schemaVersion === 'classcare-workspace-backup-v1' &&
    Boolean(packageValue.data) &&
    Array.isArray(packageValue.data?.classrooms) &&
    Array.isArray(packageValue.data?.students)
  );
}

export function ImportExportPage({ session }: ImportExportPageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentExportRow[]>(demoStudents);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [dmcRows, setDmcRows] = useState<PreviewRow[]>([]);
  const [dmcClassOptions, setDmcClassOptions] = useState<DmcClassOption[]>([]);
  const [selectedDmcClassKeys, setSelectedDmcClassKeys] = useState<string[]>([]);
  const [manualStudent, setManualStudent] = useState({
    classroomName: session.workspace?.classroomName || demoClassrooms[0].name,
    firstName: '',
    lastName: '',
    nickname: '',
    studentCode: '',
  });
  const [guardianPreviewRows, setGuardianPreviewRows] = useState<GuardianPreviewRow[]>([]);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [backupPackagePreview, setBackupPackagePreview] = useState<WorkspaceBackupPackage | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อ import/export/backup กับ Supabase จริง',
  );
  const [studentManageQuery, setStudentManageQuery] = useState('');
  const [studentManageClassroomId, setStudentManageClassroomId] = useState('all');
  const [studentManageStatus, setStudentManageStatus] = useState<StudentExportRow['status'] | 'all'>('all');
  const [selectedManagedStudentIds, setSelectedManagedStudentIds] = useState<string[]>([]);

  const classroomNameById = useMemo(
    () => Object.fromEntries(classrooms.map((classroom) => [classroom.id, classroom.name])),
    [classrooms],
  );
  const existingCodes = useMemo(
    () =>
      new Set(
        students
          .filter((student) => (student.status || 'active') !== 'archived')
          .map((student) => student.student_code)
          .filter(Boolean) as string[],
      ),
    [students],
  );
  const validPreviewRows = previewRows.filter((row) => row.errors.length === 0 && row.warnings.length === 0);
  const invalidPreviewRows = previewRows.filter((row) => row.errors.length > 0 || row.warnings.length > 0);
  const managedStudents = useMemo(() => {
    const normalizedQuery = studentManageQuery.trim().toLowerCase();

    return students.filter((student) => {
      const status = student.status || 'active';
      if (studentManageStatus !== 'all' && status !== studentManageStatus) return false;
      if (studentManageClassroomId !== 'all' && student.classroom_id !== studentManageClassroomId) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        student.student_code,
        student.first_name,
        student.last_name,
        student.nickname,
        classroomNameById[student.classroom_id || ''],
        studentStatusLabels[status],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [classroomNameById, studentManageClassroomId, studentManageQuery, studentManageStatus, students]);
  const studentsByCode = useMemo(
    () =>
      new Map(
        students
          .filter((student) => student.student_code)
          .map((student) => [student.student_code as string, student]),
      ),
    [students],
  );
  const validGuardianRows = guardianPreviewRows.filter((row) => row.errors.length === 0);
  const invalidGuardianRows = guardianPreviewRows.filter((row) => row.errors.length > 0);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setBackups([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: backupRows, error: backupError },
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id,name')
          .eq('workspace_id', session.workspace.id)
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,status,classroom_id')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('workspace_backups')
          .select('id,status,row_counts,created_at')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || backupError) {
        setNotice(classroomError?.message || studentError?.message || backupError?.message || 'โหลดข้อมูล import/export ไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      setClassrooms((classroomRows || []) as ClassroomRow[]);
      setStudents((studentRows || []) as StudentExportRow[]);
      setBackups((backupRows || []) as BackupRow[]);
      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  function exportTemplate() {
    const sample = ['001', 'สมชาย', 'รักเรียน', 'ชาย', session.workspace?.classroomName || 'ป.5/2'];
    downloadText('classcare-students-template.csv', [templateHeaders.join(','), sample.map(escapeCsv).join(',')].join('\n'), 'text/csv;charset=utf-8');
  }

  function exportGuardianTemplate() {
    const sample = ['001', 'มารดา', 'คุณแม่สมชาย', 'parent@example.com', '08x-xxx-xxxx', 'pending', 'yes'];
    downloadText(
      'classcare-guardians-template.csv',
      [guardianTemplateHeaders.join(','), sample.map(escapeCsv).join(',')].join('\n'),
      'text/csv;charset=utf-8',
    );
  }

  function exportStudents() {
    const lines = [
      templateHeaders.join(','),
      ...students.map((student) =>
        [
          student.student_code || '',
          student.first_name,
          student.last_name,
          student.nickname || '',
          classroomNameById[student.classroom_id || ''] || '',
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];
    downloadText('classcare-students-export.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setPreviewRows(parseStudentCsv(text, existingCodes));
    setNotice(`อ่านไฟล์ ${file.name} แล้ว กรุณาตรวจ preview ก่อน import`);
  }

  function applyDmcClassSelection(classKeys: string[], rows = dmcRows) {
    setSelectedDmcClassKeys(classKeys);
    const selectedKeySet = new Set(classKeys);
    const selectedRows = rows.filter((row) => selectedKeySet.has(`${row.dmcGrade || ''}::${row.dmcRoom || ''}`));
    setPreviewRows(selectedRows);
  }

  function toggleDmcClassSelection(classKey: string) {
    const nextKeys = selectedDmcClassKeys.includes(classKey)
      ? selectedDmcClassKeys.filter((key) => key !== classKey)
      : [...selectedDmcClassKeys, classKey];
    applyDmcClassSelection(nextKeys);
  }

  async function handleDmcFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await readSheet(file);
      const parsed = parseDmcWorkbookRows(rows as unknown[][], existingCodes);
      const firstClassKey = parsed.classOptions[0]?.key;
      const initialKeys = firstClassKey ? [firstClassKey] : [];
      setDmcRows(parsed.previewRows);
      setDmcClassOptions(parsed.classOptions);
      setSelectedDmcClassKeys(initialKeys);
      setPreviewRows(
        firstClassKey
          ? parsed.previewRows.filter((row) => `${row.dmcGrade || ''}::${row.dmcRoom || ''}` === firstClassKey)
          : parsed.previewRows,
      );
      setNotice(`อ่านไฟล์ DMC ${file.name} แล้ว พบ ${parsed.classOptions.length} ชั้น/ห้อง กรุณาเลือกชั้นที่ดูแลก่อน import`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'อ่านไฟล์ DMC ไม่สำเร็จ');
    }
  }

  function addManualStudentToPreview() {
    const firstName = manualStudent.firstName.trim();
    const lastName = manualStudent.lastName.trim();
    const classroomName = manualStudent.classroomName.trim();
    const studentCode = manualStudent.studentCode.trim();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!firstName) errors.push('ไม่มีชื่อ');
    if (!lastName) errors.push('ไม่มีนามสกุล');
    if (!classroomName) errors.push('ไม่มีชั้น/ห้อง');
    if (studentCode && existingCodes.has(studentCode)) warnings.push('เลขประจำตัวซ้ำกับข้อมูลเดิม จะถูกข้ามใน import จริง');
    if (studentCode && previewRows.some((row) => row.studentCode === studentCode)) warnings.push('เลขประจำตัวซ้ำใน preview');

    setPreviewRows((current) => [
      {
        classroomName,
        errors,
        firstName,
        gender: 'unspecified',
        lastName,
        metadata: {
          manual_added_by: session.profile.id,
          manual_source: 'ImportExportPage',
        },
        nickname: manualStudent.nickname.trim(),
        rowNumber: current.length + 1,
        source: 'manual',
        studentCode,
        warnings,
      },
      ...current,
    ]);
    setManualStudent((current) => ({
      ...current,
      firstName: '',
      lastName: '',
      nickname: '',
      studentCode: '',
    }));
    setNotice('เพิ่มนักเรียนเข้ารายการ preview แล้ว กรุณาตรวจสอบก่อน import');
  }

  async function handleGuardianFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setGuardianPreviewRows(parseGuardianCsv(text, studentsByCode));
    setNotice(`อ่านไฟล์ ${file.name} แล้ว กรุณาตรวจ preview ผู้ปกครองก่อน import`);
  }

  async function ensureClassroomByName(classroomName: string, gradeLevel?: string) {
    const existing = classrooms.find((classroom) => classroom.name === classroomName);
    if (existing) return existing.id;

    if (!supabase || !session.workspace) {
      const localClassroom = { id: `demo-classroom-${Date.now()}-${classroomName}`, name: classroomName };
      setClassrooms((current) => [...current, localClassroom]);
      return localClassroom.id;
    }

    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        academic_year: session.workspace.academicYear,
        grade_level: gradeLevel || null,
        homeroom_teacher_profile_id: session.profile.id,
        name: classroomName,
        workspace_id: session.workspace.id,
      })
      .select('id,name')
      .single();

    if (error) throw error;
    const nextClassroom = data as ClassroomRow;
    setClassrooms((current) => [...current, nextClassroom]);
    return nextClassroom.id;
  }

  function toggleManagedStudentSelection(studentId: string) {
    setSelectedManagedStudentIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId],
    );
  }

  function selectAllManagedStudents() {
    setSelectedManagedStudentIds(managedStudents.map((student) => student.id));
  }

  async function updateManagedStudentStatus(studentIds: string[], status: NonNullable<StudentExportRow['status']>) {
    if (studentIds.length === 0) {
      setNotice('กรุณาเลือกรายชื่อก่อนจัดการ');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase || !session.workspace) {
      setStudents((current) => current.map((student) => (studentIds.includes(student.id) ? { ...student, status } : student)));
      setSelectedManagedStudentIds([]);
      setNotice(`เปลี่ยนสถานะ ${studentIds.length} รายชื่อเป็น ${studentStatusLabels[status]} ในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .update({ status })
      .in('id', studentIds)
      .eq('workspace_id', session.workspace.id)
      .select('id,student_code,first_name,last_name,nickname,status,classroom_id');

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const updatedById = new Map(((data || []) as StudentExportRow[]).map((student) => [student.id, student]));
    setStudents((current) => current.map((student) => updatedById.get(student.id) || student));
    setSelectedManagedStudentIds([]);
    await writeAuditLog(session, {
      action: 'import_job.students_status_changed',
      entityId: session.workspace.id,
      entityTable: 'students',
      metadata: {
        count: studentIds.length,
        status,
        student_ids: studentIds,
      },
      riskLevel: status === 'archived' ? 'normal' : 'low',
      source: 'import_export',
    });
    setNotice(`เปลี่ยนสถานะ ${studentIds.length} รายชื่อเป็น ${studentStatusLabels[status]} แล้ว`);
    setIsSubmitting(false);
  }

  async function deleteManagedStudents(studentIds: string[]) {
    if (studentIds.length === 0) {
      setNotice('กรุณาเลือกรายชื่อก่อนลบ');
      return;
    }

    const confirmed = window.confirm(
      `ลบนักเรียน ${studentIds.length} รายชื่อถาวรหรือไม่?\n\nใช้เฉพาะกรณีนำเข้าซ้ำหรือนำเข้าผิด ถ้าไม่แน่ใจให้ใช้ “เก็บถาวร” ก่อน`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase || !session.workspace) {
      setStudents((current) => current.filter((student) => !studentIds.includes(student.id)));
      setSelectedManagedStudentIds([]);
      setNotice(`ลบ ${studentIds.length} รายชื่อออกจากโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .in('id', studentIds)
      .eq('workspace_id', session.workspace.id);

    if (error) {
      setNotice(`ลบถาวรไม่สำเร็จ: ${error.message} | ใช้เก็บถาวรได้ทันทีถ้า RLS ยังไม่อนุญาต delete`);
      setIsSubmitting(false);
      return;
    }

    setStudents((current) => current.filter((student) => !studentIds.includes(student.id)));
    setSelectedManagedStudentIds([]);
    await writeAuditLog(session, {
      action: 'import_job.students_deleted',
      entityId: session.workspace.id,
      entityTable: 'students',
      metadata: {
        count: studentIds.length,
        student_ids: studentIds,
      },
      riskLevel: 'high',
      source: 'import_export',
    });
    setNotice(`ลบ ${studentIds.length} รายชื่อถาวรแล้ว`);
    setIsSubmitting(false);
  }

  async function importValidRows() {
    setIsSubmitting(true);
    setNotice(null);

    if (validPreviewRows.length === 0) {
      setNotice('ไม่มีแถวที่พร้อม import');
      setIsSubmitting(false);
      return;
    }

    try {
      const rowsToInsert: StudentInsertRow[] = [];

      for (const row of validPreviewRows) {
        const classroomId = await ensureClassroomByName(row.classroomName, row.dmcGrade);
        rowsToInsert.push({
          birth_date: row.birthDate || null,
          care_flags: row.careFlags || {},
          classroom_id: classroomId,
          first_name: row.firstName,
          gender: row.gender || 'unspecified',
          health_flags: row.healthFlags || {},
          last_name: row.lastName,
          metadata: row.metadata || {
            import_source: row.source || 'student_csv',
          },
          nickname: row.nickname || null,
          status: 'active',
          student_code: row.studentCode || null,
          workspace_id: session.workspace?.id || 'demo-workspace',
        });
      }

      if (!supabase || !session.workspace) {
        setStudents((current) => [
          ...rowsToInsert.map((row, index) => ({
            classroom_id: row.classroom_id,
            first_name: row.first_name,
            id: `demo-imported-student-${Date.now()}-${index}`,
            last_name: row.last_name,
            nickname: row.nickname,
            status: 'active' as const,
            student_code: row.student_code,
          })),
          ...current,
        ]);
        setPreviewRows([]);
        setNotice('import นักเรียนในโหมดตัวอย่างสำเร็จ');
        setIsSubmitting(false);
        return;
      }

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(rowsToInsert)
        .select('id,student_code,first_name,last_name,nickname,status,classroom_id');
      if (studentError) throw studentError;

      const { error: jobError } = await supabase.from('import_jobs').insert({
        workspace_id: session.workspace.id,
        import_type: 'students',
        status: 'imported',
        total_rows: previewRows.length,
        valid_rows: validPreviewRows.length,
        invalid_rows: invalidPreviewRows.length,
        preview: previewRows.slice(0, 50),
        error_summary: invalidPreviewRows.map((row) => ({
          errors: row.errors,
          rowNumber: row.rowNumber,
          warnings: row.warnings,
        })),
        metadata: {
          dmc_class_keys: selectedDmcClassKeys,
          import_sources: Array.from(new Set(previewRows.map((row) => row.source || 'csv'))),
        },
        created_by: session.profile.id,
        imported_at: new Date().toISOString(),
      });

      if (jobError) throw jobError;

      await writeAuditLog(session, {
        action: 'import_job.students_imported',
        entityId: session.workspace.id,
        entityTable: 'import_jobs',
        metadata: {
          dmc_class_keys: selectedDmcClassKeys,
          import_sources: Array.from(new Set(previewRows.map((row) => row.source || 'csv'))),
          invalid_rows: invalidPreviewRows.length,
          total_rows: previewRows.length,
          valid_rows: validPreviewRows.length,
        },
        riskLevel: invalidPreviewRows.length > 0 ? 'normal' : 'low',
        source: 'import_export',
      });
      setStudents((current) => [...((insertedStudents || []) as StudentExportRow[]), ...current]);
      setPreviewRows([]);
      setNotice('import นักเรียนสำเร็จและบันทึก import job แล้ว');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'import ไม่สำเร็จ');
    }

    setIsSubmitting(false);
  }

  async function importGuardianRows() {
    setIsSubmitting(true);
    setNotice(null);

    if (validGuardianRows.length === 0) {
      setNotice('ไม่มีแถวผู้ปกครองที่พร้อม import');
      setIsSubmitting(false);
      return;
    }

    const guardianRows = validGuardianRows
      .filter((row) => row.studentId)
      .map((row) => ({
        consent_status: row.consentStatus,
        display_name: row.guardianName,
        is_primary: false,
        metadata: {
          imported_email: row.guardianEmail || null,
          imported_from: 'guardian_csv',
        },
        phone: row.guardianPhone || null,
        relation: row.relation,
        student_id: row.studentId as string,
        workspace_id: session.workspace?.id || 'demo-workspace',
      }));

    const invitationRows = validGuardianRows
      .filter((row) => row.studentId && row.createPortalInvite && row.guardianEmail)
      .map((row) => ({
        invite_email: row.guardianEmail,
        invited_by: session.profile.id,
        portal_role: 'parent',
        relation: row.relation,
        status: 'invited',
        student_id: row.studentId as string,
        workspace_id: session.workspace?.id || 'demo-workspace',
      }));

    if (!supabase || !session.workspace) {
      setGuardianPreviewRows([]);
      setNotice(`import ผู้ปกครอง ${guardianRows.length} รายการ และเตรียมคำเชิญ ${invitationRows.length} รายการในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    try {
      if (guardianRows.length > 0) {
        const { error: guardianError } = await supabase.from('student_guardians').insert(guardianRows);
        if (guardianError) throw guardianError;
      }

      if (invitationRows.length > 0) {
        const { error: invitationError } = await supabase.from('portal_invitations').insert(invitationRows);
        if (invitationError) throw invitationError;
      }

      const { error: jobError } = await supabase.from('import_jobs').insert({
        workspace_id: session.workspace.id,
        import_type: 'guardians',
        status: 'imported',
        total_rows: guardianPreviewRows.length,
        valid_rows: validGuardianRows.length,
        invalid_rows: invalidGuardianRows.length,
        preview: guardianPreviewRows.slice(0, 50),
        error_summary: invalidGuardianRows.map((row) => ({
          errors: row.errors,
          rowNumber: row.rowNumber,
          warnings: row.warnings,
        })),
        created_by: session.profile.id,
        imported_at: new Date().toISOString(),
      });

      if (jobError) throw jobError;

      await writeAuditLog(session, {
        action: 'import_job.guardians_imported',
        entityId: session.workspace.id,
        entityTable: 'import_jobs',
        metadata: {
          guardian_rows: guardianRows.length,
          invalid_rows: invalidGuardianRows.length,
          portal_invitations: invitationRows.length,
          total_rows: guardianPreviewRows.length,
          valid_rows: validGuardianRows.length,
        },
        riskLevel: invitationRows.length > 0 ? 'normal' : 'low',
        source: 'import_export',
      });
      setGuardianPreviewRows([]);
      setNotice(`import ผู้ปกครอง ${guardianRows.length} รายการ และสร้างคำเชิญ Portal ${invitationRows.length} รายการสำเร็จ`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'import ผู้ปกครองไม่สำเร็จ');
    }

    setIsSubmitting(false);
  }

  async function createBackupManifest() {
    setIsSubmitting(true);
    setNotice(null);

    const rowCounts = {
      classrooms: classrooms.length,
      students: students.length,
      previewRows: previewRows.length,
      guardianPreviewRows: guardianPreviewRows.length,
    };
    const backupPackage: WorkspaceBackupPackage = {
      app: 'ClassCare 360',
      data: {
        classrooms,
        guardianPreviewRows,
        previewRows,
        students,
      },
      exportedAt: new Date().toISOString(),
      restoreNotes: [
        'ไฟล์นี้เป็น backup package สำหรับ preview/restore แบบตรวจซ้ำก่อน import',
        'การ restore ควรนำเข้าเป็น preview ก่อนเสมอ และตรวจ duplicate/error ก่อนบันทึกจริง',
        'ไฟล์นี้ไม่รวมรูปภาพหรือสลิปใน storage bucket ให้สำรอง bucket แยกต่างหาก',
      ],
      rowCounts,
      schemaVersion: 'classcare-workspace-backup-v1',
      workspace: {
        academicYear: session.workspace?.academicYear || null,
        id: session.workspace?.id || null,
        name: session.workspace?.name || null,
        schoolName: session.workspace?.schoolName || null,
      },
    };

    if (!supabase || !session.workspace) {
      const localBackup = {
        created_at: new Date().toISOString(),
        id: `demo-backup-${Date.now()}`,
        row_counts: rowCounts,
        status: 'created',
      };
      setBackups((current) => [localBackup, ...current]);
      downloadText(
        `classcare-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify({ ...backupPackage, backup: localBackup }, null, 2),
        'application/json;charset=utf-8',
      );
      setNotice('สร้าง workspace backup package ในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('workspace_backups')
      .insert({
        workspace_id: session.workspace.id,
        requested_by: session.profile.id,
        backup_type: 'teacher_self',
        status: 'created',
        row_counts: rowCounts,
        metadata: {
          generated_from: 'ImportExportPage',
          timezone: 'Asia/Bangkok',
        },
      })
      .select('id,status,row_counts,created_at')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const backup = data as BackupRow;
    await writeAuditLog(session, {
      action: 'workspace_backup.package_created',
      entityId: backup.id,
      entityTable: 'workspace_backups',
      metadata: {
        row_counts: rowCounts,
        schema_version: backupPackage.schemaVersion,
      },
      riskLevel: 'low',
      source: 'import_export',
    });
    setBackups((current) => [backup, ...current]);
    downloadText(
      `classcare-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ ...backupPackage, backup }, null, 2),
      'application/json;charset=utf-8',
    );
    setNotice('สร้าง workspace backup package และบันทึก metadata สำเร็จ');
    setIsSubmitting(false);
  }

  async function handleBackupPackageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isWorkspaceBackupPackage(parsed)) {
        setNotice('ไฟล์ backup ไม่ถูกต้องหรือ schemaVersion ไม่ตรงกับ ClassCare 360');
        setBackupPackagePreview(null);
        return;
      }

      setBackupPackagePreview(parsed);
      setNotice(`อ่าน backup package สำเร็จ: นักเรียน ${parsed.data.students.length} คน ห้องเรียน ${parsed.data.classrooms.length} ห้อง`);
    } catch (error) {
      setBackupPackagePreview(null);
      setNotice(error instanceof Error ? error.message : 'อ่านไฟล์ backup ไม่สำเร็จ');
    } finally {
      event.target.value = '';
    }
  }

  function stageBackupStudentsForImport() {
    if (!backupPackagePreview) return;

    const classroomById = new Map(backupPackagePreview.data.classrooms.map((classroom) => [classroom.id, classroom.name]));
    const stagedRows = backupPackagePreview.data.students.map((student, index) => {
      const studentCode = student.student_code || '';
      const warnings: string[] = [];
      if (studentCode && existingCodes.has(studentCode)) warnings.push('รหัสซ้ำกับข้อมูลเดิม จะถูกข้ามใน import จริง');

      return {
        classroomName: classroomById.get(student.classroom_id || '') || backupPackagePreview.workspace.name || '',
        errors: [
          !student.first_name ? 'ไม่มี first_name' : null,
          !student.last_name ? 'ไม่มี last_name' : null,
          !student.classroom_id ? 'ไม่มี classroom_id' : null,
        ].filter((message): message is string => Boolean(message)),
        firstName: student.first_name,
        lastName: student.last_name,
        nickname: student.nickname || '',
        rowNumber: index + 1,
        source: 'manual' as const,
        studentCode,
        warnings,
      };
    });

    setPreviewRows(stagedRows);
    setNotice(`แปลง backup เป็น preview นักเรียน ${stagedRows.length} แถวแล้ว กรุณาตรวจ duplicate/error ก่อน import`);
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <Archive size={18} aria-hidden="true" />
            Import / Export / Backup
          </div>
          <h1 className="app-page-title">
            นำเข้า ส่งออก และสำรองข้อมูล
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            ทุกงานต้อง preview ก่อน import, ตรวจ duplicate และบันทึก metadata เพื่อ audit โดยไม่ใช้ Google Sheet เป็น database หลัก
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[520px]">
          {[
            { label: 'นักเรียน', value: students.length },
            { label: 'ห้องเรียน', value: classrooms.length },
            { label: 'Preview', value: previewRows.length + guardianPreviewRows.length },
          ].map((item) => (
            <div className="nexus-card p-3 text-center" key={item.label}>
              <p className="text-2xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-5">
        <aside className="grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <FileUp size={16} aria-hidden="true" />
              DMC Excel
            </div>
            <p className="mt-4 text-sm font-bold leading-6 text-slate-600">
              อัปโหลดไฟล์รายชื่อนักเรียนจาก DMC แล้วเลือกชั้น/ห้องที่ครูดูแล ระบบจะ preview เฉพาะนักเรียนห้องนั้นก่อนนำเข้า
            </p>
            <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-300 bg-cyan-50/60 p-4 text-center transition hover:bg-white">
              <Upload className="text-cyan-700" size={26} aria-hidden="true" />
              <span className="mt-2 text-sm font-black text-slate-700">เลือกไฟล์ DMC .xlsx</span>
              <span className="mt-1 text-xs font-bold text-slate-500">รองรับหัวตาราง: ชั้น, ห้อง, ชื่อ, นามสกุล</span>
              <input accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => void handleDmcFileChange(event)} type="file" />
            </label>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-slate-500">เลือกชั้น/ห้องที่ดูแลได้หลายรายการ</span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-cyan-700 ring-1 ring-cyan-100">
                  {selectedDmcClassKeys.length} ห้อง
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={dmcClassOptions.length === 0}
                  onClick={() => applyDmcClassSelection(dmcClassOptions.map((option) => option.key))}
                  type="button"
                >
                  เลือกทั้งหมด
                </button>
                <button
                  className="h-9 rounded-2xl bg-white px-3 text-xs font-black text-slate-600 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={dmcClassOptions.length === 0}
                  onClick={() => applyDmcClassSelection([])}
                  type="button"
                >
                  ล้างทั้งหมด
                </button>
              </div>
              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                {dmcClassOptions.length === 0 ? (
                  <div className="nexus-muted-box p-3 text-sm font-bold text-slate-600">ยังไม่มีไฟล์ DMC</div>
                ) : null}
                {dmcClassOptions.map((option) => {
                  const checked = selectedDmcClassKeys.includes(option.key);

                  return (
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                        checked
                          ? 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-100'
                          : 'bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white'
                      }`}
                      key={option.key}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          checked={checked}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          onChange={() => toggleDmcClassSelection(option.key)}
                          type="checkbox"
                        />
                        <span className="truncate">{option.classroomName}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
                        {option.count} คน
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <Upload size={16} aria-hidden="true" />
              เพิ่มนักเรียนเอง
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <span className="text-xs font-black uppercase text-slate-500">ชั้น/ห้อง</span>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setManualStudent((current) => ({ ...current, classroomName: event.target.value }))}
                  value={manualStudent.classroomName}
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">เลขประจำตัว</span>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setManualStudent((current) => ({ ...current, studentCode: event.target.value }))}
                  value={manualStudent.studentCode}
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ชื่อเล่น</span>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setManualStudent((current) => ({ ...current, nickname: event.target.value }))}
                  value={manualStudent.nickname}
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ชื่อ</span>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setManualStudent((current) => ({ ...current, firstName: event.target.value }))}
                  value={manualStudent.firstName}
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">นามสกุล</span>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setManualStudent((current) => ({ ...current, lastName: event.target.value }))}
                  value={manualStudent.lastName}
                />
              </label>
            </div>
            <button
              className="dark-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
              onClick={addManualStudentToPreview}
              type="button"
            >
              <Upload size={17} aria-hidden="true" />
              เพิ่มเข้า Preview
            </button>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <FileUp size={16} aria-hidden="true" />
              Student CSV
            </div>
            <div className="mt-4 grid gap-3">
              <button className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={exportTemplate} type="button">
                <Download size={17} aria-hidden="true" />
                ดาวน์โหลด Template
              </button>
              <button className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={exportStudents} type="button">
                <Download size={17} aria-hidden="true" />
                Export นักเรียน CSV
              </button>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 text-center transition hover:bg-white">
                <Upload className="text-cyan-700" size={26} aria-hidden="true" />
                <span className="mt-2 text-sm font-black text-slate-700">เลือกไฟล์ CSV เพื่อ preview</span>
                <span className="mt-1 text-xs font-bold text-slate-500">{templateHeaders.join(', ')}</span>
                <input accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleFileChange(event)} type="file" />
              </label>
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <FileUp size={16} aria-hidden="true" />
              Guardian CSV
            </div>
            <p className="mt-4 text-sm font-bold leading-6 text-slate-600">
              นำเข้าผู้ปกครองและสร้างคำเชิญ Parent Portal ด้วย email โดยจับคู่จาก student_code
            </p>
            <div className="mt-4 grid gap-3">
              <button className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={exportGuardianTemplate} type="button">
                <Download size={17} aria-hidden="true" />
                Template ผู้ปกครอง
              </button>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 text-center transition hover:bg-white">
                <Upload className="text-cyan-700" size={26} aria-hidden="true" />
                <span className="mt-2 text-sm font-black text-slate-700">เลือก Guardian CSV</span>
                <span className="mt-1 text-xs font-bold text-slate-500">student_code, guardian_email, create_portal_invite</span>
                <input accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleGuardianFileChange(event)} type="file" />
              </label>
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <ShieldCheck size={16} aria-hidden="true" />
              Backup
            </div>
            <p className="mt-4 text-sm font-bold leading-6 text-slate-600">
              สร้าง backup package ราย workspace เป็น JSON สำหรับส่งต่อ ย้ายเครื่อง หรือต่อยอดเข้า Google Drive Cold Storage
            </p>
            <button
              className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || isLoading}
              onClick={() => void createBackupManifest()}
              type="button"
            >
              <Save size={17} aria-hidden="true" />
              สร้าง Backup Package
            </button>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-black text-amber-700">Imported Students</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  จัดการรายชื่อที่นำเข้าแล้ว {managedStudents.length} รายการ
                </h2>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  ใช้ตรวจรายชื่อซ้ำ ผิดห้อง หรือ import ผิดไฟล์ ก่อนซ่อนด้วยเก็บถาวรหรือลบถาวรเฉพาะรายการที่แน่ใจ
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="nexus-pill inline-flex h-10 items-center justify-center px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={managedStudents.length === 0}
                  onClick={selectAllManagedStudents}
                  type="button"
                >
                  เลือกผลลัพธ์ทั้งหมด
                </button>
                <button
                  className="nexus-pill inline-flex h-10 items-center justify-center gap-2 px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || selectedManagedStudentIds.length === 0}
                  onClick={() => void updateManagedStudentStatus(selectedManagedStudentIds, 'archived')}
                  type="button"
                >
                  <Archive size={15} aria-hidden="true" />
                  เก็บถาวร
                </button>
                <button
                  className="nexus-pill inline-flex h-10 items-center justify-center gap-2 px-3 text-xs font-black text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || selectedManagedStudentIds.length === 0}
                  onClick={() => void updateManagedStudentStatus(selectedManagedStudentIds, 'active')}
                  type="button"
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  กู้คืน
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || selectedManagedStudentIds.length === 0}
                  onClick={() => void deleteManagedStudents(selectedManagedStudentIds)}
                  type="button"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  ลบถาวร
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 2xl:grid-cols-[minmax(220px,1fr)_220px_180px_auto] 2xl:items-center">
              <label className="relative block min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  className="nexus-field h-11 w-full pl-10 pr-3"
                  onChange={(event) => setStudentManageQuery(event.target.value)}
                  placeholder="ค้นหาชื่อ รหัส หรือห้องเรียน"
                  value={studentManageQuery}
                />
              </label>
              <select
                className="nexus-field h-11 px-3"
                onChange={(event) => setStudentManageClassroomId(event.target.value)}
                value={studentManageClassroomId}
              >
                <option value="all">ทุกห้องเรียน</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
                <option value="">ยังไม่ผูกห้อง</option>
              </select>
              <select
                className="nexus-field h-11 px-3"
                onChange={(event) => setStudentManageStatus(event.target.value as StudentExportRow['status'] | 'all')}
                value={studentManageStatus}
              >
                <option value="all">ทุกสถานะ</option>
                <option value="active">กำลังเรียน</option>
                <option value="archived">เก็บถาวร</option>
                <option value="inactive">พักใช้งาน</option>
                <option value="transferred">ย้ายออก</option>
                <option value="graduated">จบแล้ว</option>
              </select>
              <div className="nexus-pill inline-flex h-11 items-center justify-center px-3 text-xs font-black text-slate-600">
                เลือกแล้ว {selectedManagedStudentIds.length} คน
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-500">
                    <th className="px-3 py-3">เลือก</th>
                    <th className="px-3 py-3">รหัส</th>
                    <th className="px-3 py-3">นักเรียน</th>
                    <th className="px-3 py-3">ห้องเรียน</th>
                    <th className="px-3 py-3">สถานะ</th>
                    <th className="px-3 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {managedStudents.map((student) => {
                    const status = student.status || 'active';
                    const checked = selectedManagedStudentIds.includes(student.id);

                    return (
                      <tr className={checked ? 'bg-amber-50/80' : 'hover:bg-amber-50/40'} key={student.id}>
                        <td className="whitespace-nowrap px-3 py-3">
                          <input
                            checked={checked}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            onChange={() => toggleManagedStudentSelection(student.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{student.student_code || '-'}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs font-bold text-slate-500">{student.nickname || 'ไม่มีชื่อเล่น'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">
                          {classroomNameById[student.classroom_id || ''] || 'ยังไม่ผูกห้อง'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                            {studentStatusLabels[status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              className="nexus-icon-button h-9 w-9"
                              onClick={() => void updateManagedStudentStatus([student.id], status === 'archived' ? 'active' : 'archived')}
                              title={status === 'archived' ? 'กู้คืนเป็นกำลังเรียน' : 'เก็บถาวร'}
                              type="button"
                            >
                              {status === 'archived' ? <RotateCcw size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                            </button>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100"
                              onClick={() => void deleteManagedStudents([student.id])}
                              title="ลบถาวร"
                              type="button"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {managedStudents.length === 0 ? (
              <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
                ไม่พบรายชื่อตามตัวกรองนี้ ถ้านำเข้าแล้วไม่เห็นในเมนูนักเรียน ให้ลองเลือกทุกห้องเรียนและทุกสถานะเพื่อตรวจว่าข้อมูลไปอยู่ผิดห้องหรือถูกเก็บถาวรหรือไม่
              </div>
            ) : null}
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">Import Preview</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  พร้อม import {validPreviewRows.length} แถว | ต้องแก้ไข {invalidPreviewRows.length} แถว
                </h2>
              </div>
              <button
                className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting || validPreviewRows.length === 0}
                onClick={() => void importValidRows()}
                type="button"
              >
                <Upload size={17} aria-hidden="true" />
                Import แถวที่ผ่าน
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-500">
                    <th className="px-3 py-3">แถว</th>
                    <th className="px-3 py-3">รหัส</th>
                    <th className="px-3 py-3">นักเรียน</th>
                    <th className="px-3 py-3">ห้องเรียน</th>
                    <th className="px-3 py-3">ผลตรวจ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {previewRows.map((row) => (
                    <tr className="hover:bg-slate-50" key={`${row.rowNumber}-${row.studentCode}-${row.firstName}`}>
                      <td className="whitespace-nowrap px-3 py-3 font-black text-slate-600">{row.rowNumber}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.studentCode || '-'}</td>
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-950">{row.firstName} {row.lastName}</p>
                        <p className="text-xs font-bold text-slate-500">{row.nickname || 'ไม่มีชื่อเล่น'}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.classroomName || '-'}</td>
                      <td className="px-3 py-3">
                        {row.errors.length === 0 && row.warnings.length === 0 ? (
                          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">ผ่าน</span>
                        ) : (
                          <div className="grid gap-1 text-xs font-bold text-amber-700">
                            {[...row.errors, ...row.warnings].map((message) => <span key={message}>{message}</span>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewRows.length === 0 ? (
              <div className="mt-4 nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ยังไม่มี preview ให้เลือก CSV template ที่กรอกข้อมูลแล้วก่อน import
              </div>
            ) : null}
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black text-teal-700">Guardian Preview</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  พร้อม import {validGuardianRows.length} แถว | ต้องแก้ไข {invalidGuardianRows.length} แถว
                </h2>
              </div>
              <button
                className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting || validGuardianRows.length === 0}
                onClick={() => void importGuardianRows()}
                type="button"
              >
                <Upload size={17} aria-hidden="true" />
                Import ผู้ปกครอง
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-500">
                    <th className="px-3 py-3">แถว</th>
                    <th className="px-3 py-3">นักเรียน</th>
                    <th className="px-3 py-3">ผู้ปกครอง</th>
                    <th className="px-3 py-3">ติดต่อ</th>
                    <th className="px-3 py-3">เชิญ Portal</th>
                    <th className="px-3 py-3">ผลตรวจ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {guardianPreviewRows.map((row) => (
                    <tr className="hover:bg-slate-50" key={`${row.rowNumber}-${row.studentCode}-${row.guardianEmail}-${row.guardianName}`}>
                      <td className="whitespace-nowrap px-3 py-3 font-black text-slate-600">{row.rowNumber}</td>
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-950">{row.studentName}</p>
                        <p className="text-xs font-bold text-slate-500">รหัส {row.studentCode || '-'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-950">{row.guardianName || '-'}</p>
                        <p className="text-xs font-bold text-slate-500">{row.relation} | {row.consentStatus}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-600">{row.guardianEmail || '-'}</p>
                        <p className="text-xs font-bold text-slate-500">{row.guardianPhone || '-'}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                          row.createPortalInvite
                            ? 'bg-cyan-50 text-cyan-700 ring-cyan-100'
                            : 'bg-slate-50 text-slate-500 ring-slate-100'
                        }`}>
                          {row.createPortalInvite ? 'สร้าง invite' : 'ไม่สร้าง'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {row.errors.length === 0 ? (
                          <div className="grid gap-1">
                            <span className="w-fit rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">ผ่าน</span>
                            {row.warnings.map((message) => (
                              <span className="text-xs font-bold text-amber-700" key={message}>{message}</span>
                            ))}
                          </div>
                        ) : (
                          <div className="grid gap-1 text-xs font-bold text-amber-700">
                            {[...row.errors, ...row.warnings].map((message) => <span key={message}>{message}</span>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {guardianPreviewRows.length === 0 ? (
              <div className="mt-4 nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ยังไม่มี preview ผู้ปกครอง ให้เลือก Guardian CSV ก่อน import หรือสร้างคำเชิญ Portal
              </div>
            ) : null}
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <p className="text-sm font-black text-cyan-700">Backup History</p>
            <div className="mt-4 grid gap-3 rounded-3xl bg-slate-950 p-4 text-white">
              <div>
                <p className="text-sm font-black text-cyan-100">Workspace Backup Package</p>
                <p className="mt-2 text-xs font-bold leading-5 text-slate-300">
                  Export เป็น JSON สำหรับส่งต่อ/ย้ายเครื่อง และ import กลับแบบ preview ก่อนบันทึกจริง
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isSubmitting}
                  onClick={() => void createBackupManifest()}
                  type="button"
                >
                  <Download size={17} aria-hidden="true" />
                  Export JSON
                </button>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50">
                  <Upload size={17} aria-hidden="true" />
                  ตรวจ Backup
                  <input accept=".json,application/json" className="sr-only" onChange={(event) => void handleBackupPackageFileChange(event)} type="file" />
                </label>
              </div>
            </div>

            {backupPackagePreview ? (
              <div className="mt-4 rounded-3xl bg-white/85 p-4 ring-1 ring-cyan-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {backupPackagePreview.workspace.schoolName || backupPackagePreview.workspace.name || 'Backup package'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      export {new Date(backupPackagePreview.exportedAt).toLocaleString('th-TH')} | schema {backupPackagePreview.schemaVersion}
                    </p>
                  </div>
                  <button
                    className="dark-action inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black"
                    onClick={stageBackupStudentsForImport}
                    type="button"
                  >
                    <FileUp size={15} aria-hidden="true" />
                    ใช้เป็น preview
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="nexus-muted-box p-3">
                    <p className="text-xl font-black text-slate-950">{backupPackagePreview.data.students.length}</p>
                    <p className="text-xs font-black text-slate-500">students</p>
                  </div>
                  <div className="nexus-muted-box p-3">
                    <p className="text-xl font-black text-slate-950">{backupPackagePreview.data.classrooms.length}</p>
                    <p className="text-xs font-black text-slate-500">classrooms</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs font-bold leading-5 text-slate-500">
                  {backupPackagePreview.restoreNotes.map((note) => (
                    <p key={note}>- {note}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {backups.map((backup) => (
                <div className="nexus-muted-box p-3" key={backup.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-slate-950">{backup.status}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{new Date(backup.created_at).toLocaleString('th-TH')}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-600">
                      students {backup.row_counts.students || 0} | classrooms {backup.row_counts.classrooms || 0}
                    </p>
                  </div>
                </div>
              ))}
              {backups.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">ยังไม่มี backup manifest</div>
              ) : null}
            </div>
          </div>
        </section>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">Created by MIKPURINUT</footer>
    </main>
  );
}
