import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Layers,
  LayoutGrid,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { DutyAssignment, DutyTask, Student } from "../../types/duty";
import { DUTY_STATUS_CONFIG } from "../../types/duty";

interface DutyScheduleViewProps {
  weekStart: string;
  onWeekChange: (week: string) => void;
  tasks: DutyTask[];
  uniqueTasks: DutyTask[];
  taskAliasIds: Map<string, string[]>;
  assignments: DutyAssignment[];
  students: Student[];
  studentMap: Map<string, Student>;
  canManage: boolean;
  busy: boolean;
  selectedDutyDate: string;
  onSelectDutyDate: (date: string) => void;
  onOpenAssignModal: (task: DutyTask, date: string, assignment?: DutyAssignment) => void;
  onOpenGenerator: () => void;
  onOpenPosterModal: () => void;
  onOpenTaskDesigner: () => void;
  onOpenInspection: (date: string) => void;
  onQuickAssignPresets?: () => void;
  onDeleteAssignment: (assignmentId: string) => Promise<void>;
}

export function DutyScheduleView({
  weekStart,
  onWeekChange,
  tasks,
  uniqueTasks,
  taskAliasIds,
  assignments,
  students,
  studentMap,
  canManage,
  busy,
  selectedDutyDate,
  onSelectDutyDate,
  onOpenAssignModal,
  onOpenGenerator,
  onOpenPosterModal,
  onOpenTaskDesigner,
  onOpenInspection,
  onQuickAssignPresets,
  onDeleteAssignment,
}: DutyScheduleViewProps) {
  const [viewMode, setViewMode] = useState<"matrix" | "cards">("matrix");

  function addDays(baseDate: string, days: number): string {
    const d = new Date(`${baseDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const days = [
    { label: "จันทร์", short: "จ.", value: 1, date: weekStart },
    { label: "อังคาร", short: "อ.", value: 2, date: addDays(weekStart, 1) },
    { label: "พุธ", short: "พ.", value: 3, date: addDays(weekStart, 2) },
    { label: "พฤหัสบดี", short: "พฤ.", value: 4, date: addDays(weekStart, 3) },
    { label: "ศุกร์", short: "ศ.", value: 5, date: addDays(weekStart, 4) },
  ];

  const todayStr = new Date().toISOString().slice(0, 10);

  // Stats calculation
  const totalAssignedThisWeek = assignments.length;
  const assignedStudentIds = new Set(assignments.map((a) => a.student_id));
  const participationRate =
    students.length > 0 ? Math.round((assignedStudentIds.size / students.length) * 100) : 0;

  const todayAssignments = assignments.filter((a) => a.duty_date === todayStr);
  const todayDoneCount = todayAssignments.filter((a) => a.status === "completed").length;

  const activeUniqueTasks = uniqueTasks.filter((t) => t.is_active);

  return (
    <div className="space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">นักเรียนทั้งหมด</span>
            <Users className="text-cyan-600" size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{students.length} คน</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">
            มีเวรในสัปดาห์นี้ {assignedStudentIds.size} คน ({participationRate}%)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">หน้าที่เวรสัปดาห์นี้</span>
            <ClipboardList className="text-blue-600" size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalAssignedThisWeek} งาน</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">
            {activeUniqueTasks.length} หน้าที่หลักเปิดใช้งาน
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">ความสมดุลของเวร</span>
            <Scale className="text-emerald-600" size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {totalAssignedThisWeek === 0 ? "ยังไม่จัดเวร" : "กระจายเท่าเทียม"}
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">
            อัลกอริทึมเฉลี่ยภาระงานอัตโนมัติ
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">สถานะเวรวันนี้</span>
            <CheckCircle2 className="text-amber-600" size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {todayAssignments.length === 0
              ? "ไม่มีเวรวันนี้"
              : `${todayDoneCount}/${todayAssignments.length} คน`}
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">
            {todayAssignments.length > 0 && todayDoneCount === todayAssignments.length
              ? "ตรวจเรียบร้อยครบทุกคน 🎉"
              : todayAssignments.length > 0
                ? "รอตรวจเวรตอนเย็น"
                : "วันหยุดหรือไม่มีการลงเวร"}
          </p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="nexus-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Week Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-white hover:text-slate-900"
                onClick={() => onWeekChange(addDays(weekStart, -7))}
                title="สัปดาห์ก่อนหน้า"
                type="button"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-3 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400">สัปดาห์</span>
                <p className="text-xs font-black text-slate-900">
                  {new Intl.DateTimeFormat("th-TH", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(`${weekStart}T12:00:00`))}{" "}
                  –{" "}
                  {new Intl.DateTimeFormat("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(`${addDays(weekStart, 4)}T12:00:00`))}
                </p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-white hover:text-slate-900"
                onClick={() => onWeekChange(addDays(weekStart, 7))}
                title="สัปดาห์ถัดไป"
                type="button"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  viewMode === "matrix"
                    ? "bg-white text-cyan-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setViewMode("matrix")}
                type="button"
              >
                <LayoutGrid size={13} />
                ตารางสัปดาห์
              </button>
              <button
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  viewMode === "cards"
                    ? "bg-white text-cyan-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setViewMode("cards")}
                type="button"
              >
                <Layers size={13} />
                การ์ดรายวัน
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-cyan-300 hover:bg-slate-50"
              onClick={onOpenTaskDesigner}
              type="button"
            >
              <Plus size={14} />
              จัดการหน้าที่เวร
            </button>

            <button
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-cyan-800 hover:bg-cyan-100"
              onClick={onOpenPosterModal}
              type="button"
            >
              <Printer size={14} />
              พิมพ์ป้ายเวรหน้าห้อง
            </button>

            <button
              className="blue-action inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-black shadow-xs disabled:opacity-50"
              disabled={busy || !canManage}
              onClick={onOpenGenerator}
              type="button"
            >
              <Sparkles size={14} />
              สุ่มจัดเวรอัตโนมัติ
            </button>
          </div>
        </div>

        {/* Empty State Banner (if no assignments exist for this week) */}
        {totalAssignedThisWeek === 0 ? (
          <div className="mt-5 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50/80 via-white to-blue-50/80 p-6 text-center shadow-xs">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-700">
              <CalendarCheck size={26} />
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-900">
              สัปดาห์นี้ยังไม่มีการมอบหมายเวรทำความสะอาด
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-xs font-bold leading-5 text-slate-500">
              คุณครูสามารถให้ระบบช่วยสุ่มจัดเวรแบบเฉลี่ยความเท่าเทียมให้เด็กทุกคนได้ทันทีในคลิกเดียว
              หรือคลิกที่ช่องตารางเพื่อมอบหมายเองตามต้องการ
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                className="blue-action inline-flex h-10 items-center gap-2 rounded-xl px-5 text-xs font-black"
                disabled={busy || !canManage}
                onClick={onOpenGenerator}
                type="button"
              >
                <Sparkles size={15} />
                สุ่มจัดเวรอัตโนมัติในสัปดาห์นี้
              </button>
              {onQuickAssignPresets ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
                  disabled={busy || !canManage}
                  onClick={onQuickAssignPresets}
                  type="button"
                >
                  <Users size={15} />
                  แบ่งกลุ่มเวรวันจันทร์-ศุกร์ (5 กลุ่ม)
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Schedule Matrix Table View */}
        {viewMode === "matrix" ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="w-48 p-3 text-xs font-black">งาน / วัน</th>
                  {days.map((day) => {
                    const isToday = day.date === todayStr;
                    return (
                      <th
                        className={`p-2 text-center transition ${
                          selectedDutyDate === day.date
                            ? "bg-cyan-900"
                            : isToday
                              ? "bg-slate-900"
                              : ""
                        }`}
                        key={day.value}
                      >
                        <div className="flex flex-col items-center justify-between gap-1">
                          <button
                            className="w-full rounded-xl px-2 py-1.5 text-center transition hover:bg-white/10"
                            onClick={() => onSelectDutyDate(day.date)}
                            type="button"
                          >
                            <span className="block text-xs font-black">
                              {day.label}{" "}
                              {new Intl.DateTimeFormat("th-TH", {
                                day: "numeric",
                                month: "short",
                              }).format(new Date(`${day.date}T12:00:00`))}
                            </span>
                            {isToday ? (
                              <span className="mt-0.5 inline-block rounded-full bg-cyan-400 px-2 py-0.2 text-[9px] font-black text-slate-950">
                                วันนี้
                              </span>
                            ) : null}
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200 hover:bg-white/25 hover:text-white"
                            onClick={() => onOpenInspection(day.date)}
                            title="ตรวจเวรวันนี้"
                            type="button"
                          >
                            <CheckCircle2 size={11} />
                            ตรวจเวร
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {activeUniqueTasks.map((task) => (
                  <tr className="hover:bg-slate-50/50" key={task.id}>
                    <th className="bg-slate-50/70 p-3 font-black text-slate-900">
                      <span className="block">{task.name}</span>
                      <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                        {task.location || "ประจำห้อง"} · {task.slots_per_day} คน
                      </span>
                    </th>
                    {days.map((day) => {
                      const isActiveOnThisDay = task.active_weekdays.includes(day.value);
                      const aliasIds = taskAliasIds.get(task.id) || [task.id];
                      const slotAssignments = assignments.filter(
                        (a) => aliasIds.includes(a.duty_task_id) && a.duty_date === day.date,
                      );

                      return (
                        <td
                          className={`p-2 align-top ${
                            selectedDutyDate === day.date ? "bg-cyan-50/30" : ""
                          }`}
                          key={day.date}
                        >
                          {!isActiveOnThisDay ? (
                            <div className="py-3 text-center text-xs font-bold text-slate-300">
                              ไม่มีเวรวันนี้
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {slotAssignments.map((assignment) => {
                                const student = studentMap.get(assignment.student_id);
                                const statusConfig = DUTY_STATUS_CONFIG[assignment.status];

                                return (
                                  <div
                                    className={`group relative flex items-center justify-between gap-1.5 rounded-xl border p-2 text-xs transition ${statusConfig.badgeClass}`}
                                    key={assignment.id}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-black">
                                        {student?.student_code ? `${student.student_code}. ` : ""}
                                        {student
                                          ? `${student.first_name} ${student.last_name}`
                                          : "-"}
                                      </p>
                                      <span className="text-[10px] font-bold opacity-80">
                                        {statusConfig.label}
                                      </span>
                                    </div>

                                    {/* Action Hover Controls */}
                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                      <button
                                        className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-cyan-800"
                                        onClick={() => onOpenAssignModal(task, day.date, assignment)}
                                        title="เปลี่ยนตัวนักเรียน"
                                        type="button"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      {canManage ? (
                                        <button
                                          className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                                          onClick={() => void onDeleteAssignment(assignment.id)}
                                          title="นำออกจากช่อง"
                                          type="button"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}

                              {slotAssignments.length < task.slots_per_day ? (
                                <button
                                  className="w-full rounded-xl border border-dashed border-slate-300 bg-white/70 py-1.5 text-center text-xs font-black text-slate-500 hover:border-cyan-400 hover:bg-cyan-50/50 hover:text-cyan-800"
                                  disabled={busy || !canManage}
                                  onClick={() => onOpenAssignModal(task, day.date)}
                                  type="button"
                                >
                                  + มอบหมาย
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Daily Cards View (Ideal for Tablet / Mobile) */
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => {
              const dayAssignments = assignments.filter((a) => a.duty_date === day.date);
              const isToday = day.date === todayStr;

              return (
                <div
                  className={`rounded-2xl border p-4 transition ${
                    isToday
                      ? "border-cyan-400 bg-cyan-50/20 shadow-md ring-1 ring-cyan-300"
                      : "border-slate-200 bg-white shadow-xs"
                  }`}
                  key={day.date}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900">{day.label}</h4>
                        {isToday ? (
                          <span className="rounded-full bg-cyan-600 px-2 py-0.2 text-[10px] font-black text-white">
                            วันนี้
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {new Intl.DateTimeFormat("th-TH", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }).format(new Date(`${day.date}T12:00:00`))}
                      </p>
                    </div>
                    <button
                      className="inline-flex items-center gap-1 rounded-xl bg-cyan-50 px-2.5 py-1.5 text-xs font-black text-cyan-800 hover:bg-cyan-100"
                      onClick={() => onOpenInspection(day.date)}
                      type="button"
                    >
                      <CheckCircle2 size={13} />
                      ตรวจเวร
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {activeUniqueTasks
                      .filter((t) => t.active_weekdays.includes(day.value))
                      .map((task) => {
                        const aliasIds = taskAliasIds.get(task.id) || [task.id];
                        const list = dayAssignments.filter((a) =>
                          aliasIds.includes(a.duty_task_id),
                        );

                        return (
                          <div
                            className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-xs"
                            key={task.id}
                          >
                            <div className="flex items-center justify-between font-black text-slate-800">
                              <span>{task.name}</span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {list.length}/{task.slots_per_day} คน
                              </span>
                            </div>
                            <div className="mt-1.5 space-y-1">
                              {list.map((assignment) => {
                                const s = studentMap.get(assignment.student_id);
                                const statusConfig = DUTY_STATUS_CONFIG[assignment.status];
                                return (
                                  <div
                                    className={`flex items-center justify-between rounded-lg border px-2 py-1 ${statusConfig.badgeClass}`}
                                    key={assignment.id}
                                  >
                                    <span className="font-bold">
                                      {s?.student_code ? `[${s.student_code}] ` : ""}
                                      {s ? `${s.first_name} ${s.last_name}` : "-"}
                                    </span>
                                    <span className="text-[10px]">{statusConfig.label}</span>
                                  </div>
                                );
                              })}
                              {list.length < task.slots_per_day ? (
                                <button
                                  className="w-full rounded-lg border border-dashed border-slate-300 py-1 text-center font-bold text-slate-400 hover:text-cyan-700"
                                  onClick={() => onOpenAssignModal(task, day.date)}
                                  type="button"
                                >
                                  + มอบหมาย
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
