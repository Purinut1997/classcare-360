import { useMemo, useState } from "react";
import { Check, Search, Trash2, UserCheck, Users, X } from "lucide-react";
import type { DutyAssignment, DutyTask, Student } from "../../types/duty";

interface StudentAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: DutyTask | null;
  dutyDate: string;
  students: Student[];
  assignments: DutyAssignment[];
  currentAssignment?: DutyAssignment | null;
  tasks: DutyTask[];
  onAssign: (studentId: string) => Promise<void>;
  onUnassign?: (assignmentId: string) => Promise<void>;
  busy: boolean;
}

export function StudentAssignModal({
  isOpen,
  onClose,
  task,
  dutyDate,
  students,
  assignments,
  currentAssignment,
  tasks,
  onAssign,
  onUnassign,
  busy,
}: StudentAssignModalProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "least">("least");

  // Calculate duty counts per student across current assignments
  const dutyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assignments.forEach((assignment) => {
      counts.set(
        assignment.student_id,
        (counts.get(assignment.student_id) || 0) + 1,
      );
    });
    return counts;
  }, [assignments]);

  // Find students who already have duty on this specific date
  const dayAssignmentsByStudent = useMemo(() => {
    const map = new Map<string, string>(); // studentId -> taskName
    assignments
      .filter((a) => a.duty_date === dutyDate && a.id !== currentAssignment?.id)
      .forEach((a) => {
        const t = tasks.find((item) => item.id === a.duty_task_id);
        map.set(a.student_id, t?.name || "หน้าที่อื่น");
      });
    return map;
  }, [assignments, currentAssignment, dutyDate, tasks]);

  const filteredStudents = useMemo(() => {
    let list = [...students];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => {
        const full = `${s.first_name} ${s.last_name}`.toLowerCase();
        const code = (s.student_code || "").toLowerCase();
        return full.includes(q) || code.includes(q);
      });
    }

    if (filterMode === "least") {
      list.sort((a, b) => {
        const countA = dutyCounts.get(a.id) || 0;
        const countB = dutyCounts.get(b.id) || 0;
        if (countA !== countB) return countA - countB;
        return (a.student_code || "").localeCompare(b.student_code || "", undefined, { numeric: true });
      });
    } else {
      list.sort((a, b) =>
        (a.student_code || "").localeCompare(b.student_code || "", undefined, { numeric: true }),
      );
    }

    return list;
  }, [dutyCounts, filterMode, search, students]);

  if (!isOpen || !task) return null;

  const currentStudent = currentAssignment
    ? students.find((s) => s.id === currentAssignment.student_id)
    : null;

  const formattedDate = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dutyDate}T12:00:00`));

  return (
    <div
      aria-labelledby="assign-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/30 bg-white shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-slate-950 px-6 py-5 text-white">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-300 ring-1 ring-cyan-400/30">
                <UserCheck size={13} />
                มอบหมายเวรประจำวัน
              </span>
              <h2 className="mt-2 text-xl font-black" id="assign-modal-title">
                {task.name}
              </h2>
              <p className="mt-0.5 text-xs font-bold text-slate-300">
                {formattedDate} {task.location ? `· ${task.location}` : ""}
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
        </div>

        {/* Current Assigned Student (if replacing) */}
        {currentStudent && onUnassign && currentAssignment ? (
          <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/70 px-6 py-3 text-xs font-bold text-amber-900">
            <div>
              <span>ผู้รับผิดชอบปัจจุบัน: </span>
              <strong className="text-amber-950">
                {currentStudent.student_code ? `[${currentStudent.student_code}] ` : ""}
                {currentStudent.first_name} {currentStudent.last_name}
              </strong>
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-black text-rose-700 hover:bg-rose-50"
              disabled={busy}
              onClick={() => void onUnassign(currentAssignment.id)}
              type="button"
            >
              <Trash2 size={13} />
              นำออก
            </button>
          </div>
        ) : null}

        {/* Controls */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, นามสกุล หรือเลขที่..."
              type="text"
              value={search}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-bold">
              <button
                className={`rounded-md px-2.5 py-1 transition ${
                  filterMode === "least"
                    ? "bg-white text-cyan-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setFilterMode("least")}
                type="button"
              >
                ⚖️ ทำเวรน้อยสุดก่อน (แนะนำ)
              </button>
              <button
                className={`rounded-md px-2.5 py-1 transition ${
                  filterMode === "all"
                    ? "bg-white text-cyan-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setFilterMode("all")}
                type="button"
              >
                เรียงตามเลขที่
              </button>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              พบ {filteredStudents.length} คน
            </span>
          </div>
        </div>

        {/* Student List */}
        <div className="max-h-[380px] flex-1 overflow-y-auto p-4">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-slate-400">
              ไม่พบนักเรียนตามเงื่อนไขที่ค้นหา
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredStudents.map((student) => {
                const count = dutyCounts.get(student.id) || 0;
                const conflictTask = dayAssignmentsByStudent.get(student.id);
                const isCurrent = currentAssignment?.student_id === student.id;

                return (
                  <button
                    className={`flex items-center justify-between rounded-2xl border p-3 text-left transition ${
                      isCurrent
                        ? "border-cyan-400 bg-cyan-50/70 ring-1 ring-cyan-400"
                        : conflictTask
                          ? "border-slate-200 bg-slate-50/70 hover:border-amber-300"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/30"
                    } ${busy ? "opacity-50" : ""}`}
                    disabled={busy}
                    key={student.id}
                    onClick={() => void onAssign(student.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-black text-slate-700">
                        {student.student_code || "#"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-950">
                            {student.first_name} {student.last_name}
                          </p>
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-800">
                              <Check size={10} /> รับผิดชอบอยู่
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-slate-500">
                            ทำเวรไปแล้ว {count} ครั้ง
                          </span>
                          {conflictTask ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                              ⚠️ วันนี้มีเวร: {conflictTask}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 group-hover:border-cyan-300 group-hover:bg-cyan-100 group-hover:text-cyan-900">
                        เลือก
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Users size={14} />
            <span>นักเรียนทั้งหมด {students.length} คน</span>
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
