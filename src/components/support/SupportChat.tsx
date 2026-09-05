import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Key,
  LifeBuoy,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase, isSupabaseReady } from "../../lib/supabaseClient";
import type { AppSessionContext } from "../../types/core";
import {
  ALL_PROMPT_CATEGORIES,
  getContextPrompts,
  type PromptChip,
} from "../../lib/aiPrompts";
import {
  AVAILABLE_GEMINI_MODELS,
  callGeminiApi,
  getSmartFallbackResponse,
  parseAssistantResponse,
  testGeminiApiKey,
  type ChatMessage,
  type GeminiModelId,
} from "../../lib/geminiClient";
import {
  getEffectiveAiConfig,
  savePersonalAiConfig,
  saveWorkspaceAiConfig,
  type EffectiveAiConfig,
} from "../../lib/aiSettings";
import { fetchLiveSchoolDataContext } from "../../lib/schoolContextService";

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
  const navigate = useNavigate();

  // Widget Open State
  const [open, setOpen] = useState(false);
  // Main Tab: 'ai' (ถามน้องแคร์) | 'ticket' (แจ้งปัญหาถึงผู้ดูแล)
  const [activeTab, setActiveTab] = useState<"ai" | "ticket">("ai");

  // -------------------------------------------------------------
  // AI Chat Assistant State
  // -------------------------------------------------------------
  const [aiConfig, setAiConfig] = useState<EffectiveAiConfig | null>(null);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = window.sessionStorage.getItem("classcare_ai_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `สวัสดีค่ะคุณครู! น้องแคร์ (AI ผู้ช่วยประจำ ClassCare 360) ยินดีให้บริการค่ะ ✨\n\nตอนนี้คุณครูกำลังอยู่ที่หน้า **"${activeLabel}"** คุณครูสามารถเลือกกด **คำสั่งลัดสำเร็จรูป** ด้านล่าง หรือพิมพ์คำถามที่ต้องการได้เลยนะคะ`,
        timestamp: new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];
  });
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Settings Modal form state
  const [customKeyInput, setCustomKeyInput] = useState("");
  const [selectedModel, setSelectedModel] =
    useState<GeminiModelId>("gemini-1.5-flash");
  const [keyScope, setKeyScope] = useState<"workspace" | "personal">(
    "workspace"
  );
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Context-aware prompt chips
  const dynamicChips = useMemo(
    () => getContextPrompts(activeView),
    [activeView]
  );

  // Load AI configuration
  const loadAiConfig = useCallback(async () => {
    const config = await getEffectiveAiConfig(session);
    setAiConfig(config);
    setSelectedModel(config.model);
    if (config.apiKey) setCustomKeyInput(config.apiKey);
  }, [session]);

  useEffect(() => {
    void loadAiConfig();
  }, [loadAiConfig]);

  // Persist messages in sessionStorage so they remain during page switches and clear only when closing the tab/browser
  useEffect(() => {
    if (aiMessages.length > 0) {
      try {
        window.sessionStorage.setItem("classcare_ai_messages", JSON.stringify(aiMessages));
      } catch {
        // Ignore storage errors
      }
    }
  }, [aiMessages]);

  // Handle manual reset chat conversation (via 🔄 button)
  const handleResetChat = useCallback(() => {
    const freshWelcome: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: `สวัสดีค่ะคุณครู! น้องแคร์ (AI ผู้ช่วยประจำ ClassCare 360) ยินดีให้บริการค่ะ ✨\n\nตอนนี้คุณครูกำลังอยู่ที่หน้า **"${activeLabel}"** คุณครูสามารถเลือกกด **คำสั่งลัดสำเร็จรูป** ด้านล่าง หรือพิมพ์คำถามที่ต้องการได้เลยนะคะ`,
      timestamp: new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setAiMessages([freshWelcome]);
    try {
      window.sessionStorage.setItem("classcare_ai_messages", JSON.stringify([freshWelcome]));
    } catch {
      // Ignore
    }
    setAiInput("");
    setIsAiLoading(false);
  }, [activeLabel]);

  // Auto scroll to bottom
  useEffect(() => {
    if (activeTab === "ai") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages, activeTab, isAiLoading]);

  // -------------------------------------------------------------
  // Support Tickets State (Preserved 100%)
  // -------------------------------------------------------------
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
            new Date(ticket.requester_last_read_at)
      ).length,
    [tickets]
  );

  const loadTickets = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("support_tickets")
      .select(
        "id,ticket_code,subject,status,priority,last_message_at,requester_last_read_at"
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
    else {
      setMessages((data || []) as Message[]);
      await supabase.from("support_tickets").update({
        requester_last_read_at: new Date().toISOString(),
      }).eq("id", ticket.id);
      void loadTickets();
    }
  }

  async function handleCreateTicket(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !body.trim() || !supabase) return;
    setBusy(true);
    setNotice(null);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        workspace_id: session.workspace?.id,
        subject: subject.trim(),
        category,
        priority,
        context_data: { activeView, activeLabel },
      })
      .select("id,ticket_code,subject,status,priority,last_message_at,requester_last_read_at")
      .single();

    if (error || !ticket) {
      setNotice(error?.message || "ไม่สามารถเปิดเรื่องได้");
      setBusy(false);
      return;
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      body: body.trim(),
    });

    setSubject("");
    setBody("");
    await loadTickets();
    await openThread(ticket as Ticket);
    setBusy(false);
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !body.trim() || !supabase) return;
    setBusy(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected.id,
      body: body.trim(),
    });
    if (error) setNotice("ส่งข้อความไม่สำเร็จ");
    else {
      setBody("");
      await openThread(selected);
    }
    setBusy(false);
  }

  // -------------------------------------------------------------
  // AI Interaction Handler
  // -------------------------------------------------------------
  const handleSendAiMessage = async (promptToSend?: string) => {
    const text = (promptToSend || aiInput).trim();
    if (!text || isAiLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setIsAiLoading(true);

    try {
      const activeKey = aiConfig?.apiKey;
      const model = aiConfig?.model || "gemini-2.0-flash";

      let rawResponse: string;

      if (activeKey && activeKey.length > 10) {
        // Fetch live factual school data (students, attendance, classrooms)
        const liveSchoolContext = await fetchLiveSchoolDataContext(
          session,
          activeView
        );

        // Use live Gemini API with real database ground truth
        rawResponse = await callGeminiApi(
          activeKey,
          model,
          [...aiMessages, userMsg],
          {
            activeView,
            classroomName: session.workspace?.classroomName,
            academicYear: session.workspace?.academicYear,
            liveSchoolContext,
          }
        );
      } else {
        // Use smart fallback engine
        const fallback = getSmartFallbackResponse(text, activeLabel);
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: fallback.cleanText,
          timestamp: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actions: fallback.actions,
        };
        setAiMessages((prev) => [...prev, assistantMsg]);
        setIsAiLoading(false);
        return;
      }

      // Parse Gemini response for actions
      const parsed = parseAssistantResponse(rawResponse);
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: parsed.cleanText,
        timestamp: new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        actions: parsed.actions,
      };

      setAiMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      // Graceful fallback on API error
      const fallback = getSmartFallbackResponse(text, activeLabel);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          role: "assistant",
          content: `${fallback.cleanText}\n\n*(หมายเหตุ: ระบบตอบด้วยคำแนะนำอัตโนมัติเนื่องจาก: ${err.message || "การเชื่อมต่อขัดข้อง"})*`,
          timestamp: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actions: fallback.actions,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Direct Calendar Event Saver for AI Assistant
  const handleSaveCalendarEvent = async (payloadStr: string) => {
    try {
      const { date, type, title } = JSON.parse(payloadStr);
      if (!date || !title) return;

      const workspaceId = session.workspace?.id;
      const isHoliday = type === "holiday";
      let success = false;

      if (isSupabaseReady && supabase && workspaceId) {
        try {
          const { error } = await supabase.from("school_calendar_days").insert({
            workspace_id: workspaceId,
            calendar_date: date,
            day_type: type,
            title: title,
            affects_attendance: !isHoliday,
            affects_reports: true,
            created_by: session.profile.id,
            metadata: { attendancePolicy: isHoliday ? "skip" : "normal" },
          });
          if (!error) success = true;
        } catch {
          // Fallback handled below
        }
      }

      // Local storage backup for immediate rendering
      const storageKey = `classcare:data-safety:${workspaceId || session.profile.id}`;
      const state = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      const existingRules = state.calendarRules || [];
      state.calendarRules = [
        ...existingRules,
        {
          id: `ai-cal-${Date.now()}`,
          date,
          title,
          type,
          attendancePolicy: isHoliday ? "skip" : "normal",
          source: success ? "supabase" : "local",
        },
      ];
      window.localStorage.setItem(storageKey, JSON.stringify(state));

      // Broadcast update event so SchoolCalendarPage reloads live
      window.dispatchEvent(new CustomEvent("classcare-calendar-updated"));

      const typeThai = type === "holiday" ? "วันหยุด" : type === "exam" ? "วันสอบ" : "วันกิจกรรม";
      setAiMessages((prev) => [
        ...prev,
        {
          id: `asst-cal-saved-${Date.now()}`,
          role: "assistant",
          content: `✅ **บันทึก ${typeThai} สำเร็จแล้วค่ะ!**\n\n- **รายการ:** ${title}\n- **วันที่:** ${date}\n- **นโยบายเวลาเรียน:** ${isHoliday ? "ไม่นับเป็นวันเรียน (ข้ามการเช็กชื่ออัตโนมัติ ไม่กระทบสถิติ 80%)" : "เช็กชื่อตามปกติ"}\n\nระบบอัปเดตลงในปฏิทินโรงเรียนเรียบร้อยแล้วค่ะ คุณครูสามารถเปิดดูในปฏิทินได้เลยนะคะ`,
          timestamp: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actions: [
            { type: "navigate", target: "/app/dashboard?view=school-calendar", label: "📅 ไปที่หน้าปฏิทินโรงเรียน" },
          ],
        },
      ]);
    } catch (e: any) {
      alert(`ไม่สามารถบันทึกปฏิทินได้: ${e.message || e}`);
    }
  };

  // Action Click Handler (Navigate or Copy or Handover or Calendar)
  const handleActionClick = (action: {
    type: "navigate" | "copy" | "handover" | "calendar";
    target?: string;
    label: string;
    payload?: string;
  }) => {
    if (action.type === "navigate" && action.target) {
      setOpen(false);
      navigate(action.target);
    } else if (action.type === "copy" && action.payload) {
      navigator.clipboard.writeText(action.payload);
      setCopiedIndex(9999);
      setTimeout(() => setCopiedIndex(null), 2500);
    } else if (action.type === "handover") {
      // Switch to Ticket tab and pre-fill form
      setActiveTab("ticket");
      setMode("new");
      setSubject(action.target || "ขอความช่วยเหลือจากแอดมิน");
      setBody(action.payload || "");
    } else if (action.type === "calendar" && action.payload) {
      void handleSaveCalendarEvent(action.payload);
    }
  };

  // Test API Key
  const handleTestKey = async () => {
    if (!customKeyInput.trim()) {
      setTestResult({ success: false, message: "กรุณาระบุ API Key ก่อนทดสอบ" });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const res = await testGeminiApiKey(customKeyInput.trim(), selectedModel);
    setTestResult(res);
    if (res.autoSwitchedModel) {
      setSelectedModel(res.autoSwitchedModel);
    }
    setIsTesting(false);
  };

  // Save API Key Configuration
  const handleSaveConfig = async () => {
    if (keyScope === "workspace") {
      await saveWorkspaceAiConfig(session, customKeyInput, selectedModel);
    } else {
      await savePersonalAiConfig(session, customKeyInput, selectedModel);
    }
    await loadAiConfig();
    setIsSettingsOpen(false);
    setTestResult(null);
  };

  return (
    <div className="support-widget fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[70] sm:bottom-6 sm:right-6">
      {open ? (
        <section
          aria-label="ผู้ช่วยครูอัจฉริยะและติดต่อผู้ดูแลระบบ"
          className="relative mb-3 flex h-[min(700px,82dvh)] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-cyan-400/40 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/60 transition-all backdrop-blur-xl"
        >
          {/* Header */}
          <header className="relative overflow-hidden border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.25),transparent_50%)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 text-slate-950 shadow-md">
                  <Bot size={19} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[.15em] text-cyan-300">
                      ClassCare AI
                    </p>
                    {aiConfig?.apiKey ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {aiConfig.model}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300">
                        ผู้ช่วยแนะนำ
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-sm sm:text-base font-black text-white">
                    น้องแคร์ — ผู้ช่วยครู
                  </h2>
                </div>
              </div>

              {/* Action buttons (Reset / Settings / Close) */}
              <div className="flex items-center gap-1">
                {activeTab === "ai" && (
                  <button
                    type="button"
                    title="เริ่มบทสนทนาใหม่ (รีเซ็ตแชท)"
                    onClick={handleResetChat}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-cyan-300 transition"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button
                  type="button"
                  title="ตั้งค่า Gemini API Key"
                  onClick={() => setIsSettingsOpen(true)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  <Settings size={15} />
                </button>
                <button
                  type="button"
                  aria-label="ปิดหน้าต่าง"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition"
                  onClick={() => setOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs (AI น้องแคร์ / ตั๋วแจ้งปัญหา) */}
            <div className="relative mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-900/80 p-1 text-xs font-bold border border-white/5">
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                  activeTab === "ai"
                    ? "bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-sm font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles size={13} />
                <span>ถาม AI น้องแคร์</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ticket")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all relative ${
                  activeTab === "ticket"
                    ? "bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-sm font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LifeBuoy size={13} />
                <span>แจ้งปัญหาถึงแอดมิน</span>
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 text-slate-900 flex flex-col">
            {activeTab === "ai" ? (
              /* TAB 1: AI CHAT ASSISTANT */
              <div className="flex flex-col flex-1 min-h-0">
                {/* Chat Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {aiMessages.map((msg, idx) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-xs font-medium"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-slate-200/50"
                        }`}
                      >
                        {/* Render content with line breaks */}
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* Interactive Action Buttons */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                            {msg.actions.map((act, actIdx) => (
                              <button
                                key={actIdx}
                                type="button"
                                onClick={() => handleActionClick(act)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-xs ${
                                  act.type === "calendar"
                                    ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 active:scale-95"
                                    : act.type === "navigate"
                                    ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                                    : act.type === "copy"
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                }`}
                              >
                                {act.type === "calendar" && (
                                  <CalendarDays size={12} className="text-rose-600" />
                                )}
                                {act.type === "navigate" && (
                                  <ExternalLink size={12} />
                                )}
                                {act.type === "copy" && <Copy size={12} />}
                                {act.type === "handover" && (
                                  <LifeBuoy size={12} />
                                )}
                                <span>{act.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="mt-0.5 px-1 text-[10px] text-slate-400 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                  ))}

                  {/* Typing / Loading Indicator */}
                  {isAiLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-2xl w-fit shadow-xs">
                      <RefreshCw size={13} className="animate-spin text-cyan-600" />
                      <span>น้องแคร์กำลังคิดและวิเคราะห์ข้อมูล...</span>
                    </div>
                  )}

                  {copiedIndex && (
                    <div className="text-center text-xs font-bold text-emerald-600 bg-emerald-50 py-1 rounded-lg">
                      ✓ คัดลอกข้อความสำเร็จ! นำไปส่งต่อได้เลย
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Dynamic Context Prompt Chips */}
                <div className="border-t border-slate-200/70 bg-white/90 p-2.5">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-500" />
                      คำสั่งลัดแนะนำ (คลิกถามทันที):
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPromptLibraryOpen(true)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      ดูคำสั่งทั้งหมด ➜
                    </button>
                  </div>

                  {/* Horizontal Scrollable Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {dynamicChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleSendAiMessage(chip.prompt)}
                        className="shrink-0 rounded-full border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 px-3 py-1 text-xs font-medium text-slate-700 transition-all active:scale-95"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Prompt Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendAiMessage();
                    }}
                    className="mt-2 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      placeholder={`ถามอะไรก็ได้ เช่น วิธีใช้, ปัญหา, ให้ช่วยสรุป...`}
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      disabled={isAiLoading}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={isAiLoading || !aiInput.trim()}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-sm hover:from-cyan-400 hover:to-sky-500 disabled:opacity-50 transition"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* TAB 2: SUPPORT TICKETS (PRESERVED 100%) */
              <div className="p-4 flex-1">
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

                    <div className="mt-4">
                      <p className="text-xs font-black uppercase text-slate-500 mb-2">
                        เรื่องของฉัน
                      </p>
                      {tickets.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
                          ยังไม่มีเรื่องที่แจ้ง
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tickets.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => openThread(t)}
                              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs hover:border-cyan-400 transition"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-cyan-700">
                                  {t.ticket_code}
                                </span>
                                <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-bold">
                                  {statusLabel[t.status] || t.status}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-bold text-slate-800 truncate">
                                {t.subject}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : mode === "new" ? (
                  <form onSubmit={handleCreateTicket} className="space-y-3">
                    <div>
                      <label className="block text-xs font-black text-slate-600 mb-1">
                        หัวข้อเรื่อง
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="สรุปปัญหาพอสังเขป..."
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-600 mb-1">
                        หมวดหมู่
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none"
                      >
                        {categories.map(([val, lbl]) => (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-600 mb-1">
                        รายละเอียด
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="อธิบายสิ่งที่เกิดขึ้น หรือสิ่งที่ต้องการให้ช่วยเหลือ..."
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setMode("list")}
                        className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-600"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white shadow-sm"
                      >
                        {busy ? "กำลังส่ง..." : "เปิดเรื่อง"}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Thread Mode */
                  <div className="flex flex-col h-full space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-bold text-slate-600">
                        {selected?.subject}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMode("list")}
                        className="text-xs font-bold text-cyan-600"
                      >
                        กลับรายการ
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-xl p-3 text-xs ${
                            m.sender_role === "support"
                              ? "bg-cyan-50 text-cyan-900 ml-4"
                              : "bg-slate-100 text-slate-800 mr-4"
                          }`}
                        >
                          <p>{m.body}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-1.5 pt-2">
                      <input
                        type="text"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="พิมพ์ข้อความตอบกลับ..."
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={busy || !body.trim()}
                        className="rounded-xl bg-cyan-600 px-3 py-2 text-white"
                      >
                        <Send size={15} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal: Gemini API Key & Model Configuration */}
          {isSettingsOpen && (
            <div className="absolute inset-0 z-30 flex flex-col bg-slate-50 text-slate-900 rounded-[28px] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs">
                    <Key size={17} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">ตั้งค่า Google Gemini AI</h3>
                    <p className="text-[10px] text-slate-500 font-medium">ปรับแต่งคีย์และโมเดลตามต้องการ</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* VIP Indicator */}
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-amber-900 shadow-2xs">
                  <span className="font-black flex items-center gap-1.5 text-amber-800">
                    <span>👑</span> สิทธิ์การใช้งานระดับ VIP:
                  </span>
                  <p className="mt-1 text-[11px] text-amber-700/90 leading-relaxed">
                    สามารถใส่ Google Gemini API Key เพื่อปลดล็อกการแชทวิเคราะห์ข้อมูลและการตอบคำถามอิสระฟรี 100%
                  </p>
                </div>

                {/* Scope Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    ขอบเขตการใช้ Key
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKeyScope("workspace")}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        keyScope === "workspace"
                          ? "border-indigo-500 bg-indigo-50/80 text-indigo-900 font-bold shadow-2xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100/60"
                      }`}
                    >
                      <span className="block text-xs font-bold text-slate-800">🏫 Key โรงเรียน</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ครูทุกคนในโรงเรียนใช้ร่วมกัน
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKeyScope("personal")}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        keyScope === "personal"
                          ? "border-indigo-500 bg-indigo-50/80 text-indigo-900 font-bold shadow-2xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100/60"
                      }`}
                    >
                      <span className="block text-xs font-bold text-slate-800">👤 Key ส่วนตัว</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ใช้เฉพาะบัญชีของคุณคนเดียว
                      </span>
                    </button>
                  </div>
                </div>

                {/* API Key Input */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    รับ API Key ฟรีได้จาก{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 font-semibold underline"
                    >
                      Google AI Studio (คลิก)
                    </a>
                  </p>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    เลือกโมเดล Gemini
                  </label>
                  <div className="space-y-1.5">
                    {AVAILABLE_GEMINI_MODELS.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition ${
                          selectedModel === m.id
                            ? "border-indigo-500 bg-indigo-50/70 text-indigo-950 shadow-2xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name="ai_model"
                          checked={selectedModel === m.id}
                          onChange={() => setSelectedModel(m.id)}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800">
                              {m.name}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded border border-indigo-200">
                              {m.tag}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {m.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div
                    className={`rounded-xl p-3 text-xs font-bold ${
                      testResult.success
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* Settings Action Buttons Footer */}
              <div className="flex gap-2 p-4 border-t border-slate-200 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  {isTesting ? "กำลังตรวจ..." : "ทดสอบเชื่อมต่อ"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm transition"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          )}

          {/* Modal: Categorized Prompt Library */}
          {isPromptLibraryOpen && (
            <div className="absolute inset-0 z-30 flex flex-col bg-slate-50 text-slate-900 rounded-[28px] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs">
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">คลังคำสั่งลัดสำเร็จรูป</h3>
                    <p className="text-[10px] text-slate-500 font-medium">แตะคำสั่งที่ต้องการเพื่อให้ AI ช่วยร่างข้อความทันที</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPromptLibraryOpen(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {ALL_PROMPT_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100/80 text-indigo-700 font-bold text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>{cat.name}</span>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {cat.prompts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setIsPromptLibraryOpen(false);
                            handleSendAiMessage(p.prompt);
                          }}
                          className="w-full text-left rounded-xl border border-slate-200/80 bg-white p-3 hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-xs transition group shadow-2xs"
                        >
                          <span className="font-bold block text-slate-800 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors">
                            {p.label}
                          </span>
                          <span className="text-[11px] text-slate-500 line-clamp-1 mt-1 group-hover:text-slate-600">
                            {p.prompt}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Floating Toggle Button with Glowing Sparkles */}
      <button
        aria-expanded={open}
        aria-label="ผู้ช่วยครูอัจฉริยะและติดต่อผู้ดูแลระบบ"
        className="group relative ml-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-300/40 bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 text-white shadow-xl shadow-cyan-950/40 transition hover:-translate-y-1 hover:shadow-cyan-500/30"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <X size={24} />
        ) : (
          <div className="relative">
            <Bot size={26} />
            <Sparkles
              size={12}
              className="absolute -top-1 -right-1 text-amber-300 animate-bounce"
            />
          </div>
        )}
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black">
            {unreadCount}
          </span>
        ) : null}

        {/* Floating Tooltip */}
        {!open && (
          <div className="pointer-events-none absolute right-full mr-3 hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur-sm whitespace-nowrap group-hover:block transition-all">
            <Sparkles size={13} className="text-amber-400" />
            <span>มีอะไรให้น้องแคร์ช่วยไหมคะ?</span>
          </div>
        )}
      </button>
    </div>
  );
}
