import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  Download,
  FileSpreadsheet,
  History,
  LayoutGrid,
  ListFilter,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { isDemoSession } from '../../lib/auth';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { getBangkokDate } from '../../lib/date';
import { formatThaiOfficialDate, buildOfficialReportCss, escapeOfficialHtml } from '../../lib/officialReport';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { getClassroomScopeBadge, getTeacherClassroomScope } from '../../lib/teacherClassrooms';
import type { AppSessionContext } from '../../types/core';

interface SavingsPageProps {
  session: AppSessionContext;
}

type SavingsTransactionType = 'deposit' | 'withdrawal' | 'adjustment';

interface ClassroomRow {
  academic_year: string | null;
  homeroom_teacher_profile_id?: string | null;
  id: string;
  name: string;
}

interface StudentRow {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  student_code: string | null;
}

interface SavingsAccountRow {
  id: string;
  student_id: string;
  balance: number;
  status: 'active' | 'frozen' | 'closed';
  metadata?: {
    opening_balance?: number;
    source_grade?: string;
    opening_date?: string;
  } | null;
}

interface SavingsTransactionRow {
  account_id: string | null;
  amount: number;
  created_at: string;
  id: string;
  note: string | null;
  recorded_by: string | null;
  student_id: string;
  transaction_date: string;
  transaction_type: SavingsTransactionType;
  workspace_id: string;
  metadata?: Record<string, unknown> | null;
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
];

const demoAccounts: SavingsAccountRow[] = [
  { balance: 420, id: 'demo-saving-account-1', status: 'active', student_id: 'demo-student-1' },
  { balance: 260, id: 'demo-saving-account-2', status: 'active', student_id: 'demo-student-2' },
  { balance: 315, id: 'demo-saving-account-3', status: 'active', student_id: 'demo-student-3' },
];

const demoTransactions: SavingsTransactionRow[] = [
  {
    account_id: 'demo-saving-account-1',
    amount: 20,
    created_at: new Date().toISOString(),
    id: 'demo-saving-transaction-1',
    note: 'ฝากประจำวัน',
    recorded_by: 'demo-teacher',
    student_id: 'demo-student-1',
    transaction_date: getBangkokDate(),
    transaction_type: 'deposit',
    workspace_id: 'demo-workspace',
  },
  {
    account_id: 'demo-saving-account-2',
    amount: 10,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    id: 'demo-saving-transaction-2',
    note: 'ถอนซื้ออุปกรณ์',
    recorded_by: 'demo-teacher',
    student_id: 'demo-student-2',
    transaction_date: getBangkokDate(),
    transaction_type: 'withdrawal',
    workspace_id: 'demo-workspace',
  },
];

const NOTE_ROTATIONS = ['rotate-[-1.5deg]', 'rotate-[1deg]', 'rotate-[-0.8deg]', 'rotate-[1.8deg]', 'rotate-[-1deg]', 'rotate-[0.8deg]'];

function getTodayDate() {
  return getBangkokDate();
}

function formatBaht(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
}

function numberToThaiBahtText(num: number): string {
  if (isNaN(num) || num === 0) return 'ศูนย์บาทถ้วน';
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const [intStr] = Math.abs(num).toFixed(2).split('.');
  let result = '';
  const len = intStr.length;

  for (let i = 0; i < len; i++) {
    const digit = Number(intStr[i]);
    const pos = len - i - 1;
    if (digit !== 0) {
      if (pos === 1 && digit === 1) {
        result += 'สิบ';
      } else if (pos === 1 && digit === 2) {
        result += 'ยี่สิบ';
      } else if (pos === 0 && digit === 1 && len > 1 && intStr[i - 1] !== '0') {
        result += 'เอ็ด';
      } else {
        result += digits[digit] + positions[pos];
      }
    }
  }
  return (num < 0 ? 'ลบ' : '') + result + 'บาทถ้วน';
}

function escapeCsv(value: string | number | null) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getClassroomWithStudents(classrooms: ClassroomRow[], students: StudentRow[]) {
  const classroomWithStudents = classrooms.find((classroom) =>
    students.some((student) => student.classroom_id === classroom.id),
  );

  return classroomWithStudents?.id || classrooms[0]?.id || '';
}

export function SavingsPage({ session }: SavingsPageProps) {
  const demoMode = isDemoSession(session);
  const location = useLocation();
  const requestedClassroomId = useMemo(() => new URLSearchParams(location.search).get('classroomId'), [location.search]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [accounts, setAccounts] = useState<SavingsAccountRow[]>(demoMode ? demoAccounts : []);
  const [transactions, setTransactions] = useState<SavingsTransactionRow[]>(demoMode ? demoTransactions : []);
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [selectedStudentId, setSelectedStudentId] = useState(demoMode ? demoStudents[0]?.id || '' : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'homeroom' | 'all'>('homeroom');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration เพื่อบันทึกเงินออมจริง',
  );
  const [form, setForm] = useState({
    amount: '20',
    note: '',
    transactionDate: getTodayDate(),
    transactionType: 'deposit' as SavingsTransactionType,
  });

  // Cute Post-it Board states
  const [viewMode, setViewMode] = useState<'board' | 'ledger'>('board');
  const [draftDeposits, setDraftDeposits] = useState<Record<string, number>>({});
  const [selectedPresetAmount, setSelectedPresetAmount] = useState<number>(20);
  const [customPresetAmount, setCustomPresetAmount] = useState('20');
  const [sheetStudent, setSheetStudent] = useState<StudentRow | null>(null);
  const [correctionTransaction, setCorrectionTransaction] = useState<SavingsTransactionRow | null>(null);
  const [isCancellingTransaction, setIsCancellingTransaction] = useState(false);
  const [cancellationCode, setCancellationCode] = useState('');
  const [cancellationCodeInput, setCancellationCodeInput] = useState('');
  const [correctionForm, setCorrectionForm] = useState({ amount: '', date: getTodayDate(), reason: '', studentId: '', type: 'deposit' as 'deposit' | 'withdrawal' });
  const [sheetForm, setSheetForm] = useState({
    amount: '20',
    note: '',
    transactionType: 'deposit' as SavingsTransactionType,
  });

  // Batch Opening Balance states
  const [isBatchOpeningModalOpen, setIsBatchOpeningModalOpen] = useState(false);
  const [batchOpeningAmounts, setBatchOpeningAmounts] = useState<Record<string, string>>({});
  const [batchSourceGrade, setBatchSourceGrade] = useState('ป.4/1');
  const [batchOpeningDate, setBatchOpeningDate] = useState(() => getTodayDate());
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchPasteInput, setBatchPasteInput] = useState('');

  const teacherScope = useMemo(
    () => getTeacherClassroomScope(session, classrooms),
    [session, classrooms],
  );

  const displayClassrooms = useMemo(() => {
    if (scopeFilter === 'homeroom' && teacherScope.hasHomeroom) {
      return teacherScope.homeroomClassrooms;
    }
    return classrooms;
  }, [classrooms, scopeFilter, teacherScope]);
  const correctionEligibleStudents = useMemo(
    () => students.filter((student) => displayClassrooms.some((classroom) => classroom.id === student.classroom_id)),
    [displayClassrooms, students],
  );

  useEffect(() => {
    if (requestedClassroomId && displayClassrooms.some((classroom) => classroom.id === requestedClassroomId)) {
      setClassroomId(requestedClassroomId);
    }
  }, [displayClassrooms, requestedClassroomId]);

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

  const accountByStudent = useMemo(() => new Map(accounts.map((account) => [account.student_id, account])), [accounts]);

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return classroomStudents;
    return classroomStudents.filter((student) =>
      [student.student_code, student.first_name, student.last_name, student.nickname]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [classroomStudents, searchTerm]);

  const selectedStudent = useMemo(
    () => classroomStudents.find((student) => student.id === selectedStudentId) || classroomStudents[0] || null,
    [classroomStudents, selectedStudentId],
  );

  const selectedTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.student_id === selectedStudent?.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [selectedStudent?.id, transactions],
  );

  const summary = useMemo(() => {
    const balances = classroomStudents.map((student) => accountByStudent.get(student.id)?.balance || 0);
    const totalBalance = balances.reduce((sum, balance) => sum + balance, 0);

    // Opening balances sum from metadata
    const openingTotal = classroomStudents.reduce((sum, student) => {
      const acc = accountByStudent.get(student.id);
      return sum + Number(acc?.metadata?.opening_balance || 0);
    }, 0);

    const deposits = transactions
      .filter((transaction) => transaction.transaction_type === 'deposit')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const withdrawals = transactions
      .filter((transaction) => transaction.transaction_type === 'withdrawal')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      averageBalance: classroomStudents.length > 0 ? totalBalance / classroomStudents.length : 0,
      deposits,
      openingTotal,
      totalBalance,
      withdrawals,
    };
  }, [accountByStudent, classroomStudents, transactions]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavingsData() {
      if (!supabase || !session.workspace || demoMode) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setAccounts(demoAccounts);
        setTransactions(demoTransactions);
        setClassroomId(demoClassrooms[0].id);
        setSelectedStudentId(demoStudents[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: accountRows, error: accountError },
        { data: transactionRows, error: transactionError },
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id,name,academic_year,homeroom_teacher_profile_id')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active')
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,classroom_id')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active')
          .order('student_code', { ascending: true }),
        supabase
          .from('savings_accounts')
          .select('id,student_id,balance,status,metadata')
          .eq('workspace_id', session.workspace.id),
        supabase
          .from('savings_transactions')
          .select('id,workspace_id,account_id,student_id,transaction_type,amount,transaction_date,note,recorded_by,created_at,metadata')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false })
          .limit(120),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || accountError || transactionError) {
        setNotice(
          classroomError?.message ||
            studentError?.message ||
            accountError?.message ||
            transactionError?.message ||
            'โหลดข้อมูลเงินออมไม่สำเร็จ',
        );
        setIsLoading(false);
        return;
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const initialScope = getTeacherClassroomScope(session, nextClassrooms);
      const nextClassroomId = initialScope.hasHomeroom
        ? initialScope.homeroomClassrooms[0].id
        : getClassroomWithStudents(nextClassrooms, nextStudents);
      const nextSelectedStudentId =
        nextStudents.find((student) => student.classroom_id === nextClassroomId)?.id || nextStudents[0]?.id || '';
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setAccounts((accountRows || []) as SavingsAccountRow[]);
      setTransactions((transactionRows || []) as SavingsTransactionRow[]);
      setClassroomId(nextClassroomId);
      setSelectedStudentId(nextSelectedStudentId);
      setIsLoading(false);
    }

    void loadSavingsData();

    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace]);

  useEffect(() => {
    const selectedStudentInClassroom = classroomStudents.some((student) => student.id === selectedStudentId);
    if (!selectedStudentInClassroom && classroomStudents[0]) setSelectedStudentId(classroomStudents[0].id);
  }, [classroomStudents, selectedStudentId]);

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนบันทึกเงินออม');
      setIsSubmitting(false);
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice('จำนวนเงินต้องมากกว่า 0');
      setIsSubmitting(false);
      return;
    }

    const currentAccount = accountByStudent.get(selectedStudent.id);
    const signedAmount = form.transactionType === 'withdrawal' ? -amount : amount;
    const nextBalance = (currentAccount?.balance || 0) + signedAmount;

    if (nextBalance < 0) {
      setNotice('ยอดถอนมากกว่ายอดคงเหลือ');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace || isDemoSession(session)) {
      const accountId = currentAccount?.id || `demo-saving-account-${Date.now()}`;
      const transaction: SavingsTransactionRow = {
        account_id: accountId,
        amount,
        created_at: new Date().toISOString(),
        id: `demo-saving-transaction-${Date.now()}`,
        note: form.note.trim() || null,
        recorded_by: session.profile.id,
        student_id: selectedStudent.id,
        transaction_date: form.transactionDate,
        transaction_type: form.transactionType,
        workspace_id: session.workspace?.id || 'demo-workspace',
      };

      setAccounts((current) => {
        const existing = current.find((account) => account.student_id === selectedStudent.id);
        if (!existing) {
          return [...current, { balance: nextBalance, id: accountId, status: 'active', student_id: selectedStudent.id }];
        }
        return current.map((account) =>
          account.student_id === selectedStudent.id ? { ...account, balance: nextBalance } : account,
        );
      });
      setTransactions((current) => [transaction, ...current]);
      setNotice('บันทึกเงินออมในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data: accountData, error: accountError } = await supabase
      .from('savings_accounts')
      .upsert(
        {
          balance: nextBalance,
          status: 'active',
          student_id: selectedStudent.id,
          workspace_id: session.workspace.id,
        },
        { onConflict: 'workspace_id,student_id' },
      )
      .select('id,student_id,balance,status')
      .single();

    if (accountError) {
      setNotice(accountError.message);
      setIsSubmitting(false);
      return;
    }

    const account = accountData as SavingsAccountRow;
    const { data: transactionData, error: transactionError } = await supabase
      .from('savings_transactions')
      .insert({
        account_id: account.id,
        amount,
        note: form.note.trim() || null,
        recorded_by: session.profile.id,
        student_id: selectedStudent.id,
        transaction_date: form.transactionDate,
        transaction_type: form.transactionType,
        workspace_id: session.workspace.id,
      })
      .select('id,workspace_id,account_id,student_id,transaction_type,amount,transaction_date,note,recorded_by,created_at')
      .single();

    if (transactionError) {
      setNotice(transactionError.message);
      setIsSubmitting(false);
      return;
    }

    setAccounts((current) => {
      const hasAccount = current.some((item) => item.id === account.id);
      if (!hasAccount) return [...current, account];
      return current.map((item) => (item.id === account.id ? account : item));
    });
    const transaction = transactionData as SavingsTransactionRow;
    await writeAuditLog(session, {
      action: 'savings_transaction.created',
      entityId: transaction.id,
      entityTable: 'savings_transactions',
      metadata: {
        amount: transaction.amount,
        balance_after: account.balance,
        student_id: transaction.student_id,
        transaction_type: transaction.transaction_type,
      },
      riskLevel: transaction.transaction_type === 'withdrawal' ? 'normal' : 'low',
      source: 'savings_center',
    });
    setTransactions((current) => [transaction, ...current]);
    setNotice('บันทึกเงินออมแล้ว');
    setIsSubmitting(false);
  }

  async function handleCorrectSavingsTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correctionTransaction || !session.workspace) return;
    const amount = Number(correctionForm.amount);
    const replacementStudent = students.find((student) => student.id === correctionForm.studentId);
    if (isCancellingTransaction && cancellationCodeInput !== cancellationCode) {
      setNotice('รหัสยืนยันไม่ถูกต้อง กรุณาตรวจรหัสแล้วลองอีกครั้ง');
      return;
    }
    if (!replacementStudent || !Number.isFinite(amount) || amount < 0 || amount > 9999999999.99 || !correctionForm.reason.trim()) {
      setNotice('กรุณาตรวจนักเรียน จำนวนเงิน และเหตุผลการแก้ไข');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);

    try {
      let original: SavingsTransactionRow;
      let reversal: SavingsTransactionRow;
      let replacement: SavingsTransactionRow | null = null;
      let sourceBalance = 0;
      let targetBalance = 0;

      if (!supabase || isDemoSession(session)) {
        const sourceAccount = accountByStudent.get(correctionTransaction.student_id);
        const targetAccount = accountByStudent.get(replacementStudent.id);
        const originalSigned = correctionTransaction.transaction_type === 'withdrawal' ? -correctionTransaction.amount : correctionTransaction.amount;
        const reversalSigned = -originalSigned;
        const replacementSigned = amount === 0 ? 0 : correctionForm.type === 'withdrawal' ? -amount : amount;
        sourceBalance = (sourceAccount?.balance || 0) + reversalSigned;
        targetBalance = replacementStudent.id === correctionTransaction.student_id
          ? sourceBalance + replacementSigned
          : (targetAccount?.balance || 0) + replacementSigned;
        if (sourceBalance < 0 || targetBalance < 0) throw new Error('ยอดของนักเรียนเดิมถูกใช้ไปแล้ว จึงย้อนรายการให้ยอดติดลบไม่ได้ กรุณาตรวจสอบก่อนแก้ไข');
        const now = new Date().toISOString();
        const reversalType = correctionTransaction.transaction_type === 'withdrawal' ? 'deposit' : 'withdrawal';
        reversal = { ...correctionTransaction, account_id: sourceAccount?.id || null, amount: correctionTransaction.amount, created_at: now, id: `demo-reversal-${Date.now()}`, note: `ย้อนรายการเดิม: ${correctionForm.reason.trim()}`, recorded_by: session.profile.id, transaction_type: reversalType, metadata: { correction_of: correctionTransaction.id, correction_role: 'reversal' } };
        if (amount > 0) {
          replacement = { ...correctionTransaction, account_id: targetAccount?.id || `demo-account-${replacementStudent.id}`, amount, created_at: now, id: `demo-replacement-${Date.now()}`, note: `รายการที่แก้ไขแทน: ${correctionForm.reason.trim()}`, recorded_by: session.profile.id, student_id: replacementStudent.id, transaction_date: correctionForm.date, transaction_type: correctionForm.type, metadata: { correction_of: correctionTransaction.id, correction_role: 'replacement' } };
        }
        original = { ...correctionTransaction, metadata: { ...(correctionTransaction.metadata || {}), correction_id: replacement?.id || reversal.id, correction_reversal_id: reversal.id, correction_reason: correctionForm.reason.trim() } };
      } else {
        const { data, error } = await supabase.rpc('correct_savings_transaction', {
          target_workspace_id: session.workspace.id,
          target_transaction_id: correctionTransaction.id,
          replacement_student_id: replacementStudent.id,
          replacement_amount: amount,
          replacement_date: correctionForm.date,
          replacement_type: correctionForm.type,
          correction_reason: correctionForm.reason.trim(),
        });
        if (error) {
          const messages: Record<string, string> = {
            savings_correction_source_balance_insufficient: 'ยอดเงินของนักเรียนเดิมถูกใช้ไปแล้ว จึงย้อนรายการให้ยอดติดลบไม่ได้ กรุณาตรวจสอบก่อนแก้ไข',
            savings_correction_would_make_negative: 'ยอดเงินหลังแก้ไขจะติดลบ กรุณาตรวจสอบยอดและรายการก่อนแก้ไข',
            savings_correction_target_balance_insufficient: 'ยอดของนักเรียนปลายทางไม่พอสำหรับรายการถอน กรุณาตรวจสอบยอดก่อนแก้ไข',
            savings_transaction_already_corrected: 'รายการนี้ถูกแก้ไขไปแล้ว ดูรายการที่เชื่อมโยงในประวัติได้เลย',
            savings_correction_not_allowed: 'บัญชีนี้ไม่มีสิทธิ์แก้รายการเงินออม',
          };
          throw new Error(Object.entries(messages).find(([key]) => error.message.includes(key))?.[1] || error.message);
        }
        const result = data as { original: SavingsTransactionRow; reversal: SavingsTransactionRow; replacement: SavingsTransactionRow | null; source_balance: number; target_balance: number | null };
        original = result.original;
        reversal = result.reversal;
        replacement = result.replacement;
        sourceBalance = Number(result.source_balance || 0);
        targetBalance = Number(result.target_balance ?? 0);
      }

      setTransactions((current) => [reversal, ...(replacement ? [replacement] : []), ...current.map((transaction) => transaction.id === original.id ? original : transaction)]);
      setAccounts((current) => {
        const next = [...current];
        const sourceIndex = next.findIndex((account) => account.student_id === correctionTransaction.student_id);
        if (sourceIndex >= 0) next[sourceIndex] = { ...next[sourceIndex], balance: sourceBalance };
        if (amount > 0) {
          const targetIndex = next.findIndex((account) => account.student_id === replacementStudent.id);
          if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], balance: targetBalance };
          else next.push({ balance: targetBalance, id: replacement?.account_id || `saving-account-${replacementStudent.id}`, status: 'active', student_id: replacementStudent.id });
        }
        return next;
      });
      setCorrectionTransaction(null);
      setIsCancellingTransaction(false);
      setCancellationCode('');
      setCancellationCodeInput('');
      setCorrectionForm({ amount: '', date: getTodayDate(), reason: '', studentId: '', type: 'deposit' });
      setNotice(amount === 0
        ? (isCancellingTransaction ? 'ยกเลิกรายการสำเร็จ ยอดเงินถูกปรับแล้วและเก็บประวัติเดิมไว้' : 'ย้อนรายการสำเร็จ รายการเดิมยังอยู่ในประวัติ และปรับยอดบัญชีแล้ว')
        : 'แก้รายการสำเร็จ ระบบเก็บรายการเดิมและบันทึกประวัติการย้อน/รายการใหม่ไว้แล้ว');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `แก้รายการไม่สำเร็จ: ${String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveDailySavings() {
    const studentIdsToSave = Object.keys(draftDeposits).filter((id) => (draftDeposits[id] || 0) > 0);
    if (studentIdsToSave.length === 0) {
      setNotice('ยังไม่มียอดเงินออมที่ต้องบันทึกในวันนี้ (แตะที่โน้ตของนักเรียนเพื่อใส่ยอดฝาก)');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    const today = getTodayDate();
    let totalDeposited = 0;

    try {
      if (!supabase || !session.workspace || isDemoSession(session)) {
        const newTransactions: SavingsTransactionRow[] = [];
        setAccounts((current) => {
          const updated = [...current];
          studentIdsToSave.forEach((stId) => {
            const amount = draftDeposits[stId] || 0;
            totalDeposited += amount;
            const existingIdx = updated.findIndex((a) => a.student_id === stId);
            const currentAcc = existingIdx >= 0 ? updated[existingIdx] : null;
            const nextBalance = (currentAcc?.balance || 0) + amount;
            const accId = currentAcc?.id || `demo-saving-account-${stId}`;

            const nextAcc: SavingsAccountRow = {
              id: accId,
              student_id: stId,
              balance: nextBalance,
              status: 'active',
              metadata: currentAcc?.metadata || null,
            };

            if (existingIdx >= 0) updated[existingIdx] = nextAcc;
            else updated.push(nextAcc);

            newTransactions.push({
              account_id: accId,
              amount,
              created_at: new Date().toISOString(),
              id: `demo-tx-${Date.now()}-${stId}`,
              note: 'ฝากประจำวัน (บันทึกด่วน)',
              recorded_by: session.profile.id,
              student_id: stId,
              transaction_date: today,
              transaction_type: 'deposit',
              workspace_id: session.workspace?.id || 'demo-workspace',
            });
          });
          return updated;
        });

        setTransactions((current) => [...newTransactions, ...current]);
        setDraftDeposits({});
        setNotice(`✨ บันทึกเงินออมประจำวันเรียบร้อยแล้ว (${studentIdsToSave.length} คน รวม ${formatBaht(totalDeposited)} ฿) [โหมดตัวอย่าง]`);
        setIsSubmitting(false);
        return;
      }

      // Supabase
      const newTransactions: SavingsTransactionRow[] = [];
      const updatedAccounts: SavingsAccountRow[] = [];

      for (const stId of studentIdsToSave) {
        const amount = draftDeposits[stId] || 0;
        totalDeposited += amount;
        const currentAcc = accountByStudent.get(stId);
        const nextBalance = (currentAcc?.balance || 0) + amount;

        const { data: accData, error: accError } = await supabase
          .from('savings_accounts')
          .upsert(
            {
              balance: nextBalance,
              status: 'active',
              student_id: stId,
              workspace_id: session.workspace.id,
              metadata: currentAcc?.metadata || null,
            },
            { onConflict: 'workspace_id,student_id' }
          )
          .select('id,student_id,balance,status,metadata')
          .single();

        if (accError) throw accError;
        const savedAcc = accData as SavingsAccountRow;
        updatedAccounts.push(savedAcc);

        const { data: txData, error: txError } = await supabase
          .from('savings_transactions')
          .insert({
            account_id: savedAcc.id,
            amount,
            note: 'ฝากประจำวัน (บันทึกด่วน)',
            recorded_by: session.profile.id,
            student_id: stId,
            transaction_date: today,
            transaction_type: 'deposit',
            workspace_id: session.workspace.id,
          })
          .select('id,workspace_id,account_id,student_id,transaction_type,amount,transaction_date,note,recorded_by,created_at')
          .single();

        if (txError) throw txError;
        newTransactions.push(txData as SavingsTransactionRow);
      }

      setAccounts((current) => {
        const next = [...current];
        updatedAccounts.forEach((acc) => {
          const idx = next.findIndex((a) => a.id === acc.id);
          if (idx >= 0) next[idx] = acc;
          else next.push(acc);
        });
        return next;
      });

      setTransactions((current) => [...newTransactions, ...current]);
      setDraftDeposits({});
      setNotice(`✨ บันทึกเงินออมประจำวันสำเร็จ (${studentIdsToSave.length} คน รวม ${formatBaht(totalDeposited)} ฿)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`บันทึกเงินออมไม่สำเร็จ: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveSheetStudentTransaction(event: FormEvent) {
    event.preventDefault();
    if (!sheetStudent) return;
    const amount = Number(sheetForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice('จำนวนเงินต้องมากกว่า 0');
      return;
    }
    const currentAccount = accountByStudent.get(sheetStudent.id);
    const signedAmount = sheetForm.transactionType === 'withdrawal' ? -amount : amount;
    const nextBalance = (currentAccount?.balance || 0) + signedAmount;
    if (nextBalance < 0) {
      setNotice('ยอดถอนมากกว่ายอดคงเหลือ');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);

    try {
      if (!supabase || !session.workspace || isDemoSession(session)) {
        const accountId = currentAccount?.id || `demo-saving-account-${sheetStudent.id}`;
        const transaction: SavingsTransactionRow = {
          account_id: accountId,
          amount,
          created_at: new Date().toISOString(),
          id: `demo-tx-${Date.now()}`,
          note: sheetForm.note.trim() || null,
          recorded_by: session.profile.id,
          student_id: sheetStudent.id,
          transaction_date: getTodayDate(),
          transaction_type: sheetForm.transactionType,
          workspace_id: session.workspace?.id || 'demo-workspace',
        };
        setAccounts((current) => {
          const existing = current.find((a) => a.student_id === sheetStudent.id);
          if (!existing) {
            return [...current, { balance: nextBalance, id: accountId, status: 'active', student_id: sheetStudent.id }];
          }
          return current.map((a) => (a.student_id === sheetStudent.id ? { ...a, balance: nextBalance } : a));
        });
        setTransactions((current) => [transaction, ...current]);
        setSheetStudent(null);
        setNotice(`บันทึก${sheetForm.transactionType === 'withdrawal' ? 'ถอนเงิน' : 'ฝากเงิน'}ให้น้อง${sheetStudent.nickname || sheetStudent.first_name}เรียบร้อย [โหมดตัวอย่าง]`);
        return;
      }

      const { data: accountData, error: accountError } = await supabase
        .from('savings_accounts')
        .upsert(
          {
            balance: nextBalance,
            status: 'active',
            student_id: sheetStudent.id,
            workspace_id: session.workspace.id,
          },
          { onConflict: 'workspace_id,student_id' }
        )
        .select('id,student_id,balance,status')
        .single();
      if (accountError) throw accountError;

      const account = accountData as SavingsAccountRow;
      const { data: transactionData, error: transactionError } = await supabase
        .from('savings_transactions')
        .insert({
          account_id: account.id,
          amount,
          note: sheetForm.note.trim() || null,
          recorded_by: session.profile.id,
          student_id: sheetStudent.id,
          transaction_date: getTodayDate(),
          transaction_type: sheetForm.transactionType,
          workspace_id: session.workspace.id,
        })
        .select('id,workspace_id,account_id,student_id,transaction_type,amount,transaction_date,note,recorded_by,created_at')
        .single();
      if (transactionError) throw transactionError;

      setAccounts((current) => {
        const idx = current.findIndex((a) => a.id === account.id);
        if (idx >= 0) {
          const next = [...current];
          next[idx] = account;
          return next;
        }
        return [...current, account];
      });
      setTransactions((current) => [transactionData as SavingsTransactionRow, ...current]);
      setSheetStudent(null);
      setNotice(`บันทึก${sheetForm.transactionType === 'withdrawal' ? 'ถอนเงิน' : 'ฝากเงิน'}ให้น้อง${sheetStudent.nickname || sheetStudent.first_name}สำเร็จ`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`เกิดข้อผิดพลาด: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function exportSavingsCsv() {
    const rows = classroomStudents.map((student) => {
      const account = accountByStudent.get(student.id);
      return [
        student.student_code || '',
        student.first_name,
        student.last_name,
        student.nickname || '',
        account?.metadata?.opening_balance || 0,
        account?.balance || 0,
        account?.status || 'active',
      ];
    });
    const csv = [
      ['student_code', 'first_name', 'last_name', 'nickname', 'opening_balance', 'current_balance', 'status'],
      ...rows,
    ]
      .map((row) => row.map((value) => escapeCsv(value)).join(','))
      .join('\n');

    downloadTextFile(`classcare-savings-${getTodayDate()}.csv`, `\uFEFF${csv}`);
  }

  function handleOpenBatchModal() {
    const initialAmounts: Record<string, string> = {};
    classroomStudents.forEach((student) => {
      const acc = accountByStudent.get(student.id);
      const existingOpening = acc?.metadata?.opening_balance;
      initialAmounts[student.id] = existingOpening !== undefined && existingOpening !== null && existingOpening > 0 ? String(existingOpening) : '';
    });
    setBatchOpeningAmounts(initialAmounts);
    setBatchPasteInput('');
    setIsBatchOpeningModalOpen(true);
  }

  function handlePasteExcel(rawText: string) {
    if (!rawText.trim()) return;
    const lines = rawText.trim().split(/[\r\n]+/);
    const newAmounts: Record<string, string> = { ...batchOpeningAmounts };

    classroomStudents.forEach((student, idx) => {
      if (idx < lines.length) {
        const line = lines[idx].trim();
        const parts = line.split(/[\t,]+/);
        const lastPart = parts[parts.length - 1].replace(/[^0-9.]/g, '');
        const num = parseFloat(lastPart);
        if (!isNaN(num) && num >= 0) {
          newAmounts[student.id] = String(num);
        }
      }
    });

    setBatchOpeningAmounts(newAmounts);
    setBatchPasteInput('');
    setNotice(`นำเข้ายอดเงินจาก Excel สำหรับ ${Math.min(lines.length, classroomStudents.length)} คนเรียบร้อย`);
  }

  async function handleSaveBatchOpeningBalance() {
    setIsBatchSaving(true);
    setNotice(null);

    const updates: Array<{
      studentId: string;
      openingAmount: number;
    }> = [];

    classroomStudents.forEach((student) => {
      const rawVal = batchOpeningAmounts[student.id];
      if (rawVal !== undefined && rawVal !== '') {
        const val = Number(rawVal);
        if (!isNaN(val) && val >= 0) {
          updates.push({ studentId: student.id, openingAmount: val });
        }
      }
    });

    if (updates.length === 0) {
      setNotice('ไม่มีรายการยอดยกมาที่ต้องบันทึก');
      setIsBatchSaving(false);
      return;
    }

    try {
      if (!supabase || !session.workspace || demoMode) {
        setAccounts((current) => {
          const updated = [...current];
          updates.forEach((u) => {
            const idx = updated.findIndex((a) => a.student_id === u.studentId);
            const currentAcc = idx >= 0 ? updated[idx] : null;
            const oldOpening = Number(currentAcc?.metadata?.opening_balance || 0);
            const nextBalance = (currentAcc?.balance || 0) - oldOpening + u.openingAmount;

            const nextAcc: SavingsAccountRow = {
              id: currentAcc?.id || `demo-account-${u.studentId}`,
              student_id: u.studentId,
              balance: Math.max(0, nextBalance),
              status: 'active',
              metadata: {
                opening_balance: u.openingAmount,
                source_grade: batchSourceGrade,
                opening_date: batchOpeningDate,
              },
            };

            if (idx >= 0) updated[idx] = nextAcc;
            else updated.push(nextAcc);
          });
          return updated;
        });

        setIsBatchOpeningModalOpen(false);
        setIsBatchSaving(false);
        const totalSum = updates.reduce((s, u) => s + u.openingAmount, 0);
        setNotice(`บันทึกยอดยกมาเรียบร้อย (${updates.length} คน รวมทั้งสิ้น ${formatBaht(totalSum)} ฿) [โหมดตัวอย่าง]`);
        return;
      }

      for (const u of updates) {
        const currentAcc = accountByStudent.get(u.studentId);
        const oldOpening = Number(currentAcc?.metadata?.opening_balance || 0);
        const nextBalance = (currentAcc?.balance || 0) - oldOpening + u.openingAmount;

        const { data: savedAcc, error: accErr } = await supabase
          .from('savings_accounts')
          .upsert(
            {
              balance: Math.max(0, nextBalance),
              status: 'active',
              student_id: u.studentId,
              workspace_id: session.workspace.id,
              metadata: {
                opening_balance: u.openingAmount,
                source_grade: batchSourceGrade,
                opening_date: batchOpeningDate,
              },
            },
            { onConflict: 'workspace_id,student_id' }
          )
          .select('id,student_id,balance,status,metadata')
          .single();

        if (accErr) throw accErr;

        if (u.openingAmount > 0) {
          const { data: savedTx, error: txErr } = await supabase
            .from('savings_transactions')
            .insert({
              account_id: savedAcc.id,
              amount: u.openingAmount,
              note: `ยอดยกมาจากชั้น ${batchSourceGrade || 'ก่อนหน้า'} (เปิดบัญชีต้นงวด)`,
              recorded_by: session.profile.id,
              student_id: u.studentId,
              transaction_date: batchOpeningDate,
              transaction_type: 'adjustment',
              workspace_id: session.workspace.id,
              metadata: {
                is_opening_balance: true,
                source_grade: batchSourceGrade,
              },
            })
            .select('id,workspace_id,account_id,student_id,transaction_type,amount,transaction_date,note,recorded_by,created_at')
            .single();

          if (!txErr && savedTx) {
            setTransactions((curr) => [savedTx as SavingsTransactionRow, ...curr]);
          }
        }

        setAccounts((curr) => {
          const hasAcc = curr.some((a) => a.id === savedAcc.id);
          if (!hasAcc) return [...curr, savedAcc as SavingsAccountRow];
          return curr.map((a) => (a.id === savedAcc.id ? (savedAcc as SavingsAccountRow) : a));
        });
      }

      await writeAuditLog(session, {
        action: 'savings_batch_opening_balance.saved',
        entityId: classroomId,
        entityTable: 'savings_accounts',
        metadata: {
          classroom_id: classroomId,
          students_count: updates.length,
          source_grade: batchSourceGrade,
          total_opening: updates.reduce((s, u) => s + u.openingAmount, 0),
        },
        riskLevel: 'normal',
        source: 'savings_center',
      });

      const totalSum = updates.reduce((s, u) => s + u.openingAmount, 0);
      setNotice(`บันทึกยอดยกมาสำเร็จ (${updates.length} คน รวมทั้งสิ้น ${formatBaht(totalSum)} ฿)`);
      setIsBatchOpeningModalOpen(false);
    } catch (err: any) {
      setNotice(err?.message || 'บันทึกยอดยกมาไม่สำเร็จ');
    } finally {
      setIsBatchSaving(false);
    }
  }

  function handlePrintHandoverReport() {
    const currentClassroom = classrooms.find((c) => c.id === classroomId);
    const classroomName = currentClassroom?.name || 'ห้องเรียน';
    const schoolName = session.workspace?.schoolName || session.workspace?.name || 'โรงเรียน';
    const academicYear = session.workspace?.academicYear || currentClassroom?.academic_year || '2569';
    const printDate = formatThaiOfficialDate(getTodayDate());

    let totalCarried = 0;
    const tableRowsHtml = classroomStudents.map((s, idx) => {
      const acc = accountByStudent.get(s.id);
      const opening = Number(acc?.metadata?.opening_balance || 0);
      const balance = Number(acc?.balance || 0);
      totalCarried += opening;
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${escapeOfficialHtml(s.student_code || '-')}</td>
          <td>${escapeOfficialHtml(s.first_name)} ${escapeOfficialHtml(s.last_name)}${s.nickname ? ` (${escapeOfficialHtml(s.nickname)})` : ''}</td>
          <td style="text-align: right; font-weight: bold;">${formatBaht(opening)}</td>
          <td style="text-align: right;">${formatBaht(balance)}</td>
          <td style="text-align: center; color: #999;">................................</td>
        </tr>
      `;
    }).join('');

    const thaiBahtText = numberToThaiBahtText(totalCarried);

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบส่งมอบ-รับมอบเงินออมทรัพย์นักเรียน_${escapeOfficialHtml(classroomName)}</title>
  <style>
    ${buildOfficialReportCss({ orientation: 'portrait' })}
    body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; font-size: 14pt; line-height: 1.6; color: #000; padding: 25mm 20mm; }
    .header-box { text-align: center; margin-bottom: 20px; }
    .header-box h2 { margin: 0; font-size: 18pt; font-weight: bold; }
    .header-box h3 { margin: 5px 0 0 0; font-size: 15pt; font-weight: normal; }
    .meta-line { margin: 15px 0; font-size: 13pt; display: flex; justify-content: space-between; }
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12pt; }
    table.data-table th, table.data-table td { border: 1px solid #333; padding: 6px 8px; }
    table.data-table th { background: #f2f2f2; text-align: center; font-weight: bold; }
    .total-box { margin-top: 15px; padding: 10px; border: 1px dashed #444; background: #fafafa; font-size: 13pt; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 12pt; }
    .sig-col { width: 30%; }
    .sig-line { margin-top: 50px; border-bottom: 1px dotted #333; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <h2>บันทึกข้อความการส่งมอบ - รับมอบเงินออมทรัพย์นักเรียน</h2>
    <h3>${escapeOfficialHtml(schoolName)} ประจำปีการศึกษา ${escapeOfficialHtml(academicYear)}</h3>
  </div>

  <div class="meta-line">
    <span><strong>ชั้นเรียน:</strong> ${escapeOfficialHtml(classroomName)}</span>
    <span><strong>จำนวนนักเรียน:</strong> ${classroomStudents.length} คน</span>
    <span><strong>วันที่ส่งมอบ:</strong> ${printDate}</span>
  </div>

  <p style="text-indent: 2.5em; margin-bottom: 15px;">
    ข้าพเจ้าครูประจำชั้นเดิม ได้ทำการตรวจสอบและส่งมอบเงินออมทรัพย์สะสมคงเหลือยกยอดมาจากชั้นเรียนก่อนหน้า ให้แก่ครูประจำชั้นคนใหม่ เพื่อนำเข้าสู่ระบบบัญชีเงินออมทรัพย์นักเรียนของห้องเรียน ${escapeOfficialHtml(classroomName)} ตามบัญชีรายชื่อดังต่อไปนี้:
  </p>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 7%;">ลำดับ</th>
        <th style="width: 14%;">รหัสประจำตัว</th>
        <th style="width: 35%;">ชื่อ - นามสกุล นักเรียน</th>
        <th style="width: 18%;">ยอดยกมา (บาท)</th>
        <th style="width: 13%;">ยอดปัจจุบัน</th>
        <th style="width: 13%;">หมายเหตุ / ลงนาม</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
    <tfoot>
      <tr style="font-weight: bold; background: #f9f9f9;">
        <td colspan="3" style="text-align: right;">รวมยอดยกมาทั้งสิ้น (${classroomStudents.length} คน):</td>
        <td style="text-align: right; color: #000;">${formatBaht(totalCarried)} ฿</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div class="total-box">
    <strong>จำนวนเงินรวมทั้งสิ้น (ตัวอักษร):</strong> ${thaiBahtText} (${formatBaht(totalCarried)} บาท)
  </div>

  <div class="signatures">
    <div class="sig-col">
      <p>ลงชื่อ...............................................</p>
      <p style="margin-top: 5px;">(...............................................)</p>
      <p style="font-weight: bold;">ผู้ส่งมอบ (ครูประจำชั้นเดิม)</p>
      <p>วันที่ ......./......./.......</p>
    </div>
    <div class="sig-col">
      <p>ลงชื่อ...............................................</p>
      <p style="margin-top: 5px;">(${escapeOfficialHtml(session.profile.displayName || 'ครูประจำชั้น')})</p>
      <p style="font-weight: bold;">ผู้รับมอบ (ครูประจำชั้นปัจจุบัน)</p>
      <p>วันที่ ......./......./.......</p>
    </div>
    <div class="sig-col">
      <p>ลงชื่อ...............................................</p>
      <p style="margin-top: 5px;">(...............................................)</p>
      <p style="font-weight: bold;">พยาน / ผู้อำนวยการโรงเรียน</p>
      <p>วันที่ ......./......./.......</p>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=900,height=900');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    }
  }

  const batchTotalSum = useMemo(() => {
    return classroomStudents.reduce((sum, s) => {
      const val = Number(batchOpeningAmounts[s.id] || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [batchOpeningAmounts, classroomStudents]);

  return (
    <main className="app-page min-h-screen pb-64 lg:pb-32 font-['Itim',sans-serif]">
      {/* ======================================================== */}
      {/* CORKBOARD / LINED PAPER CONTAINER (Post-it Theme)         */}
      {/* ======================================================== */}
      <div className="rounded-[32px] border-2 border-[#e6dcce] bg-[#f5efe6] [background-image:repeating-linear-gradient(0deg,transparent_0_27px,#e8dfd2_27px_28px)] p-4 sm:p-7 shadow-md">
        
        {/* Top Header */}
        <header className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-1.5">
              <span>สมุดเงินออมนักเรียน</span>
              <span className="text-xl sm:text-2xl">📌</span>
            </h1>
            <p className="mt-0.5 text-sm sm:text-base font-semibold text-[#44403c]">
              ฝาก ถอน ปรับยอด ดูยอดรวมทั้งห้อง และพิมพ์ใบส่งมอบเงินออม
            </p>
          </div>

          {/* 4 Post-it Stat Memo Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:min-w-[500px]">
            {/* Total Balance */}
            <div className="relative rounded-xl bg-[#d9f99d] p-3 text-center shadow-[2px_4px_6px_rgba(27,62,4,0.18)] rotate-[1deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#1b3e04]">{formatBaht(summary.totalBalance)} ฿</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#1b3e04]">ยอดคงเหลือรวม</p>
            </div>

            {/* Opening Total */}
            <div className="relative rounded-xl bg-[#e9d5ff] p-3 text-center shadow-[2px_4px_6px_rgba(88,28,135,0.18)] -rotate-[1.5deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#581c87]">{formatBaht(summary.openingTotal)} ฿</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#581c87]">ยอดยกมาจากชั้นก่อน</p>
            </div>

            {/* Deposits */}
            <div className="relative rounded-xl bg-[#bae6fd] p-3 text-center shadow-[2px_4px_6px_rgba(3,79,119,0.18)] rotate-[1.5deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#034f77]">{formatBaht(summary.deposits)} ฿</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#034f77]">ฝากเพิ่มรอบนี้</p>
            </div>

            {/* Withdrawals */}
            <div className="relative rounded-xl bg-[#fecdd3] p-3 text-center shadow-[2px_4px_6px_rgba(136,19,55,0.18)] -rotate-[1deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#881337]">{formatBaht(summary.withdrawals)} ฿</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#881337]">ถอนรอบนี้</p>
            </div>
          </div>
        </header>

        {/* Mode Switcher & Filter Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2d5c3] pt-3.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-2xl bg-white/80 p-1 border border-[#c7bca9] shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                viewMode === 'board'
                  ? 'bg-[#332f2b] text-white shadow-xs'
                  : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <LayoutGrid size={15} />
              <span>กระดานออมเงิน 📌</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                viewMode === 'ledger'
                  ? 'bg-[#332f2b] text-white shadow-xs'
                  : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <ListFilter size={15} />
              <span>สมุดบัญชีละเอียด 📋</span>
            </button>
            <Link
              to={`/app/dashboard?view=reports&reportView=savings${classroomId ? `&classroomId=${encodeURIComponent(classroomId)}` : ''}`}
              className="flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-teal-800 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <FileSpreadsheet size={15} aria-hidden="true" />
              <span>รายงานเงินออม</span>
            </Link>
          </div>

          {/* Classroom Selector */}
          <div className="relative inline-flex items-center rotate-[0.8deg] shadow-xs">
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="appearance-none rounded-xl border border-[#c7bca9] bg-white py-1.5 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-[#1c1917] shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {displayClassrooms.map((c) => {
                const badge = getClassroomScopeBadge(c, session.profile.id);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.academic_year ? `(${c.academic_year})` : ''} — {badge.label}
                  </option>
                );
              })}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57534e]" />
          </div>
        </div>

        {/* ======================================================== */}
        {/* POST-IT BOARD MODE                                       */}
        {/* ======================================================== */}
        {viewMode === 'board' && (
          <div className="mt-4">
            {/* Quick Action & Preset Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-2 text-xs font-bold text-teal-900 shadow-2xs">
                  <span className="whitespace-nowrap">กำหนดยอดฝาก</span>
                  <input
                    aria-label="กำหนดยอดฝากเองเป็นบาท"
                    type="number"
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    value={customPresetAmount}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomPresetAmount(value);
                      const amount = Number(value);
                      setSelectedPresetAmount(value.trim() && Number.isFinite(amount) && amount > 0 && amount <= 9999999999.99 && Math.round(amount * 100) / 100 === amount ? amount : 0);
                    }}
                    className="h-6 w-20 rounded-md border border-teal-200 bg-teal-50/60 px-1.5 text-right text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <span>บาท</span>
                </label>
                <span className="px-1 text-[10px] font-bold text-[#8a8178]">ยอดด่วน</span>
                {[10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedPresetAmount(amt);
                      setCustomPresetAmount(String(amt));
                    }}
                    className={`h-8 px-2.5 rounded-xl text-xs font-bold transition active:scale-95 shadow-2xs ${
                      selectedPresetAmount === amt
                        ? 'bg-[#332f2b] text-white ring-2 ring-amber-400'
                        : 'bg-white border border-[#c7bca9] text-[#44403c] hover:bg-amber-50'
                    }`}
                  >
                    +{amt} ฿
                  </button>
                ))}

                <button
                  type="button"
                  disabled={selectedPresetAmount <= 0}
                  onClick={() => {
                    const next: Record<string, number> = {};
                    classroomStudents.forEach((s) => {
                      next[s.id] = selectedPresetAmount;
                    });
                    setDraftDeposits(next);
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border border-lime-400 bg-white text-xs font-bold text-[#1b3e04] hover:bg-lime-50 active:scale-95 transition shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Coins size={13} className="text-[#1b3e04]" />
                  <span>+{selectedPresetAmount} ฿ ทุกคน</span>
                </button>

                {Object.keys(draftDeposits).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftDeposits({})}
                    className="h-8 px-2.5 rounded-xl border border-rose-300 bg-white text-xs font-bold text-[#881337] hover:bg-rose-50 active:scale-95 transition shadow-2xs"
                  >
                    ล้างยอดวันนี้
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenBatchModal}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-indigo-800 hover:bg-indigo-50 active:scale-95 transition shadow-2xs"
                >
                  <ArrowDownToLine size={13} />
                  <span>ยอดยกมา</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintHandoverReport}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border border-[#c7bca9] bg-white text-xs font-bold text-[#44403c] hover:bg-amber-50 active:scale-95 transition shadow-2xs"
                >
                  <Printer size={13} />
                  <span>พิมพ์ใบส่งมอบ</span>
                </button>
              </div>
            </div>

            <p className="mt-1 text-xs sm:text-sm font-medium text-[#57534e]">
              กำหนดยอดที่ช่องด้านบนหรือเลือกยอดด่วน แล้วแตะโน้ตเพื่อใส่ยอดฝาก (แตะซ้ำเพื่อเพิ่มยอด) หรือกด ✏️ เพื่อดูรายละเอียด/ถอนเงิน
            </p>

            {/* Post-it Notes Grid */}
            <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4.5 pt-2">
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const draft = draftDeposits[student.id] || 0;
                const account = accountByStudent.get(student.id);
                const currentBalance = account?.balance || 0;
                const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];
                const hasDeposit = draft > 0;

                // Tone colors
                const bgClass = hasDeposit
                  ? 'bg-[#d9f99d] text-[#1b3e04] shadow-[2px_4px_6px_rgba(27,62,4,0.18)] ring-2 ring-lime-400'
                  : 'bg-[#fef08a] text-[#713f12] shadow-[2px_4px_6px_rgba(113,63,18,0.18)]';

                return (
                  <div
                    key={student.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectedPresetAmount <= 0) return;
                      setDraftDeposits((prev) => {
                        const cur = prev[student.id] || 0;
                        if (cur === 0) return { ...prev, [student.id]: selectedPresetAmount };
                        if (cur === selectedPresetAmount) return { ...prev, [student.id]: selectedPresetAmount * 2 };
                        const next = { ...prev };
                        delete next[student.id];
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (selectedPresetAmount <= 0) return;
                        setDraftDeposits((prev) => {
                          const cur = prev[student.id] || 0;
                          if (cur === 0) return { ...prev, [student.id]: selectedPresetAmount };
                          if (cur === selectedPresetAmount) return { ...prev, [student.id]: selectedPresetAmount * 2 };
                          const next = { ...prev };
                          delete next[student.id];
                          return next;
                        });
                      }
                    }}
                    className={`group relative flex flex-col items-center justify-center rounded-xs sm:rounded-sm p-2 sm:p-2.5 min-h-[74px] sm:min-h-[82px] transition-all select-none active:scale-95 cursor-pointer ${bgClass} ${rotation} hover:scale-105 hover:z-10`}
                    title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (ยอดปัจจุบัน ${formatBaht(currentBalance)} ฿) — แตะเพื่อเพิ่มยอดฝาก +${selectedPresetAmount} ฿`}
                  >
                    {/* Frosted Tape */}
                    <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-7 rounded-[1px] bg-white/70 shadow-2xs backdrop-blur-2xs" />

                    {/* Pencil Edit Icon Button */}
                    <button
                      type="button"
                      aria-label={`แก้ไขเงินออมของ ${student.first_name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetStudent(student);
                        setSheetForm({
                          amount: String(draft > 0 ? draft : selectedPresetAmount),
                          note: '',
                          transactionType: 'deposit',
                        });
                      }}
                      className="absolute top-1 right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white/85 hover:bg-white text-stone-500 hover:text-stone-900 border border-stone-200/70 transition-all cursor-pointer z-20 shadow-2xs hover:scale-115 active:scale-90"
                    >
                      <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>

                    {/* Large Roll Number */}
                    <span className="text-2xl sm:text-3xl font-bold leading-none tracking-tight">
                      {rollNumber}
                    </span>

                    {/* Student Name */}
                    <span className="text-xs sm:text-sm font-bold truncate mt-0.5 max-w-full text-center px-0.5">
                      {student.nickname || student.first_name}
                    </span>

                    {/* Badge: Today Draft Deposit or Current Balance */}
                    <div className="mt-1">
                      {hasDeposit ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1b3e04] px-1.5 py-0.2 text-[10px] sm:text-xs font-bold text-white shadow-2xs animate-in zoom-in-75 duration-100">
                          +{formatBaht(draft)} ฿
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold opacity-75">
                          {currentBalance > 0 ? `${formatBaht(currentBalance)}฿` : '0฿'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {classroomStudents.length === 0 && !isLoading && (
              <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-950">
                <p className="text-base font-bold">ยังไม่มีนักเรียนในห้องนี้</p>
                <p className="mt-1 text-xs text-amber-800/80">กรุณาเพิ่มหรือนำเข้ารายชื่อนักเรียนก่อนบันทึกเงินออม</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* DETAILED LEDGER MODE (Workbench)                         */}
        {/* ======================================================== */}
        {viewMode === 'ledger' && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
            {/* Left Column: Transaction Form & Tools (Deposit Slip Style) */}
            <aside className="grid gap-4">
              {/* Transaction Form Card */}
              <form
                className="relative rounded-2xl border border-[#ded5c6] bg-white/95 p-4 sm:p-5 shadow-sm"
                onSubmit={(event) => void handleCreateTransaction(event)}
              >
                <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-8 rounded-[1px] bg-white/80 shadow-2xs" />

                <div className="flex items-center gap-2 text-sm font-bold text-[#3f3a36] border-b border-[#f0e8dc] pb-2.5">
                  <Wallet size={16} className="text-[#3f3a36]" aria-hidden="true" />
                  <span>บันทึกธุรกรรมเงินออม</span>
                </div>

                <div className="mt-3.5 grid gap-3">
                  {/* Classroom Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#78716c]">ห้องเรียน:</span>
                      {teacherScope.hasHomeroom && (
                        <div className="inline-flex rounded-lg bg-amber-50 p-0.5 text-[11px] font-bold border border-amber-200">
                          <button
                            type="button"
                            onClick={() => {
                              setScopeFilter('homeroom');
                              if (teacherScope.homeroomClassrooms[0]) {
                                setClassroomId(teacherScope.homeroomClassrooms[0].id);
                              }
                            }}
                            className={`rounded-md px-2 py-0.5 transition ${
                              scopeFilter === 'homeroom'
                                ? 'bg-white text-amber-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            ⭐ ที่ปรึกษา
                          </button>
                          <button
                            type="button"
                            onClick={() => setScopeFilter('all')}
                            className={`rounded-md px-2 py-0.5 transition ${
                              scopeFilter === 'all'
                                ? 'bg-white text-slate-800 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            🌐 ทุกห้อง
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        className="h-9.5 w-full appearance-none rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 pr-8 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                        onChange={(event) => setClassroomId(event.target.value)}
                        value={classroomId}
                      >
                        {displayClassrooms.map((classroom) => {
                          const badge = getClassroomScopeBadge(classroom, session.profile.id);
                          return (
                            <option key={classroom.id} value={classroom.id}>
                              {badge.prefix}{classroom.name} — {badge.label}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716c]" />
                    </div>
                  </div>

                  {/* Student Selector */}
                  <div>
                    <span className="text-xs font-bold text-[#78716c] block mb-1">เลือกนักเรียน:</span>
                    <div className="relative">
                      <select
                        className="h-9.5 w-full appearance-none rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 pr-8 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                        onChange={(event) => setSelectedStudentId(event.target.value)}
                        value={selectedStudent?.id || ''}
                      >
                        {classroomStudents.map((student, idx) => (
                          <option key={student.id} value={student.id}>
                            {idx + 1}. {student.first_name} {student.last_name} {student.nickname ? `(${student.nickname})` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716c]" />
                    </div>
                  </div>

                  {/* Type buttons (ฝาก vs ถอน) */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, transactionType: 'deposit' }))}
                      className={`flex h-10 items-center justify-center gap-1 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 ${
                        form.transactionType === 'deposit'
                          ? 'bg-[#d9f99d] text-[#3f6212] ring-2 ring-lime-400 shadow-xs'
                          : 'bg-white border border-[#ded5c6] text-[#78716c] hover:bg-slate-50'
                      }`}
                    >
                      <Plus size={15} />
                      <span>ฝากเงิน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, transactionType: 'withdrawal' }))}
                      className={`flex h-10 items-center justify-center gap-1 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 ${
                        form.transactionType === 'withdrawal'
                          ? 'bg-[#fecdd3] text-[#9f1239] ring-2 ring-rose-400 shadow-xs'
                          : 'bg-white border border-[#ded5c6] text-[#78716c] hover:bg-slate-50'
                      }`}
                    >
                      <Minus size={15} />
                      <span>ถอนเงิน</span>
                    </button>
                  </div>

                  {/* Date & Amount */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#78716c] block mb-1">วันที่:</span>
                      <ThaiDatePicker
                        className="h-9.5 text-xs font-bold text-[#3f3a36]"
                        onValueChange={(value) => setForm((current) => ({ ...current, transactionDate: value }))}
                        value={form.transactionDate}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#78716c] block mb-1">จำนวนเงิน (บาท):</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="เช่น 20"
                        value={form.amount}
                        onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                        className="h-9.5 w-full rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <span className="text-xs font-bold text-[#78716c] block mb-1">หมายเหตุ:</span>
                    <input
                      type="text"
                      placeholder="เช่น ฝากประจำวัน / ถอนซื้อสมุด"
                      value={form.note}
                      onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                      className="h-9.5 w-full rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3f3a36] hover:bg-[#2c2825] text-white text-sm font-bold shadow-[3px_4px_0_#f59e0b] active:translate-y-0.5 active:shadow-[1px_2px_0_#f59e0b] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save size={16} />
                  <span>บันทึกธุรกรรม ✓</span>
                </button>
              </form>

              {/* Quick Tools Sticky Notes */}
              <div className="rounded-2xl border border-[#ded5c6] bg-white/95 p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#3f3a36]">
                  <RotateCcw size={15} className="text-indigo-600" />
                  <span>เครื่องมือจัดการเงินออม</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenBatchModal}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs sm:text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition active:scale-95"
                >
                  <ArrowDownToLine size={15} />
                  <span>บันทึกยอดยกมา (ทั้งห้อง)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintHandoverReport}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
                >
                  <Printer size={15} />
                  <span>พิมพ์ใบส่งมอบเงินออม</span>
                </button>
                <button
                  type="button"
                  onClick={exportSavingsCsv}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-amber-900 hover:bg-amber-100 transition active:scale-95"
                >
                  <Download size={15} />
                  <span>Export ยอดคงเหลือ (Excel)</span>
                </button>
              </div>
            </aside>

            {/* Right Column: Ledger Table & Timeline */}
            <section className="grid gap-5">
              {/* Balances Ledger Table */}
              <div className="rounded-2xl border border-[#ded5c6] bg-white/95 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#f0e8dc] pb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#3f3a36]">
                      สมุดบัญชีเงินออม ({classroomStudents.length} คน)
                    </h2>
                    <p className="text-xs text-[#8a8178]">
                      แตะที่ชื่อนักเรียนเพื่อดูประวัติการฝาก–ถอน
                    </p>
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือเลขที่..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-9 w-full sm:w-56 rounded-xl border border-[#ded5c6] bg-amber-50/40 pl-9 pr-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#f0e8dc] text-left">
                    <thead>
                      <tr className="text-xs font-bold text-[#78716c]">
                        <th className="px-3 py-2.5">ลำดับ</th>
                        <th className="px-3 py-2.5">ชื่อ-สกุล นักเรียน</th>
                        <th className="px-3 py-2.5 text-right">ยอดยกมา</th>
                        <th className="px-3 py-2.5 text-right">ยอดคงเหลือสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e8dc] text-xs sm:text-sm">
                      {filteredStudents.map((student, idx) => {
                        const account = accountByStudent.get(student.id);
                        const opening = Number(account?.metadata?.opening_balance || 0);
                        const isSelected = selectedStudentId === student.id;
                        return (
                          <tr
                            key={student.id}
                            onClick={() => setSelectedStudentId(student.id)}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-amber-100/70 font-bold' : 'hover:bg-amber-50/50'
                            }`}
                          >
                            <td className="px-3 py-2.5 text-[#78716c] font-bold">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="text-[#3f3a36] font-bold">
                                {student.first_name} {student.last_name}
                              </p>
                              <p className="text-[11px] text-[#8a8178]">
                                {student.nickname ? `น้อง${student.nickname}` : student.student_code || '-'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-right text-[#78716c]">
                              {opening > 0 ? `${formatBaht(opening)} ฿` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-base sm:text-lg font-bold text-[#3f3a36]">
                              {formatBaht(account?.balance || 0)} ฿
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transaction Timeline */}
              <div className="rounded-2xl border border-[#ded5c6] bg-white/95 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-[#f0e8dc] pb-2.5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#3f3a36]">
                      ประวัติธุรกรรม: {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'เลือกนักเรียน'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#8a8178]">ยอดเงินปัจจุบัน: </span>
                    <b className="text-base text-[#3f3a36]">
                      {formatBaht(selectedStudent ? accountByStudent.get(selectedStudent.id)?.balance || 0 : 0)} ฿
                    </b>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {selectedTransactions.map((transaction) => {
                    const isWithdrawal = transaction.transaction_type === 'withdrawal';
                    const isAdjustment = transaction.transaction_type === 'adjustment';
                    const Icon = isWithdrawal ? TrendingDown : isAdjustment ? RotateCcw : TrendingUp;
                    return (
                      <div
                        key={transaction.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs sm:text-sm ${
                          isWithdrawal
                            ? 'bg-[#fecdd3]/40 border-rose-200'
                            : isAdjustment
                            ? 'bg-[#e9d5ff]/40 border-purple-200'
                            : 'bg-[#d9f99d]/40 border-lime-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            isWithdrawal ? 'bg-rose-100 text-rose-700' : isAdjustment ? 'bg-purple-100 text-purple-700' : 'bg-lime-100 text-lime-700'
                          }`}>
                            <Icon size={16} />
                          </span>
                          <div>
                            <p className="font-bold text-[#3f3a36]">
                              {isWithdrawal ? 'ถอนเงิน' : isAdjustment ? 'ยอดยกมา / ปรับยอด' : 'ฝากเงิน'}{' '}
                              <b>{formatBaht(transaction.amount)} ฿</b>
                            </p>
                            <p className="text-[11px] text-[#8a8178]">
                              {transaction.transaction_date} | {transaction.note || 'ไม่มีหมายเหตุ'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="text-[11px] font-bold text-[#78716c]">
                            {isAdjustment ? 'ยอดยกมา' : isWithdrawal ? 'ถอน' : 'ฝาก'}
                          </span>
                          {transaction.metadata?.correction_id || transaction.metadata?.correction_of ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              {transaction.metadata?.correction_role === 'reversal' ? 'รายการย้อนกลับ' : transaction.metadata?.correction_role === 'replacement' ? 'รายการแก้ไขแทน' : 'แก้ไขแล้ว'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCancellingTransaction(false);
                                  setCorrectionTransaction(transaction);
                                  setCorrectionForm({
                                    amount: String(transaction.amount),
                                    date: transaction.transaction_date,
                                    reason: '',
                                    studentId: transaction.student_id,
                                    type: transaction.transaction_type === 'withdrawal' ? 'withdrawal' : 'deposit',
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[10px] font-black text-violet-800 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                              >
                                <Pencil size={11} aria-hidden="true" /> แก้รายการ
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const randomValues = new Uint32Array(1);
                                  window.crypto.getRandomValues(randomValues);
                                  setCancellationCode(String(1000 + (randomValues[0] % 9000)));
                                  setCancellationCodeInput('');
                                  setIsCancellingTransaction(true);
                                  setCorrectionTransaction(transaction);
                                  setCorrectionForm({ amount: '0', date: transaction.transaction_date, reason: '', studentId: transaction.student_id, type: 'deposit' });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                              >
                                <Undo2 size={11} aria-hidden="true" /> ยกเลิกรายการ
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {selectedTransactions.length === 0 && (
                    <div className="p-4 text-center text-xs sm:text-sm text-[#8a8178]">
                      ยังไม่มีรายการธุรกรรมของนักเรียนคนนี้
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {correctionTransaction && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" role="presentation">
            <form onSubmit={(event) => void handleCorrectSavingsTransaction(event)} className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="savings-correction-title">
              <header className={`flex items-start justify-between gap-3 border-b p-5 ${isCancellingTransaction ? 'border-rose-100 bg-rose-50/70' : 'border-slate-100 bg-slate-50'}`}>
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-slate-500">สมุดบัญชีเงินออม</p>
                  <h2 id="savings-correction-title" className="mt-1 text-lg font-semibold text-slate-950">{isCancellingTransaction ? 'ยกเลิกรายการเงินออม' : 'แก้รายการเงินออม'}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-600">{isCancellingTransaction ? 'ระบบจะย้อนยอดและเก็บรายการเดิมไว้ในประวัติ' : 'ระบบจะเก็บรายการเดิมและบันทึกการย้อนในประวัติ หากกำหนดยอดใหม่ ระบบจะเพิ่มรายการที่ถูกต้องให้ด้วย'}</p>
                </div>
                <button type="button" onClick={() => { setCorrectionTransaction(null); setIsCancellingTransaction(false); }} className="rounded-xl p-2 text-slate-500 hover:bg-white" aria-label="ปิดหน้าต่างแก้รายการ"><X size={18} /></button>
              </header>
              <div className="grid gap-3 p-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-black text-slate-800">รายการเดิม: {correctionTransaction.transaction_type === 'withdrawal' ? 'ถอน' : correctionTransaction.transaction_type === 'adjustment' ? 'ปรับยอด' : 'ฝาก'} {formatBaht(correctionTransaction.amount)} บาท</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{students.find((student) => student.id === correctionTransaction.student_id)?.first_name || 'นักเรียน'} {students.find((student) => student.id === correctionTransaction.student_id)?.last_name || ''} · {correctionTransaction.transaction_date} · {correctionTransaction.note || 'ไม่มีหมายเหตุ'}</p>
                </div>
                {isCancellingTransaction ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-900">ตรวจให้แน่ใจก่อนยกเลิก</p>
                    <p className="mt-1 text-xs leading-5 text-rose-800">ยอด {formatBaht(correctionTransaction.amount)} บาทจะถูกย้อนออกจากบัญชีนักเรียน ระบบจะเก็บรายการเดิมและเหตุผลไว้ตรวจสอบย้อนหลัง</p>
                    {(() => {
                      const currentBalance = accountByStudent.get(correctionTransaction.student_id)?.balance ?? 0;
                      const nextBalance = currentBalance + (correctionTransaction.transaction_type === 'withdrawal' ? correctionTransaction.amount : -correctionTransaction.amount);
                      return (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                            <span className="block text-slate-500">ยอดปัจจุบัน</span>
                            <span className="mt-0.5 block font-semibold tabular-nums text-slate-900">{formatBaht(currentBalance)} บาท</span>
                          </div>
                          <div className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                            <span className="block text-slate-500">ยอดหลังยกเลิก</span>
                            <span className={`mt-0.5 block font-semibold tabular-nums ${nextBalance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatBaht(nextBalance)} บาท</span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-center">
                        <span className="block text-[10px] font-medium text-slate-500">รหัสยืนยัน</span>
                        <span className="font-mono text-xl font-bold tracking-[0.25em] text-slate-900">{cancellationCode}</span>
                      </div>
                      <label className="grid flex-1 gap-1 text-xs font-semibold text-slate-700">กรอกรหัส 4 หลัก
                        <input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" value={cancellationCodeInput} onChange={(event) => setCancellationCodeInput(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="เช่น 4821" className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-center font-mono text-lg font-bold tracking-[0.25em]" />
                      </label>
                    </div>
                  </div>
                ) : null}
                {!isCancellingTransaction ? (
                  <>
                    <label className="grid gap-1 text-xs font-bold text-slate-700">นักเรียนที่ถูกต้อง
                      <select required disabled={Number(correctionForm.amount) === 0} value={correctionForm.studentId} onChange={(event) => setCorrectionForm((current) => ({ ...current, studentId: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">
                        {correctionEligibleStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}{student.nickname ? ` (${student.nickname})` : ''}</option>)}
                      </select>
                      {Number(correctionForm.amount) === 0 ? <span className="font-medium text-slate-600">ยอด 0 บาทจะย้อนรายการเดิมของนักเรียนคนนี้ โดยไม่สร้างรายการใหม่</span> : null}
                      {teacherScope.hasHomeroom && scopeFilter === 'homeroom' ? <span className="font-medium text-slate-500">ต้องแก้ไปยังห้องอื่น? เลือก “ทุกห้อง” ที่ตัวกรองห้องก่อน</span> : null}
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="grid gap-1 text-xs font-bold text-slate-700">ประเภท
                        <select disabled={Number(correctionForm.amount) === 0} value={correctionForm.type} onChange={(event) => setCorrectionForm((current) => ({ ...current, type: event.target.value as 'deposit' | 'withdrawal' }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">
                          <option value="deposit">ฝากเงิน</option><option value="withdrawal">ถอนเงิน</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-700">จำนวนเงิน (บาท)
                        <input required type="number" min="0" max="9999999999.99" step="0.01" value={correctionForm.amount} onChange={(event) => setCorrectionForm((current) => ({ ...current, amount: event.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-700">วันที่รายการใหม่
                        <input required disabled={Number(correctionForm.amount) === 0} type="date" value={correctionForm.date} onChange={(event) => setCorrectionForm((current) => ({ ...current, date: event.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500" />
                      </label>
                    </div>
                  </>
                ) : null}
                <label className="grid gap-1 text-xs font-bold text-slate-700">{isCancellingTransaction ? 'เหตุผลที่ยกเลิก' : 'เหตุผลที่แก้ไข'}
                  <textarea required maxLength={300} value={correctionForm.reason} onChange={(event) => setCorrectionForm((current) => ({ ...current, reason: event.target.value }))} placeholder={isCancellingTransaction ? 'เช่น บันทึกฝากผิดคน' : 'เช่น บันทึกผิดคน / จำนวนเงินจริง 10 บาท'} className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm font-medium" />
                </label>
                {!isCancellingTransaction && Number(correctionForm.amount) === 0 ? (
                  <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[11px] font-semibold leading-5 text-violet-900">ยอด 0 บาทจะไม่สร้างธุรกรรมยอดศูนย์ แต่ระบบจะลงรายการย้อนธุรกรรมเดิมและเก็บเหตุผลไว้ หากเงินถูกใช้ไปแล้วจนยอดติดลบ ระบบจะไม่ทำรายการ</p>
                ) : !isCancellingTransaction ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-900">ถ้ายอดของนักเรียนเดิมถูกถอนหรือใช้ไปแล้วจนการย้อนทำให้ยอดติดลบ ระบบจะไม่ทำรายการ และให้ตรวจสอบกับผู้ดูแลก่อน</p>
                ) : null}
              </div>
              <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
                <button type="button" onClick={() => { setCorrectionTransaction(null); setIsCancellingTransaction(false); }} disabled={isSubmitting} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white">กลับ</button>
                <button type="submit" disabled={isSubmitting || correctionEligibleStudents.length === 0 || (isCancellingTransaction && cancellationCodeInput !== cancellationCode)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${isCancellingTransaction ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-800 hover:bg-slate-900'}`}>{isSubmitting ? 'กำลังบันทึก…' : isCancellingTransaction ? 'ยืนยันยกเลิกรายการ' : Number(correctionForm.amount) === 0 ? 'ตรวจและย้อนรายการเดิม' : 'ตรวจและบันทึกการแก้ไข'}</button>
              </footer>
            </form>
          </div>
        )}

        {/* Generous bottom spacer so page can scroll comfortably past bottom dock */}
        <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
      </div>

      {/* ======================================================== */}
      {/* FLOATING ACTION DOCK: Matches Style 5                      */}
      {/* ======================================================== */}
      {viewMode === 'board' && classroomStudents.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-[#c7bca9] bg-[#fbf8f3]/95 p-3.5 shadow-xl backdrop-blur-md">
          {/* Summary Text */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-sm sm:text-base font-bold text-[#1c1917]">
            <span>
              ฝากวันนี้ <b className="text-[#1b3e04]">{Object.keys(draftDeposits).filter((id) => (draftDeposits[id] || 0) > 0).length} คน</b>
            </span>
            <span>·</span>
            <span>
              รวมยอด <b className="text-[#1b3e04]">{formatBaht(Object.values(draftDeposits).reduce((sum, v) => sum + (v || 0), 0))} ฿</b>
            </span>
          </div>

          {/* Big Charcoal Button with Golden Shadow */}
          <button
            type="button"
            onClick={() => void handleSaveDailySavings()}
            disabled={isSubmitting || Object.keys(draftDeposits).filter((id) => (draftDeposits[id] || 0) > 0).length === 0}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#332f2b] text-base font-bold text-white shadow-[0_5px_0_#d97706] hover:bg-[#252220] active:translate-y-1 active:shadow-[0_2px_0_#d97706] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <span>บันทึกเงินออมเรียบร้อย</span>
                <Check size={20} className="stroke-[3]" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* SINGLE STUDENT QUICK TRANSACTION MODAL                     */}
      {/* ======================================================== */}
      {sheetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-3xl border border-[#ded5c6] bg-[#fbf8f3] p-5 shadow-2xl flex flex-col font-['Itim',sans-serif]">
            <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-12 rounded-[1px] bg-white/80 shadow-2xs" />
            <div className="flex items-center justify-between border-b border-[#f0e8dc] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#3f3a36]">
                  {sheetStudent.first_name} {sheetStudent.last_name}
                </h3>
                <p className="text-xs text-[#8a8178]">
                  {sheetStudent.nickname ? `น้อง${sheetStudent.nickname}` : 'นักเรียน'} · ยอดคงเหลือปัจจุบัน: {formatBaht(accountByStudent.get(sheetStudent.id)?.balance || 0)} ฿
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetStudent(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveSheetStudentTransaction(e)} className="mt-3.5 space-y-3">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSheetForm((prev) => ({ ...prev, transactionType: 'deposit' }))}
                  className={`h-9 rounded-xl text-xs font-bold transition ${
                    sheetForm.transactionType === 'deposit'
                      ? 'bg-[#d9f99d] text-[#1b3e04] ring-2 ring-lime-400 shadow-xs'
                      : 'bg-white border border-[#ded5c6] text-[#78716c]'
                  }`}
                >
                  ฝากเงิน (+)
                </button>
                <button
                  type="button"
                  onClick={() => setSheetForm((prev) => ({ ...prev, transactionType: 'withdrawal' }))}
                  className={`h-9 rounded-xl text-xs font-bold transition ${
                    sheetForm.transactionType === 'withdrawal'
                      ? 'bg-[#fecdd3] text-[#881337] ring-2 ring-rose-400 shadow-xs'
                      : 'bg-white border border-[#ded5c6] text-[#78716c]'
                  }`}
                >
                  ถอนเงิน (-)
                </button>
              </div>

              {/* Amount Quick Presets */}
              <div className="flex items-center gap-1.5">
                {[10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSheetForm((prev) => ({ ...prev, amount: String(amt) }))}
                    className="flex-1 h-8 rounded-lg border border-[#ded5c6] bg-white text-xs font-bold text-[#3f3a36] hover:bg-amber-50 active:scale-95 transition"
                  >
                    {amt}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-xs font-bold text-[#78716c] block mb-1">จำนวนเงิน (บาท):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={sheetForm.amount}
                  onChange={(e) => setSheetForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 px-3 text-base font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-bold text-[#78716c] block mb-1">หมายเหตุ:</label>
                <input
                  type="text"
                  placeholder="เช่น ฝากประจำวัน / ถอนซื้ออุปกรณ์"
                  value={sheetForm.note}
                  onChange={(e) => setSheetForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 px-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3f3a36] text-white text-sm font-bold shadow-[2px_3px_0_#f59e0b] hover:bg-[#2c2825] active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายการ ✓'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Batch Opening Balance Modal */}
      {isBatchOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl rounded-3xl border border-[#ded5c6] bg-[#fbf8f3] p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#f0e8dc] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#3f3a36]">
                  ตั้งค่ายอดยกมาจากปีก่อนหน้า (Opening Balance)
                </h3>
                <p className="text-xs text-[#8a8178]">
                  {classrooms.find((c) => c.id === classroomId)?.name || 'ห้องเรียน'} · กรอกยอดเงินยกมาของนักเรียนแต่ละคน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchOpeningModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {classroomStudents.map((student, idx) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[#ded5c6] bg-white text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[11px] font-bold text-amber-900">
                        {idx + 1}
                      </span>
                      <p className="truncate font-bold text-[#3f3a36]">
                        {student.first_name} {student.last_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={batchOpeningAmounts[student.id] ?? ''}
                        onChange={(e) =>
                          setBatchOpeningAmounts((prev) => ({
                            ...prev,
                            [student.id]: e.target.value,
                          }))
                        }
                        className="h-8 w-24 rounded-lg border border-[#ded5c6] px-2 text-right text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-[#78716c]">฿</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#f0e8dc] pt-3">
              <p className="text-xs sm:text-sm text-[#78716c]">
                ยอดรวมยกมาทั้งห้อง: <b className="text-base text-[#3f3a36]">{formatBaht(batchTotalSum)} ฿</b>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchOpeningModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-[#78716c] hover:bg-slate-100"
                  disabled={isBatchSaving}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveBatchOpeningBalance}
                  disabled={isBatchSaving}
                  className="rounded-xl bg-[#3f3a36] px-5 py-2 text-xs font-bold text-white shadow-[2px_3px_0_#f59e0b] hover:bg-slate-800 disabled:opacity-50"
                >
                  {isBatchSaving ? 'กำลังบันทึก...' : `บันทึกยอดยกมา (${classroomStudents.length} คน)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-950 font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-amber-800 hover:text-amber-950">
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
