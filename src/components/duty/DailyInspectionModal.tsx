import { useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Star,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { DutyAssignment, DutyStatus, DutyTask, Student } from "../../types/duty";
import { DUTY_STATUS_CONFIG } from "../../types/duty";

interface DailyInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  assignments: DutyAssignment[];
  tasks: DutyTask[];
  students: Student[];
  studentMap: Map<string, Student>;
  onRecord: (
    assignment: DutyAssignment,
    status: DutyStatus,
    options?: {
      substituteId?: string | null;
      checklistResult?: Array<{ label: string; checked: boolean }>;
      evidencePaths?: string[];
      note?: string | null;
    },
  ) => Promise<void>;
  onMarkAllDone: (date: string) => Promise<void>;
  canManage: boolean;
  busy: boolean;
}

export function DailyInspectionModal({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  assignments,
  tasks,
  students,
  studentMap,
  onRecord,
  onMarkAllDone,
  canManage,
  busy,
}: DailyInspectionModalProps) {
  const [activeSubstituteAssignmentId, setActiveSubstituteAssignmentId] = useState<string | null>(null);
  const [substituteChoice, setSubstituteChoice] = useState<string>("");
  const [starRating, setStarRating] = useState<number>(5);
  const [activeChecklist, setActiveChecklist] = useState<Record<string, Record<string, boolean>>>({});
  const [evidenceInput, setEvidenceInput] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const dayAssignments = assignments.filter((a) => a.duty_date === selectedDate);
  const completedCount = dayAssignments.filter((a) => a.status === "completed").length;
  const pendingCount = dayAssignments.filter((a) => a.status === "assigned").length;

  const formattedDate = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedDate}T12:00:00`));

  function changeDay(offsetDays: number) {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + offsetDays);
    const nextDate = d.toISOString().slice(0, 10);
    onDateChange(nextDate);
  }

  function handleChecklistToggle(assignmentId: string, itemLabel: string, currentVal: boolean) {
    setActiveChecklist((prev) => ({
      ...prev,
      [assignmentId]: {
        ...(prev[assignmentId] || {}),
        [itemLabel]: !currentVal,
      },
    }));
  }

  return (
    <div
      aria-labelledby="inspection-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/30 bg-white shadow-2xl">
        {/* Header with Dark Modern Theme */}
        <div className="relative overflow-hidden bg-slate-950 px-6 py-5 text-white">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/30">
                <CheckCircle2 size={13} />
                ตรวจผลเวรประจำวัน
              </span>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  onClick={() => changeDay(-1)}
                  title="วันก่อนหน้า"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <h2 className="text-xl font-black" id="inspection-modal-title">
                  {formattedDate}
                </h2>
                <button
                  className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  onClick={() => changeDay(1)}
                  title="วันถัดไป"
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
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

          {/* Quick Metrics & Cleanliness Rating */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="flex items-center gap-4 text-xs font-bold">
              <span>
                ทั้งหมด: <strong className="text-white">{dayAssignments.length}</strong> คน
              </span>
              <span className="text-emerald-400">
                ทำแล้ว: <strong>{completedCount}</strong>
              </span>
              <span className="text-amber-300">
                รอตรวจ: <strong>{pendingCount}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="mr-1 text-[11px] font-bold text-slate-400">ระดับความสะอาด:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  className={`transition ${star <= starRating ? "text-amber-400" : "text-white/20 hover:text-amber-200"}`}
                  key={star}
                  onClick={() => setStarRating(star)}
                  title={`ให้ ${star} ดาว`}
                  type="button"
                >
                  <Star className="fill-current" size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 1-Click Action Bar */}
        {dayAssignments.length > 0 && pendingCount > 0 ? (
          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-6 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <Sparkles className="text-emerald-600" size={16} />
              <span>ตรวจด่วน: หากนักเรียนทุกคนช่วยกันทำงานเรียบร้อยแล้ว</span>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              disabled={busy || !canManage}
              onClick={() => void onMarkAllDone(selectedDate)}
              type="button"
            >
              <CheckCircle2 size={14} />
              ทำครบทุกคน ({pendingCount} คน)
            </button>
          </div>
        ) : null}

        {/* Assignment List */}
        <div className="max-h-[500px] flex-1 overflow-y-auto p-4 sm:p-6">
          {dayAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <Clock className="mx-auto text-slate-300" size={36} />
              <h3 className="mt-3 text-base font-black text-slate-700">ไม่มีเวรในวันนี้</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                อาจเป็นวันหยุดตามปฏิทินโรงเรียน หรือยังไม่ได้มอบหมายเวรในวันนี้
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {dayAssignments.map((assignment) => {
                const task = tasks.find((t) => t.id === assignment.duty_task_id);
                const student = studentMap.get(assignment.student_id);
                const substitute = assignment.substitute_student_id
                  ? studentMap.get(assignment.substitute_student_id)
                  : null;
                const statusConf = DUTY_STATUS_CONFIG[assignment.status];
                const isSubmittingSub = activeSubstituteAssignmentId === assignment.id;

                return (
                  <article
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                    key={assignment.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">
                            {task?.name || "หน้าที่เวร"}
                          </span>
                          {task?.location ? (
                            <span className="text-xs font-bold text-slate-400">
                              · {task.location}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${statusConf.badgeClass}`}
                          >
                            {statusConf.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-700">
                          {student?.student_code ? `[${student.student_code}] ` : ""}
                          {student ? `${student.first_name} ${student.last_name}` : "-"}
                          {substitute ? (
                            <span className="ml-2 font-bold text-amber-700">
                              (มีคนแทน: {substitute.first_name} {substitute.last_name})
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {/* Status Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                            assignment.status === "completed"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                          }`}
                          disabled={busy || !canManage}
                          onClick={() => {
                            const taskChecklist = task?.checklist || [];
                            const checks = taskChecklist.map((label) => ({
                              label,
                              checked: activeChecklist[assignment.id]?.[label] ?? true,
                            }));
                            const evidence = evidenceInput[assignment.id]
                              ? [evidenceInput[assignment.id]]
                              : undefined;
                            void onRecord(assignment, "completed", {
                              checklistResult: checks.length ? checks : undefined,
                              evidencePaths: evidence,
                            });
                          }}
                          type="button"
                        >
                          🟢 ทำแล้ว (+1)
                        </button>

                        <button
                          className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                            assignment.status === "missed"
                              ? "bg-rose-600 text-white shadow-sm"
                              : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                          }`}
                          disabled={busy || !canManage}
                          onClick={() => void onRecord(assignment, "missed")}
                          type="button"
                        >
                          🔴 ไม่ทำ (-1)
                        </button>

                        <button
                          className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                            assignment.status === "excused"
                              ? "bg-slate-700 text-white shadow-sm"
                              : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }`}
                          disabled={busy || !canManage}
                          onClick={() => void onRecord(assignment, "excused")}
                          type="button"
                        >
                          ลาเวร
                        </button>

                        {task?.allow_substitute ? (
                          <button
                            className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                              assignment.status === "substituted" || isSubmittingSub
                                ? "bg-amber-600 text-white shadow-sm"
                                : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                            }`}
                            disabled={busy || !canManage}
                            onClick={() => {
                              if (isSubmittingSub) {
                                setActiveSubstituteAssignmentId(null);
                              } else {
                                setActiveSubstituteAssignmentId(assignment.id);
                                setSubstituteChoice(assignment.substitute_student_id || "");
                              }
                            }}
                            type="button"
                          >
                            มีคนแทน
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Inline Substitute Selector */}
                    {isSubmittingSub ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                        <label className="block text-xs font-black text-amber-900">
                          เลือกนักเรียนที่มาทำเวรแทน:
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <select
                            className="h-9 flex-1 rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-bold text-slate-800"
                            onChange={(e) => setSubstituteChoice(e.target.value)}
                            value={substituteChoice}
                          >
                            <option value="">-- เลือกเพื่อนร่วมห้องที่มาช่วยแทน --</option>
                            {students
                              .filter((s) => s.id !== assignment.student_id)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.student_code ? `[${s.student_code}] ` : ""}
                                  {s.first_name} {s.last_name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-800 disabled:opacity-50"
                            disabled={!substituteChoice}
                            onClick={() => {
                              void onRecord(assignment, "substituted", {
                                substituteId: substituteChoice,
                              });
                              setActiveSubstituteAssignmentId(null);
                            }}
                            type="button"
                          >
                            บันทึกคนแทน
                          </button>
                          <button
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600"
                            onClick={() => setActiveSubstituteAssignmentId(null)}
                            type="button"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Task Checklist Items */}
                    {task?.checklist && task.checklist.length > 0 ? (
                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        <p className="text-[11px] font-black text-slate-500">
                          เช็กลิสต์ความเรียบร้อย ({task.checklist.length} รายการ):
                        </p>
                        <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                          {task.checklist.map((item) => {
                            const isChecked = activeChecklist[assignment.id]?.[item] ?? true;
                            return (
                              <label
                                className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700"
                                key={item}
                              >
                                <input
                                  checked={isChecked}
                                  className="h-3.5 w-3.5 rounded text-cyan-600 focus:ring-cyan-500"
                                  onChange={() =>
                                    handleChecklistToggle(assignment.id, item, isChecked)
                                  }
                                  type="checkbox"
                                />
                                <span>{item}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Evidence Path (if required) */}
                    {task?.evidence_required ? (
                      <div className="mt-2.5 border-t border-slate-100 pt-2 text-xs">
                        <span className="font-bold text-cyan-800">
                          📷 หน้าที่นี้ต้องการหลักฐานภาพถ่าย:
                        </span>
                        <input
                          className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-bold"
                          onChange={(e) =>
                            setEvidenceInput((prev) => ({
                              ...prev,
                              [assignment.id]: e.target.value,
                            }))
                          }
                          placeholder="วางลิงก์รูปถ่าย หรือระบุหมายเหตุความสะอาด..."
                          type="text"
                          value={evidenceInput[assignment.id] || ""}
                        />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs font-bold text-slate-500">
            ระบบจะอัปเดตแต้มจิตพิสัย (+1 / -1) ไปยังสมุดพฤติกรรมอัตโนมัติ
          </p>
          <button
            className="rounded-xl bg-slate-900 px-6 py-2 text-sm font-black text-white hover:bg-slate-800"
            onClick={onClose}
            type="button"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
