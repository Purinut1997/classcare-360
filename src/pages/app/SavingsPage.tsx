import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Minus,
  PiggyBank,
  Plus,
  Save,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface SavingsPageProps {
  session: AppSessionContext;
}

type SavingsTransactionType = 'deposit' | 'withdrawal' | 'adjustment';

interface ClassroomRow {
  academic_year: string | null;
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
    transaction_date: new Date().toISOString().slice(0, 10),
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
    transaction_date: new Date().toISOString().slice(0, 10),
    transaction_type: 'withdrawal',
    workspace_id: 'demo-workspace',
  },
];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatBaht(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
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
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [accounts, setAccounts] = useState<SavingsAccountRow[]>(demoAccounts);
  const [transactions, setTransactions] = useState<SavingsTransactionRow[]>(demoTransactions);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [selectedStudentId, setSelectedStudentId] = useState(demoStudents[0].id);
  const [searchTerm, setSearchTerm] = useState('');
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
    const deposits = transactions
      .filter((transaction) => transaction.transaction_type === 'deposit')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const withdrawals = transactions
      .filter((transaction) => transaction.transaction_type === 'withdrawal')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      averageBalance: classroomStudents.length > 0 ? totalBalance / classroomStudents.length : 0,
      deposits,
      totalBalance,
      withdrawals,
    };
  }, [accountByStudent, classroomStudents, transactions]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavingsData() {
      if (!supabase || !session.workspace) {
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
          .select('id,name,academic_year')
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
          .select('id,student_id,balance,status')
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
      const nextClassroomId = getClassroomWithStudents(nextClassrooms, nextStudents);
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
  }, [session.workspace]);

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

    if (!supabase || !session.workspace) {
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
        account?.balance || 0,
        account?.status || 'active',
      ];
    });
    const csv = [
      ['student_code', 'first_name', 'last_name', 'nickname', 'balance', 'status'],
      ...rows,
    ]
      .map((row) => row.map((value) => escapeCsv(value)).join(','))
      .join('\n');

    downloadTextFile(`classcare-savings-${getTodayDate()}.csv`, `\uFEFF${csv}`);
  }

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

        <div className="grid grid-cols-2 gap-2 sm:min-w-[520px] sm:grid-cols-4">
          {[
            { label: 'ยอดรวม', value: `${formatBaht(summary.totalBalance)} ฿` },
            { label: 'เฉลี่ย/คน', value: `${formatBaht(summary.averageBalance)} ฿` },
            { label: 'ฝากรวม', value: `${formatBaht(summary.deposits)} ฿` },
            { label: 'ถอนรวม', value: `${formatBaht(summary.withdrawals)} ฿` },
          ].map((item) => (
            <div className="nexus-card p-3 text-center" key={item.label}>
              <p className="text-xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="grid gap-5">
          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void handleCreateTransaction(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Wallet size={16} aria-hidden="true" />
              บันทึกธุรกรรม
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ห้องเรียน</span>
                <select className="nexus-field mt-2" onChange={(event) => setClassroomId(event.target.value)} value={classroomId}>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </label>
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
                  <input className="nexus-field mt-2" onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} type="date" value={form.transactionDate} />
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
                <h2 className="mt-1 text-2xl font-black text-slate-950">{classroomStudents.length} บัญชีในห้องนี้</h2>
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
                    <th className="px-3 py-3">ยอดคงเหลือ</th>
                    <th className="px-3 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((student) => {
                    const account = accountByStudent.get(student.id);
                    return (
                      <tr className="cursor-pointer hover:bg-slate-50" key={student.id} onClick={() => setSelectedStudentId(student.id)}>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{student.student_code || '-'}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">{student.first_name} {student.last_name}</p>
                          <p className="text-xs font-bold text-slate-500">{student.nickname || 'ไม่มีชื่อเล่น'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-lg font-black text-slate-950">{formatBaht(account?.balance || 0)} ฿</td>
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
              <p className="text-sm font-black text-slate-500">
                ยอดปัจจุบัน {formatBaht(selectedStudent ? accountByStudent.get(selectedStudent.id)?.balance || 0 : 0)} ฿
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              {selectedTransactions.map((transaction) => {
                const isWithdrawal = transaction.transaction_type === 'withdrawal';
                const Icon = isWithdrawal ? TrendingDown : TrendingUp;
                return (
                  <div className="nexus-muted-box flex items-center justify-between gap-3 p-3" key={transaction.id}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white ${isWithdrawal ? 'text-rose-700' : 'text-cyan-700'} shadow-sm`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">{isWithdrawal ? 'ถอน' : 'ฝาก'} {formatBaht(transaction.amount)} ฿</p>
                        <p className="text-xs font-bold text-slate-500">{transaction.transaction_date} | {transaction.note || 'ไม่มีหมายเหตุ'}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${isWithdrawal ? 'bg-rose-50 text-rose-700 ring-rose-100' : 'bg-cyan-50 text-cyan-700 ring-cyan-100'}`}>
                      {transaction.transaction_type}
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
