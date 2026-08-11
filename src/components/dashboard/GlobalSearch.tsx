import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, DoorOpen, GraduationCap, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('th');
}

export function GlobalSearch({ navItems, session }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<SearchStudent[]>([]);
  const [classrooms, setClassrooms] = useState<SearchClassroom[]>([]);
  const normalizedQuery = normalize(query);

  const menuResults = useMemo(() => {
    if (!normalizedQuery) return navItems.slice(0, 5);
    return navItems.filter((item) => normalize(`${item.label} ${item.key} ${item.moduleKey}`).includes(normalizedQuery)).slice(0, 6);
  }, [navItems, normalizedQuery]);

  const studentResults = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return students.filter((student) => normalize([student.student_code, student.first_name, student.last_name, student.nickname].filter(Boolean).join(' ')).includes(normalizedQuery)).slice(0, 6);
  }, [normalizedQuery, students]);

  const classroomResults = useMemo(() => normalizedQuery.length < 2 ? [] : classrooms.filter((classroom) => normalize(classroom.name).includes(normalizedQuery)).slice(0, 4), [classrooms, normalizedQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const client = supabase;
    const workspaceId = session?.workspace?.id;
    if (normalizedQuery.length < 2 || !client || !workspaceId) {
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
        const [{ data: studentRows }, { data: classroomRows }] = await Promise.all([
          activeClient.from('students').select('id,student_code,first_name,last_name,nickname,classroom_id').eq('workspace_id', workspaceId).limit(120),
          activeClient.from('classrooms').select('id,name').eq('workspace_id', workspaceId).eq('status', 'active').limit(80),
        ]);
        if (!isCurrent) return;
        setStudents((studentRows || []) as SearchStudent[]);
        setClassrooms((classroomRows || []) as SearchClassroom[]);
        setIsLoading(false);
      }
      void searchWorkspace();
    }, 180);
    return () => { isCurrent = false; window.clearTimeout(timeoutId); };
  }, [normalizedQuery, session?.workspace?.id]);

  function closeSearch() { setIsOpen(false); setQuery(''); }
  function openMenu(path: string) { navigate(path); closeSearch(); }
  function openStudent(student: SearchStudent) { navigate(`/app/dashboard?view=students&studentView=roster&studentId=${encodeURIComponent(student.id)}`); closeSearch(); }
  function openClassroom(classroom: SearchClassroom) { navigate(`/app/dashboard?view=students&studentView=roster&classroomId=${encodeURIComponent(classroom.id)}`); closeSearch(); }
  const hasWorkspaceResults = studentResults.length > 0 || classroomResults.length > 0;

  return (
    <div className="app-global-search-wrap">
      <label className="app-global-search">
        <Search size={17} aria-hidden="true" />
        <input aria-autocomplete="list" aria-expanded={isOpen} aria-haspopup="listbox" aria-label="ค้นหาทั่วทั้งระบบ" onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder="ค้นหานักเรียน เมนู หรือรายงาน" ref={inputRef} type="search" value={query} />
        <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-400 xl:inline">Ctrl K</kbd>
      </label>
      {isOpen ? <div className="app-global-search-panel" role="listbox">
        <div className="app-global-search-hint"><span>{normalizedQuery ? 'ผลการค้นหา' : 'ไปยังส่วนต่าง ๆ อย่างรวดเร็ว'}</span><span>Esc เพื่อปิด</span></div>
        {menuResults.length > 0 ? <section aria-label="เมนูระบบ"><p className="app-global-search-section-title">เมนูและรายงาน</p>{menuResults.map((item) => { const Icon = item.icon; return <button className="app-global-search-result" key={item.key} onClick={() => openMenu(item.path)} type="button"><span className="app-global-search-result-icon"><Icon size={16} /></span><span className="min-w-0 flex-1 text-left"><strong>{item.label}</strong><small>เปิดหน้า{item.label}</small></span><ChevronRight size={16} aria-hidden="true" /></button>; })}</section> : null}
        {normalizedQuery.length >= 2 ? <>
          {isLoading ? <p className="app-global-search-loading"><NexusAuroraInline label="กำลังค้นหาใน workspace นี้" /></p> : null}
          {studentResults.length > 0 ? <section aria-label="นักเรียน"><p className="app-global-search-section-title">นักเรียน</p>{studentResults.map((student) => <button className="app-global-search-result" key={student.id} onClick={() => openStudent(student)} type="button"><span className="app-global-search-result-icon"><Users size={16} /></span><span className="min-w-0 flex-1 text-left"><strong>{`${student.first_name} ${student.last_name}`}</strong><small>{[student.student_code, student.nickname].filter(Boolean).join(' · ') || 'เปิดข้อมูลนักเรียน'}</small></span><ChevronRight size={16} aria-hidden="true" /></button>)}</section> : null}
          {classroomResults.length > 0 ? <section aria-label="ห้องเรียน"><p className="app-global-search-section-title">ห้องเรียน</p>{classroomResults.map((classroom) => <button className="app-global-search-result" key={classroom.id} onClick={() => openClassroom(classroom)} type="button"><span className="app-global-search-result-icon"><DoorOpen size={16} /></span><span className="min-w-0 flex-1 text-left"><strong>{classroom.name}</strong><small>เปิดรายชื่อนักเรียนในห้อง</small></span><ChevronRight size={16} aria-hidden="true" /></button>)}</section> : null}
          {!isLoading && !hasWorkspaceResults && menuResults.length === 0 ? <p className="app-global-search-empty"><BookOpen size={17} /> ไม่พบผลลัพธ์ที่ตรงกัน</p> : null}
          {!isLoading && !supabase ? <p className="app-global-search-note"><GraduationCap size={15} /> ค้นหารายชื่อนักเรียนได้เมื่อเชื่อมต่อฐานข้อมูล</p> : null}
        </> : null}
      </div> : null}
    </div>
  );
}
