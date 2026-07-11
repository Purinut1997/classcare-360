import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Printer, Search, ShieldCheck } from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface ReportsPageProps {
  session: AppSessionContext;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';

interface ClassroomRow {
  academic_year: string | null;
  id: string;
  name: string;
}

interface StudentRow {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  student_code: string | null;
}

interface AttendanceSessionRow {
  attendance_date: string;
  classroom_id: string;
  id: string;
  period_label: string;
  subject_name: string | null;
}

interface AttendanceRecordRow {
  note: string | null;
  session_id: string;
  status: AttendanceStatus;
  student_id: string;
}

interface CoreReportMetrics {
  attendance: {
    presentRate: number;
    riskCount: number;
    total: number;
  };
  behavior: {
    followUps: number;
    positiveCount: number;
    totalPoints: number;
  };
  savings: {
    accountCount: number;
    totalBalance: number;
  };
  scores: {
    assessmentCount: number;
    averagePercent: number;
    belowHalfCount: number;
  };
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
];

const demoSessions: AttendanceSessionRow[] = [
  { attendance_date: new Date().toISOString().slice(0, 10), classroom_id: 'demo-classroom', id: 'demo-session-1', period_label: 'เช้า', subject_name: 'โฮมรูม' },
];

const demoRecords: AttendanceRecordRow[] = [
  { note: null, session_id: 'demo-session-1', status: 'present', student_id: 'demo-student-1' },
  { note: 'มาสาย 10 นาที', session_id: 'demo-session-1', status: 'late', student_id: 'demo-student-2' },
  { note: 'ผู้ปกครองแจ้งลา', session_id: 'demo-session-1', status: 'leave', student_id: 'demo-student-3' },
];

const emptyCoreMetrics: CoreReportMetrics = {
  attendance: {
    presentRate: 0,
    riskCount: 0,
    total: 0,
  },
  behavior: {
    followUps: 0,
    positiveCount: 0,
    totalPoints: 0,
  },
  savings: {
    accountCount: 0,
    totalBalance: 0,
  },
  scores: {
    assessmentCount: 0,
    averagePercent: 0,
    belowHalfCount: 0,
  },
};

const statusLabels: Record<AttendanceStatus, string> = {
  present: 'มา',
  absent: 'ขาด',
  late: 'สาย',
  leave: 'ลา',
  sick: 'ป่วย',
  activity: 'กิจกรรม',
};

const statusOrder: AttendanceStatus[] = ['present', 'absent', 'late', 'leave', 'sick', 'activity'];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function buildReportRows(
  classrooms: ClassroomRow[],
  students: StudentRow[],
  sessions: AttendanceSessionRow[],
  records: AttendanceRecordRow[],
) {
  return records.map((record) => {
    const session = sessions.find((item) => item.id === record.session_id);
    const student = students.find((item) => item.id === record.student_id);
    const classroom = classrooms.find((item) => item.id === session?.classroom_id || item.id === student?.classroom_id);

    return {
      classroomName: classroom?.name || '-',
      date: session?.attendance_date || '-',
      note: record.note || '',
      periodLabel: session?.period_label || '-',
      status: record.status,
      studentCode: student?.student_code || '-',
      studentName: student ? `${student.first_name} ${student.last_name}` : '-',
      subjectName: session?.subject_name || '-',
    };
  });
}

interface ReportSummaryRow {
  count: number;
  label: string;
  status: AttendanceStatus;
}

interface ReportDetailRow {
  classroomName: string;
  date: string;
  note: string;
  periodLabel: string;
  status: AttendanceStatus;
  studentCode: string;
  studentName: string;
  subjectName: string;
}

function buildPrintableReportHtml({
  dateFrom,
  dateTo,
  reportRows,
  schoolName,
  summary,
}: {
  dateFrom: string;
  dateTo: string;
  reportRows: ReportDetailRow[];
  schoolName: string;
  summary: ReportSummaryRow[];
}) {
  const summaryRows = summary
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td class="number">${item.count}</td>
        </tr>
      `,
    )
    .join('');
  const detailRows = reportRows
    .map(
      (row, index) => `
        <tr>
          <td class="number">${index + 1}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.periodLabel)}</td>
          <td>${escapeHtml(row.classroomName)}</td>
          <td>${escapeHtml(row.studentCode)}</td>
          <td>${escapeHtml(row.studentName)}</td>
          <td>${escapeHtml(statusLabels[row.status])}</td>
          <td>${escapeHtml(row.subjectName)}</td>
          <td>${escapeHtml(row.note || '-')}</td>
        </tr>
      `,
    )
    .join('');

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ClassCare 360 - รายงานเวลาเรียน</title>
        <style>
          @page { margin: 14mm; size: A4 landscape; }
          * { box-sizing: border-box; }
          body {
            color: #0f172a;
            font-family: "Anuphan", "Noto Sans Thai", Arial, sans-serif;
            line-height: 1.5;
            margin: 0;
          }
          header {
            border-bottom: 2px solid #0ea5e9;
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 12px;
          }
          h1 { font-size: 24px; margin: 0; }
          h2 { font-size: 16px; margin: 20px 0 8px; }
          p { margin: 4px 0; }
          .meta { color: #475569; font-size: 12px; font-weight: 700; text-align: right; }
          .credit { color: #0369a1; font-size: 11px; font-weight: 800; }
          table { border-collapse: collapse; page-break-inside: auto; width: 100%; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th {
            background: #e0f2fe;
            color: #0f172a;
            font-size: 11px;
            font-weight: 900;
          }
          th, td {
            border: 1px solid #cbd5e1;
            font-size: 11px;
            padding: 7px 8px;
            text-align: left;
            vertical-align: top;
          }
          .number { text-align: center; white-space: nowrap; }
          .summary { max-width: 360px; }
          footer {
            border-top: 1px solid #cbd5e1;
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            margin-top: 18px;
            padding-top: 8px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>ClassCare 360 - รายงานเวลาเรียน</h1>
            <p>${escapeHtml(schoolName)}</p>
            <p class="credit">Created by MIKPURINUT</p>
          </div>
          <div class="meta">
            <p>ช่วงวันที่ ${escapeHtml(dateFrom)} ถึง ${escapeHtml(dateTo)}</p>
            <p>จำนวนรายการ ${reportRows.length}</p>
            <p>สร้างเมื่อ ${new Intl.DateTimeFormat('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Bangkok',
            }).format(new Date())}</p>
          </div>
        </header>
        <h2>สรุปสถานะ</h2>
        <table class="summary">
          <thead><tr><th>สถานะ</th><th>จำนวน</th></tr></thead>
          <tbody>${summaryRows}</tbody>
        </table>
        <h2>รายละเอียด</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>วันที่</th>
              <th>ช่วงเวลา</th>
              <th>ห้องเรียน</th>
              <th>รหัส</th>
              <th>นักเรียน</th>
              <th>สถานะ</th>
              <th>วิชา/กิจกรรม</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
        <footer>ClassCare 360 | Created by MIKPURINUT</footer>
      </body>
    </html>`;
}

export function ReportsPage({ session }: ReportsPageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionRow[]>(demoSessions);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>(demoRecords);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [dateFrom, setDateFrom] = useState(getTodayDate());
  const [dateTo, setDateTo] = useState(getTodayDate());
  const [query, setQuery] = useState('');
  const [coreMetrics, setCoreMetrics] = useState<CoreReportMetrics>(emptyCoreMetrics);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อออกรายงานจาก Supabase จริง',
  );

  useEffect(() => {
    let isMounted = true;

    async function loadReportData() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setAttendanceSessions(demoSessions);
        setAttendanceRecords(demoRecords);
        setCoreMetrics({
          attendance: {
            presentRate: 67,
            riskCount: 2,
            total: demoRecords.length,
          },
          behavior: {
            followUps: 1,
            positiveCount: 3,
            totalPoints: 12,
          },
          savings: {
            accountCount: demoStudents.length,
            totalBalance: 1250,
          },
          scores: {
            assessmentCount: 2,
            averagePercent: 82,
            belowHalfCount: 1,
          },
        });
        setClassroomId(demoClassrooms[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: sessionRows, error: sessionError },
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id,name,academic_year')
          .eq('workspace_id', session.workspace.id)
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,classroom_id')
          .eq('workspace_id', session.workspace.id)
          .order('student_code', { ascending: true }),
        supabase
          .from('attendance_sessions')
          .select('id,classroom_id,attendance_date,period_label,subject_name')
          .eq('workspace_id', session.workspace.id)
          .gte('attendance_date', dateFrom)
          .lte('attendance_date', dateTo)
          .order('attendance_date', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || sessionError) {
        setNotice(classroomError?.message || studentError?.message || sessionError?.message || 'โหลดข้อมูลรายงานไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextSessions = (sessionRows || []) as AttendanceSessionRow[];
      const sessionIds = nextSessions.map((item) => item.id);
      let nextRecords: AttendanceRecordRow[] = [];

      if (sessionIds.length > 0) {
        const { data: recordRows, error: recordError } = await supabase
          .from('attendance_records')
          .select('session_id,student_id,status,note')
          .eq('workspace_id', session.workspace.id)
          .in('session_id', sessionIds);

        if (!isMounted) return;

        if (recordError) {
          setNotice(recordError.message);
          setIsLoading(false);
          return;
        }

        nextRecords = (recordRows || []) as AttendanceRecordRow[];
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      setClassrooms(nextClassrooms);
      setStudents((studentRows || []) as StudentRow[]);
      setAttendanceSessions(nextSessions);
      setAttendanceRecords(nextRecords);
      setClassroomId((current) => current || nextClassrooms[0]?.id || '');

      const [
        { data: scoreRows },
        { data: savingsRows },
        { data: behaviorRows },
      ] = await Promise.all([
        supabase
          .from('score_entries')
          .select('assessment_id,score,score_assessments(max_score,status)')
          .eq('workspace_id', session.workspace.id)
          .not('score', 'is', null)
          .limit(1000),
        supabase
          .from('savings_accounts')
          .select('balance,status')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active')
          .limit(1000),
        supabase
          .from('behavior_records')
          .select('tone,points,follow_up_status,behavior_date')
          .eq('workspace_id', session.workspace.id)
          .gte('behavior_date', dateFrom)
          .lte('behavior_date', dateTo)
          .limit(1000),
      ]);

      const scoreData = (scoreRows || []) as Array<{
        assessment_id: string | null;
        score: number | null;
        score_assessments?: { max_score?: number | null; status?: string | null } | null;
      }>;
      const scorePercents = scoreData
        .map((row) => {
          const maxScore = Number(row.score_assessments?.max_score || 0);
          const score = Number(row.score || 0);
          return maxScore > 0 ? (score / maxScore) * 100 : null;
        })
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const savingsData = (savingsRows || []) as Array<{ balance: number | string | null }>;
      const behaviorData = (behaviorRows || []) as Array<{
        follow_up_status: string | null;
        points: number | null;
        tone: string | null;
      }>;
      const presentCount = nextRecords.filter((record) => record.status === 'present').length;
      const riskCount = nextRecords.filter((record) => ['absent', 'late', 'leave', 'sick'].includes(record.status)).length;

      setCoreMetrics({
        attendance: {
          presentRate: nextRecords.length > 0 ? Math.round((presentCount / nextRecords.length) * 100) : 0,
          riskCount,
          total: nextRecords.length,
        },
        behavior: {
          followUps: behaviorData.filter((row) => row.follow_up_status && !['none', 'resolved'].includes(row.follow_up_status)).length,
          positiveCount: behaviorData.filter((row) => row.tone === 'positive').length,
          totalPoints: behaviorData.reduce((sum, row) => sum + Number(row.points || 0), 0),
        },
        savings: {
          accountCount: savingsData.length,
          totalBalance: round(savingsData.reduce((sum, row) => sum + Number(row.balance || 0), 0)),
        },
        scores: {
          assessmentCount: new Set(scoreData.map((row) => row.assessment_id).filter(Boolean)).size,
          averagePercent: scorePercents.length > 0 ? round(scorePercents.reduce((sum, value) => sum + value, 0) / scorePercents.length) : 0,
          belowHalfCount: scorePercents.filter((value) => value < 50).length,
        },
      });
      setIsLoading(false);
    }

    void loadReportData();

    return () => {
      isMounted = false;
    };
  }, [dateFrom, dateTo, session.workspace]);

  const reportRows = useMemo(() => {
    const rows = buildReportRows(classrooms, students, attendanceSessions, attendanceRecords);
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (classroomId && row.classroomName !== classrooms.find((item) => item.id === classroomId)?.name) return false;
      if (!normalizedQuery) return true;

      return [row.studentCode, row.studentName, row.status, statusLabels[row.status], row.note]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [attendanceRecords, attendanceSessions, classroomId, classrooms, query, students]);

  const summary = useMemo(
    () =>
      statusOrder.map((status) => ({
        count: reportRows.filter((row) => row.status === status).length,
        label: statusLabels[status],
        status,
      })),
    [reportRows],
  );

  function exportCsv() {
    const headers = ['วันที่', 'ช่วงเวลา', 'ห้องเรียน', 'รหัส', 'นักเรียน', 'สถานะ', 'หมายเหตุ', 'เครดิต'];
    const lines = [
      headers.map(escapeCsv).join(','),
      ...reportRows.map((row) =>
        [
          row.date,
          row.periodLabel,
          row.classroomName,
          row.studentCode,
          row.studentName,
          statusLabels[row.status],
          row.note,
          'Created by MIKPURINUT',
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];
    downloadBlob(
      `classcare-attendance-${dateFrom}-${dateTo}.csv`,
      new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }),
    );
  }

  function exportExcel() {
    const summaryRows = summary
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.count}</td>
        </tr>
      `)
      .join('');
    const detailRows = reportRows
      .map((row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.periodLabel)}</td>
          <td>${escapeHtml(row.classroomName)}</td>
          <td>${escapeHtml(row.studentCode)}</td>
          <td>${escapeHtml(row.studentName)}</td>
          <td>${escapeHtml(statusLabels[row.status])}</td>
          <td>${escapeHtml(row.subjectName)}</td>
          <td>${escapeHtml(row.note || '-')}</td>
        </tr>
      `)
      .join('');
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; }
            h1, h2, p { margin: 0 0 10px; }
            table { border-collapse: collapse; margin: 12px 0 24px; width: 100%; }
            th { background: #e0f2fe; color: #0f172a; font-weight: 700; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; mso-number-format:"\\@"; }
          </style>
        </head>
        <body>
          <h1>ClassCare 360 - รายงานเวลาเรียน</h1>
          <p>${escapeHtml(session.workspace?.schoolName || 'Demo Workspace')} | ${escapeHtml(dateFrom)} ถึง ${escapeHtml(dateTo)}</p>
          <p>Created by MIKPURINUT</p>
          <h2>สรุปสถานะ</h2>
          <table>
            <thead>
              <tr><th>สถานะ</th><th>จำนวน</th></tr>
            </thead>
            <tbody>${summaryRows}</tbody>
          </table>
          <h2>รายละเอียด</h2>
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ช่วงเวลา</th>
                <th>ห้องเรียน</th>
                <th>รหัส</th>
                <th>นักเรียน</th>
                <th>สถานะ</th>
                <th>วิชา/กิจกรรม</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>
        </body>
      </html>
    `;
    downloadBlob(
      `classcare-attendance-${dateFrom}-${dateTo}.xls`,
      new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    );
  }

  function exportJsonPackage() {
    const payload = {
      createdAt: new Date().toISOString(),
      credit: 'Created by MIKPURINUT',
      filters: {
        classroomId,
        dateFrom,
        dateTo,
        query,
      },
      reportType: 'attendance_summary',
      coreMetrics,
      rows: reportRows.map((row) => ({
        ...row,
        statusLabel: statusLabels[row.status],
      })),
      schoolName: session.workspace?.schoolName || 'Demo Workspace',
      summary,
      timezone: 'Asia/Bangkok',
      workspaceId: session.workspace?.id || 'demo-workspace',
    };

    downloadBlob(
      `classcare-attendance-package-${dateFrom}-${dateTo}.json`,
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    );
  }

  function printReport() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNotice('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup แล้วลองอีกครั้ง');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintableReportHtml({
        dateFrom,
        dateTo,
        reportRows,
        schoolName: session.workspace?.schoolName || 'Demo Workspace',
        summary,
      }),
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
  }

  return (
    <main className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="nexus-kicker">
            <FileSpreadsheet size={18} aria-hidden="true" />
            Report Center
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
            รายงานเวลาเรียน
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            {session.workspace?.schoolName || 'Demo Workspace'} | สรุปจาก attendance session และ record ที่ถูกกรองด้วย RLS
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5"
            disabled={reportRows.length === 0}
            onClick={printReport}
            type="button"
          >
            <Printer size={17} aria-hidden="true" />
            PDF/พิมพ์
          </button>
          <button
            className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={reportRows.length === 0}
            onClick={exportCsv}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            CSV
          </button>
          <button
            className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={reportRows.length === 0}
            onClick={exportExcel}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            Excel
          </button>
          <button
            className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={reportRows.length === 0}
            onClick={exportJsonPackage}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            detail: `${coreMetrics.attendance.riskCount} รายการต้องติดตาม`,
            label: 'เวลาเรียน',
            value: `${coreMetrics.attendance.presentRate}%`,
          },
          {
            detail: `${coreMetrics.scores.assessmentCount} ชุดคะแนน | ต่ำกว่า 50% ${coreMetrics.scores.belowHalfCount} รายการ`,
            label: 'คะแนนเฉลี่ย',
            value: `${coreMetrics.scores.averagePercent}%`,
          },
          {
            detail: `${coreMetrics.savings.accountCount} บัญชี active`,
            label: 'เงินออมรวม',
            value: coreMetrics.savings.totalBalance.toLocaleString('th-TH'),
          },
          {
            detail: `ติดตามต่อ ${coreMetrics.behavior.followUps} รายการ | เชิงบวก ${coreMetrics.behavior.positiveCount}`,
            label: 'พฤติกรรม',
            value: coreMetrics.behavior.totalPoints.toLocaleString('th-TH'),
          },
        ].map((item) => (
          <article className="nexus-card p-4 transition hover:-translate-y-1" key={item.label}>
            <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="nexus-card p-4 sm:p-5">
          <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
            <ShieldCheck size={16} className="text-teal-600" aria-hidden="true" />
            Report guard + RLS
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ห้องเรียน
              <select
                className="nexus-field h-11 px-3"
                onChange={(event) => setClassroomId(event.target.value)}
                value={classroomId}
              >
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                จากวันที่
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setDateFrom(event.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ถึงวันที่
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setDateTo(event.target.value)}
                  type="date"
                  value={dateTo}
                />
              </label>
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
              <input
                className="nexus-field h-11 w-full pl-10 pr-3"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อ รหัส สถานะ"
                value={query}
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {summary.map((item) => (
              <div className="nexus-muted-box p-3 text-center transition hover:-translate-y-1" key={item.status}>
                <p className="text-2xl font-black text-slate-950">{item.count}</p>
                <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black text-teal-700">Attendance Summary</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                รายละเอียด {reportRows.length} รายการ
              </h2>
            </div>
            <p className="text-xs font-bold text-slate-500">Created by MIKPURINUT</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr className="text-xs font-black uppercase text-slate-500">
                  <th className="px-3 py-3">วันที่</th>
                  <th className="px-3 py-3">ห้อง</th>
                  <th className="px-3 py-3">นักเรียน</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-3 py-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reportRows.map((row, index) => (
                  <tr className="hover:bg-sky-50/50" key={`${row.date}-${row.studentCode}-${index}`}>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">
                      {row.date}
                      <span className="block text-xs text-slate-400">{row.periodLabel}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.classroomName}</td>
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-950">{row.studentName}</p>
                      <p className="text-xs font-bold text-slate-500">{row.studentCode}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-600">{row.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && reportRows.length === 0 ? (
            <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
              ยังไม่มีข้อมูลรายงานตามช่วงวันที่และตัวกรองนี้
            </div>
          ) : null}
        </section>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
