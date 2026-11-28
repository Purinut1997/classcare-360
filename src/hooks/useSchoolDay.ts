import { useEffect, useState } from 'react';
import { loadSchoolDay, SCHOOL_CALENDAR_CHANGED, type SchoolDay } from '../lib/schoolDay';
export function useSchoolDay(workspaceId: string | undefined, date: string, demo = false) {
  const [day, setDay] = useState<SchoolDay | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const reload = () => refresh((value) => value + 1);
    window.addEventListener(SCHOOL_CALENDAR_CHANGED, reload);
    window.addEventListener('focus', reload);
    return () => { window.removeEventListener(SCHOOL_CALENDAR_CHANGED, reload); window.removeEventListener('focus', reload); };
  }, []);
  useEffect(() => {
    let active = true; setLoading(true); setDay(null); setError('');
    void loadSchoolDay(workspaceId, date, demo).then((result) => { if (active) setDay(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'โหลดปฏิทินไม่ได้'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, date, demo, revision]);
  return { day, error, loading, refresh: () => refresh((value) => value + 1) };
}
