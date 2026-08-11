import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Inbox,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type Ticket = {
  id: string;
  ticket_code: string;
  requester_name: string;
  requester_email: string;
  source: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  context: Record<string, unknown>;
  last_message_at: string;
  admin_last_read_at: string | null;
  created_at: string;
};
type Message = {
  id: string;
  body: string;
  sender_role: string;
  is_internal: boolean;
  created_at: string;
};
const statuses = [
  ["open", "เปิดใหม่"],
  ["in_progress", "กำลังดูแล"],
  ["waiting_user", "รอผู้แจ้ง"],
  ["resolved", "แก้ไขแล้ว"],
  ["closed", "ปิดเรื่อง"],
] as const;

export function SuperadminSupportInbox() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loadTickets = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id,ticket_code,requester_name,requester_email,source,category,subject,priority,status,context,last_message_at,admin_last_read_at,created_at",
      )
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) setNotice("ยังโหลดกล่องรับเรื่องไม่ได้: " + error.message);
    else setTickets((data || []) as Ticket[]);
  }, []);
  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);
  const shown = useMemo(
    () =>
      tickets.filter((t) => {
        const active = !["resolved", "closed"].includes(t.status);
        const matches =
          filter === "all" ||
          (filter === "active" ? active : t.status === filter);
        return (
          matches &&
          `${t.ticket_code} ${t.subject} ${t.requester_name} ${t.requester_email}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [tickets, filter, query],
  );
  const metrics = {
    open: tickets.filter((t) => t.status === "open").length,
    urgent: tickets.filter(
      (t) =>
        t.priority === "urgent" && !["closed", "resolved"].includes(t.status),
    ).length,
    active: tickets.filter((t) => !["closed", "resolved"].includes(t.status))
      .length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };
  async function choose(ticket: Ticket) {
    setSelected(ticket);
    setNotice(null);
    if (!supabase) return;
    const { data } = await supabase
      .from("support_messages")
      .select("id,body,sender_role,is_internal,created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at");
    setMessages((data || []) as Message[]);
    await supabase.rpc("mark_support_ticket_read", { p_ticket_id: ticket.id });
  }
  async function updateTicket(patch: Record<string, unknown>) {
    if (!supabase || !selected) return;
    const previous = selected;
    setSelected({ ...selected, ...patch } as Ticket);
    const { error } = await supabase
      .from("support_tickets")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
        resolved_at:
          patch.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", selected.id);
    if (error) {
      setSelected(previous);
      setNotice("อัปเดตสถานะไม่สำเร็จ");
    } else await loadTickets();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selected || !reply.trim()) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: selected.id,
        sender_profile_id: user?.id,
        sender_role: "admin",
        body: reply.trim(),
        is_internal: internal,
      });
    if (error) setNotice("ส่งข้อความไม่สำเร็จ");
    else {
      setReply("");
      setInternal(false);
      await choose(selected);
      if (!internal && selected.status === "open")
        await updateTicket({ status: "in_progress" });
    }
    setBusy(false);
  }
  return (
    <section className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          {
            label: "รอรับเรื่อง",
            value: metrics.open,
            icon: Inbox,
            color: "text-cyan-700 bg-cyan-50",
          },
          {
            label: "กำลังดำเนินการ",
            value: metrics.active,
            icon: Clock3,
            color: "text-blue-700 bg-blue-50",
          },
          {
            label: "เร่งด่วน",
            value: metrics.urgent,
            icon: AlertCircle,
            color: "text-rose-700 bg-rose-50",
          },
          {
            label: "แก้ไขแล้ว",
            value: metrics.resolved,
            icon: CheckCircle2,
            color: "text-emerald-700 bg-emerald-50",
          },
        ].map((x) => (
          <div className="nexus-card flex items-center gap-3 p-4" key={x.label}>
            <span
              className={`grid h-11 w-11 place-items-center rounded-2xl ${x.color}`}
            >
              <x.icon size={20} />
            </span>
            <div>
              <p className="text-2xl font-black">{x.value}</p>
              <p className="text-xs font-bold text-slate-500">{x.label}</p>
            </div>
          </div>
        ))}
      </div>
      {notice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          {notice}
        </div>
      ) : null}
      <div className="nexus-card grid min-h-[650px] overflow-hidden lg:grid-cols-[330px_minmax(380px,1fr)_300px]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <h2 className="flex items-center gap-2 font-black">
              <Inbox size={18} /> กล่องรับเรื่อง
            </h2>
            <label className="relative block">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <input
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาเลขที่เรื่องหรือผู้แจ้ง"
                value={query}
              />
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
              onChange={(e) => setFilter(e.target.value)}
              value={filter}
            >
              <option value="active">กำลังดำเนินการทั้งหมด</option>
              <option value="all">ทุกสถานะ</option>
              {statuses.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[530px] overflow-y-auto">
            {shown.map((t) => (
              <button
                className={`w-full border-b border-slate-100 p-4 text-left transition hover:bg-cyan-50 ${selected?.id === t.id ? "bg-cyan-50" : ""}`}
                key={t.id}
                onClick={() => void choose(t)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-cyan-700">
                    {t.ticket_code}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${t.priority === "urgent" ? "bg-rose-500" : t.status === "open" ? "bg-cyan-500" : "bg-slate-300"}`}
                  />
                </div>
                <strong className="mt-1 block truncate text-sm">
                  {t.subject}
                </strong>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {t.requester_name} · {t.source}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <main className="flex min-h-[560px] flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
          {selected ? (
            <>
              <header className="border-b border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-cyan-700">
                      {selected.ticket_code}
                    </p>
                    <h3 className="text-lg font-black">{selected.subject}</h3>
                  </div>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                    onChange={(e) =>
                      void updateTicket({ status: e.target.value })
                    }
                    value={selected.status}
                  >
                    {statuses.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {messages.map((m) => (
                  <div
                    className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}
                    key={m.id}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.is_internal ? "border border-amber-200 bg-amber-50 text-amber-900" : m.sender_role === "admin" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white"}`}
                    >
                      <small className="font-black opacity-60">
                        {m.is_internal
                          ? "บันทึกภายใน"
                          : m.sender_role === "admin"
                            ? "ผู้ดูแล"
                            : "ผู้แจ้ง"}
                      </small>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <small className="opacity-50">
                        {new Date(m.created_at).toLocaleString("th-TH")}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="space-y-2 border-t border-slate-200 bg-white p-3"
                onSubmit={send}
              >
                <textarea
                  className="min-h-20 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm"
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="พิมพ์คำตอบ หรือบันทึกภายใน..."
                  value={reply}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                      type="checkbox"
                    />{" "}
                    บันทึกภายใน (ผู้แจ้งไม่เห็น)
                  </label>
                  <button
                    className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    disabled={busy || !reply.trim()}
                  >
                    <Send size={14} />
                    {busy ? "กำลังส่ง" : "ส่งข้อความ"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-slate-500">
              <div>
                <MessageSquare
                  className="mx-auto mb-3 text-slate-300"
                  size={42}
                />
                <p className="font-black">เลือกเรื่องเพื่อเปิดบทสนทนา</p>
                <p className="text-sm">
                  อ่านข้อความ ตอบกลับ และเปลี่ยนสถานะได้ในจอเดียว
                </p>
              </div>
            </div>
          )}
        </main>
        <aside className="p-4">
          {selected ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black text-slate-400">ผู้แจ้ง</p>
                <p className="mt-1 font-black">{selected.requester_name}</p>
                <a
                  className="text-xs text-cyan-700"
                  href={`mailto:${selected.requester_email}`}
                >
                  {selected.requester_email}
                </a>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400">ความสำคัญ</p>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  onChange={(e) =>
                    void updateTicket({ priority: e.target.value })
                  }
                  value={selected.priority}
                >
                  <option value="normal">ปกติ</option>
                  <option value="important">สำคัญ</option>
                  <option value="urgent">เร่งด่วน</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400">
                  บริบทอัตโนมัติ
                </p>
                <dl className="mt-2 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs">
                  {Object.entries(selected.context || {})
                    .filter(([k]) =>
                      [
                        "page_name",
                        "workspace_name",
                        "classroom_name",
                        "role",
                        "viewport",
                      ].includes(k),
                    )
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-black text-slate-400">
                          {k.replace(/_/g, " ")}
                        </dt>
                        <dd className="break-words font-bold">
                          {String(v || "-")}
                        </dd>
                      </div>
                    ))}
                </dl>
                {typeof selected.context?.page_url === "string" ? (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-xs font-black text-cyan-700"
                    href={String(selected.context.page_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    เปิดหน้าที่แจ้ง <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
