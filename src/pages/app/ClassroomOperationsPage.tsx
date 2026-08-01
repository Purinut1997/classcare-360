import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarCheck,
  Download,
  GraduationCap,
  LockKeyhole,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scale,
  Trash2,
  X,
} from "lucide-react";
import QRCode from "qrcode";

import { writeAuditLog } from "../../lib/auditLog";
import { getBangkokDate } from "../../lib/date";
import { isSupabaseReady, supabase } from "../../lib/supabaseClient";
import type { AppSessionContext } from "../../types/core";

type TabKey = "duty" | "locks" | "rollover" | "archive" | "parent-qr";
type DutyStatus =
  "assigned" | "completed" | "missed" | "excused" | "substituted";

interface Classroom {
  academic_year: string | null;
  id: string;
  name: string;
  status: string;
}
interface Student {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  student_code: string | null;
}
interface DutyTask {
  active_weekdays: number[];
  allow_substitute: boolean;
  checklist: string[];
  evidence_required: boolean;
  id: string;
  instructions: string | null;
  is_active: boolean;
  location: string | null;
  missed_points: number;
  name: string;
  positive_points: number;
  rotation_strategy: "balanced" | "random" | "fixed" | "manual";
  slots_per_day: number;
  sort_order: number;
}
interface DutyAssignment {
  duty_date: string;
  duty_task_id: string;
  id: string;
  status: DutyStatus;
  student_id: string;
  substitute_student_id: string | null;
}
interface PeriodLock {
  classroom_id: string | null;
  id: string;
  module_key: "attendance" | "scores" | "savings";
  period_month: string;
  reason: string;
  status: "locked" | "unlocked";
}
interface UnlockRequest {
  id: string;
  lock_id: string;
  reason: string;
  status: string;
}
interface YearClosure {
  id: string;
  source_academic_year: string;
  source_classroom_id: string;
  status: string;
  summary: Record<string, number>;
  target_academic_year: string;
  target_classroom_id: string | null;
  undo_deadline: string | null;
}
interface YearTransition {
  closure_id: string;
  id: string;
  student_id: string;
  transition_type: "promoted" | "retained" | "graduated" | "transferred" | "inactive";
}
interface YearSnapshot {
  academic_year: string;
  classroom_name: string;
  created_at: string;
  id: string;
  record_counts: Record<string, number>;
}
interface PortalInvite {
  expires_at: string | null;
  id: string;
  invite_email: string;
  status: string;
  student_id: string;
}
interface BehaviorPoint {
  points: number;
  student_id: string;
}

const tabs: Array<{ icon: typeof CalendarCheck; key: TabKey; label: string }> =
  [
    { icon: CalendarCheck, key: "duty", label: "ตารางเวร" },
    { icon: LockKeyhole, key: "locks", label: "ล็อกข้อมูล" },
    { icon: GraduationCap, key: "rollover", label: "ปิดชั้น/เลื่อนชั้น" },
    { icon: Archive, key: "archive", label: "คลังย้อนหลัง" },
    { icon: QrCode, key: "parent-qr", label: "QR ผู้ปกครอง" },
  ];

const moduleLabels = {
  attendance: "เวลาเรียน",
  savings: "เงินออม",
  scores: "คะแนน",
};
const dutyWeekdays = [
  { label: "จันทร์", short: "จ.", value: 1 },
  { label: "อังคาร", short: "อ.", value: 2 },
  { label: "พุธ", short: "พ.", value: 3 },
  { label: "พฤหัสบดี", short: "พฤ.", value: 4 },
  { label: "ศุกร์", short: "ศ.", value: 5 },
  { label: "เสาร์", short: "ส.", value: 6 },
  { label: "อาทิตย์", short: "อา.", value: 7 },
];
const demoClassrooms: Classroom[] = [
  { academic_year: "2569", id: "demo-room", name: "ป.5/1", status: "active" },
];
const demoStudents: Student[] = [
  {
    classroom_id: "demo-room",
    first_name: "กิตติภพ",
    id: "demo-1",
    last_name: "ใจดี",
    student_code: "2454",
  },
  {
    classroom_id: "demo-room",
    first_name: "พิมพ์ชนก",
    id: "demo-2",
    last_name: "แสงทอง",
    student_code: "2455",
  },
  {
    classroom_id: "demo-room",
    first_name: "ธนกฤต",
    id: "demo-3",
    last_name: "มั่นคง",
    student_code: "2456",
  },
];

function mondayOf(date = new Date()) {
  const value = new Date(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return getBangkokDate(value);
}

function fullName(student: Student | undefined) {
  return student ? `${student.first_name} ${student.last_name}` : "-";
}

function dutyTaskKey(name: string) {
  return name.normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]+/g, "").toLocaleLowerCase("th");
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type OperationsMode = "duty" | "locks" | "year" | "parent";

export function ClassroomOperationsPage({
  mode = "duty",
  session,
}: {
  mode?: OperationsMode;
  session: AppSessionContext;
}) {
  const [tab, setTab] = useState<TabKey>(
    mode === "locks" ? "locks" : mode === "year" ? "rollover" : mode === "parent" ? "parent-qr" : "duty",
  );
  const [classrooms, setClassrooms] = useState<Classroom[]>(demoClassrooms);
  const [students, setStudents] = useState<Student[]>(demoStudents);
  const [classroomId, setClassroomId] = useState(
    session.workspace?.id ? "" : "demo-room",
  );
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [tasks, setTasks] = useState<DutyTask[]>([]);
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<UnlockRequest[]>([]);
  const [closures, setClosures] = useState<YearClosure[]>([]);
  const [transitions, setTransitions] = useState<YearTransition[]>([]);
  const [snapshots, setSnapshots] = useState<YearSnapshot[]>([]);
  const [invitations, setInvitations] = useState<PortalInvite[]>([]);
  const [behaviorPoints, setBehaviorPoints] = useState<BehaviorPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady
      ? null
      : "โหมดตัวอย่าง: เชื่อม Supabase เพื่อบันทึกข้อมูลจริง",
  );
  const [lockForm, setLockForm] = useState({
    module: "attendance" as keyof typeof moduleLabels,
    month: getBangkokDate().slice(0, 7),
    reason: "ตรวจสอบข้อมูลประจำเดือนเรียบร้อยแล้ว",
  });
  const [rolloverForm, setRolloverForm] = useState({
    targetClassroomId: "",
    targetYear: String(Number(session.workspace?.academicYear || "2569") + 1),
    note: "",
  });
  const [inviteForm, setInviteForm] = useState({
    days: "7",
    email: "",
    studentId: "",
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [selectedDutyDate, setSelectedDutyDate] = useState(weekStart);
  const [taskForm, setTaskForm] = useState({
    activeWeekdays: [1, 2, 3, 4, 5] as number[],
    allowSubstitute: true,
    checklist: "",
    evidenceRequired: false,
    instructions: "",
    isActive: true,
    location: "",
    missedPoints: -1,
    name: "",
    positivePoints: 1,
    rotationStrategy: "balanced" as DutyTask["rotation_strategy"],
    slotsPerDay: 1,
  });

  const roomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );
  const studentMap = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  );
  const roomAssignments = useMemo(
    () =>
      assignments.filter(
        (item) =>
          item.duty_date >= weekStart &&
          item.duty_date <= addDays(weekStart, 6),
      ),
    [assignments, weekStart],
  );
  const displayedDutyDays = useMemo(() => {
    const configured = new Set(tasks.flatMap((task) => task.active_weekdays));
    const values = dutyWeekdays.filter((day) => configured.has(day.value));
    return values.length ? values : dutyWeekdays.slice(0, 5);
  }, [tasks]);
  const uniqueTasks = useMemo(() => {
    const seen = new Set<string>();
    return tasks.filter((task) => {
      const key = dutyTaskKey(task.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tasks]);
  const taskAliasIds = useMemo(() => {
    const groups = new Map<string, string[]>();
    tasks.forEach((task) => {
      const key = dutyTaskKey(task.name);
      groups.set(key, [...(groups.get(key) || []), task.id]);
    });
    return new Map(uniqueTasks.map((task) => [task.id, groups.get(dutyTaskKey(task.name)) || [task.id]]));
  }, [tasks, uniqueTasks]);
  const selectedDayAssignments = useMemo(
    () => roomAssignments.filter((assignment) => assignment.duty_date === selectedDutyDate),
    [roomAssignments, selectedDutyDate],
  );
  const pointsByStudent = useMemo(() => {
    const totals = new Map<string, number>();
    behaviorPoints.forEach((item) =>
      totals.set(
        item.student_id,
        (totals.get(item.student_id) || 0) + item.points,
      ),
    );
    return totals;
  }, [behaviorPoints]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !session.workspace) return;
      setBusy(true);
      const workspaceId = session.workspace.id;
      const results = await Promise.all([
        supabase
          .from("classrooms")
          .select("id,name,academic_year,status")
          .eq("workspace_id", workspaceId)
          .order("name"),
        supabase
          .from("students")
          .select("id,classroom_id,student_code,first_name,last_name")
          .eq("workspace_id", workspaceId)
          .eq("status", "active")
          .order("student_code"),
        supabase
          .from("duty_tasks")
          .select("id,name,location,instructions,checklist,active_weekdays,slots_per_day,positive_points,missed_points,rotation_strategy,allow_substitute,evidence_required,is_active,sort_order")
          .eq("workspace_id", workspaceId)
          .order("sort_order"),
        supabase
          .from("duty_assignments")
          .select(
            "id,duty_task_id,duty_date,student_id,substitute_student_id,status",
          )
          .eq("workspace_id", workspaceId)
          .gte("duty_date", addDays(weekStart, -35))
          .order("duty_date"),
        supabase
          .from("data_period_locks")
          .select("id,classroom_id,period_month,module_key,status,reason")
          .eq("workspace_id", workspaceId)
          .order("period_month", { ascending: false }),
        supabase
          .from("data_unlock_requests")
          .select("id,lock_id,reason,status")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("academic_year_closures")
          .select(
            "id,source_classroom_id,target_classroom_id,source_academic_year,target_academic_year,status,summary,undo_deadline",
          )
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("academic_year_snapshots")
          .select("id,academic_year,classroom_name,record_counts,created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("student_year_transitions")
          .select("id,closure_id,student_id,transition_type")
          .eq("workspace_id", workspaceId),
        supabase
          .from("portal_invitations")
          .select("id,student_id,invite_email,status,expires_at")
          .eq("workspace_id", workspaceId)
          .eq("portal_role", "parent")
          .order("created_at", { ascending: false }),
        supabase
          .from("behavior_records")
          .select("student_id,points")
          .eq("workspace_id", workspaceId)
          .eq("category", "งานเวรประจำชั้น"),
      ]);
      if (!active) return;
      const firstError = results.find((result) => result.error)?.error;
      if (firstError && !firstError.message.includes("duty_tasks"))
        setNotice(firstError.message);
      const roomRows = (results[0].data || []) as Classroom[];
      setClassrooms(roomRows);
      setStudents((results[1].data || []) as Student[]);
      setTasks((results[2].data || []) as DutyTask[]);
      setAssignments((results[3].data || []) as DutyAssignment[]);
      setLocks((results[4].data || []) as PeriodLock[]);
      setUnlockRequests((results[5].data || []) as UnlockRequest[]);
      setClosures((results[6].data || []) as YearClosure[]);
      setSnapshots((results[7].data || []) as YearSnapshot[]);
      setTransitions((results[8].data || []) as YearTransition[]);
      setInvitations((results[9].data || []) as PortalInvite[]);
      setBehaviorPoints((results[10].data || []) as BehaviorPoint[]);
      const initialRoom =
        classroomId ||
        roomRows.find((room) => room.status === "active")?.id ||
        roomRows[0]?.id ||
        "";
      setClassroomId(initialRoom);
      setRolloverForm((current) => ({
        ...current,
        targetClassroomId:
          current.targetClassroomId ||
          roomRows.find(
            (room) => room.id !== initialRoom && room.status === "active",
          )?.id ||
          "",
      }));
      setBusy(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [classroomId, session.workspace, weekStart]);

  useEffect(() => {
    setTab(
      mode === "locks"
        ? "locks"
        : mode === "year"
          ? "rollover"
          : mode === "parent"
            ? "parent-qr"
            : "duty",
    );
  }, [mode]);

  useEffect(() => setSelectedDutyDate(weekStart), [weekStart]);

  async function refreshOperations() {
    setWeekStart((current) => `${current}`);
    window.location.reload();
  }

  async function generateDuty() {
    if (!supabase || !session.workspace || !classroomId) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc("generate_balanced_duty_week", {
      target_classroom_id: classroomId,
      target_week_start: weekStart,
      target_workspace_id: session.workspace.id,
    });
    if (error) setNotice(error.message);
    else {
      setNotice("จัดเวรอย่างสมดุลและเผยแพร่ตารางประจำสัปดาห์แล้ว");
      await writeAuditLog(session, {
        action: "duty.week_generated",
        entityId: classroomId,
        entityTable: "duty_weeks",
        metadata: { classroomId, weekStart },
        riskLevel: "normal",
        source: "classroom_operations",
      });
      setTimeout(() => window.location.reload(), 500);
    }
    setBusy(false);
  }

  async function assignDutyManually(task: DutyTask, dutyDate: string) {
    if (!supabase || !session.workspace || !classroomId) return;
    const query = window.prompt("กรอกรหัสนักเรียนหรือชื่อที่ต้องการมอบหมาย")?.trim();
    if (!query) return;
    const student = roomStudents.find(
      (item) => item.id === query || item.student_code === query || fullName(item).includes(query),
    );
    if (!student) {
      setNotice("ไม่พบนักเรียนในห้องนี้");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("set_manual_duty_assignment", {
      target_classroom_id: classroomId,
      target_date: dutyDate,
      target_student_id: student.id,
      target_task_id: task.id,
      target_workspace_id: session.workspace.id,
    });
    setNotice(error ? error.message : `มอบหมาย ${fullName(student)} ทำหน้าที่ ${task.name} แล้ว`);
    if (!error) setTimeout(() => window.location.reload(), 350);
    setBusy(false);
  }

  function editTask(task?: DutyTask) {
    setDesignerOpen(true);
    setEditingTaskId(task?.id || null);
    setTaskForm(task ? {
      activeWeekdays: task.active_weekdays,
      allowSubstitute: task.allow_substitute,
      checklist: task.checklist.join("\n"),
      evidenceRequired: task.evidence_required,
      instructions: task.instructions || "",
      isActive: task.is_active,
      location: task.location || "",
      missedPoints: task.missed_points,
      name: task.name,
      positivePoints: task.positive_points,
      rotationStrategy: task.rotation_strategy,
      slotsPerDay: task.slots_per_day,
    } : {
      activeWeekdays: [1, 2, 3, 4, 5], allowSubstitute: true, checklist: "", evidenceRequired: false,
      instructions: "", isActive: true, location: "", missedPoints: -1, name: "", positivePoints: 1,
      rotationStrategy: "balanced", slotsPerDay: 1,
    });
  }

  async function saveDutyTask(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !session.workspace || !classroomId || !taskForm.name.trim() || !taskForm.activeWeekdays.length) return;
    setBusy(true);
    const payload = {
      active_weekdays: taskForm.activeWeekdays,
      allow_substitute: taskForm.allowSubstitute,
      checklist: taskForm.checklist.split("\n").map((item) => item.trim()).filter(Boolean),
      classroom_id: classroomId,
      evidence_required: taskForm.evidenceRequired,
      instructions: taskForm.instructions.trim() || null,
      is_active: taskForm.isActive,
      location: taskForm.location.trim() || null,
      missed_points: Math.min(0, taskForm.missedPoints),
      name: taskForm.name.trim(),
      positive_points: Math.max(0, taskForm.positivePoints),
      rotation_strategy: taskForm.rotationStrategy,
      slots_per_day: Math.max(1, Math.min(10, taskForm.slotsPerDay)),
      workspace_id: session.workspace.id,
    };
    const result = editingTaskId
      ? await supabase.from("duty_tasks").update(payload).eq("id", editingTaskId).eq("workspace_id", session.workspace.id)
      : await supabase.from("duty_tasks").insert({ ...payload, created_by: session.profile.id, sort_order: tasks.length * 10 + 10 });
    if (result.error) setNotice(result.error.message);
    else { setNotice(editingTaskId ? "แก้ไขหน้าที่เวรแล้ว" : "เพิ่มหน้าที่เวรแล้ว"); setTimeout(() => window.location.reload(), 400); }
    setBusy(false);
  }

  async function toggleDutyTask(task: DutyTask) {
    if (!supabase || !session.workspace) return;
    const { error } = await supabase.from("duty_tasks").update({ is_active: !task.is_active }).eq("id", task.id).eq("workspace_id", session.workspace.id);
    if (error) setNotice(error.message);
    else setTasks((current) => current.map((item) => item.id === task.id ? { ...item, is_active: !item.is_active } : item));
  }

  async function deleteDutyTask(task: DutyTask, taskIds: string[]) {
    if (!supabase || !session.workspace) return false;
    setBusy(true);
    setNotice(null);
    const relatedAssignmentCount = assignments.filter((item) => taskIds.includes(item.duty_task_id)).length;
    const { error } = await supabase
      .from("duty_tasks")
      .delete()
      .eq("workspace_id", session.workspace.id)
      .in("id", taskIds);

    if (error) {
      setNotice(`ลบหน้าที่เวรไม่สำเร็จ: ${error.message}`);
      setBusy(false);
      return false;
    }

    setTasks((current) => current.filter((item) => !taskIds.includes(item.id)));
    setAssignments((current) => current.filter((item) => !taskIds.includes(item.duty_task_id)));
    if (editingTaskId && taskIds.includes(editingTaskId)) editTask();
    setNotice(`ลบหน้าที่ “${task.name}” และรายการมอบหมายที่เกี่ยวข้อง ${relatedAssignmentCount} รายการแล้ว`);
    await writeAuditLog(session, {
      action: "duty.task_deleted",
      entityId: task.id,
      entityTable: "duty_tasks",
      metadata: { assignmentCount: relatedAssignmentCount, name: task.name, taskIds },
      riskLevel: "high",
      source: "classroom_operations",
    });
    setBusy(false);
    return true;
  }

  async function recordDuty(assignment: DutyAssignment, status: DutyStatus) {
    if (!supabase) return;
    setBusy(true);
    const task = tasks.find((item) => item.id === assignment.duty_task_id);
    if (status === "substituted" && task && !task.allow_substitute) {
      setNotice("หน้าที่นี้ไม่อนุญาตให้ใช้คนแทน");
      setBusy(false);
      return;
    }
    const substituteQuery =
      status === "substituted"
        ? window.prompt("กรอกรหัสนักเรียนหรือชื่อผู้ทำเวรแทน")?.trim()
        : null;
    const substitute = substituteQuery
      ? roomStudents.find(
          (student) =>
            student.id === substituteQuery ||
            student.student_code === substituteQuery ||
            fullName(student).includes(substituteQuery),
        )
      : null;
    if (status === "substituted" && !substitute) {
      setNotice("ไม่พบนักเรียนผู้ทำเวรแทนในห้องนี้");
      setBusy(false);
      return;
    }
    const checklistResult = status === "completed" && task?.checklist.length
      ? task.checklist.map((label) => ({ checked: window.confirm(`ยืนยัน: ${label}`), label }))
      : [];
    if (checklistResult.some((item) => !item.checked)) {
      setNotice("เช็กลิสต์ยังไม่ครบ จึงยังไม่บันทึกว่าทำเวรเสร็จ");
      setBusy(false);
      return;
    }
    const evidence = status === "completed" && task?.evidence_required
      ? window.prompt("หน้าที่นี้ต้องมีหลักฐาน กรุณาวางลิงก์รูปภาพหรือไฟล์")?.trim()
      : null;
    if (status === "completed" && task?.evidence_required && !evidence) {
      setNotice("ยังไม่มีหลักฐาน จึงยังไม่บันทึกว่าทำเวรเสร็จ");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc("record_duty_result_v2", {
      next_status: status,
      result_note: null,
      target_checklist_result: checklistResult,
      target_evidence_paths: evidence ? [evidence] : [],
      target_assignment_id: assignment.id,
      target_substitute_student_id: substitute?.id || null,
    });
    if (error) setNotice(error.message);
    else {
      const points =
        (data as { behavior_points?: number } | null)?.behavior_points || 0;
      setAssignments((current) =>
        current.map((item) =>
          item.id === assignment.id ? { ...item, status } : item,
        ),
      );
      setNotice(
        `บันทึกผลเวรแล้ว และส่ง ${points >= 0 ? "+" : ""}${points} คะแนนไปยังพฤติกรรม/จิตพิสัย`,
      );
    }
    setBusy(false);
  }

  async function lockPeriod(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !session.workspace || !classroomId) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_period_lock", {
      lock_reason: lockForm.reason,
      target_classroom_id: classroomId,
      target_module: lockForm.module,
      target_month: `${lockForm.month}-01`,
      target_workspace_id: session.workspace.id,
    });
    setNotice(
      error
        ? error.message
        : `ล็อก${moduleLabels[lockForm.module]} เดือน ${lockForm.month} แล้ว`,
    );
    if (!error) setTimeout(() => window.location.reload(), 400);
    setBusy(false);
  }

  async function requestUnlock(lock: PeriodLock) {
    if (!supabase) return;
    const reason = window.prompt("ระบุเหตุผลที่ต้องการปลดล็อก");
    if (!reason) return;
    const { error } = await supabase.rpc("request_period_unlock", {
      request_reason: reason,
      target_lock_id: lock.id,
    });
    setNotice(
      error ? error.message : "ส่งคำขอปลดล็อกให้เจ้าของ Workspace แล้ว",
    );
  }

  async function reviewUnlock(request: UnlockRequest, approve: boolean) {
    if (!supabase) return;
    const { error } = await supabase.rpc("review_period_unlock", {
      approve,
      review_note: approve ? "อนุมัติจากศูนย์งานประจำชั้น" : "ไม่อนุมัติ",
      target_request_id: request.id,
    });
    setNotice(
      error
        ? error.message
        : approve
          ? "อนุมัติและปลดล็อกแล้ว"
          : "ปฏิเสธคำขอแล้ว",
    );
    if (!error) setTimeout(() => window.location.reload(), 400);
  }

  async function prepareClosure(event: FormEvent) {
    event.preventDefault();
    if (
      !supabase ||
      !session.workspace ||
      !classroomId ||
      !rolloverForm.targetClassroomId
    )
      return;
    setBusy(true);
    const { error } = await supabase.rpc("prepare_year_closure", {
      closure_note: rolloverForm.note || null,
      source_classroom: classroomId,
      target_classroom: rolloverForm.targetClassroomId,
      target_workspace_id: session.workspace.id,
      target_year: rolloverForm.targetYear,
    });
    setNotice(
      error ? error.message : "สร้าง Preview และส่งคำขออนุมัติการปิดชั้นแล้ว",
    );
    if (!error) setTimeout(() => window.location.reload(), 500);
    setBusy(false);
  }

  async function closureAction(
    closure: YearClosure,
    action: "approve" | "execute" | "undo",
  ) {
    if (!supabase) return;
    if (
      action === "execute" &&
      !window.confirm(
        "ยืนยัน Execute การปิดชั้น? ระบบจะสร้าง Snapshot ก่อนย้ายนักเรียน",
      )
    )
      return;
    if (
      action === "undo" &&
      !window.confirm("ยืนยัน Undo และย้ายนักเรียนกลับห้องเดิม?")
    )
      return;
    setBusy(true);
    const response =
      action === "approve"
        ? await supabase.rpc("approve_year_closure", {
            target_closure_id: closure.id,
          })
        : action === "execute"
          ? await supabase.rpc("execute_year_closure", {
              target_closure_id: closure.id,
            })
          : await supabase.rpc("undo_year_closure", {
              target_closure_id: closure.id,
              undo_reason: "เจ้าของ Workspace สั่งย้อนกลับ",
            });
    setNotice(
      response.error
        ? response.error.message
        : action === "approve"
          ? "อนุมัติแล้ว พร้อม Execute"
          : action === "execute"
            ? "ปิดชั้นและสร้าง Snapshot สำเร็จ"
            : "Undo สำเร็จ นักเรียนกลับสู่ห้องเดิมแล้ว",
    );
    if (!response.error) setTimeout(() => window.location.reload(), 600);
    setBusy(false);
  }

  async function updateTransition(transition: YearTransition, nextType: YearTransition["transition_type"]) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_year_transition", {
      next_classroom_id: null,
      next_type: nextType,
      target_transition_id: transition.id,
      transition_note: null,
    });
    if (error) setNotice(error.message);
    else {
      setTransitions((current) => current.map((item) => item.id === transition.id ? { ...item, transition_type: nextType } : item));
      setNotice("ปรับผลการปิดชั้นของนักเรียนแล้ว");
    }
    setBusy(false);
  }

  async function createParentInvite(event: FormEvent) {
    event.preventDefault();
    if (
      !supabase ||
      !session.workspace ||
      !inviteForm.studentId ||
      !inviteForm.email
    )
      return;
    setBusy(true);
    const expiresAt = new Date(
      Date.now() + Number(inviteForm.days) * 86400000,
    ).toISOString();
    const { data, error } = await supabase
      .from("portal_invitations")
      .insert({
        expires_at: expiresAt,
        invite_email: inviteForm.email.trim().toLowerCase(),
        invited_by: session.profile.id,
        portal_role: "parent",
        relation: "ผู้ปกครอง",
        status: "invited",
        student_id: inviteForm.studentId,
        workspace_id: session.workspace.id,
      })
      .select("id")
      .single();
    if (error) setNotice(error.message);
    else if (data) {
      const claimUrl = `${window.location.origin}/portal/invitations?invitation=${data.id}`;
      setQrDataUrl(await QRCode.toDataURL(claimUrl, { margin: 2, width: 320 }));
      setNotice(
        "สร้างคำเชิญและ QR แบบหมดอายุได้แล้ว ผู้ปกครองต้องเข้าสู่ระบบด้วยอีเมลที่ระบุ",
      );
    }
    setBusy(false);
  }

  async function revokeInvite(invite: PortalInvite) {
    if (
      !supabase ||
      !session.workspace ||
      !window.confirm("เพิกถอน QR และคำเชิญนี้?")
    )
      return;
    const { error } = await supabase
      .from("portal_invitations")
      .update({ status: "revoked" })
      .eq("workspace_id", session.workspace.id)
      .eq("id", invite.id);
    setNotice(
      error ? error.message : "เพิกถอนคำเชิญแล้ว QR เดิมไม่สามารถรับสิทธิ์ได้",
    );
    if (!error)
      setInvitations((current) =>
        current.map((item) =>
          item.id === invite.id ? { ...item, status: "revoked" } : item,
        ),
      );
  }

  const activeLocks = locks.filter((item) => item.status === "locked").length;
  const pendingRequests = unlockRequests.filter(
    (item) => item.status === "pending",
  ).length;
  const expiringInvites = invitations.filter(
    (item) =>
      item.status === "invited" &&
      item.expires_at &&
      new Date(item.expires_at).getTime() < Date.now() + 7 * 86400000,
  ).length;
  const modeTab: TabKey = mode === "locks"
    ? "locks"
    : mode === "parent"
      ? "parent-qr"
      : mode === "year"
        ? "rollover"
        : "duty";
  const visibleTabs = mode === "year"
    ? tabs.filter((item) => item.key === "rollover" || item.key === "archive")
    : tabs.filter((item) => item.key === modeTab);
  const pageTitle = mode === "duty"
    ? "ตารางเวรและจิตพิสัย"
    : mode === "locks"
      ? "ควบคุมงวดข้อมูล"
      : mode === "year"
        ? "ปิดชั้นและคลังปีการศึกษา"
        : "Portal และ QR ผู้ปกครอง";
  const pageDescription = mode === "duty"
    ? "ออกแบบหน้าที่รายวัน จัดเวรอย่างสมดุล ตรวจผล คนแทน และเชื่อมคะแนนจิตพิสัย"
    : mode === "locks"
      ? "ล็อกเวลาเรียน คะแนน และเงินออมหลังตรวจ พร้อมขั้นตอนขอและอนุมัติปลดล็อก"
      : mode === "year"
        ? "Preview → Approve → Execute → Undo พร้อม Snapshot สำหรับค้นย้อนหลัง"
        : "สร้างคำเชิญผู้ปกครองแบบหมดอายุได้ เพิกถอนได้ และไม่ใช้เลขบัตรประชาชน";

  return (
    <main className="app-page">
      <header className="border-b border-slate-200/70 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              {pageDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="nexus-field h-11 min-w-48 px-3"
              onChange={(event) => setClassroomId(event.target.value)}
              value={classroomId}
            >
              {classrooms
                .filter((room) => room.status === "active")
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.academic_year || "-"})
                  </option>
                ))}
            </select>
            <button
              className="dark-action inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black"
              onClick={() => void refreshOperations()}
              type="button"
            >
              <RefreshCw size={16} />
              รีเฟรช
            </button>
          </div>
        </div>
      </header>

      {mode !== "duty" ? <section className="mt-4 rounded-2xl border border-slate-200 bg-white/75 p-2">
        {mode === "locks" ? <StatusRail
          icon={LockKeyhole}
          label={`ล็อกอยู่ ${activeLocks} งวด · รออนุมัติ ${pendingRequests}`}
          tone="amber"
        /> : null}
        {mode === "year" ? <StatusRail
          icon={Archive}
          label={`Snapshot พร้อมค้น ${snapshots.length} ชุด`}
          tone="cyan"
        /> : null}
        {mode === "parent" ? <StatusRail
          icon={QrCode}
          label={`คำเชิญใกล้หมดอายุ ${expiringInvites} รายการ`}
          tone="rose"
        /> : null}
      </section> : null}

      {visibleTabs.length > 1 ? <nav className="mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white/80 sm:grid-cols-2">
        {visibleTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`flex h-14 items-center justify-center gap-2 border-b-2 px-3 text-sm font-black transition ${tab === item.key ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav> : null}

      {notice ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">
          {notice}
        </div>
      ) : null}

      {tab === "duty" ? (
        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                สัปดาห์
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setWeekStart(event.target.value)}
                  type="date"
                  value={weekStart}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-black text-cyan-800 hover:bg-cyan-100"
                  onClick={() => editTask()}
                  type="button"
                >
                  <Plus size={17} />
                  เพิ่มหน้าที่เวร
                </button>
                <button
                  className="dark-action inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black"
                  onClick={() => window.print()}
                  type="button"
                >
                  <Printer size={17} />
                  พิมพ์รายงาน
                </button>
                <button
                  className="blue-action inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black disabled:opacity-50"
                  disabled={busy || !classroomId}
                  onClick={() => void generateDuty()}
                  type="button"
                >
                  <Scale size={17} />
                  จัดเวรอย่างสมดุล
                </button>
              </div>
            </div>
            <DutySummary
              assignments={roomAssignments}
              studentCount={roomStudents.length}
            />
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="p-3">งาน / วัน</th>
                    {displayedDutyDays.map((day) => {
                      const date = addDays(weekStart, day.value - 1);
                      return <th className={`p-1.5 ${selectedDutyDate === date ? "bg-cyan-950" : ""}`} key={day.value}>
                        <button className="w-full rounded-xl px-2 py-2 text-left transition hover:bg-white/10" onClick={() => setSelectedDutyDate(date)} type="button">
                        {new Intl.DateTimeFormat("th-TH", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        }).format(
                          new Date(`${date}T12:00:00`),
                        )}
                        </button>
                      </th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {uniqueTasks.filter((task) => task.is_active).map((task) => (
                    <tr className="border-t border-slate-200" key={task.id}>
                      <th className="bg-slate-50 p-3 font-black text-slate-900">
                        <span className="block">{task.name}</span>
                        {task.location ? <span className="mt-1 block text-xs font-bold text-slate-400">{task.location}</span> : null}
                      </th>
                      {displayedDutyDays.map((day) => {
                        const date = addDays(weekStart, day.value - 1);
                        const list = roomAssignments.filter(
                          (item) =>
                            (taskAliasIds.get(task.id) || [task.id]).includes(item.duty_task_id) &&
                            item.duty_date === date,
                        );
                        return (
                          <td className={`p-2 align-top ${selectedDutyDate === date ? "bg-cyan-50/50" : ""}`} key={date}>
                            {list.length ? (
                              <>{list.map((assignment) => (
                                <div
                                  className={`mb-1.5 flex items-center gap-2 rounded-xl border px-2.5 py-2 ${dutyStatusStyle(assignment.status)}`}
                                  key={assignment.id}
                                >
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-70" />
                                  <p className="min-w-0 truncate text-xs font-black">
                                    {fullName(
                                      studentMap.get(assignment.student_id),
                                    )}
                                  </p>
                                </div>
                              ))}
                              {list.length < task.slots_per_day ? <button className="w-full rounded-lg border border-dashed border-cyan-300 px-2 py-1.5 text-xs font-black text-cyan-700" disabled={busy} onClick={() => void assignDutyManually(task, date)} type="button">+ เพิ่มคน</button> : null}</>
                            ) : task.active_weekdays.includes(day.value) ? (
                              <button className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-black text-slate-500 hover:border-cyan-300 hover:text-cyan-700" disabled={busy} onClick={() => void assignDutyManually(task, date)} type="button">+ มอบหมายเอง</button>
                            ) : (
                              <span className="text-slate-300">ไม่มีเวรวันนี้</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="grid content-start gap-4">
            <div className="nexus-card p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">ตรวจผลรายวัน</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${selectedDutyDate}T12:00:00`))}
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
                <Metric label="ทั้งหมด" value={`${selectedDayAssignments.length}`} />
                <Metric label="ตรวจแล้ว" value={`${selectedDayAssignments.filter((item) => item.status !== "assigned").length}`} />
                <Metric label="รอตรวจ" value={`${selectedDayAssignments.filter((item) => item.status === "assigned").length}`} />
              </div>
              <div className="mt-4 grid max-h-[560px] gap-2 overflow-y-auto pr-1">
                {selectedDayAssignments.length ? selectedDayAssignments.map((assignment) => {
                  const task = tasks.find((item) => item.id === assignment.duty_task_id);
                  return <div className="rounded-2xl border border-slate-200 bg-white p-3" key={assignment.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{task?.name || "หน้าที่เวร"}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">{fullName(studentMap.get(assignment.student_id))}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${dutyStatusStyle(assignment.status)}`}>{dutyStatusLabel(assignment.status)}</span>
                    </div>
                    <select className="nexus-field mt-3 h-9 w-full px-2 text-xs font-black" disabled={busy} onChange={(event) => void recordDuty(assignment, event.target.value as DutyStatus)} value={assignment.status}>
                      <option value="assigned">รอตรวจ</option>
                      <option value="completed">ทำแล้ว</option>
                      <option value="missed">ไม่ทำเวร</option>
                      <option value="excused">ลาเวร</option>
                      <option value="substituted">มีคนแทน</option>
                    </select>
                  </div>;
                }) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">วันนี้ยังไม่มีการมอบหมายเวร</div>}
              </div>
            </div>
            <details className="nexus-card group p-5">
              <summary className="cursor-pointer list-none text-lg font-black text-slate-950">สรุปคะแนนจิตพิสัยรายคน <span className="ml-2 text-xs text-cyan-700">เปิดดู</span></summary>
              <p className="mt-2 text-xs font-bold text-slate-500">คะแนนฐาน 80 + ผลพฤติกรรมและผลเวรที่บันทึกแล้ว</p>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                {roomStudents.slice(0, 8).map((student) => {
                  const point = pointsByStudent.get(student.id) || 0;
                  const score = Math.max(0, Math.min(100, 80 + point));
                  return (
                    <div
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      key={student.id}
                    >
                      <span className="text-sm font-bold text-slate-700">
                        {fullName(student)}
                      </span>
                      <span className="font-black text-cyan-700">
                        {score}/100
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          </aside>
          {designerOpen ? <DutyTaskSettings
            busy={busy}
            editingTaskId={editingTaskId}
            form={taskForm}
            onCancel={() => setEditingTaskId(null)}
            onClose={() => setDesignerOpen(false)}
            onEdit={editTask}
            onForm={setTaskForm}
            onDelete={(task) => deleteDutyTask(task, taskAliasIds.get(task.id) || [task.id])}
            getDeleteImpact={(task) => assignments.filter((item) => (taskAliasIds.get(task.id) || [task.id]).includes(item.duty_task_id)).length}
            onSave={saveDutyTask}
            onToggle={toggleDutyTask}
            tasks={uniqueTasks}
          /> : null}
        </section>
      ) : null}

      {tab === "locks" ? (
        <LocksPanel
          busy={busy}
          form={lockForm}
          locks={locks.filter(
            (item) => !item.classroom_id || item.classroom_id === classroomId,
          )}
          onForm={setLockForm}
          onLock={lockPeriod}
          onRequest={requestUnlock}
          onReview={reviewUnlock}
          owner={
            session.profile.role === "teacher_owner" ||
            session.profile.role === "superadmin"
          }
          requests={unlockRequests}
        />
      ) : null}
      {tab === "rollover" ? (
        <RolloverPanel
          busy={busy}
          classroomId={classroomId}
          classrooms={classrooms}
          closures={closures}
          form={rolloverForm}
          onAction={closureAction}
          onForm={setRolloverForm}
          onPrepare={prepareClosure}
          studentCount={roomStudents.length}
          students={students}
          transitions={transitions}
          onTransition={updateTransition}
        />
      ) : null}
      {tab === "archive" ? (
        <ArchivePanel
          onExport={(snapshot) =>
            downloadJson(
              `classcare-archive-${snapshot.academic_year}-${snapshot.id}.json`,
              snapshot,
            )
          }
          snapshots={snapshots}
        />
      ) : null}
      {tab === "parent-qr" ? (
        <ParentQrPanel
          busy={busy}
          form={inviteForm}
          invitations={invitations}
          onCreate={createParentInvite}
          onForm={setInviteForm}
          onRevoke={revokeInvite}
          qrDataUrl={qrDataUrl}
          students={roomStudents}
        />
      ) : null}
    </main>
  );
}

function addDays(value: string, count: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}
function StatusRail({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof LockKeyhole;
  label: string;
  tone: "amber" | "cyan" | "rose";
}) {
  const color = {
    amber: "text-amber-700 bg-amber-50",
    cyan: "text-cyan-700 bg-cyan-50",
    rose: "text-rose-700 bg-rose-50",
  }[tone];
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-black ${color}`}
    >
      <Icon size={18} />
      {label}
    </div>
  );
}
function dutyStatusStyle(status: DutyStatus) {
  return status === "completed" || status === "substituted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "missed"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : status === "excused"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
}
function dutyStatusLabel(status: DutyStatus) {
  return { assigned: "รอตรวจ", completed: "ทำแล้ว", excused: "ลาเวร", missed: "ไม่ทำเวร", substituted: "มีคนแทน" }[status];
}
function DutySummary({
  assignments,
  studentCount,
}: {
  assignments: DutyAssignment[];
  studentCount: number;
}) {
  const counts = assignments.reduce(
    (map, item) => (
      (map[item.student_id] = (map[item.student_id] || 0) + 1),
      map
    ),
    {} as Record<string, number>,
  );
  const values = Object.values(counts);
  const gap = values.length ? Math.max(...values) - Math.min(...values) : 0;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-4">
      <Metric label="นักเรียน" value={`${studentCount} คน`} />
      <Metric label="มอบหมายทั้งหมด" value={`${assignments.length} งาน`} />
      <Metric label="ความต่างสูงสุด" value={`${gap} ครั้ง`} />
      <Metric label="ความสมดุล" value={gap <= 1 ? "สมดุลดี" : "ควรจัดใหม่"} />
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/40">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

type DutyTaskForm = {
  activeWeekdays: number[];
  allowSubstitute: boolean;
  checklist: string;
  evidenceRequired: boolean;
  instructions: string;
  isActive: boolean;
  location: string;
  missedPoints: number;
  name: string;
  positivePoints: number;
  rotationStrategy: DutyTask["rotation_strategy"];
  slotsPerDay: number;
};

function DutyTaskSettings({
  busy,
  editingTaskId,
  form,
  onCancel,
  onClose,
  onEdit,
  onForm,
  onDelete,
  getDeleteImpact,
  onSave,
  onToggle,
  tasks,
}: {
  busy: boolean;
  editingTaskId: string | null;
  form: DutyTaskForm;
  onCancel: () => void;
  onClose: () => void;
  onEdit: (task?: DutyTask) => void;
  onForm: (value: DutyTaskForm) => void;
  onDelete: (task: DutyTask) => Promise<boolean>;
  getDeleteImpact: (task: DutyTask) => number;
  onSave: (event: FormEvent) => void;
  onToggle: (task: DutyTask) => void;
  tasks: DutyTask[];
}) {
  const [deleteCandidate, setDeleteCandidate] = useState<DutyTask | null>(null);
  const selectedTask = editingTaskId
    ? tasks.find((task) => task.id === editingTaskId)
    : null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5" role="presentation">
    <section aria-label="ออกแบบหน้าที่เวร" className="h-full w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/70 bg-white p-5 shadow-2xl sm:p-6" role="dialog">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Duty Designer</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">ออกแบบหน้าที่เวรของโรงเรียน</h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
            แต่ละหน้าที่กำหนดวัน จำนวนคน จุดปฏิบัติงาน วิธีหมุนเวียน เช็กลิสต์ และคะแนนได้อิสระ จึงรองรับทั้งโรงเรียนที่มีเวรเฉพาะวันเรียนและโรงเรียนที่มีเวรวันหยุด
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white" onClick={() => onEdit()} type="button"><Plus size={17} /> เพิ่มหน้าที่</button>
          <button aria-label="ปิด" className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={onClose} type="button"><X size={18} /></button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <div className="grid max-h-[calc(100vh-220px)] content-start gap-2 overflow-y-auto pr-1">
          {tasks.length ? tasks.map((task) => (
            <article className={`rounded-2xl border p-4 ${task.is_active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`} key={task.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">{task.name}</h3>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${task.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {task.is_active ? "ใช้งาน" : "พักใช้งาน"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {task.location || "ไม่ระบุจุด"} · {task.slots_per_day} คน/วัน · {task.rotation_strategy === "balanced" ? "จัดสมดุล" : task.rotation_strategy === "random" ? "สุ่ม" : task.rotation_strategy === "fixed" ? "ชุดเดิม" : "จัดเอง"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dutyWeekdays.map((day) => (
                      <span className={`rounded-lg px-2 py-1 text-[11px] font-black ${task.active_weekdays.includes(day.value) ? "bg-cyan-50 text-cyan-800" : "bg-slate-50 text-slate-300"}`} key={day.value}>
                        {day.short}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => onEdit(task)} title="แก้ไข" type="button"><Pencil size={16} /></button>
                  <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50" onClick={() => void onToggle(task)} type="button">
                    {task.is_active ? "พัก" : "เปิด"}
                  </button>
                  <button
                    aria-label={`ลบหน้าที่ ${task.name}`}
                    className="rounded-xl border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy}
                    onClick={() => setDeleteCandidate(task)}
                    title="ลบหน้าที่เวร"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">ยังไม่มีหน้าที่เวร กดเพิ่มหน้าที่เพื่อเริ่มออกแบบ</div>
          )}
        </div>

        <form className="rounded-3xl border border-cyan-100 bg-cyan-50/40 p-4" onSubmit={onSave}>
          <h3 className="text-lg font-black text-slate-950">{selectedTask ? `แก้ไข ${selectedTask.name}` : "เพิ่มหน้าที่เวร"}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-black text-slate-600">ชื่อหน้าที่
              <input className="nexus-field h-11 px-3" onChange={(event) => onForm({ ...form, name: event.target.value })} required value={form.name} />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">จุดปฏิบัติงาน
              <input className="nexus-field h-11 px-3" onChange={(event) => onForm({ ...form, location: event.target.value })} placeholder="เช่น หน้าอาคาร 1" value={form.location} />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">จำนวนคนต่อวัน
              <input className="nexus-field h-11 px-3" max={10} min={1} onChange={(event) => onForm({ ...form, slotsPerDay: Number(event.target.value) })} type="number" value={form.slotsPerDay} />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">วิธีจัดเวร
              <select className="nexus-field h-11 px-3" onChange={(event) => onForm({ ...form, rotationStrategy: event.target.value as DutyTask["rotation_strategy"] })} value={form.rotationStrategy}>
                <option value="balanced">สมดุลจำนวนครั้ง</option>
                <option value="random">สุ่มรายสัปดาห์</option>
                <option value="fixed">ชุดเดิมต่อเนื่อง</option>
                <option value="manual">ครูจัดเอง</option>
              </select>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="text-xs font-black text-slate-600">วันที่มีหน้าที่นี้</legend>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dutyWeekdays.map((day) => {
                const checked = form.activeWeekdays.includes(day.value);
                return <label className={`cursor-pointer rounded-xl border px-2 py-2 text-center text-xs font-black ${checked ? "border-cyan-400 bg-cyan-100 text-cyan-900" : "border-slate-200 bg-white text-slate-500"}`} key={day.value}>
                  <input className="sr-only" checked={checked} onChange={() => onForm({ ...form, activeWeekdays: checked ? form.activeWeekdays.filter((value) => value !== day.value) : [...form.activeWeekdays, day.value].sort() })} type="checkbox" />
                  {day.short}
                </label>;
              })}
            </div>
          </fieldset>
          <label className="mt-4 grid gap-1 text-xs font-black text-slate-600">คำแนะนำการทำเวร
            <textarea className="nexus-field min-h-20 p-3" onChange={(event) => onForm({ ...form, instructions: event.target.value })} placeholder="ขอบเขตงานและข้อควรระวัง" value={form.instructions} />
          </label>
          <label className="mt-3 grid gap-1 text-xs font-black text-slate-600">เช็กลิสต์ตรวจงาน (1 บรรทัดต่อ 1 ข้อ)
            <textarea className="nexus-field min-h-24 p-3" onChange={(event) => onForm({ ...form, checklist: event.target.value })} placeholder={"กวาดพื้นสะอาด\nเก็บอุปกรณ์เข้าที่"} value={form.checklist} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-black text-slate-600">คะแนนเมื่อผ่าน
              <input className="nexus-field h-11 px-3" min={0} onChange={(event) => onForm({ ...form, positivePoints: Number(event.target.value) })} type="number" value={form.positivePoints} />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">คะแนนเมื่อไม่ทำ
              <input className="nexus-field h-11 px-3" max={0} onChange={(event) => onForm({ ...form, missedPoints: Number(event.target.value) })} type="number" value={form.missedPoints} />
            </label>
          </div>
          <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
            <label className="flex items-center gap-2"><input checked={form.allowSubstitute} onChange={(event) => onForm({ ...form, allowSubstitute: event.target.checked })} type="checkbox" /> อนุญาตคนแทน</label>
            <label className="flex items-center gap-2"><input checked={form.evidenceRequired} onChange={(event) => onForm({ ...form, evidenceRequired: event.target.checked })} type="checkbox" /> ต้องแนบหลักฐาน</label>
          </div>
          {!form.activeWeekdays.length ? <p className="mt-3 text-xs font-black text-rose-600">เลือกอย่างน้อย 1 วัน</p> : null}
          <div className="mt-5 flex gap-2">
            <button className="blue-action h-11 flex-1 rounded-2xl px-4 text-sm font-black disabled:opacity-50" disabled={busy || !form.activeWeekdays.length || !form.name.trim()} type="submit">บันทึกหน้าที่เวร</button>
            {selectedTask ? <button className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600" onClick={onCancel} type="button">ยกเลิก</button> : null}
          </div>
        </form>
      </div>
      {deleteCandidate ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-md" role="presentation">
          <section
            aria-describedby="delete-duty-description"
            aria-labelledby="delete-duty-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.35)]"
            role="alertdialog"
          >
            <div className="border-b border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-700"><Trash2 size={20} /></span>
              <h3 className="mt-4 text-xl font-black text-slate-950" id="delete-duty-title">ลบหน้าที่ “{deleteCandidate.name}”?</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600" id="delete-duty-description">
                หน้าที่นี้จะหายจากตัวออกแบบและตารางเวร พร้อมลบรายการมอบหมายที่เกี่ยวข้อง {getDeleteImpact(deleteCandidate)} รายการ การดำเนินการนี้ย้อนกลับไม่ได้
              </p>
            </div>
            <div className="grid gap-2 p-5 sm:grid-cols-2">
              <button
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                disabled={busy}
                onClick={() => setDeleteCandidate(null)}
                type="button"
              >
                เก็บไว้ก่อน
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-black text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                disabled={busy}
                onClick={() => void onDelete(deleteCandidate).then((deleted) => { if (deleted) setDeleteCandidate(null); })}
                type="button"
              >
                <Trash2 size={16} /> {busy ? "กำลังลบ..." : "ยืนยันลบหน้าที่"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
    </div>
  );
}

function LocksPanel({
  busy,
  form,
  locks,
  onForm,
  onLock,
  onRequest,
  onReview,
  owner,
  requests,
}: {
  busy: boolean;
  form: { module: keyof typeof moduleLabels; month: string; reason: string };
  locks: PeriodLock[];
  onForm: (value: typeof form) => void;
  onLock: (event: FormEvent) => void;
  onRequest: (lock: PeriodLock) => void;
  onReview: (request: UnlockRequest, approve: boolean) => void;
  owner: boolean;
  requests: UnlockRequest[];
}) {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form className="nexus-card p-5" onSubmit={onLock}>
        <h2 className="text-xl font-black text-slate-950">
          ล็อกข้อมูลประจำเดือน
        </h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          เมื่อผู้ตรวจยืนยันแล้ว ครูต้องส่งคำขอพร้อมเหตุผลก่อนแก้ย้อนหลัง
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm font-black text-slate-700">
            โมดูล
            <select
              className="nexus-field h-11 px-3"
              onChange={(e) =>
                onForm({
                  ...form,
                  module: e.target.value as keyof typeof moduleLabels,
                })
              }
              value={form.module}
            >
              {Object.entries(moduleLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            เดือน
            <input
              className="nexus-field h-11 px-3"
              onChange={(e) => onForm({ ...form, month: e.target.value })}
              type="month"
              value={form.month}
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            เหตุผล
            <textarea
              className="nexus-field min-h-24 p-3"
              onChange={(e) => onForm({ ...form, reason: e.target.value })}
              value={form.reason}
            />
          </label>
          <button
            className="blue-action h-11 rounded-2xl px-4 text-sm font-black disabled:opacity-50"
            disabled={busy || !owner}
          >
            ล็อกข้อมูล
          </button>
        </div>
      </form>
      <div className="nexus-card p-5">
        <h2 className="text-xl font-black text-slate-950">
          สถานะงวดและคำขอปลดล็อก
        </h2>
        <div className="mt-4 grid gap-3">
          {locks.map((lock) => (
            <article
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              key={lock.id}
            >
              <div>
                <p className="font-black text-slate-950">
                  {moduleLabels[lock.module_key]} ·{" "}
                  {lock.period_month.slice(0, 7)}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {lock.reason}
                </p>
              </div>
              <button
                className="dark-action h-9 rounded-xl px-3 text-xs font-black"
                onClick={() => void onRequest(lock)}
                type="button"
              >
                ขอปลดล็อก
              </button>
            </article>
          ))}
          {requests
            .filter((r) => r.status === "pending")
            .map((request) => (
              <article
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                key={request.id}
              >
                <p className="font-black text-amber-950">
                  คำขอ: {request.reason}
                </p>
                {owner ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-black text-white"
                      onClick={() => void onReview(request, true)}
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white"
                      onClick={() => void onReview(request, false)}
                    >
                      ปฏิเสธ
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          {!locks.length && !requests.length ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
              ยังไม่มีงวดที่ล็อกหรือคำขอปลดล็อก
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RolloverPanel({
  busy,
  classroomId,
  classrooms,
  closures,
  form,
  onAction,
  onForm,
  onPrepare,
  onTransition,
  studentCount,
  students,
  transitions,
}: {
  busy: boolean;
  classroomId: string;
  classrooms: Classroom[];
  closures: YearClosure[];
  form: { targetClassroomId: string; targetYear: string; note: string };
  onAction: (
    closure: YearClosure,
    action: "approve" | "execute" | "undo",
  ) => void;
  onForm: (value: typeof form) => void;
  onPrepare: (event: FormEvent) => void;
  onTransition: (transition: YearTransition, nextType: YearTransition["transition_type"]) => void;
  studentCount: number;
  students: Student[];
  transitions: YearTransition[];
}) {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <form className="nexus-card p-5" onSubmit={onPrepare}>
        <h2 className="text-xl font-black text-slate-950">
          เตรียมปิดชั้นแบบปลอดภัย
        </h2>
        <div className="mt-4 rounded-2xl bg-cyan-50 p-4">
          <p className="text-xs font-black text-cyan-700">PREVIEW</p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {studentCount} คน
          </p>
          <p className="text-sm font-bold text-slate-500">
            จะถูกเตรียมเป็น “เลื่อนชั้น” และยังไม่ย้ายจริงจนกว่า Execute
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ห้องปลายทาง
            <select
              className="nexus-field h-11 px-3"
              onChange={(e) =>
                onForm({ ...form, targetClassroomId: e.target.value })
              }
              value={form.targetClassroomId}
            >
              <option value="">เลือกห้อง</option>
              {classrooms
                .filter((r) => r.id !== classroomId && r.status === "active")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.academic_year})
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ปีการศึกษาใหม่
            <input
              className="nexus-field h-11 px-3"
              onChange={(e) => onForm({ ...form, targetYear: e.target.value })}
              value={form.targetYear}
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            หมายเหตุ
            <textarea
              className="nexus-field min-h-20 p-3"
              onChange={(e) => onForm({ ...form, note: e.target.value })}
              value={form.note}
            />
          </label>
          <button
            className="blue-action h-11 rounded-2xl px-4 text-sm font-black disabled:opacity-50"
            disabled={busy || !form.targetClassroomId}
          >
            สร้าง Preview และส่งอนุมัติ
          </button>
        </div>
      </form>
      <div className="nexus-card p-5">
        <h2 className="text-xl font-black text-slate-950">
          Preview → Approve → Execute → Undo
        </h2>
        <div className="mt-4 grid gap-3">
          {closures.map((closure) => (
            <article
              className="rounded-2xl border border-slate-200 p-4"
              key={closure.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-950">
                    {closure.source_academic_year} →{" "}
                    {closure.target_academic_year}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    นักเรียน {closure.summary?.total_students || 0} คน · สถานะ{" "}
                    {closure.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {closure.status === "pending_approval" ? (
                    <button
                      className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white"
                      onClick={() => void onAction(closure, "approve")}
                    >
                      Approve
                    </button>
                  ) : null}
                  {closure.status === "approved" ? (
                    <button
                      className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-black text-white"
                      onClick={() => void onAction(closure, "execute")}
                    >
                      Execute
                    </button>
                  ) : null}
                  {closure.status === "executed" ? (
                    <button
                      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white"
                      onClick={() => void onAction(closure, "undo")}
                    >
                      <RotateCcw className="mr-1 inline" size={14} />
                      Undo
                    </button>
                  ) : null}
                </div>
              </div>
              {closure.status === "pending_approval" ? (
                <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">ตรวจผลรายคนก่อนอนุมัติ</p>
                  {transitions.filter((item) => item.closure_id === closure.id).map((transition) => {
                    const student = students.find((item) => item.id === transition.student_id);
                    return (
                      <label className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between" key={transition.id}>
                        <span className="text-sm font-black text-slate-900">{student?.student_code} · {fullName(student)}</span>
                        <select
                          className="nexus-field h-9 px-3 text-xs font-black"
                          disabled={busy}
                          onChange={(event) => void onTransition(transition, event.target.value as YearTransition["transition_type"])}
                          value={transition.transition_type}
                        >
                          <option value="promoted">เลื่อนชั้น</option>
                          <option value="retained">ซ้ำชั้น</option>
                          <option value="graduated">จบการศึกษา</option>
                          <option value="transferred">ย้ายสถานศึกษา</option>
                          <option value="inactive">พ้นสภาพ</option>
                        </select>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ))}
          {!closures.length ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
              ยังไม่มีแผนปิดชั้น
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
function ArchivePanel({
  onExport,
  snapshots,
}: {
  onExport: (snapshot: YearSnapshot) => void;
  snapshots: YearSnapshot[];
}) {
  return (
    <section className="nexus-card mt-5 p-5">
      <div className="flex items-center gap-3">
        <Archive className="text-cyan-600" />
        <div>
          <h2 className="text-2xl font-black text-slate-950">
            คลังข้อมูลปีการศึกษา
          </h2>
          <p className="text-sm font-bold text-slate-500">
            Snapshot แบบอ่านอย่างเดียว เก็บสถานะก่อนปิดชั้นและพร้อมส่งออกตรวจสอบ
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {snapshots.map((snapshot) => (
          <article
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={snapshot.id}
          >
            <div>
              <p className="font-black text-slate-950">
                {snapshot.classroom_name} · ปี {snapshot.academic_year}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                นักเรียน {snapshot.record_counts?.students || 0} คน ·{" "}
                {new Intl.DateTimeFormat("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(snapshot.created_at))}
              </p>
            </div>
            <button
              className="dark-action inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black"
              onClick={() => onExport(snapshot)}
            >
              <Download size={15} />
              ส่งออก Snapshot
            </button>
          </article>
        ))}
        {!snapshots.length ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
            Snapshot แรกจะถูกสร้างอัตโนมัติก่อน Execute การปิดชั้น
          </p>
        ) : null}
      </div>
    </section>
  );
}
function ParentQrPanel({
  busy,
  form,
  invitations,
  onCreate,
  onForm,
  onRevoke,
  qrDataUrl,
  students,
}: {
  busy: boolean;
  form: { days: string; email: string; studentId: string };
  invitations: PortalInvite[];
  onCreate: (event: FormEvent) => void;
  onForm: (value: typeof form) => void;
  onRevoke: (invite: PortalInvite) => void;
  qrDataUrl: string | null;
  students: Student[];
}) {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <form className="nexus-card p-5" onSubmit={onCreate}>
        <h2 className="text-xl font-black text-slate-950">
          สร้าง QR คำเชิญผู้ปกครอง
        </h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          QR ไม่บรรจุเลขบัตรประชาชน
          ผู้ปกครองต้องเข้าสู่ระบบด้วยอีเมลที่ตรงกับคำเชิญ
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm font-black text-slate-700">
            นักเรียน
            <select
              className="nexus-field h-11 px-3"
              onChange={(e) => onForm({ ...form, studentId: e.target.value })}
              value={form.studentId}
            >
              <option value="">เลือกนักเรียน</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.student_code} · {fullName(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            อีเมลผู้ปกครอง
            <input
              className="nexus-field h-11 px-3"
              onChange={(e) => onForm({ ...form, email: e.target.value })}
              type="email"
              value={form.email}
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            หมดอายุใน
            <select
              className="nexus-field h-11 px-3"
              onChange={(e) => onForm({ ...form, days: e.target.value })}
              value={form.days}
            >
              <option value="1">1 วัน</option>
              <option value="7">7 วัน</option>
              <option value="14">14 วัน</option>
              <option value="30">30 วัน</option>
            </select>
          </label>
          <button
            className="blue-action h-11 rounded-2xl px-4 text-sm font-black disabled:opacity-50"
            disabled={busy || !form.studentId || !form.email}
          >
            สร้างคำเชิญและ QR
          </button>
        </div>
        {qrDataUrl ? (
          <div className="mt-5 rounded-2xl bg-white p-4 text-center ring-1 ring-slate-200">
            <img
              alt="QR คำเชิญผู้ปกครอง"
              className="mx-auto h-56 w-56"
              src={qrDataUrl}
            />
            <p className="mt-2 text-xs font-black text-teal-700">
              QR พร้อมใช้งานและเพิกถอนได้
            </p>
          </div>
        ) : null}
      </form>
      <div className="nexus-card p-5">
        <h2 className="text-xl font-black text-slate-950">คำเชิญล่าสุด</h2>
        <div className="mt-4 grid gap-3">
          {invitations.map((invite) => (
            <article
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              key={invite.id}
            >
              <div>
                <p className="font-black text-slate-950">
                  {invite.invite_email}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {fullName(students.find((s) => s.id === invite.student_id))} ·{" "}
                  {invite.status} · หมดอายุ{" "}
                  {invite.expires_at
                    ? new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                      }).format(new Date(invite.expires_at))
                    : "ไม่กำหนด"}
                </p>
              </div>
              {invite.status === "invited" ? (
                <button
                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white"
                  onClick={() => void onRevoke(invite)}
                >
                  เพิกถอน
                </button>
              ) : null}
            </article>
          ))}
          {!invitations.length ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
              ยังไม่มีคำเชิญผู้ปกครอง
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
