import type { DutyAssignment, DutyTask, Student } from "../types/duty";

function getEmoji(name: string): string {
  if (name.includes("กวาด")) return "🧹";
  if (name.includes("ถู")) return "🧽";
  if (name.includes("ขยะ")) return "🗑️";
  if (name.includes("กระดาน") || name.includes("โต๊ะ")) return "🧼";
  if (name.includes("ห้องน้ำ")) return "🚿";
  if (name.includes("ไฟ") || name.includes("แอร์") || name.includes("หน้าต่าง")) return "🪟";
  return "⭐";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildClassroomPosterHtml({
  roomName,
  schoolName,
  teacherName,
  weekStart,
  weekEnd,
  tasks,
  assignments,
  studentMap,
}: {
  roomName: string;
  schoolName: string;
  teacherName: string;
  weekStart: string;
  weekEnd: string;
  tasks: DutyTask[];
  assignments: DutyAssignment[];
  studentMap: Map<string, Student>;
}): string {
  function addDays(baseDate: string, days: number): string {
    const d = new Date(`${baseDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const days = [
    { label: "วันจันทร์", short: "จันทร์", date: weekStart, color: "#fef08a", darkColor: "#854d0e" },
    { label: "วันอังคาร", short: "อังคาร", date: addDays(weekStart, 1), color: "#fbcfe8", darkColor: "#9d174d" },
    { label: "วันพุธ", short: "พุธ", date: addDays(weekStart, 2), color: "#bbf7d0", darkColor: "#166534" },
    { label: "วันพฤหัสบดี", short: "พฤหัสฯ", date: addDays(weekStart, 3), color: "#fed7aa", darkColor: "#9a3412" },
    { label: "วันศุกร์", short: "ศุกร์", date: addDays(weekStart, 4), color: "#bae6fd", darkColor: "#075985" },
  ];

  const activeTasks = tasks.filter((t) => t.is_active);

  const formattedWeekStart = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${weekStart}T12:00:00`));

  const formattedWeekEnd = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${weekEnd}T12:00:00`));

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>ป้ายเวรทำความสะอาดประจำห้อง ${escapeHtml(roomName)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: "TH Sarabun New", "Noto Sans Thai", "Prompt", Tahoma, sans-serif;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .poster-container {
      width: 281mm;
      height: 194mm;
      margin: 0 auto;
      border: 4px dashed #0284c7;
      border-radius: 20px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: radial-gradient(circle at 10% 10%, #f0fdf4 0%, #ffffff 40%, #f0f9ff 100%);
    }
    .poster-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #0284c7;
      padding-bottom: 8px;
    }
    .poster-title-area h1 {
      margin: 0;
      font-size: 26pt;
      font-weight: 900;
      color: #0369a1;
      line-height: 1.1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .poster-title-area p {
      margin: 2px 0 0 0;
      font-size: 13pt;
      font-weight: 700;
      color: #475569;
    }
    .poster-badge {
      background: #e0f2fe;
      border: 2px solid #38bdf8;
      border-radius: 14px;
      padding: 6px 14px;
      text-align: right;
    }
    .poster-badge .period-label {
      font-size: 10pt;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
    }
    .poster-badge .period-dates {
      font-size: 14pt;
      font-weight: 900;
      color: #0f172a;
    }
    .poster-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 10px;
      flex: 1;
    }
    .day-column {
      background: #ffffff;
      border: 2px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 5px rgba(0,0,0,0.04);
    }
    .day-header {
      padding: 6px 4px;
      text-align: center;
      font-size: 14pt;
      font-weight: 900;
      border-bottom: 2px solid #cbd5e1;
    }
    .day-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      background: #fafafa;
    }
    .task-block {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 6px 8px;
    }
    .task-title {
      font-size: 12pt;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .student-pill {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 11pt;
      font-weight: 700;
      color: #166534;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .student-pill:last-child {
      margin-bottom: 0;
    }
    .student-code {
      font-size: 9pt;
      color: #15803d;
      font-weight: 800;
    }
    .empty-slot {
      font-size: 10pt;
      color: #94a3b8;
      text-align: center;
      padding: 4px;
    }
    .poster-footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5pt;
      font-weight: 700;
      color: #64748b;
    }
    .poster-footer .slogan {
      color: #0284c7;
    }
    .poster-footer .teacher {
      color: #1e293b;
    }
  </style>
</head>
<body>
  <div class="poster-container">
    <div class="poster-header">
      <div class="poster-title-area">
        <h1>✨ ตารางเวรทำความสะอาดประจำห้อง ${escapeHtml(roomName)}</h1>
        <p>${escapeHtml(schoolName)} · ร่วมสร้างห้องเรียนสะอาด น่าอยู่ มีระเบียบวินัย</p>
      </div>
      <div class="poster-badge">
        <div class="period-label">สัปดาห์ประจำวันที่</div>
        <div class="period-dates">${formattedWeekStart} - ${formattedWeekEnd}</div>
      </div>
    </div>

    <div class="poster-grid">
      ${days
        .map((day) => {
          const dayAssignments = assignments.filter((a) => a.duty_date === day.date);

          return `
        <div class="day-column">
          <div class="day-header" style="background:${day.color}; color:${day.darkColor};">
            ${day.label}
          </div>
          <div class="day-body">
            ${activeTasks
              .map((task) => {
                const list = dayAssignments.filter((a) => a.duty_task_id === task.id);
                return `
              <div class="task-block">
                <div class="task-title">
                  <span>${getEmoji(task.name)}</span>
                  <span>${escapeHtml(task.name)}</span>
                </div>
                ${
                  list.length > 0
                    ? list
                        .map((a) => {
                          const s = studentMap.get(a.student_id);
                          return `
                    <div class="student-pill">
                      <span>${escapeHtml(s ? `${s.first_name} ${s.last_name}` : "-")}</span>
                      ${s?.student_code ? `<span class="student-code">#${escapeHtml(s.student_code)}</span>` : ""}
                    </div>
                  `;
                        })
                        .join("")
                    : `<div class="empty-slot">—</div>`
                }
              </div>
            `;
              })
              .join("")}
          </div>
        </div>
      `;
        })
        .join("")}
    </div>

    <div class="poster-footer">
      <div class="slogan">🌟 "ห้องเรียนสะอาด จิตใจแจ่มใส ร่วมใจดูแลของส่วนรวม"</div>
      <div class="teacher">ครูประจำชั้น: ${escapeHtml(teacherName || "................................................")}</div>
    </div>
  </div>
  <script>
    window.addEventListener("load", function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;
}
