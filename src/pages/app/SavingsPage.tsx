import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ArrowDownToLine,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Minus,
  PiggyBank,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { isDemoSession } from '../../lib/auth';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
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
          .select('id,workspace_id,account_id,student_id,transaction_type,amount,transaction_date,note,recorded_by,created_at')
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

        {/* Main Workbench Layout */}
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
                      <span className="text-[11px] font-bold text-[#78716c]">
                        {isAdjustment ? 'ยอดยกมา' : isWithdrawal ? 'ถอน' : 'ฝาก'}
                      </span>
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

        {/* Generous bottom spacer so page can scroll comfortably past bottom dock */}
        <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
      </div>

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
