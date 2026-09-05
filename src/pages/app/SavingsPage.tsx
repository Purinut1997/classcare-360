import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
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
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [accounts, setAccounts] = useState<SavingsAccountRow[]>(demoAccounts);
  const [transactions, setTransactions] = useState<SavingsTransactionRow[]>(demoTransactions);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [selectedStudentId, setSelectedStudentId] = useState(demoStudents[0].id);
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
    <main className="app-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <PiggyBank size={16} aria-hidden="true" />
            Savings Center
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            เงินออมนักเรียนแบบแยกบัญชีรายคนและตรวจย้อนหลังได้
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            ฝาก ถอน ปรับยอด ดูยอดรวมทั้งห้อง และ export รายชื่อนักเรียนพร้อมยอดคงเหลือ โดยทุกธุรกรรมผูกกับ workspace และผู้บันทึก
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[560px] sm:grid-cols-4">
          <div className="nexus-card p-3 text-center border-l-4 border-l-cyan-600">
            <p className="text-xl font-black text-slate-950">{formatBaht(summary.totalBalance)} ฿</p>
            <p className="mt-1 text-xs font-black text-cyan-700">ยอดคงเหลือรวม</p>
          </div>
          <div className="nexus-card p-3 text-center border-l-4 border-l-indigo-600">
            <p className="text-xl font-black text-indigo-700">{formatBaht(summary.openingTotal)} ฿</p>
            <p className="mt-1 text-xs font-black text-indigo-600">ยอดยกมาจากชั้นก่อน</p>
          </div>
          <div className="nexus-card p-3 text-center border-l-4 border-l-emerald-600">
            <p className="text-xl font-black text-emerald-700">{formatBaht(summary.deposits)} ฿</p>
            <p className="mt-1 text-xs font-black text-emerald-600">ฝากเพิ่มรอบนี้</p>
          </div>
          <div className="nexus-card p-3 text-center border-l-4 border-l-rose-600">
            <p className="text-xl font-black text-rose-700">{formatBaht(summary.withdrawals)} ฿</p>
            <p className="mt-1 text-xs font-black text-rose-600">ถอนรอบนี้</p>
          </div>
        </div>
      </div>

      <section className="app-workbench">
        <aside className="grid gap-4">
          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void handleCreateTransaction(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Wallet size={16} aria-hidden="true" />
              บันทึกธุรกรรม
            </div>
            <div className="mt-4 grid gap-3">
              <div className="block">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-500">ห้องเรียน</span>
                  {teacherScope.hasHomeroom && (
                    <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-black">
                      <button
                        type="button"
                        onClick={() => {
                          setScopeFilter('homeroom');
                          if (teacherScope.homeroomClassrooms[0]) {
                            setClassroomId(teacherScope.homeroomClassrooms[0].id);
                          }
                        }}
                        className={`rounded-lg px-2 py-0.5 transition ${
                          scopeFilter === 'homeroom'
                            ? 'bg-white text-cyan-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ⭐ ที่ปรึกษา ({teacherScope.homeroomClassrooms.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScopeFilter('all')}
                        className={`rounded-lg px-2 py-0.5 transition ${
                          scopeFilter === 'all'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🌐 ทุกห้อง
                      </button>
                    </div>
                  )}
                </div>
                <select className="nexus-field mt-2" onChange={(event) => setClassroomId(event.target.value)} value={classroomId}>
                  {displayClassrooms.map((classroom) => {
                    const badge = getClassroomScopeBadge(classroom, session.profile.id);
                    return (
                      <option key={classroom.id} value={classroom.id}>
                        {badge.prefix}{classroom.name} — {badge.label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">นักเรียน</span>
                <select className="nexus-field mt-2" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudent?.id || ''}>
                  {classroomStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.student_code || '-'} {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`h-11 rounded-2xl px-4 text-sm font-black transition ${
                    form.transactionType === 'deposit' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                  onClick={() => setForm((current) => ({ ...current, transactionType: 'deposit' }))}
                  type="button"
                >
                  <Plus className="mr-1 inline" size={16} aria-hidden="true" />
                  ฝาก
                </button>
                <button
                  className={`h-11 rounded-2xl px-4 text-sm font-black transition ${
                    form.transactionType === 'withdrawal' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                  onClick={() => setForm((current) => ({ ...current, transactionType: 'withdrawal' }))}
                  type="button"
                >
                  <Minus className="mr-1 inline" size={16} aria-hidden="true" />
                  ถอน
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">วันที่</span>
                  <ThaiDatePicker className="mt-2" onValueChange={(value) => setForm((current) => ({ ...current, transactionDate: value }))} value={form.transactionDate} />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">จำนวนเงิน</span>
                  <input className="nexus-field mt-2" min="1" onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} type="number" value={form.amount} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">หมายเหตุ</span>
                <input className="nexus-field mt-2" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="เช่น ฝากประจำวัน / ถอนซื้ออุปกรณ์" value={form.note} />
              </label>
            </div>
            <button className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isSubmitting || isLoading} type="submit">
              <Save size={17} aria-hidden="true" />
              บันทึกธุรกรรม
            </button>
          </form>

          <div className="nexus-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-indigo-700">
              <RotateCcw size={16} aria-hidden="true" />
              การจัดการยอดยกมา
            </div>
            <p className="text-xs font-bold leading-6 text-slate-600">
              มีเงินออมสะสมส่งต่อมาจาก ป.4 หรือปีก่อนหน้า? ใช้ระบบยอดยกมาเพื่อเปิดบัญชีพร้อมกันทั้งห้อง
            </p>
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-black text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700"
              onClick={handleOpenBatchModal}
              type="button"
            >
              <ArrowDownToLine size={17} aria-hidden="true" />
              บันทึกยอดยกมา (ทั้งห้อง)
            </button>
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              onClick={handlePrintHandoverReport}
              type="button"
            >
              <Printer size={17} aria-hidden="true" />
              พิมพ์ใบส่งมอบเงินออม
            </button>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-teal-700">
              <ShieldCheck size={16} aria-hidden="true" />
              Audit Ready
            </div>
            <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
              เงินออมควรห้ามลบธุรกรรมจริงใน production ให้ใช้รายการ adjustment และ audit log แทน เพื่อให้ครูตรวจย้อนหลังได้ครบ
            </p>
            <button className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={exportSavingsCsv} type="button">
              <Download size={17} aria-hidden="true" />
              Export ยอดคงเหลือ
            </button>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">Classroom Balances</p>
                <div className="flex items-center gap-3">
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{classroomStudents.length} บัญชีในห้องนี้</h2>
                  <button
                    onClick={handleOpenBatchModal}
                    className="mt-1 inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100"
                    title="บันทึกยอดยกมาพร้อมกันทั้งห้อง"
                  >
                    <ArrowDownToLine size={13} />
                    ยกยอดมา
                  </button>
                </div>
              </div>
              <label className="flex min-h-11 min-w-[260px] items-center gap-2 rounded-2xl bg-white/80 px-3 ring-1 ring-slate-200">
                <Search className="shrink-0 text-slate-400" size={17} aria-hidden="true" />
                <input className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none" onChange={(event) => setSearchTerm(event.target.value)} placeholder="ค้นหานักเรียน" value={searchTerm} />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-500">
                    <th className="px-3 py-3">รหัส</th>
                    <th className="px-3 py-3">นักเรียน</th>
                    <th className="px-3 py-3 text-right">ยอดยกมา</th>
                    <th className="px-3 py-3 text-right">ยอดคงเหลือสุทธิ</th>
                    <th className="px-3 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((student) => {
                    const account = accountByStudent.get(student.id);
                    const opening = Number(account?.metadata?.opening_balance || 0);
                    return (
                      <tr className="cursor-pointer hover:bg-slate-50" key={student.id} onClick={() => setSelectedStudentId(student.id)}>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{student.student_code || '-'}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">{student.first_name} {student.last_name}</p>
                          <p className="text-xs font-bold text-slate-500">{student.nickname || 'ไม่มีชื่อเล่น'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-600">
                          {opening > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-black text-indigo-700 ring-1 ring-indigo-100">
                              {formatBaht(opening)} ฿
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">0 ฿</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-lg font-black text-slate-950">{formatBaht(account?.balance || 0)} ฿</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">{account?.status || 'active'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black text-teal-700">Transaction Timeline</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'เลือกนักเรียน'}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-indigo-600">
                  ยอดยกมา: {formatBaht(Number(selectedStudent ? accountByStudent.get(selectedStudent.id)?.metadata?.opening_balance || 0 : 0))} ฿
                </p>
                <p className="text-sm font-black text-slate-700">
                  ยอดปัจจุบัน {formatBaht(selectedStudent ? accountByStudent.get(selectedStudent.id)?.balance || 0 : 0)} ฿
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {selectedTransactions.map((transaction) => {
                const isWithdrawal = transaction.transaction_type === 'withdrawal';
                const isAdjustment = transaction.transaction_type === 'adjustment';
                const Icon = isWithdrawal ? TrendingDown : isAdjustment ? RotateCcw : TrendingUp;
                return (
                  <div className="nexus-muted-box flex items-center justify-between gap-3 p-3" key={transaction.id}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white ${isWithdrawal ? 'text-rose-700' : isAdjustment ? 'text-indigo-700' : 'text-cyan-700'} shadow-sm`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">
                          {isWithdrawal ? 'ถอน' : isAdjustment ? 'ยอดยกมา / ปรับยอด' : 'ฝาก'} {formatBaht(transaction.amount)} ฿
                        </p>
                        <p className="text-xs font-bold text-slate-500">{transaction.transaction_date} | {transaction.note || 'ไม่มีหมายเหตุ'}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${isWithdrawal ? 'bg-rose-50 text-rose-700 ring-rose-100' : isAdjustment ? 'bg-indigo-50 text-indigo-700 ring-indigo-100' : 'bg-cyan-50 text-cyan-700 ring-cyan-100'}`}>
                      {isAdjustment ? 'ยอดยกมา' : transaction.transaction_type}
                    </span>
                  </div>
                );
              })}
              {selectedTransactions.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">ยังไม่มีธุรกรรมของนักเรียนคนนี้</div>
              ) : null}
            </div>
          </div>
        </section>
      </section>

      {/* Batch Opening Balance Modal */}
      {isBatchOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="nexus-card flex max-h-[92vh] w-full max-w-3xl flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 font-black text-sm">
                  <RotateCcw size={18} />
                  บันทึกยอดยกมาจากชั้นเรียนก่อนหน้า
                </div>
                <h3 className="text-xl font-black text-slate-950 mt-1">
                  ตั้งค่ายอดยกมา (Opening Balance) — {classrooms.find((c) => c.id === classroomId)?.name || 'ห้องเรียน'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchOpeningModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-500">ชั้นเรียนเดิมที่ส่งต่อมา</label>
                <input
                  type="text"
                  className="nexus-field mt-1.5"
                  value={batchSourceGrade}
                  onChange={(e) => setBatchSourceGrade(e.target.value)}
                  placeholder="เช่น ป.4/1 หรือ ยอดยกมาจาก ป.4"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase text-slate-500">วันที่ยกยอดมา</label>
                <ThaiDatePicker
                  className="mt-1.5"
                  value={batchOpeningDate}
                  onValueChange={setBatchOpeningDate}
                />
              </div>
            </div>

            {/* Quick paste helper */}
            <div className="mt-3 rounded-2xl bg-indigo-50/60 p-3 border border-indigo-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <FileSpreadsheet size={15} />
                  วางยอดเงินจาก Excel ได้ทั้งแถบ (เรียงตามรายชื่อด้านล่าง)
                </span>
                {batchPasteInput && (
                  <button
                    type="button"
                    onClick={() => handlePasteExcel(batchPasteInput)}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-black text-white hover:bg-indigo-700"
                  >
                    กดนำเข้ายอด
                  </button>
                )}
              </div>
              <input
                type="text"
                className="nexus-field mt-2 bg-white text-xs"
                placeholder="คลิกที่นี่แล้วกด Ctrl + V เพื่อวางตัวเลขจาก Excel (เช่น 500 [Enter] 320 [Enter] ...)"
                value={batchPasteInput}
                onChange={(e) => {
                  setBatchPasteInput(e.target.value);
                  handlePasteExcel(e.target.value);
                }}
              />
            </div>

            {/* Student list grid */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1 border border-slate-100 rounded-2xl">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">ลำดับ</th>
                    <th className="px-3 py-2.5">รหัส</th>
                    <th className="px-3 py-2.5">ชื่อ - นามสกุล</th>
                    <th className="px-3 py-2.5 text-right w-44">ยอดยกมา (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classroomStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 text-slate-500 font-bold">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-600 font-bold">{student.student_code || '-'}</td>
                      <td className="px-3 py-2">
                        <span className="font-black text-slate-900">{student.first_name} {student.last_name}</span>
                        {student.nickname && <span className="text-xs text-slate-500 ml-1.5">({student.nickname})</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="nexus-field h-9 text-right font-black text-slate-950 w-full"
                          placeholder="0"
                          value={batchOpeningAmounts[student.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchOpeningAmounts((prev) => ({ ...prev, [student.id]: val }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="text-sm font-bold text-slate-600">
                นักเรียนทั้งหมด <span className="font-black text-slate-950">{classroomStudents.length}</span> คน | รวมยอดยกมาทั้งห้อง:{' '}
                <span className="text-lg font-black text-indigo-700">{formatBaht(batchTotalSum)} ฿</span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsBatchOpeningModalOpen(false)}
                  className="rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
                  disabled={isBatchSaving}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveBatchOpeningBalance}
                  disabled={isBatchSaving}
                  className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isBatchSaving ? 'กำลังบันทึก...' : `บันทึกยอดยกมา (${classroomStudents.length} คน)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">Created by MIKPURINUT</footer>
    </main>
  );
}
