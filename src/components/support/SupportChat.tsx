import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LifeBuoy,
  MessageCircle,
  Plus,
  Send,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import type { AppSessionContext } from "../../types/core";

type Ticket = {
  id: string;
  ticket_code: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  requester_last_read_at: string | null;
};
type Message = {
  id: string;
  body: string;
  sender_role: string;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  open: "รับเรื่องแล้ว",
  in_progress: "กำลังดูแล",
  waiting_user: "รอข้อมูลจากคุณ",
  resolved: "แก้ไขแล้ว",
  closed: "ปิดเรื่อง",
};
const categories = [
  ["other", "ใช้งานทั่วไป"],
  ["account", "บัญชี/สิทธิ์"],
  ["data", "ข้อมูล"],
  ["attendance", "เช็กชื่อ"],
  ["reports", "รายงาน"],
  ["billing", "แพ็กเกจ"],
  ["feature", "เสนอฟีเจอร์"],
  ["security", "ความปลอดภัย"],
] as const;

export function SupportChat({
  activeLabel,
  activeView,
  session,
}: {
  activeLabel: string;
  activeView: string;
  session: AppSessionContext;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "new" | "thread">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("normal");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unreadCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.requester_last_read_at &&
          new Date(ticket.last_message_at) >
            new Date(ticket.requester_last_read_at),
      ).length,
    [tickets],
  );

  const loadTickets = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("support_tickets")
      .select(
        "id,ticket_code,subject,status,priority,last_message_at,requester_last_read_at",
      )
      .order("last_message_at", { ascending: false })
      .limit(20);
    if (data) setTickets(data as Ticket[]);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadTickets();
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [loadTickets]);

  async function openThread(ticket: Ticket) {
    setSelected(ticket);
    setMode("thread");
    setNotice(null);
    if (!supabase) return;
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,body,sender_role,created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at");
    if (error) setNotice("ยังเปิดบทสนทนาไม่ได้ กรุณาลองอีกครั้ง");
    else setMessages((data || []) as Message[]);
    await supabase.rpc("mark_support_ticket_read", { p_ticket_id: ticket.id });
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !subject.trim() || body.trim().length < 4) return;
    setBusy(true);
    setNotice(null);
    const context = {
      page_key: activeView,
      page_name: activeLabel,
      page_url: `${location.pathname}${location.search}`,
      workspace_name: session.workspace?.name,
      classroom_name: session.workspace?.classroomName,
      role: session.profile.role,
      viewport: `${innerWidth}x${innerHeight}`,
      browser: navigator.userAgent,
      reported_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        workspace_id: session.workspace?.id || null,
        requester_profile_id: session.profile.id,
        requester_name: session.profile.displayName,
        requester_email: session.profile.email,
        subject: subject.trim(),
        category,
        priority,
        source: "classcare",
        context,
      })
      .select(
        "id,ticket_code,subject,status,priority,last_message_at,requester_last_read_at",
      )
      .single();
    if (error || !data) {
      setNotice(
        error?.message.includes("support_tickets")
          ? "ระบบรับแจ้งกำลังรอติดตั้งฐานข้อมูลเวอร์ชันล่าสุด"
          : "ส่งเรื่องไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
      setBusy(false);
      return;
    }
    const ticket = data as Ticket;
    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_profile_id: session.profile.id,
        sender_role: "requester",
        body: body.trim(),
      });
    if (messageError) {
      setNotice(
        "สร้างเลขที่เรื่องแล้ว แต่ส่งข้อความไม่สำเร็จ กรุณาเปิดเรื่องแล้วส่งอีกครั้ง",
      );
    }
    setSubject("");
    setBody("");
    setCategory("other");
    setPriority("normal");
    setBusy(false);
    await loadTickets();
    await openThread(ticket);
  }

  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selected || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: selected.id,
        sender_profile_id: session.profile.id,
        sender_role: "requester",
        body: body.trim(),
      });
    if (error) setNotice("ส่งข้อความไม่สำเร็จ");
    else {
      setBody("");
      await openThread(selected);
    }
    setBusy(false);
  }

  return (
    <div className="support-widget fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[70] sm:bottom-6 sm:right-6">
      {open ? (
        <section
          aria-label="ติดต่อผู้ดูแลระบบ"
          className="mb-3 flex h-[min(680px,78dvh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-cyan-300/30 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/40"
        >
          <header className="relative overflow-hidden border-b border-white/10 px-5 py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.2),transparent_45%)]" />
            <div className="relative flex items-center gap-3">
              {mode !== "list" ? (
                <button
                  aria-label="ย้อนกลับ"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 hover:bg-white/10"
                  onClick={() => {
                    setMode("list");
                    setSelected(null);
                    setBody("");
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400 text-slate-950">
                  <LifeBuoy size={20} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">
                  ClassCare Support
                </p>
                <h2 className="truncate text-base font-black">
                  {mode === "new"
                    ? "แจ้งปัญหา"
                    : mode === "thread"
                      ? selected?.ticket_code
                      : "คุยกับผู้ดูแลระบบ"}
                </h2>
              </div>
              <button
                aria-label="ปิดหน้าต่างแชท"
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 text-slate-900">
            {notice ? (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                {notice}
              </p>
            ) : null}
            {mode === "list" ? (
              <>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 p-4 text-left text-white shadow-lg shadow-cyan-900/15"
                  onClick={() => setMode("new")}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
                    <Plus />
                  </span>
                  <span>
                    <strong className="block text-sm">
                      แจ้งปัญหาจากหน้านี้
                    </strong>
                    <small className="text-cyan-50">
                      แนบหน้า “{activeLabel}” ให้อัตโนมัติ
                    </small>
                  </span>
                </button>
                <p className="mb-2 mt-5 text-xs font-black text-slate-500">
                  เรื่องของฉัน
                </p>
                <div className="space-y-2">
                  {tickets.length ? (
                    tickets.map((ticket) => (
                      <button
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-300"
                        key={ticket.id}
                        onClick={() => void openThread(ticket)}
                      >
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-xl ${ticket.status === "resolved" || ticket.status === "closed" ? "bg-emerald-50 text-emerald-600" : "bg-cyan-50 text-cyan-700"}`}
                        >
                          {ticket.status === "resolved" ||
                          ticket.status === "closed" ? (
                            <CheckCircle2 size={17} />
                          ) : (
                            <Clock3 size={17} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">
                            {ticket.subject}
                          </strong>
                          <small className="text-slate-500">
                            {ticket.ticket_code} · {statusLabel[ticket.status]}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                      ยังไม่มีเรื่องที่แจ้ง
                    </div>
                  )}
                </div>
              </>
            ) : null}
            {mode === "new" ? (
              <form className="space-y-3" onSubmit={createTicket}>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-xs">
                  <strong className="block text-cyan-900">บริบทที่จะแนบ</strong>
                  <span className="text-cyan-700">
                    {activeLabel} ·{" "}
                    {session.workspace?.name || "ไม่ระบุ Workspace"} ·{" "}
                    {session.workspace?.classroomName || "ทุกห้อง"}
                  </span>
                </div>
                <label className="block text-xs font-black">
                  หัวข้อ
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium outline-none focus:border-cyan-500"
                    maxLength={160}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="เช่น กดบันทึกแล้วข้อมูลไม่ขึ้น"
                    required
                    value={subject}
                  />
                </label>
                <label className="block text-xs font-black">
                  ประเภท
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                    onChange={(e) => setCategory(e.target.value)}
                    value={category}
                  >
                    {categories.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-black">
                  ความเร่งด่วน
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                    onChange={(e) => setPriority(e.target.value)}
                    value={priority}
                  >
                    <option value="normal">ปกติ</option>
                    <option value="important">สำคัญ</option>
                    <option value="urgent">เร่งด่วน</option>
                  </select>
                </label>
                <label className="block text-xs font-black">
                  รายละเอียด
                  <textarea
                    className="mt-1 min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium outline-none focus:border-cyan-500"
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="เกิดอะไรขึ้น และคาดหวังให้ระบบทำงานอย่างไร"
                    required
                    value={body}
                  />
                </label>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-black text-white disabled:opacity-50"
                  disabled={busy}
                >
                  <Send size={16} />
                  {busy ? "กำลังส่ง..." : "ส่งให้ผู้ดูแล"}
                </button>
              </form>
            ) : null}
            {mode === "thread" ? (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    className={`flex ${message.sender_role === "admin" ? "justify-start" : "justify-end"}`}
                    key={message.id}
                  >
                    <div
                      className={`max-w-[84%] rounded-2xl px-3 py-2 text-sm ${message.sender_role === "admin" ? "border border-slate-200 bg-white" : "bg-cyan-600 text-white"}`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <small className="mt-1 block opacity-60">
                        {new Date(message.created_at).toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {mode === "thread" ? (
            <form
              className="flex gap-2 border-t border-white/10 bg-slate-950 p-3"
              onSubmit={reply}
            >
              <input
                aria-label="พิมพ์ข้อความ"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                onChange={(e) => setBody(e.target.value)}
                placeholder="พิมพ์ข้อความ..."
                value={body}
              />
              <button
                aria-label="ส่งข้อความ"
                className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-slate-950 disabled:opacity-50"
                disabled={busy || !body.trim()}
              >
                <Send size={18} />
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      <button
        aria-expanded={open}
        aria-label="ติดต่อผู้ดูแลระบบ"
        className="relative ml-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-200/30 bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-xl shadow-cyan-950/30 transition hover:-translate-y-1"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <X size={24} />
        ) : (
          <MessageCircle size={25} fill="currentColor" />
        )}
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black">
            {unreadCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
