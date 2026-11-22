import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, DoorOpen, GraduationCap, Lock, Search, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isDemoSession, withDemoContext } from '../../lib/auth';
import { canAccessViewByPlan, usePlanAccessPolicies } from '../../lib/planAccessPolicy';
import { supabase } from '../../lib/supabaseClient';
import { NexusAuroraInline } from '../system/NexusAuroraLoader';
import type { AppNavItem } from '../../routes/appRoutes';
import type { AppSessionContext } from '../../types/core';

interface GlobalSearchProps {
  navItems: AppNavItem[];
  session?: AppSessionContext;
}

interface SearchStudent {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  student_code: string | null;
}

interface SearchClassroom {
  id: string;
  name: string;
}

const MENU_SYNONYMS: Record<string, string> = {
  overview: 'วันนี้ หน้าแรก bento overview แดชบอร์ด',
  'teacher-work': 'เช็กชื่อ มาเรียน ขาด ลา มาสาย คาบเรียน attendance',
  students: 'นักเรียน ทะเบียน ปพ เยี่ยมบ้าน student 360',
  scores: 'คะแนน เกรด สอบ สมุดคะแนน ปพ.5 score',
  'omr-scanner': 'omr กระดาษคำตอบ ตรวจข้อสอบ สแกน ฝน กขคง',
  schedule: 'ตารางสอน คาบ วิชา timetable schedule',
  'academic-hub': 'วิชาการ ปพ.5 ปพ.6 ปพ.7 ปิดเทอม เลื่อนชั้น เกณฑ์ สพฐ',
  'student-health': 'สุขภาพ แปรงฟัน ดื่มนม อาหารกลางวัน น้ำหนัก ส่วนสูง bmi',
  savings: 'ออมทรัพย์ เงินออม ฝาก ถอน บัญชีออมเงิน',
  behavior: 'พฤติกรรม ความประพฤติ คะแนนความประพฤติ',
  'desirable-characteristics': 'คุณลักษณะอันพึงประสงค์ 8 ประการ อ่านคิดเขียน',
  'classroom-operations': 'เวรประจำวัน ปฏิบัติงานห้องเรียน หน้าที่ เวร',
  'parent-access': 'ผู้ปกครอง qr ลิงก์เชิญ ประตู',
  automation: 'แจ้งเตือนเด็กเสี่ยง อัตโนมัติ ขาดติด ตก',
  randomizer: 'สุ่มชื่อ แบ่งกลุ่ม เลขที่ ลำดับนำเสนอ',
  'math-games': 'เกมคณิตศาสตร์ ห้องเรียน',
  reports: 'รายงาน สรุป พิมพ์ ปพ export excel',
  'daily-brief': 'สรุปประจำวัน ส่งผอ ประจำวัน',
  'school-calendar': 'ปฏิทินโรงเรียน วันหยุด กิจกรรม เปิดเทอม',
};

const demoSearchStudents: SearchStudent[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
];

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('th');
}

function sanitizeIlikeTerm(value: string): string {
  return value.trim().replace(/[,()%*_\\]/g, '');
}

type SearchEntry =
  | { kind: 'menu'; item: AppNavItem; locked: boolean }
  | { kind: 'student'; student: SearchStudent }
  | { kind: 'classroom'; classroom: SearchClassroom };

export function GlobalSearch({ navItems, session }: GlobalSearchProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const planPolicies = usePlanAccessPolicies();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [students, setStudents] = useState<SearchStudent[]>([]);
  const [classrooms, setClassrooms] = useState<SearchClassroom[]>([]);
  const normalizedQuery = normalize(query);
  const demoMode = Boolean(session && isDemoSession(session));
  const isSuperadmin = session?.profile.role === 'superadmin';

  const isMenuLocked = (item: AppNavItem) =>
    Boolean(session && !isSuperadmin && !canAccessViewByPlan(session, item.key, item.moduleKey, planPolicies));

  const menuResults = useMemo(() => {
    if (!normalizedQuery) return navItems.slice(0, 6);
    return navItems
      .filter((item) => {
        const displayLabel = item.key === 'overview' ? `วันนี้ ${item.label}` : item.label;
        const searchable = `${displayLabel} ${item.key} ${item.moduleKey} ${MENU_SYNONYMS[item.key] || ''}`;
        return normalize(searchable).includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [navItems, normalizedQuery]);

  const studentResults = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    if (!demoMode) return students.slice(0, 8);
    return students
      .filter((student) =>
        normalize([student.student_code, student.first_name, student.last_name, student.nickname].filter(Boolean).join(' ')).includes(
          normalizedQuery,
        ),
      )
      .slice(0, 8);
  }, [demoMode, normalizedQuery, students]);

  const classroomResults = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    if (!demoMode) return classrooms.slice(0, 5);
    return classrooms.filter((classroom) => normalize(classroom.name).includes(normalizedQuery)).slice(0, 5);
  }, [classrooms, demoMode, normalizedQuery]);

  const flatEntries = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = menuResults.map((item) => ({
      kind: 'menu',
      item,
      locked: isMenuLocked(item),
    }));
    if (normalizedQuery.length >= 2) {
      studentResults.forEach((student) => entries.push({ kind: 'student', student }));
      classroomResults.forEach((classroom) => entries.push({ kind: 'classroom', classroom }));
    }
    return entries;
  }, [menuResults, studentResults, classroomResults, normalizedQuery, session, isSuperadmin, planPolicies]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery, isOpen]);

  // Global Cmd/Ctrl+K shortcut & click-outside dismissal
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      } else if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    function onPointerDown(event: MouseEvent) {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  // Server-side filtered student & classroom search (works across large multi-hundred-student schools)
  useEffect(() => {
    const client = supabase;
    const workspaceId = session?.workspace?.id;
    if (normalizedQuery.length < 2 || !workspaceId) {
      setStudents([]);
      setClassrooms([]);
      setIsLoading(false);
      return;
    }
    if (demoMode) {
      setStudents(demoSearchStudents);
      setClassrooms([{ id: 'demo-classroom', name: session?.workspace?.classroomName || 'ห้องเรียนตัวอย่าง' }]);
      setIsLoading(false);
      return;
    }
    if (!client) {
      setStudents([]);
      setClassrooms([]);
      setIsLoading(false);
      return;
    }

    const cleanTerm = sanitizeIlikeTerm(query);
    if (cleanTerm.length < 2) {
      setStudents([]);
      setClassrooms([]);
      setIsLoading(false);
      return;
    }

    const activeClient = client;
    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      async function searchWorkspace() {
        setIsLoading(true);
        const pattern = `%${cleanTerm}%`;
        const [{ data: studentRows }, { data: classroomRows }] = await Promise.all([
          activeClient
            .from('students')
            .select('id,student_code,first_name,last_name,nickname,classroom_id')
            .eq('workspace_id', workspaceId)
            .eq('status', 'active')
            .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},nickname.ilike.${pattern},student_code.ilike.${pattern}`)
            .order('student_code')
            .limit(15),
          activeClient
            .from('classrooms')
            .select('id,name')
            .eq('workspace_id', workspaceId)
            .eq('status', 'active')
            .ilike('name', pattern)
            .order('name')
            .limit(10),
        ]);
        if (!isCurrent) return;
        setStudents((studentRows || []) as SearchStudent[]);
        setClassrooms((classroomRows || []) as SearchClassroom[]);
        setIsLoading(false);
      }
      void searchWorkspace();
    }, 180);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [demoMode, normalizedQuery, query, session?.workspace?.classroomName, session?.workspace?.id]);

  function closeSearch() {
    setIsOpen(false);
    setQuery('');
  }

  function openMenu(item: AppNavItem, locked: boolean) {
    if (locked) {
      navigate(withDemoContext('/app/package', location.search));
      closeSearch();
      return;
    }
    if (item.externalUrl) window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
    else navigate(withDemoContext(item.path, location.search));
    closeSearch();
  }

  function openStudent(student: SearchStudent) {
    navigate(
      withDemoContext(
        `/app/dashboard?view=students&studentView=roster&studentId=${encodeURIComponent(student.id)}`,
        location.search,
      ),
    );
    closeSearch();
  }

  function openClassroom(classroom: SearchClassroom) {
    navigate(
      withDemoContext(
        `/app/dashboard?view=students&studentView=roster&classroomId=${encodeURIComponent(classroom.id)}`,
        location.search,
      ),
    );
    closeSearch();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || flatEntries.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatEntries.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatEntries.length) % flatEntries.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = flatEntries[activeIndex];
      if (!entry) return;
      if (entry.kind === 'menu') openMenu(entry.item, entry.locked);
      else if (entry.kind === 'student') openStudent(entry.student);
      else if (entry.kind === 'classroom') openClassroom(entry.classroom);
    }
  }

  const hasWorkspaceResults = studentResults.length > 0 || classroomResults.length > 0;
  let runningIdx = 0;

  return (
    <div className="app-global-search-wrap" ref={wrapRef}>
      <label className="app-global-search">
        <Search size={17} aria-hidden="true" />
        <input
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="ค้นหาทั่วทั้งระบบ"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="ค้นหานักเรียน รหัส เมนู หรือรายงาน"
          ref={inputRef}
          type="search"
          value={query}
        />
        <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-400 xl:inline">
          Ctrl K
        </kbd>
      </label>

      {isOpen ? (
        <div className="app-global-search-panel" role="listbox">
          <div className="app-global-search-hint">
            <span>{normalizedQuery ? 'ผลการค้นหา' : 'ไปยังส่วนต่าง ๆ อย่างรวดเร็ว'}</span>
            <span>↑↓ เลือก · Enter เปิด · Esc ปิด</span>
          </div>

          {menuResults.length > 0 ? (
            <section aria-label="เมนูระบบ">
              <p className="app-global-search-section-title">เมนูและรายงาน</p>
              {menuResults.map((item) => {
                const idx = runningIdx++;
                const Icon = item.icon;
                const locked = isMenuLocked(item);
                const labelText = item.key === 'overview' ? 'วันนี้ (ภาพรวม)' : item.label;
                return (
                  <button
                    className={`app-global-search-result ${activeIndex === idx ? 'bg-[#f2f7f4] ring-1 ring-[#bfe0cd]' : ''}`}
                    key={item.key}
                    onClick={() => openMenu(item, locked)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    type="button"
                  >
                    <span className="app-global-search-result-icon">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{labelText}</strong>
                      <small>
                        {locked
                          ? 'ต้องอัปเกรดสิทธิ์ VIP เพื่อใช้งาน'
                          : item.externalUrl
                            ? 'เปิดเว็บเกมภายนอก'
                            : `เปิดหน้า${labelText}`}
                      </small>
                    </span>
                    {locked ? <Lock size={14} className="text-amber-600" aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                  </button>
                );
              })}
            </section>
          ) : null}

          {normalizedQuery.length >= 2 ? (
            <>
              {isLoading ? (
                <p className="app-global-search-loading">
                  <NexusAuroraInline label="กำลังค้นหาใน workspace นี้" />
                </p>
              ) : null}

              {studentResults.length > 0 ? (
                <section aria-label="นักเรียน">
                  <p className="app-global-search-section-title">นักเรียน</p>
                  {studentResults.map((student) => {
                    const idx = runningIdx++;
                    return (
                      <button
                        className={`app-global-search-result ${activeIndex === idx ? 'bg-[#f2f7f4] ring-1 ring-[#bfe0cd]' : ''}`}
                        key={student.id}
                        onClick={() => openStudent(student)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        type="button"
                      >
                        <span className="app-global-search-result-icon">
                          <Users size={16} />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <strong>{`${student.first_name} ${student.last_name}`}</strong>
                          <small>{[student.student_code, student.nickname].filter(Boolean).join(' · ') || 'เปิดข้อมูลนักเรียน'}</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    );
                  })}
                </section>
              ) : null}

              {classroomResults.length > 0 ? (
                <section aria-label="ห้องเรียน">
                  <p className="app-global-search-section-title">ห้องเรียน</p>
                  {classroomResults.map((classroom) => {
                    const idx = runningIdx++;
                    return (
                      <button
                        className={`app-global-search-result ${activeIndex === idx ? 'bg-[#f2f7f4] ring-1 ring-[#bfe0cd]' : ''}`}
                        key={classroom.id}
                        onClick={() => openClassroom(classroom)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        type="button"
                      >
                        <span className="app-global-search-result-icon">
                          <DoorOpen size={16} />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <strong>{classroom.name}</strong>
                          <small>เปิดรายชื่อนักเรียนในห้อง</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    );
                  })}
                </section>
              ) : null}

              {!isLoading && !hasWorkspaceResults && menuResults.length === 0 ? (
                <p className="app-global-search-empty">
                  <BookOpen size={17} /> ไม่พบผลลัพธ์ที่ตรงกัน
                </p>
              ) : null}

              {!isLoading && !supabase ? (
                <p className="app-global-search-note">
                  <GraduationCap size={15} /> ค้นหารายชื่อนักเรียนได้เมื่อเชื่อมต่อฐานข้อมูล
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
