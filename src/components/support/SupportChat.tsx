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
  ChevronDown,
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
import {
  CuteCareyAvatar,
  MASCOT_OPTIONS,
  type MascotAvatarType,
} from "./CuteCareyAvatar";

import { supabase, isSupabaseReady } from "../../lib/supabaseClient";
import type { AppSessionContext } from "../../types/core";
import {
  ALL_PROMPT_CATEGORIES,
  getContextPrompts,
  type PromptChip,
} from "../../lib/aiPrompts";
import {
  AVAILABLE_GEMINI_MODELS,
  MANUAL_GEMINI_MODELS,
  callGeminiApi,
  getSmartFallbackResponse,
  parseAssistantResponse,
  testGeminiApiKey,
  type ChatMessage,
  type GeminiModelId,
} from "../../lib/geminiClient";
import {
  deletePersonalAiConfig,
  deleteWorkspaceAiConfig,
  getEffectiveAiConfig,
  savePersonalAiConfig,
  saveWorkspaceAiConfig,
  type EffectiveAiConfig,
} from "../../lib/aiSettings";
import { fetchLiveSchoolDataContext } from "../../lib/schoolContextService";
import { getThaiPublicHolidays, resolveCalendarYear } from "../../lib/thaiHolidays";

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
    const savedEnding = window.localStorage.getItem("classcare_ai_polite_ending");
    const initKa = savedEnding === "male" ? "ครับ" : "ค่ะ";
    const initNaka = savedEnding === "male" ? "นะครับ" : "นะคะ";

    return [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `สวัสดี${initKa}คุณครู! น้องแคร์ (AI ผู้ช่วยประจำ ClassCare 360) ยินดีให้บริการ${initKa} ✨\n\nตอนนี้คุณครูกำลังอยู่ที่หน้า **"${activeLabel}"** คุณครูสามารถเลือกกด **คำสั่งลัดสำเร็จรูป** ด้านล่าง หรือพิมพ์คำถามที่ต้องการได้เลย${initNaka}`,
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

  // Quick Switcher dropdown state & manual fallback toggle
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [allowFallback, setAllowFallback] = useState<boolean>(() => {
    return window.localStorage.getItem("classcare_ai_allow_fallback") !== "false";
  });

  // Mascot Avatar state (saved in localStorage)
  const [mascotType, setMascotType] = useState<MascotAvatarType>(() => {
    try {
      const saved = window.localStorage.getItem("classcare_ai_mascot_avatar") as MascotAvatarType;
      if (saved && ["bear", "cat", "bunny", "girl", "shiba"].includes(saved)) {
        return saved;
      }
    } catch {}
    return "bear";
  });

  const handleSelectMascot = (type: MascotAvatarType) => {
    setMascotType(type);
    try {
      window.localStorage.setItem("classcare_ai_mascot_avatar", type);
    } catch {}
  };

  const currentMascot = useMemo(
    () => MASCOT_OPTIONS.find((m) => m.id === mascotType) || MASCOT_OPTIONS[0],
    [mascotType]
  );

  // Polite ending setting: 'female' (ค่ะ/นะคะ) vs 'male' (ครับ/นะครับ) vs 'neutral'
  const [politeEnding, setPoliteEnding] = useState<"female" | "male" | "neutral">(() => {
    try {
      const saved = window.localStorage.getItem("classcare_ai_polite_ending") as "female" | "male" | "neutral";
      if (saved && ["female", "male", "neutral"].includes(saved)) {
        return saved;
      }
    } catch {}
    return "female";
  });

  const handleSelectPoliteEnding = (ending: "female" | "male" | "neutral") => {
    setPoliteEnding(ending);
    try {
      window.localStorage.setItem("classcare_ai_polite_ending", ending);
    } catch {}
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for external trigger events (e.g. from Center button in MobileNav)
  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    window.addEventListener("classcare:toggle-ai-chat", handleToggle);
    window.addEventListener("classcare:open-ai-chat", handleOpen);
    window.addEventListener("classcare:close-ai-chat", handleClose);

    return () => {
      window.removeEventListener("classcare:toggle-ai-chat", handleToggle);
      window.removeEventListener("classcare:open-ai-chat", handleOpen);
      window.removeEventListener("classcare:close-ai-chat", handleClose);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("classcare:ai-chat-state-changed", {
        detail: { isOpen: open },
      })
    );
  }, [open]);

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

    const pKey = session?.profile?.id
      ? localStorage.getItem(`classcare_personal_ai_key_${session.profile.id}`) || ""
      : "";
    const wKey = session?.workspace?.id
      ? localStorage.getItem(`classcare_workspace_ai_key_${session.workspace.id}`) || ""
      : "";

    if (config.source === "personal") {
      setKeyScope("personal");
      setCustomKeyInput(pKey || config.apiKey || "");
    } else {
      setKeyScope("workspace");
      setCustomKeyInput(wKey || config.apiKey || "");
    }
  }, [session]);

  const handleSelectScope = (scope: "workspace" | "personal") => {
    setKeyScope(scope);
    if (scope === "workspace") {
      const wKey = session?.workspace?.id
        ? localStorage.getItem(`classcare_workspace_ai_key_${session.workspace.id}`) || ""
        : "";
      setCustomKeyInput(wKey);
    } else {
      const pKey = session?.profile?.id
        ? localStorage.getItem(`classcare_personal_ai_key_${session.profile.id}`) || ""
        : "";
      setCustomKeyInput(pKey);
    }
    setTestResult(null);
  };

  useEffect(() => {
    window.localStorage.setItem("classcare_ai_allow_fallback", allowFallback ? "true" : "false");
  }, [allowFallback]);

  const handleQuickSwitchModel = async (newModel: GeminiModelId) => {
    setSelectedModel(newModel);
    setIsModelSelectorOpen(false);
    if (aiConfig?.apiKey) {
      if (keyScope === "workspace") {
        await saveWorkspaceAiConfig(session, aiConfig.apiKey, newModel);
      } else {
        await savePersonalAiConfig(session, aiConfig.apiKey, newModel);
      }
      await loadAiConfig();
    }
  };

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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("classcare:ai-unread-changed", {
        detail: { unreadCount },
      })
    );
  }, [unreadCount]);

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
      const model = selectedModel || aiConfig?.model || "auto";

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
            allowFallback,
            politeEnding,
          }
        );
      } else {
        // Use smart fallback engine
        const fallback = getSmartFallbackResponse(text, activeLabel, politeEnding);
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
      const fallback = getSmartFallbackResponse(text, activeLabel, politeEnding);
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

  // Batch Calendar Holidays Saver for Carey AI (All-in-one year insert)
  const handleSaveBatchCalendarEvents = async (payloadStr: string) => {
    try {
      const parsed = payloadStr ? JSON.parse(payloadStr) : {};
      const targetYear = resolveCalendarYear(parsed.year || session.workspace?.academicYear || "2569");
      const holidays = getThaiPublicHolidays(targetYear);
      if (!holidays || holidays.length === 0) return;

      const workspaceId = session.workspace?.id;
      let insertedCount = 0;

      if (isSupabaseReady && supabase && workspaceId) {
        try {
          // Fetch existing days to prevent duplicating same title on same date
          const { data: existing } = await supabase
            .from("school_calendar_days")
            .select("calendar_date, title")
            .eq("workspace_id", workspaceId);

          const existingSet = new Set((existing || []).map((e: any) => `${e.calendar_date}|${e.title}`));
          const newRows = holidays
            .filter((h) => !existingSet.has(`${h.date}|${h.title}`))
            .map((h) => ({
              workspace_id: workspaceId,
              calendar_date: h.date,
              day_type: h.type,
              title: h.title,
              affects_attendance: false,
              affects_reports: true,
              created_by: session.profile.id,
              metadata: { attendancePolicy: h.attendancePolicy },
            }));

          if (newRows.length > 0) {
            const { error } = await supabase.from("school_calendar_days").insert(newRows);
            if (!error) insertedCount = newRows.length;
          }
        } catch (dbErr) {
          console.warn("Supabase batch holiday insert fallback:", dbErr);
        }
      }

      // Also persist to LocalStorage safety rules
      const storageKey = `classcare:data-safety:${workspaceId || session.profile.id}`;
      const state = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      const existingRules = state.calendarRules || [];
      const localSet = new Set(existingRules.map((r: any) => `${r.date}|${r.title}`));

      const additionalLocal = holidays
        .filter((h) => !localSet.has(`${h.date}|${h.title}`))
        .map((h, i) => ({
          id: `ai-cal-batch-${Date.now()}-${i}`,
          date: h.date,
          title: h.title,
          type: h.type,
          attendancePolicy: h.attendancePolicy,
          source: insertedCount > 0 ? "supabase" : "local",
        }));

      state.calendarRules = [...existingRules, ...additionalLocal];
      window.localStorage.setItem(storageKey, JSON.stringify(state));

      // Broadcast live event so calendar page immediately updates
      window.dispatchEvent(new CustomEvent("classcare-calendar-updated"));

      const thaiYear = targetYear + 543;
      setAiMessages((prev) => [
        ...prev,
        {
          id: `asst-cal-batch-saved-${Date.now()}`,
          role: "assistant",
          content: `🎉 **บันทึกวันหยุดราชการไทยประจำปี ${thaiYear} ครบทั้งปีสำเร็จแล้วค่ะ!**\n\n- **จำนวนวันหยุด:** ${holidays.length} วัน (ปีใหม่, วันครู, มาฆบูชา, สงกรานต์, วันเฉลิมพระชนมพรรษา, วันแม่, วันพ่อ ฯลฯ)\n- **นโยบายเวลาเรียน:** ทุกวันหยุดถูกตั้งค่าเป็น **"ไม่นับเป็นวันเรียน (ข้ามเช็กชื่อ)"** ให้อัตโนมัติ เพื่อไม่ให้กระทบสถิติเวลาเรียน 80% ของนักเรียน\n\nคุณครูสามารถเปิดดูในปฏิทินโรงเรียนได้ทันทีเลยนะคะ`,
          timestamp: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actions: [
            { type: "navigate", target: "/app/dashboard?view=school-calendar", label: "📅 เปิดดูปฏิทินโรงเรียน" },
          ],
        },
      ]);
    } catch (e: any) {
      alert(`ไม่สามารถบันทึกวันหยุดทั้งปีได้: ${e.message || e}`);
    }
  };

  // Action Click Handler (Navigate or Copy or Handover or Calendar or Batch Calendar)
  const handleActionClick = (action: {
    type: "navigate" | "copy" | "handover" | "calendar" | "calendar_batch";
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
    } else if (action.type === "calendar_batch" && action.payload) {
      void handleSaveBatchCalendarEvents(action.payload);
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

  // Delete API Key Configuration
  const handleDeleteKey = async () => {
    if (!session) return;
    const scopeName = keyScope === "workspace" ? "Key โรงเรียน" : "Key ส่วนตัว";
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${scopeName} ออกจากระบบ? (ระบบจะเปลี่ยนกลับไปใช้โหมดมาตรฐาน)`)) {
      return;
    }
    if (keyScope === "workspace") {
      await deleteWorkspaceAiConfig(session);
    } else {
      await deletePersonalAiConfig(session);
    }
    setCustomKeyInput("");
    setTestResult(null);
    await loadAiConfig();
  };

  return (
    <div className="support-widget no-print print:hidden fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] inset-x-3 mx-auto z-[70] flex flex-col items-center pointer-events-none sm:pointer-events-auto sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:items-end">
      {open ? (
        <section
          aria-label="ผู้ช่วยครูอัจฉริยะและติดต่อผู้ดูแลระบบ"
          className="relative mb-3 flex h-[min(700px,80dvh)] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-cyan-400/40 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/60 transition-all backdrop-blur-xl pointer-events-auto"
        >
          {/* Header */}
          <header className="relative overflow-hidden border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.25),transparent_50%)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-amber-300 via-sky-400 to-indigo-500 p-0.5 shadow-md shadow-sky-950/50 ring-1 ring-white/20">
                  <CuteCareyAvatar type={mascotType} size={34} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[.15em] text-cyan-300">
                      ClassCare AI
                    </p>
                    {aiConfig?.apiKey ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                          title="คลิกเพื่อสลับโมเดล AI ทันใจ"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30 hover:text-white transition cursor-pointer"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>
                            {selectedModel === 'auto'
                              ? '✨ Auto'
                              : selectedModel === 'gemini-3.6-flash'
                              ? '🌟 3.6 Flash'
                              : selectedModel === 'gemini-3.5-flash'
                              ? '🌟 3.5 Flash'
                              : selectedModel === 'gemini-1.5-pro'
                              ? '🧠 1.5 Pro'
                              : '⚡ 1.5 Flash'}
                          </span>
                          <ChevronDown size={10} className="text-emerald-400 ml-0.5" />
                        </button>

                        {/* Quick Switch Dropdown */}
                        {isModelSelectorOpen && (
                          <div className="absolute left-0 top-full mt-1.5 w-52 rounded-2xl border border-slate-700 bg-slate-900/95 p-1.5 text-xs shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95">
                            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                              <span>สลับโมเดล AI</span>
                              <span className="text-[9px] text-cyan-400 font-normal">คลิกเลือกทันที</span>
                            </div>
                            <div className="py-1 space-y-1">
                              {AVAILABLE_GEMINI_MODELS.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleQuickSwitchModel(m.id)}
                                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition ${
                                    selectedModel === m.id
                                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <div className="truncate min-w-0 pr-2">
                                    <div className="font-bold flex items-center gap-1 truncate text-[11px]">
                                      <span>{m.name.replace(/ \(.*\)/, '')}</span>
                                      {m.id === 'auto' && (
                                        <span className="text-[8px] text-amber-300 bg-amber-400/20 px-1 py-0.2 rounded font-black">
                                          Auto
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">{m.quota || m.tag}</div>
                                  </div>
                                  {selectedModel === m.id && (
                                    <Check size={13} className="text-cyan-400 shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300">
                        ผู้ช่วยแนะนำ
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                    <span>{currentMascot.name}</span>
                    <span className="text-xs font-normal text-sky-300">— ผู้ช่วยครูอัจฉริยะ</span>
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
                      <div className={`flex items-end gap-2 max-w-[92%] ${msg.role === "user" ? "justify-end ml-auto" : "justify-start mr-auto"}`}>
                        {msg.role === "assistant" && (
                          <div className="shrink-0 mb-1 select-none">
                            <CuteCareyAvatar type={mascotType} size={28} />
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
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
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-xs ${
                                  act.type === "calendar_batch"
                                    ? "bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white hover:brightness-110 shadow-sm active:scale-95 px-3 py-1.5"
                                    : act.type === "calendar"
                                    ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 active:scale-95"
                                    : act.type === "navigate"
                                    ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                                    : act.type === "copy"
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                }`}
                              >
                                {act.type === "calendar_batch" && (
                                  <Sparkles size={13} className="text-amber-200 animate-pulse" />
                                )}
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

                {/* Cute Mascot Selection */}
                <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/80 via-white to-indigo-50/50 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                      <span>🎨</span>
                      <span>เลือกตัวละครน้องแคร์ (มาสคอตน่ารัก):</span>
                    </label>
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full border border-sky-200">
                      {currentMascot.emoji} {currentMascot.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    คลิกเปลี่ยนหน้าตาของน้องแคร์ได้ตามใจชอบ พร้อมแสดงผลทันทีทั้งปุ่มลอยและในแชทค่ะ
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                    {MASCOT_OPTIONS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectMascot(m.id)}
                        className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-all ${
                          mascotType === m.id
                            ? "border-sky-500 bg-sky-50/90 text-sky-950 shadow-xs ring-2 ring-sky-400 font-bold"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <CuteCareyAvatar type={m.id} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate">
                            {m.name}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {m.description.split(" ")[0]}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Polite Ending & Teacher Tone Setting */}
                <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/70 via-white to-sky-50/50 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                      <span>🗣️</span>
                      <span>คำลงท้ายสำหรับคุณครู (ร่างข้อความ/แชท):</span>
                    </label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-full border border-indigo-200">
                      {politeEnding === 'male' ? '👨‍🏫 ครับ / นะครับ' : politeEnding === 'female' ? '👩‍🏫 ค่ะ / นะคะ' : '🌟 สุภาพเป็นกลาง'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    กำหนดให้ AI ใช้คำลงท้ายที่ตรงกับคุณครู เมื่อช่วยร่างข้อความส่งผู้ปกครอง สมุดพก และตอบคำถาม
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleSelectPoliteEnding('female')}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                        politeEnding === 'female'
                          ? 'border-pink-500 bg-pink-50/90 text-pink-950 shadow-xs ring-2 ring-pink-400 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xl">👩‍🏫</span>
                      <span className="text-xs font-bold">ครูผู้หญิง</span>
                      <span className="text-[9px] text-pink-600 bg-pink-100/80 px-1.5 py-0.2 rounded-full font-bold">ค่ะ / นะคะ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPoliteEnding('male')}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                        politeEnding === 'male'
                          ? 'border-indigo-500 bg-indigo-50/90 text-indigo-950 shadow-xs ring-2 ring-indigo-400 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xl">👨‍🏫</span>
                      <span className="text-xs font-bold">ครูผู้ชาย</span>
                      <span className="text-[9px] text-indigo-600 bg-indigo-100/80 px-1.5 py-0.2 rounded-full font-bold">ครับ / นะครับ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPoliteEnding('neutral')}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                        politeEnding === 'neutral'
                          ? 'border-sky-500 bg-sky-50/90 text-sky-950 shadow-xs ring-2 ring-sky-400 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xl">🌟</span>
                      <span className="text-xs font-bold">ทางการ / กลาง</span>
                      <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">ตามบริบท</span>
                    </button>
                  </div>
                </div>

                {/* Scope Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    ขอบเขตการใช้ Key
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectScope("workspace")}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        keyScope === "workspace"
                          ? "border-indigo-500 bg-indigo-50/80 text-indigo-900 font-bold shadow-2xs ring-1 ring-indigo-400"
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
                      onClick={() => handleSelectScope("personal")}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        keyScope === "personal"
                          ? "border-indigo-500 bg-indigo-50/80 text-indigo-900 font-bold shadow-2xs ring-1 ring-indigo-400"
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-slate-700">
                      {keyScope === "workspace"
                        ? "🏫 Google Gemini API Key ของโรงเรียน"
                        : "👤 Google Gemini API Key ส่วนตัว"}
                    </label>
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      {keyScope === "workspace" ? "บันทึกแยกใน Workspace" : "บันทึกแยกใน Profile"}
                    </span>
                  </div>
                  <input
                    type="password"
                    placeholder={
                      keyScope === "workspace"
                        ? "ใส่ API Key สำหรับแชร์ครูทั้งโรงเรียน (AIzaSy...)"
                        : "ใส่ API Key สำหรับใช้งานส่วนตัวคนเดียว (AIzaSy...)"
                    }
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

                {/* Model Selection (Auto vs Manual) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-slate-700">
                      โหมดการเลือกโมเดล AI
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600">
                      {selectedModel === 'auto' ? '✨ โหมดสลับอัตโนมัติ' : '🎯 โหมดเลือกเอง'}
                    </span>
                  </div>

                  {/* Mode Tabs */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3">
                    <button
                      type="button"
                      onClick={() => setSelectedModel('auto')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                        selectedModel === 'auto'
                          ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>✨</span>
                      <span>สลับอัตโนมัติ (Auto)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedModel === 'auto') {
                          setSelectedModel('gemini-3.5-flash');
                        }
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                        selectedModel !== 'auto'
                          ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🎯</span>
                      <span>เลือกโมเดลเอง (Manual)</span>
                    </button>
                  </div>

                  {/* Auto Mode UI */}
                  {selectedModel === 'auto' ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-indigo-950 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs flex items-center gap-1.5 text-indigo-900">
                          <span>🤖</span> Auto Model Cascade (แนะนำสูงสุด ✨)
                        </span>
                        <span className="text-[9px] font-black text-indigo-700 bg-white/90 px-2 py-0.5 rounded-full border border-indigo-200">
                          Zero Downtime
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                        ระบบจะเริ่มจากโมเดลที่ฉลาดที่สุด และสลับรุ่นสำรองให้อัตโนมัติทันทีเมื่อโควตาเต็ม ไม่สะดุด:
                      </p>
                      <div className="space-y-1.5 text-[11px] bg-white/80 rounded-xl p-2.5 border border-indigo-100 shadow-2xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="flex items-center gap-1">🌟 1. Gemini 3.6 Flash</span>
                          <span className="text-[9px] text-indigo-700 bg-indigo-100/90 px-1.5 py-0.2 rounded font-bold">Google แนะนำล่าสุด</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-5">↓ สลับอัตโนมัติเมื่อจำเป็น</div>
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="flex items-center gap-1">✨ 2. Gemini 3.5 Flash</span>
                          <span className="text-[9px] text-amber-700 bg-amber-100/90 px-1.5 py-0.2 rounded font-bold">ฉลาด ละเอียด</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-5">↓ สลับสำรอง</div>
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="flex items-center gap-1">⚡ 3. Gemini 1.5 Flash</span>
                          <span className="text-[9px] text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded font-bold">1,500 ครั้ง/วัน (เสถียรสุด)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Manual Selection UI */
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-600 mb-1">
                        คลิกเลือกรุ่นโมเดลที่ต้องการเจาะจงใช้งานด้วยตนเอง:
                      </p>
                      <div className="space-y-2">
                        {MANUAL_GEMINI_MODELS.map((m) => (
                          <label
                            key={m.id}
                            className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition ${
                              selectedModel === m.id
                                ? "border-indigo-500 bg-indigo-50/70 text-indigo-950 shadow-2xs ring-1 ring-indigo-400"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                                <span className="font-bold text-xs text-slate-900">
                                  {m.name}
                                </span>
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded border border-indigo-200">
                                  {m.tag}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                {m.description}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
                                <span className="bg-slate-100 border border-slate-200/80 px-1.5 py-0.2 rounded font-medium">
                                  ⚡ {m.speed}
                                </span>
                                <span className="bg-indigo-50/80 text-indigo-800 border border-indigo-100 px-1.5 py-0.2 rounded font-bold">
                                  📊 {m.quota}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* Fallback Toggle in Manual Mode */}
                      <label className="flex items-center gap-2 mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition">
                        <input
                          type="checkbox"
                          checked={allowFallback}
                          onChange={(e) => setAllowFallback(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-slate-700 font-medium leading-tight">
                          เปิดการสลับรุ่นสำรองอัตโนมัติหากโควตารุ่นนี้เต็ม (ป้องกันติด Error 429)
                        </span>
                      </label>
                    </div>
                  )}
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
                    <div>{testResult.message}</div>
                    {!testResult.success && (testResult.message.includes('quota') || testResult.message.includes('Quota')) && (
                      <div className="mt-1.5 pt-1.5 border-t border-rose-200/80 text-[11px] font-normal text-rose-700 leading-relaxed">
                        💡 <strong>คำแนะนำ:</strong> กรุณาเลือกโมเดล <strong>Gemini 1.5 Flash</strong> ด้านบน (โควตาฟรี 1,500 ครั้ง/วัน) หรือผูก Billing บน Google AI Studio เพื่อปลดล็อกเป็น Unlimited ไม่จำกัดครั้งต่อวันค่ะ
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Settings Action Buttons Footer */}
              <div className="flex gap-2 p-4 border-t border-slate-200 bg-white shadow-xs">
                {customKeyInput.trim() && (
                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    title="ลบ Key นี้ออกจากระบบ"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition shadow-2xs flex items-center gap-1 shrink-0"
                  >
                    <Trash2 size={14} />
                    <span>ลบ Key</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting || !customKeyInput.trim()}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  {isTesting ? "กำลังตรวจ..." : "ทดสอบ"}
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

      {/* Floating Toggle Button with Glowing Cute Mascot (Desktop only, mobile uses Center Dock Button) */}
      <button
        aria-expanded={open}
        aria-label="ผู้ช่วยครูอัจฉริยะและติดต่อผู้ดูแลระบบ"
        className="group relative ml-auto hidden sm:grid h-15 w-15 place-items-center rounded-full border-2 border-white/60 bg-gradient-to-br from-amber-300 via-sky-400 to-indigo-600 p-0.5 text-white shadow-xl shadow-sky-950/30 transition-all duration-300 hover:-translate-y-1.5 hover:scale-105 hover:shadow-sky-500/40 active:scale-95 cursor-pointer pointer-events-auto"
        onClick={() => setOpen((value) => !value)}
      >
        {/* Breathing animated aura ring */}
        <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-pink-400 via-sky-400 to-amber-300 opacity-60 blur-xs animate-pulse group-hover:opacity-100 transition-opacity" />

        <div className="relative z-10 grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 shadow-inner overflow-hidden">
          {open ? (
            <X size={26} className="text-white drop-shadow" />
          ) : (
            <div className="relative grid place-items-center">
              <CuteCareyAvatar type={mascotType} size={38} className="drop-shadow-sm" />
              <Sparkles
                size={13}
                className="absolute -top-1 -right-1 text-amber-300 animate-bounce drop-shadow"
              />
            </div>
          )}
        </div>

        {unreadCount ? (
          <span className="absolute -right-1 -top-1 z-20 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black text-white shadow">
            {unreadCount}
          </span>
        ) : null}

        {/* Floating Tooltip Bubble with Pointer Arrow */}
        {!open && (
          <div className="pointer-events-none absolute right-full mr-3 hidden sm:flex items-center gap-2 rounded-2xl border border-sky-100/90 bg-white/95 px-3.5 py-2 text-xs font-black text-slate-800 shadow-2xl backdrop-blur-md whitespace-nowrap transition-all duration-200 group-hover:flex">
            <span className="text-sm">{currentMascot.emoji}</span>
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
              มีอะไรให้{currentMascot.name}ช่วยไหม{politeEnding === "male" ? "ครับ" : "คะ"}? ✨
            </span>
            <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-white/95" />
          </div>
        )}
      </button>
    </div>
  );
}
