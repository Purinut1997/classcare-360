import { type FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LifeBuoy,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type PublicThread = {
  ticket: {
    ticket_code: string;
    subject: string;
    status: string;
    created_at: string;
  };
  messages: Array<{
    id: string;
    body: string;
    sender_role: string;
    created_at: string;
  }>;
};
const storageKey = "classcare-public-support-access";

export function PublicSupportPage() {
  const params = new URLSearchParams(location.search);
  const embed = params.get("embed") === "1";
  const source =
    params.get("source") === "mediaplatform" ? "mediaplatform" : "public";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("other");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [access, setAccess] = useState<{
    ticket_code: string;
    access_token: string;
  } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  });
  const [thread, setThread] = useState<PublicThread | null>(null);
  async function load(current = access) {
    if (!supabase || !current) return;
    const { data, error } = await supabase.rpc("get_public_support_ticket", {
      p_ticket_code: current.ticket_code,
      p_access_token: current.access_token,
    });
    if (error) setNotice("เปิดเรื่องเดิมไม่ได้ กรุณาตรวจสอบข้อมูลอีกครั้ง");
    else setThread(data as PublicThread);
  }
  // Restore this browser's latest public conversation only when the widget mounts.
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- restore the most recent conversation once
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const context = {
      page_name: params.get("page_title") || document.title,
      page_url: params.get("page_url") || document.referrer || location.href,
      source,
      viewport: `${innerWidth}x${innerHeight}`,
      reported_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.rpc("create_public_support_ticket", {
      p_name: name,
      p_email: email,
      p_subject: subject,
      p_body: body,
      p_category: category,
      p_source: source,
      p_context: context,
      p_honeypot: honeypot,
    });
    if (error)
      setNotice(
        error.message.includes("rate_limited")
          ? "ส่งเรื่องถี่เกินไป กรุณารอสักครู่"
          : "ส่งเรื่องไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง",
      );
    else {
      const next = data as { ticket_code: string; access_token: string };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setAccess(next);
      setBody("");
      await load(next);
    }
    setBusy(false);
  }
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !access || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("reply_public_support_ticket", {
      p_ticket_code: access.ticket_code,
      p_access_token: access.access_token,
      p_body: body,
    });
    if (error) setNotice("ส่งข้อความไม่สำเร็จ");
    else {
      setBody("");
      await load();
    }
    setBusy(false);
  }
  const content = (
    <div
      className={`${embed ? "h-dvh" : "min-h-screen py-8 sm:py-14"} bg-slate-950 text-slate-100`}
    >
      <main
        className={`${embed ? "h-full max-w-none rounded-none" : "mx-auto min-h-[680px] max-w-xl rounded-[32px] border border-white/10 shadow-2xl"} flex flex-col overflow-hidden bg-slate-900`}
      >
        <header className="relative overflow-hidden border-b border-white/10 p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,.24),transparent_50%)]" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400 text-slate-950">
              <LifeBuoy />
            </span>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">
                {source === "mediaplatform"
                  ? "MediaPlatform × ClassCare"
                  : "ClassCare 360"}
              </p>
              <h1 className="text-lg font-black">ติดต่อผู้ดูแลระบบ</h1>
              <p className="text-xs text-slate-400">
                ทุกข้อความมีเลขที่เรื่องและติดตามได้
              </p>
            </div>
            {thread ? (
              <button
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10"
                onClick={() => {
                  setThread(null);
                  setAccess(null);
                  localStorage.removeItem(storageKey);
                }}
                title="แจ้งเรื่องใหม่"
              >
                <ArrowLeft size={17} />
              </button>
            ) : null}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 text-slate-900">
          {notice ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
              {notice}
            </p>
          ) : null}
          {thread ? (
            <>
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={18} />
                  <strong>รับเรื่องแล้ว · {thread.ticket.ticket_code}</strong>
                </div>
                <p className="mt-1 text-sm font-bold">
                  {thread.ticket.subject}
                </p>
              </div>
              <div className="space-y-3">
                {thread.messages.map((m) => (
                  <div
                    className={`flex ${m.sender_role === "admin" ? "justify-start" : "justify-end"}`}
                    key={m.id}
                  >
                    <div
                      className={`max-w-[84%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === "admin" ? "border border-slate-200 bg-white" : "bg-cyan-600 text-white"}`}
                    >
                      <small className="font-black opacity-60">
                        {m.sender_role === "admin" ? "ผู้ดูแล" : "คุณ"}
                      </small>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <small className="opacity-50">
                        {new Date(m.created_at).toLocaleString("th-TH")}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800">
                <strong className="block">แจ้งจากหน้านี้โดยอัตโนมัติ</strong>
                {params.get("page_title") || "หน้าเว็บไซต์สาธารณะ"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black">
                  ชื่อ
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium"
                    onChange={(e) => setName(e.target.value)}
                    required
                    value={name}
                  />
                </label>
                <label className="text-xs font-black">
                  อีเมล
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </label>
              </div>
              <label className="hidden">
                เว็บไซต์
                <input
                  autoComplete="off"
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  value={honeypot}
                />
              </label>
              <label className="block text-xs font-black">
                ประเภท
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  onChange={(e) => setCategory(e.target.value)}
                  value={category}
                >
                  <option value="other">ใช้งานทั่วไป</option>
                  <option value="account">บัญชี/สิทธิ์</option>
                  <option value="data">ข้อมูล</option>
                  <option value="billing">แพ็กเกจ/ชำระเงิน</option>
                  <option value="feature">เสนอแนะฟีเจอร์</option>
                  <option value="security">ความปลอดภัย</option>
                </select>
              </label>
              <label className="block text-xs font-black">
                หัวข้อ
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium"
                  maxLength={160}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="ปัญหาที่พบโดยสรุป"
                  required
                  value={subject}
                />
              </label>
              <label className="block text-xs font-black">
                รายละเอียด
                <textarea
                  className="mt-1 min-h-28 w-full resize-none rounded-xl border border-slate-200 p-3 font-medium"
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="อธิบายสิ่งที่เกิดขึ้น..."
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
              <p className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400">
                <ShieldCheck size={12} />{" "}
                ข้อมูลใช้เพื่อแก้ไขปัญหาและไม่แสดงต่อสาธารณะ
              </p>
            </form>
          )}
        </div>
        {thread ? (
          <form
            className="flex gap-2 border-t border-white/10 bg-slate-950 p-3"
            onSubmit={reply}
          >
            <input
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-sm text-white"
              onChange={(e) => setBody(e.target.value)}
              placeholder="พิมพ์ข้อความเพิ่มเติม..."
              value={body}
            />
            <button
              className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-slate-950"
              disabled={busy || !body.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        ) : null}
      </main>
    </div>
  );
  return content;
}

export function PublicSupportLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      <>
        {open ? (
          <div className="mb-3 h-[min(680px,78dvh)] w-[min(390px,calc(100vw-2.5rem))] overflow-hidden rounded-[28px] border border-slate-700 bg-slate-950 shadow-2xl">
            <iframe
              className="h-full w-full"
              src={`/support?embed=1&source=public&page_title=${encodeURIComponent(document.title)}&page_url=${encodeURIComponent(location.href)}`}
              title="ติดต่อผู้ดูแลระบบ"
            />
          </div>
        ) : null}
      </>
      <button
        aria-label="ติดต่อผู้ดูแลระบบ"
        className="ml-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-xl"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle fill="currentColor" />
      </button>
    </div>
  );
}
