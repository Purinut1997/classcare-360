export function formatReportDate(date: string) {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`));
}

export interface AttendanceReportDetails {
  date: string;
  school: string;
  classroom: string;
  subject?: string | null;
  period?: string;
  students: Array<{ name: string; status: string }>;
}

export function formatAttendanceReport(details: AttendanceReportDetails, summaryOnly: boolean) {
  const groups = [
    { status: 'present', label: 'มาเรียน' },
    { status: 'late', label: 'มาสาย' },
    { status: 'leave', label: 'ลา' },
    { status: 'sick', label: 'ลาป่วย' },
    { status: 'absent', label: 'ขาดเรียน' },
  ];
  const lines = [
    details.school,
    `ชั้น ${details.classroom}`,
    `ประจำวันที่ ${formatReportDate(details.date)}`,
    ...(details.subject ? [`วิชา ${details.subject}`, `คาบเรียน ${details.period || 'ไม่ระบุ'}`] : ['การมาเรียนประจำชั้น']),
    '',
    'เรียน ผู้ปกครองนักเรียน',
    'ขอแจ้งผลการมาเรียน ดังนี้',
    `นักเรียนทั้งหมด ${details.students.length} คน`,
    ...groups.map(({ status, label }) => `${label} ${details.students.filter((student) => student.status === status).length} คน`),
  ];
  if (!summaryOnly) {
    for (const { status, label } of groups) {
      const members = details.students.filter((student) => student.status === status);
      if (!members.length) continue;
      lines.push('', `รายชื่อนักเรียน${label} (${members.length} คน)`);
      members.forEach((student, index) => lines.push(`${index + 1}. ${student.name}`));
    }
  }
  lines.push('', 'จึงเรียนมาเพื่อทราบ', 'ครูผู้บันทึกการมาเรียน');
  return lines.join('\n');
}
