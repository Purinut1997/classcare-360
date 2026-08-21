import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  ImagePlus,
  MessageSquarePlus,
  Printer,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { ThaiDatePicker } from "../../components/shared/ThaiDatePicker";
import { supabase } from "../../lib/supabaseClient";
import { hasWorkspaceCapability } from "../../lib/roles";
import type { AppSessionContext } from "../../types/core";

type BriefStatus = "draft" | "submitted" | "approved" | "returned" | "shared";
type ReportType = "daily" | "activity" | "meeting" | "training" | "incident";
type Brief = {
  id: string;
  brief_date: string;
  report_type: ReportType;
  title: string;
  summary: string;
  highlights: string;
  follow_ups: string;
  tomorrow_plan: string;
  auto_snapshot: Snapshot;
  status: BriefStatus;
  reviewer_profile_id: string | null;
  updated_at: string;
};
type Log = {
  id: string;
  log_time: string;
  log_type: string;
  body: string;
  created_at: string;
};
type Attachment = {
  id: string;
  file_name: string;
  storage_path: string;
  signedUrl?: string;
};
type Snapshot = {
  events?: string[];
  attendance?: Record<string, number>;
  duty?: Record<string, number>;
  behavior?: number;
  health?: number;
  savings?: { count: number; amount: number };
  tomorrow?: string[];
};
const templates: Record<
  ReportType,
  { label: string; title: string; summary: string; highlights: string }
> = {
  daily: {
    label: "รายงานประจำวัน",
    title: "สรุปการดำเนินงานประจำวัน",
    summary: "การจัดการเรียนการสอนและกิจกรรมประจำวันดำเนินไปตามแผน",
    highlights: "",
  },
  activity: {
    label: "กิจกรรม",
    title: "รายงานผลการจัดกิจกรรม",
    summary: "ดำเนินกิจกรรมตามกำหนดการของโรงเรียน",
    highlights: "ผลการเข้าร่วมและสิ่งที่นักเรียนได้รับ",
  },
  meeting: {
    label: "ประชุม",
    title: "บันทึกการประชุม",
    summary: "ประชุมเพื่อกำหนดแนวทางและติดตามการดำเนินงาน",
    highlights: "มติที่ประชุม",
  },
  training: {
    label: "อบรม",
    title: "รายงานการอบรม/พัฒนาวิชาชีพ",
    summary: "เข้าร่วมการอบรมและนำความรู้มาประยุกต์ใช้",
    highlights: "องค์ความรู้ที่ได้รับ",
  },
  incident: {
    label: "เหตุการณ์",
    title: "รายงานเหตุการณ์สำคัญ",
    summary: "บันทึกข้อเท็จจริงและการดำเนินการเบื้องต้น",
    highlights: "การแก้ไขสถานการณ์",
  },
};
const statusLabels: Record<BriefStatus, string> = {
  draft: "ฉบับร่าง",
  submitted: "ส่งตรวจแล้ว",
  approved: "อนุมัติแล้ว",
  returned: "ส่งกลับแก้ไข",
  shared: "แชร์แล้ว",
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nextDate = (value: string) => {
  const d = new Date(`${value}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const thaiDate = (value: string) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(
    new Date(`${value}T00:00:00`),
  );

export function DailySchoolBriefPage({
  session,
}: {
  session: AppSessionContext;
}) {
  const [date, setDate] = useState(
    () => new URLSearchParams(location.search).get("date") || today(),
  );
  const [classroomId, setClassroomId] = useState("");
  const [classrooms, setClassrooms] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reviewers, setReviewers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [revisions, setRevisions] = useState<
    Array<{
      id: string;
      action: string;
      note: string | null;
      created_at: string;
    }>
  >([]);
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [quickLog, setQuickLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    reportType: "daily" as ReportType,
    title: templates.daily.title,
    summary: templates.daily.summary,
    highlights: "",
    followUps: "",
    tomorrowPlan: "",
    reviewerId: "",
  });
  const workspaceId = session.workspace?.id;
  const canWriteBrief = hasWorkspaceCapability(session, "daily_brief.write");
  const load = useCallback(async () => {
    if (!supabase || !workspaceId) return;
    setBusy(true);
    setNotice(null);
    const tomorrow = nextDate(date);
    let briefQuery = supabase
      .from("daily_school_briefs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("brief_date", date)
      .eq("report_type", form.reportType);
    briefQuery = classroomId
      ? briefQuery.eq("classroom_id", classroomId)
      : briefQuery.is("classroom_id", null);
    const [
      rooms,
      briefRow,
      logRows,
      eventRows,
      tomorrowRows,
      sessionRows,
      behaviorRows,
      healthRows,
      savingRows,
      dutyRows,
      reviewerRows,
    ] = await Promise.all([
      supabase
        .from("classrooms")
        .select("id,name")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("name"),
      briefQuery.maybeSingle(),
      supabase
        .from("daily_brief_logs")
        .select("id,log_time,log_type,body,created_at")
        .eq("workspace_id", workspaceId)
        .eq("log_date", date)
        .order("log_time"),
      supabase
        .from("school_calendar_days")
        .select("title")
        .eq("workspace_id", workspaceId)
        .eq("calendar_date", date),
      supabase
        .from("school_calendar_days")
        .select("title")
        .eq("workspace_id", workspaceId)
        .eq("calendar_date", tomorrow),
      supabase
        .from("attendance_sessions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("attendance_date", date),
      supabase
        .from("behavior_records")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("behavior_date", date),
      supabase
        .from("student_health_records")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("record_date", date),
      supabase
        .from("savings_transactions")
        .select("amount,transaction_type")
        .eq("workspace_id", workspaceId)
        .eq("transaction_date", date),
      supabase
        .from("duty_assignments")
        .select("status")
        .eq("workspace_id", workspaceId)
        .eq("duty_date", date),
      supabase
        .from("workspace_memberships")
        .select("profile_id,role,profiles(display_name)")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .in("role", ["teacher_owner", "teacher_member"]),
    ]);
    setClassrooms((rooms.data || []) as Array<{ id: string; name: string }>);
    setReviewers(
      (
        (reviewerRows.data || []) as Array<{
          profile_id: string;
          profiles: Array<{ display_name: string | null }>;
        }>
      ).map((row) => ({
        id: row.profile_id,
        name: row.profiles?.[0]?.display_name || "ครูในโรงเรียน",
      })),
    );
    const ids = (sessionRows.data || []).map((x) => x.id);
    let attendance: Record<string, number> = {};
    if (ids.length) {
      const records = await supabase
        .from("attendance_records")
        .select("status")
        .in("session_id", ids);
      attendance = (records.data || []).reduce<Record<string, number>>(
        (a, r) => {
          a[r.status] = (a[r.status] || 0) + 1;
          return a;
        },
        {},
      );
    }
    const savingData = (savingRows.data || []) as Array<{
      amount: number;
      transaction_type: string;
    }>;
    const dutyData = (dutyRows.data || []) as Array<{ status: string }>;
    const nextSnapshot: Snapshot = {
      events: (eventRows.data || []).map((x) => x.title),
      tomorrow: (tomorrowRows.data || []).map((x) => x.title),
      attendance,
      duty: {
        total: dutyData.length,
        completed: dutyData.filter((x) =>
          ["completed", "verified"].includes(x.status),
        ).length,
        pending: dutyData.filter(
          (x) => !["completed", "verified"].includes(x.status),
        ).length,
      },
      behavior: behaviorRows.count || 0,
      health: healthRows.count || 0,
      savings: {
        count: savingData.length,
        amount: savingData.reduce(
          (n, x) =>
            n +
            (x.transaction_type === "withdrawal"
              ? -Number(x.amount)
              : Number(x.amount)),
          0,
        ),
      },
    };
    setSnapshot(nextSnapshot);
    setLogs((logRows.data || []) as Log[]);
    if (briefRow.data) {
      const b = briefRow.data as Brief;
      setBrief(b);
      setForm({
        reportType: b.report_type,
        title: b.title,
        summary: b.summary,
        highlights: b.highlights,
        followUps: b.follow_ups,
        tomorrowPlan: b.tomorrow_plan,
        reviewerId: b.reviewer_profile_id || "",
      });
      const rev = await supabase
        .from("daily_brief_revisions")
        .select("id,action,note,created_at")
        .eq("brief_id", b.id)
        .order("created_at", { ascending: false })
        .limit(12);
      setRevisions((rev.data || []) as typeof revisions);
      const attachmentRows = await supabase
        .from("daily_brief_attachments")
        .select("id,file_name,storage_path")
        .eq("brief_id", b.id)
        .order("created_at");
      const signedAttachments = await Promise.all(
        ((attachmentRows.data || []) as Attachment[]).map(async (item) => {
          const signed = await supabase!.storage
            .from("daily-briefs")
            .createSignedUrl(item.storage_path, 60 * 30);
          return { ...item, signedUrl: signed.data?.signedUrl };
        }),
      );
      setAttachments(signedAttachments);
    } else {
      setBrief(null);
      setRevisions([]);
      setAttachments([]);
      setForm((f) => ({
        ...f,
        title: templates[f.reportType].title,
        summary: templates[f.reportType].summary,
        highlights: templates[f.reportType].highlights,
        followUps: "",
        tomorrowPlan: (nextSnapshot.tomorrow || []).join("\n"),
      }));
    }
    setBusy(false);
  }, [classroomId, date, form.reportType, workspaceId]);
  useEffect(() => {
    void load();
  }, [load]);
  const completeness = useMemo(
    () =>
      Math.round(
        ([
          form.title,
          form.summary,
          form.highlights,
          form.followUps || "optional",
          form.tomorrowPlan || "optional",
          snapshot.attendance,
        ].filter(Boolean).length /
          6) *
          100,
      ),
    [form, snapshot],
  );
  async function save(status: BriefStatus = "draft") {
    if (!canWriteBrief) return;
    if (!supabase || !workspaceId) return;
    setBusy(true);
    const payload = {
      workspace_id: workspaceId,
      classroom_id: classroomId || null,
      brief_date: date,
      report_type: form.reportType,
      title: form.title,
      summary: form.summary,
      highlights: form.highlights,
      follow_ups: form.followUps,
      tomorrow_plan: form.tomorrowPlan,
      auto_snapshot: snapshot,
      status,
      reviewer_profile_id: form.reviewerId || null,
      created_by: session.profile.id,
      updated_by: session.profile.id,
      submitted_at:
        status === "submitted"
          ? new Date().toISOString()
          : brief?.status === "submitted"
            ? undefined
            : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      shared_at: status === "shared" ? new Date().toISOString() : null,
    };
    const result = brief
      ? await supabase
          .from("daily_school_briefs")
          .update(payload)
          .eq("id", brief.id)
          .eq("workspace_id", workspaceId)
          .select()
          .single()
      : await supabase
          .from("daily_school_briefs")
          .insert(payload)
          .select()
          .single();
    if (result.error) {
      setNotice(
        result.error.message.includes("daily_school_briefs")
          ? "กรุณาติดตั้ง migration 0044 ก่อนใช้งาน"
          : "บันทึกไม่สำเร็จ: " + result.error.message,
      );
    } else {
      const saved = result.data as Brief;
      await supabase.from("daily_brief_revisions").insert({
        brief_id: saved.id,
        workspace_id: workspaceId,
        action: status === "draft" ? (brief ? "saved" : "created") : status,
        note: null,
        snapshot: payload,
        actor_profile_id: session.profile.id,
      });
      setNotice(
        status === "draft"
          ? "บันทึกฉบับร่างแล้ว"
          : `${statusLabels[status]}เรียบร้อย`,
      );
      await load();
    }
    setBusy(false);
  }
  async function addLog(e: FormEvent) {
    e.preventDefault();
    if (!canWriteBrief) return;
    if (!supabase || !workspaceId || !quickLog.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("daily_brief_logs").insert({
      workspace_id: workspaceId,
      brief_id: brief?.id || null,
      classroom_id: classroomId || null,
      log_date: date,
      log_type: "quick",
      body: quickLog.trim(),
      created_by: session.profile.id,
    });
    if (error) setNotice("เพิ่มบันทึกไม่สำเร็จ");
    else {
      setQuickLog("");
      await load();
    }
    setBusy(false);
  }
  async function uploadAttachment(file: File) {
    if (!canWriteBrief) return;
    if (!supabase || !workspaceId) return;
    if (!brief) {
      setNotice("บันทึกฉบับร่างก่อนแนบภาพหรือไฟล์");
      return;
    }
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${workspaceId}/${brief.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage
      .from("daily-briefs")
      .upload(storagePath, file, { upsert: false });
    if (uploaded.error)
      setNotice("อัปโหลดไฟล์ไม่สำเร็จ: " + uploaded.error.message);
    else {
      const saved = await supabase.from("daily_brief_attachments").insert({
        brief_id: brief.id,
        workspace_id: workspaceId,
        storage_path: storagePath,
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        uploaded_by: session.profile.id,
      });
      setNotice(
        saved.error ? "บันทึกข้อมูลไฟล์ไม่สำเร็จ" : "แนบไฟล์ในรายงานแล้ว",
      );
      if (!saved.error) await load();
    }
    setBusy(false);
  }
  function applyTemplate(type: ReportType) {
    const t = templates[type];
    setForm((f) => ({
      ...f,
      reportType: type,
      title: t.title,
      summary: t.summary,
      highlights: t.highlights,
    }));
  }
  function print() {
    window.print();
  }
  return (
    <main className="app-page daily-brief-page">
      <header className="daily-brief-header">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
            <FileCheck2 size={18} /> Daily School Brief
          </div>
          <h1 className="mt-2 text-3xl font-black">สรุปโรงเรียนในวันเดียว</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">
            ระบบรวมข้อมูลจากปฏิทิน เช็กชื่อ เวร พฤติกรรม สุขภาพ
            และเงินออมเป็นฉบับร่างให้ตรวจได้ทันที
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="daily-secondary-action"
            onClick={() => void save("draft")}
            disabled={busy || !canWriteBrief}
          >
            <Save size={16} />
            บันทึกฉบับร่าง
          </button>
          <button
            className="daily-primary-action"
            onClick={() => void save("submitted")}
            disabled={busy || !canWriteBrief}
          >
            <Send size={16} />
            ส่งตรวจ
          </button>
          <button className="daily-secondary-action" onClick={print}>
            <Printer size={16} />
            พิมพ์/PDF
          </button>
        </div>
      </header>
      {notice ? (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-900">
          {notice}
        </div>
      ) : null}
      <section className="daily-brief-workbench mt-5 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px] xl:items-start">
        <aside className="daily-brief-side space-y-5">
          <div>
            <h2 className="daily-side-title">
              <CalendarDays size={16} />
              ตัวกรองรายงาน
            </h2>
            <label className="daily-field-label">
              วันที่
              <ThaiDatePicker
                className="mt-2 h-11 px-3"
                value={date}
                onValueChange={setDate}
              />
            </label>
            <label className="daily-field-label">
              ห้องเรียน
              <select
                className="nexus-field mt-2 h-11 px-3"
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
              >
                <option value="">ภาพรวมโรงเรียน</option>
                {classrooms.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <h2 className="daily-side-title">
              <Sparkles size={16} />
              แม่แบบเริ่มต้น
            </h2>
            <div className="grid gap-2">
              {Object.entries(templates).map(([key, t]) => (
                <button
                  className={`daily-template ${form.reportType === key ? "is-active" : ""}`}
                  key={key}
                  onClick={() => applyTemplate(key as ReportType)}
                >
                  <span>{t.label}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={addLog}>
            <h2 className="daily-side-title">
              <MessageSquarePlus size={16} />
              Quick Log
            </h2>
            <textarea
              className="nexus-field min-h-24 w-full p-3 text-sm"
              value={quickLog}
              onChange={(e) => setQuickLog(e.target.value)}
              placeholder="เช่น นักเรียน 2 คนลาป่วย"
            />
            <button
              className="daily-primary-action mt-2 w-full justify-center"
              disabled={busy || !canWriteBrief || !quickLog.trim()}
            >
              เพิ่มใน Timeline
            </button>
          </form>
        </aside>
        <article className="daily-brief-paper">
          <div className="daily-paper-heading">
            <p>
              {session.workspace?.schoolName ||
                session.workspace?.name ||
                "โรงเรียน"}
            </p>
            <h2>{form.title}</h2>
            <span>
              {thaiDate(date)} ·{" "}
              {classrooms.find((x) => x.id === classroomId)?.name ||
                "ภาพรวมโรงเรียน"}
            </span>
          </div>
          <div className="daily-snapshot-grid">
            {[
              {
                l: "กิจกรรม",
                v: snapshot.events?.length || 0,
                d: (snapshot.events || []).join(", ") || "ไม่มีรายการ",
              },
              {
                l: "มาเรียน",
                v: snapshot.attendance?.present || 0,
                d: `ขาด ${snapshot.attendance?.absent || 0} · สาย ${snapshot.attendance?.late || 0} · ลา ${(snapshot.attendance?.leave || 0) + (snapshot.attendance?.sick || 0)}`,
              },
              {
                l: "เวรเสร็จ",
                v: snapshot.duty?.completed || 0,
                d: `ค้าง ${snapshot.duty?.pending || 0} จาก ${snapshot.duty?.total || 0}`,
              },
              {
                l: "ต้องติดตาม",
                v: (snapshot.behavior || 0) + (snapshot.health || 0),
                d: `พฤติกรรม ${snapshot.behavior || 0} · สุขภาพ ${snapshot.health || 0}`,
              },
              {
                l: "เงินออมวันนี้",
                v: (snapshot.savings?.amount || 0).toLocaleString("th-TH"),
                d: `${snapshot.savings?.count || 0} รายการ`,
              },
            ].map((x) => (
              <div key={x.l}>
                <span>{x.l}</span>
                <strong>{x.v}</strong>
                <small>{x.d}</small>
              </div>
            ))}
          </div>
          <section className="daily-paper-section">
            <label>ภาพรวมวันนี้</label>
            <textarea
              value={form.summary}
              onChange={(e) =>
                setForm((f) => ({ ...f, summary: e.target.value }))
              }
            />
          </section>
          <section className="daily-paper-section">
            <label>ผลสำเร็จ/สาระสำคัญ</label>
            <textarea
              value={form.highlights}
              onChange={(e) =>
                setForm((f) => ({ ...f, highlights: e.target.value }))
              }
              placeholder="สิ่งที่ดำเนินการสำเร็จหรือข้อค้นพบสำคัญ"
            />
          </section>
          <section className="daily-paper-section">
            <label>ปัญหาและสิ่งที่ต้องติดตาม</label>
            <textarea
              value={form.followUps}
              onChange={(e) =>
                setForm((f) => ({ ...f, followUps: e.target.value }))
              }
              placeholder="ระบุผู้รับผิดชอบและกำหนดเวลา"
            />
          </section>
          <section className="daily-paper-section">
            <label>รายการวันพรุ่งนี้</label>
            <textarea
              value={form.tomorrowPlan}
              onChange={(e) =>
                setForm((f) => ({ ...f, tomorrowPlan: e.target.value }))
              }
            />
          </section>
          <div className="daily-timeline">
            <h3>
              <Clock3 size={17} /> Timeline ประจำวัน
            </h3>
            {logs.length ? (
              logs.map((log) => (
                <div className="daily-timeline-row" key={log.id}>
                  <time>{String(log.log_time).slice(0, 5)}</time>
                  <span />
                  <p>{log.body}</p>
                </div>
              ))
            ) : (
              <p className="daily-empty">ยังไม่มี Quick Log ในวันนี้</p>
            )}
          </div>
          <footer className="daily-paper-signature">
            <div>
              ผู้จัดทำ
              <br />
              <strong>{session.profile.displayName}</strong>
            </div>
            <div>
              ผู้ตรวจ/ผู้รับรอง
              <br />
              <strong>
                {form.reviewerId ? "ระบุผู้รับรองแล้ว" : "รอเลือกผู้รับรอง"}
              </strong>
            </div>
          </footer>
        </article>
        <aside className="daily-brief-side daily-review-panel">
          <div className="flex items-center justify-between">
            <h2 className="daily-side-title mb-0">
              <CheckCircle2 size={16} />
              ความพร้อม
            </h2>
            <strong className="text-2xl text-cyan-700">{completeness}%</strong>
          </div>
          <div className="daily-progress">
            <span style={{ width: `${completeness}%` }} />
          </div>
          <dl className="daily-checklist">
            <div>
              <dt>ข้อมูลอัตโนมัติ</dt>
              <dd>{Object.keys(snapshot).length ? "พร้อม" : "รอข้อมูล"}</dd>
            </div>
            <div>
              <dt>สถานะ</dt>
              <dd>{statusLabels[brief?.status || "draft"]}</dd>
            </div>
            <div>
              <dt>อัปเดตล่าสุด</dt>
              <dd>
                {brief
                  ? new Date(brief.updated_at).toLocaleString("th-TH")
                  : "ยังไม่บันทึก"}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <h2 className="daily-side-title">
              <ImagePlus size={16} />
              ภาพและไฟล์แนบ
            </h2>
            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-black text-slate-600 hover:border-cyan-400">
              เพิ่มภาพหรือ PDF
              <input
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                disabled={busy || !canWriteBrief}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAttachment(file);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {attachments.map((item) => (
                <a
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600"
                  href={item.signedUrl}
                  key={item.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.signedUrl &&
                  /\.(png|jpe?g|webp)$/i.test(item.file_name) ? (
                    <img
                      alt={item.file_name}
                      className="h-20 w-full object-cover"
                      src={item.signedUrl}
                    />
                  ) : (
                    <span className="grid h-20 place-items-center">
                      <FileCheck2 />
                    </span>
                  )}
                  <span className="block truncate p-2">{item.file_name}</span>
                </a>
              ))}
            </div>
          </div>
          <label className="daily-field-label">
            ผู้ตรวจ/ผู้รับรอง
            <select
              className="nexus-field mt-2 h-11 px-3"
              value={form.reviewerId}
              onChange={(e) =>
                setForm((f) => ({ ...f, reviewerId: e.target.value }))
              }
            >
              <option value="">เลือกภายหลัง</option>
              {reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name}
                </option>
              ))}
            </select>
          </label>
          {session.profile.role === "teacher_owner" ||
          session.profile.role === "superadmin" ? (
            <button
              className="daily-approve-action"
              onClick={() => void save("approved")}
              disabled={busy || !canWriteBrief}
            >
              <CheckCircle2 size={16} />
              อนุมัติรายงาน
            </button>
          ) : null}
          <button
            className="daily-share-action"
            onClick={() => void save("shared")}
            disabled={busy || !canWriteBrief || brief?.status !== "approved"}
          >
            <Users size={16} />
            แชร์ให้ผู้ปกครอง
          </button>
          <div>
            <h2 className="daily-side-title mt-5">
              <Clock3 size={16} />
              ประวัติ
            </h2>
            <div className="space-y-3">
              {revisions.map((r) => (
                <div className="daily-revision" key={r.id}>
                  <strong>{r.action}</strong>
                  <span>{new Date(r.created_at).toLocaleString("th-TH")}</span>
                </div>
              ))}
              {!revisions.length ? (
                <p className="daily-empty">ยังไม่มีประวัติ</p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
