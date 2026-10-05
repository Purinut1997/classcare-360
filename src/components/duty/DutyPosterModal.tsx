import { useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileText,
  Palette,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import type { DutyAssignment, DutyTask, Student } from "../../types/duty";

interface DutyPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: string;
  roomName: string;
  schoolName: string;
  teacherName: string;
  tasks: DutyTask[];
  assignments: DutyAssignment[];
  students: Student[];
  studentMap: Map<string, Student>;
  onPrint: (style: "poster" | "official", week: string) => void;
  busy: boolean;
}

export function DutyPosterModal({
  isOpen,
  onClose,
  weekStart,
  roomName,
  schoolName,
  teacherName,
  tasks,
  assignments,
  students,
  studentMap,
  onPrint,
  busy,
}: DutyPosterModalProps) {
  const [printWeek, setPrintWeek] = useState(weekStart);
  const [posterStyle, setPosterStyle] = useState<"poster" | "official">("poster");

  if (!isOpen) return null;

  function addDays(baseDate: string, days: number): string {
    const d = new Date(`${baseDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const weekEnd = addDays(printWeek, 4);

  const days = [
    { label: "จันทร์", full: "วันจันทร์", date: printWeek, value: 1 },
    { label: "อังคาร", full: "วันอังคาร", date: addDays(printWeek, 1), value: 2 },
    { label: "พุธ", full: "วันพุธ", date: addDays(printWeek, 2), value: 3 },
    { label: "พฤหัสฯ", full: "วันพฤหัสบดี", date: addDays(printWeek, 3), value: 4 },
    { label: "ศุกร์", full: "วันศุกร์", date: addDays(printWeek, 4), value: 5 },
  ];

  const activeTasks = tasks.filter((t) => t.is_active);

  function getTaskEmoji(name: string): string {
    if (name.includes("กวาด")) return "🧹";
    if (name.includes("ถู")) return "🧽";
    if (name.includes("ขยะ")) return "🗑️";
    if (name.includes("กระดาน") || name.includes("โต๊ะ")) return "🧼";
    if (name.includes("ห้องน้ำ")) return "🚿";
    if (name.includes("ไฟ") || name.includes("แอร์") || name.includes("หน้าต่าง")) return "🪟";
    return "⭐";
  }

  return (
    <div
      aria-labelledby="duty-print-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-slate-950 px-6 py-5 text-white">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-300 ring-1 ring-cyan-400/30">
                <Printer size={13} />
                พิมพ์ป้ายเวร & รายงาน A4 แนวนอน
              </span>
              <h2 className="mt-2 text-xl font-black" id="duty-print-title">
                พิมพ์ตารางเวรห้อง {roomName}
              </h2>
              <p className="mt-0.5 text-xs font-bold text-slate-300">
                สัปดาห์วันที่{" "}
                {new Intl.DateTimeFormat("th-TH", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(`${printWeek}T12:00:00`))}{" "}
                –{" "}
                {new Intl.DateTimeFormat("th-TH", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(`${weekEnd}T12:00:00`))}
              </p>
            </div>
            <button
              aria-label="ปิด"
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Style Switcher & Week selector */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="inline-flex rounded-xl bg-white/10 p-1 text-xs font-black">
              <button
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  posterStyle === "poster"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setPosterStyle("poster")}
                type="button"
              >
                <Palette size={14} />
                ป้ายเวรสดใสติดบอร์ดห้องเรียน (แนะนำ)
              </button>
              <button
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  posterStyle === "official"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setPosterStyle("official")}
                type="button"
              >
                <FileText size={14} />
                แบบรายงานราชการ (ทางการ)
              </button>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold">
              <button
                className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20"
                onClick={() => setPrintWeek((w) => addDays(w, -7))}
                type="button"
              >
                ◀ สัปดาห์ก่อน
              </button>
              <button
                className="rounded-lg bg-cyan-500/20 px-2 py-1 text-cyan-300"
                onClick={() => setPrintWeek(weekStart)}
                type="button"
              >
                สัปดาห์นี้
              </button>
              <button
                className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20"
                onClick={() => setPrintWeek((w) => addDays(w, 7))}
                type="button"
              >
                สัปดาห์ถัดไป ▶
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Paper Canvas */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-6 shadow-md">
            {posterStyle === "poster" ? (
              /* Playful Modern Poster */
              <div>
                <div className="flex items-center justify-between border-b-2 border-cyan-500 pb-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-600">
                      {schoolName}
                    </span>
                    <h3 className="text-xl font-black text-slate-900">
                      ✨ ตารางเวรทำความสะอาดประจำห้อง {roomName}
                    </h3>
                  </div>
                  <div className="rounded-xl bg-cyan-50 px-3 py-1.5 text-right ring-1 ring-cyan-200">
                    <p className="text-[10px] font-black text-cyan-800">ช่วงวันที่</p>
                    <p className="text-xs font-black text-slate-800">
                      {new Intl.DateTimeFormat("th-TH", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(`${printWeek}T12:00:00`))}{" "}
                      -{" "}
                      {new Intl.DateTimeFormat("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(`${weekEnd}T12:00:00`))}
                    </p>
                  </div>
                </div>

                {/* Grid */}
                <div className="mt-4 grid grid-cols-5 gap-2.5">
                  {days.map((day) => {
                    const dayAssignments = assignments.filter((a) => a.duty_date === day.date);

                    return (
                      <div
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-center"
                        key={day.date}
                      >
                        <div className="rounded-lg bg-cyan-700 py-1 text-white shadow-xs">
                          <p className="text-xs font-black">{day.full}</p>
                          <p className="text-[10px] opacity-80">
                            {new Intl.DateTimeFormat("th-TH", {
                              day: "numeric",
                              month: "short",
                            }).format(new Date(`${day.date}T12:00:00`))}
                          </p>
                        </div>

                        <div className="mt-2.5 space-y-2">
                          {activeTasks.map((task) => {
                            const taskAssignments = dayAssignments.filter(
                              (a) => a.duty_task_id === task.id,
                            );

                            return (
                              <div
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-left text-xs"
                                key={task.id}
                              >
                                <p className="font-black text-slate-800">
                                  {getTaskEmoji(task.name)} {task.name}
                                </p>
                                <div className="mt-1 space-y-0.5">
                                  {taskAssignments.length > 0 ? (
                                    taskAssignments.map((a) => {
                                      const s = studentMap.get(a.student_id);
                                      return (
                                        <p
                                          className="truncate rounded bg-cyan-50 px-1 py-0.5 text-[11px] font-bold text-cyan-900"
                                          key={a.id}
                                        >
                                          {s?.student_code ? `${s.student_code}. ` : ""}
                                          {s ? `${s.first_name} ${s.last_name.slice(0, 1)}.` : "-"}
                                        </p>
                                      );
                                    })
                                  ) : (
                                    <p className="text-[10px] text-slate-300">—</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
                  <p>ห้องเรียนสะอาด ปลอดโปร่ง ร่วมใจรักษาความสะอาดประจำวัน 💖</p>
                  <div className="text-right">
                    <p className="font-bold">ครูประจำชั้น: {teacherName}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Official Standard Form Preview */
              <div>
                <div className="border-b border-slate-900 pb-2 text-center">
                  <p className="text-xs font-bold text-slate-500">เอกสารงานกิจวัตรและเวรประจำชั้น</p>
                  <h3 className="text-base font-black text-slate-900">
                    ตารางเวรทำความสะอาดและการดูแลห้องเรียน {roomName}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {schoolName} · สัปดาห์ {printWeek} ถึง {weekEnd}
                  </p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-400 text-left text-[11px]">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-400 p-1.5">หน้าที่</th>
                        {days.map((d) => (
                          <th className="border border-slate-400 p-1.5 text-center" key={d.date}>
                            {d.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTasks.map((t) => (
                        <tr key={t.id}>
                          <td className="border border-slate-400 p-1.5 font-bold">{t.name}</td>
                          {days.map((d) => {
                            const list = assignments.filter(
                              (a) => a.duty_date === d.date && a.duty_task_id === t.id,
                            );
                            return (
                              <td className="border border-slate-400 p-1 text-center" key={d.date}>
                                {list.map((a) => {
                                  const s = studentMap.get(a.student_id);
                                  return (
                                    <div key={a.id}>
                                      {s ? `${s.first_name} ${s.last_name.slice(0, 1)}.` : "-"}
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <p className="text-xs font-bold text-slate-500">
            ระบบปรับขนาดพอดีหน้ากระดาษ A4 แนวนอนอัตโนมัติ (1 หน้า)
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              ปิด
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-6 py-2 text-sm font-black text-white shadow-md hover:bg-cyan-800 disabled:opacity-50"
              disabled={busy}
              onClick={() => onPrint(posterStyle, printWeek)}
              type="button"
            >
              <Printer size={16} />
              พิมพ์เอกสาร (Print / PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
