import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Key,
  Lock,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';

import {
  AVAILABLE_GEMINI_MODELS,
  testGeminiApiKey,
  type GeminiModelId,
} from '../../lib/geminiClient';
import {
  getEffectiveAiConfig,
  isUserVip,
  saveWorkspaceAiConfig,
  type EffectiveAiConfig,
} from '../../lib/aiSettings';
import type { AppSessionContext } from '../../types/core';

interface WorkspaceAiSettingsCardProps {
  session: AppSessionContext;
}

export function WorkspaceAiSettingsCard({ session }: WorkspaceAiSettingsCardProps) {
  const isVip = isUserVip(session);
  const isOwnerOrAdmin =
    session.profile.role === 'superadmin' || session.profile.role === 'teacher_owner';

  const [aiConfig, setAiConfig] = useState<EffectiveAiConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>('gemini-2.0-flash');
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      const config = await getEffectiveAiConfig(session);
      setAiConfig(config);
      if (config.apiKey) setApiKeyInput(config.apiKey);
      if (config.model) setSelectedModel(config.model);
    }
    loadConfig();
  }, [session]);

  const handleTestKey = async () => {
    if (!apiKeyInput.trim()) {
      setTestResult({ success: false, message: 'กรุณากรอก API Key ก่อนทดสอบ' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const res = await testGeminiApiKey(apiKeyInput.trim(), selectedModel);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveNotice(null);
    try {
      await saveWorkspaceAiConfig(session, apiKeyInput.trim(), selectedModel);
      const updated = await getEffectiveAiConfig(session);
      setAiConfig(updated);
      setSaveNotice('บันทึกการตั้งค่า AI ประจำโรงเรียนเรียบร้อยแล้ว');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (e: any) {
      setSaveNotice(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-sm">
      {/* Card Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                ระบบ AI ผู้ช่วยครู (Google Gemini AI)
              </h2>
              {isVip ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                  VIP Enabled 👑
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  Free Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              กำหนด API Key และโมเดลกลางประจำโรงเรียน เพื่อให้ครูทุกคนในโรงเรียนใช้งาน AI น้องแคร์ได้ร่วมกัน
            </p>
          </div>
        </div>

        {/* Current status chip */}
        <div className="shrink-0">
          {aiConfig?.apiKey ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              พร้อมใช้งาน ({aiConfig.model})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              โหมดผู้ช่วยแนะนำ (ยังไม่ใส่ Key)
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="mt-5 space-y-4">
        {!isVip ? (
          /* Locked State for Non-VIP */
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs sm:text-sm">
                <p className="font-bold text-amber-900">
                  สิทธิ์การปรับแต่ง Gemini API Key อิสระเป็นสิทธิ์พิเศษสำหรับสมาชิก VIP
                </p>
                <p className="mt-1 text-amber-700 leading-relaxed">
                  ครูทุกคนในโรงเรียนยังคงสามารถกดปุ่ม <strong>"AI น้องแคร์"</strong> ที่มุมขวาล่างเพื่อสอบถามวิธีใช้งานระบบ, ดูคำสั่งลัด, และนำทางได้ตามปกติ
                  หากต้องการให้ AI วิเคราะห์ข้อมูลเชิงลึกอิสระหรือเลือกโมเดล Gemini 2.0 Flash / 1.5 Pro สามารถอัปเกรดเป็นแพ็กเกจ VIP ได้ค่ะ
                </p>
                <div className="mt-3">
                  <Link
                    to="/app/package"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-amber-500 hover:to-indigo-500"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>ดูรายละเอียดแพ็กเกจ VIP</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VIP Unlocked Form */
          <div className="space-y-4">
            {saveNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{saveNotice}</span>
              </div>
            )}

            {/* API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-indigo-600" />
                  Google Gemini API Key ของโรงเรียน
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>รับ API Key ฟรี (Google AI Studio)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  disabled={!isOwnerOrAdmin}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                  {showKey ? 'ซ่อน' : 'แสดง'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                เมื่อใส่ Key นี้ ครูทุกคนในโรงเรียนจะสามารถคุยกับ AI ได้ทันทีโดยไม่ต้องสมัคร Key เอง (ใช้โควต้าฟรี 1,500 ครั้ง/วัน)
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เลือกโมเดล Gemini มาตรฐานของโรงเรียน
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_GEMINI_MODELS.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                      selectedModel === m.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-400'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ws_ai_model"
                      checked={selectedModel === m.id}
                      onChange={() => setSelectedModel(m.id)}
                      disabled={!isOwnerOrAdmin}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{m.name}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.2 rounded">
                          {m.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Test Connection Alert */}
            {testResult && (
              <div
                className={`rounded-xl p-3 text-xs font-bold flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            {isOwnerOrAdmin && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting || !apiKeyInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition active:scale-98"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า AI'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
