import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path, rewrite = (source) => source) {
  const source = rewrite(fs.readFileSync(path, 'utf8'));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { readLocalDraft } = await load('src/lib/localDraftStorage.ts');
const data = new Map();
const storage = { getItem: (key) => data.get(key) ?? null, removeItem: (key) => data.delete(key) };
const now = Date.now();
data.set('school-a:teacher-a:room-a', JSON.stringify({ version: 1, updatedAt: now, value: { marks: { student: 'leave' }, notes: { student: 'แจ้งลา' } } }));
assert.equal(readLocalDraft(storage, 'school-a:teacher-a:room-a', now).value.notes.student, 'แจ้งลา');
assert.equal(readLocalDraft(storage, 'school-a:teacher-b:room-a', now), null);
assert.equal(readLocalDraft(storage, 'school-b:teacher-a:room-a', now), null);
assert.equal(readLocalDraft(storage, 'school-a:teacher-a:room-a', now + 7 * 86400000), null);
data.set('broken', '{bad'); assert.equal(readLocalDraft(storage, 'broken', now), null);
data.set('future', JSON.stringify({ version: 1, updatedAt: now + 10000, value: {} })); assert.equal(readLocalDraft(storage, 'future', now), null);
const { nextLessonDate, lessonAttendancePath } = await load('src/lib/lessonAttendance.ts', (source) => source.replace("import { getBangkokDate } from './date';", "const getBangkokDate = () => '2026-11-28';"));
assert.equal(nextLessonDate('จันทร์', '2026-11-28'), '2026-11-30');
assert.equal(nextLessonDate('เสาร์', '2026-11-28'), '2026-11-28');
assert.equal(nextLessonDate('ศุกร์', '2026-12-31'), '2027-01-01');
const query = new URLSearchParams(lessonAttendancePath('จันทร์', 'ป.5/1', 'คณิตศาสตร์', 'คาบ 4').split('?')[1]);
assert.equal(query.get('classroomName'), 'ป.5/1'); assert.equal(query.get('subjectName'), 'คณิตศาสตร์'); assert.equal(query.get('attendanceDate'), '2026-11-30');
const { loadSchoolDay } = await load('src/lib/schoolDay.ts', (source) => source
  .replace("import { supabase } from './supabaseClient';", "const supabase = { from: () => ({ select: () => ({ eq: () => ({ eq: async (_key, date) => date === '2026-12-01' ? { data: [{ title: 'วันหยุดโรงเรียน', day_type: 'closed', affects_attendance: false }], error: null } : date === '2026-12-02' ? { data: [{ title: 'เรียนชดเชย', day_type: 'makeup', affects_attendance: true }], error: null } : { data: null, error: { message: 'offline' } } }) }) }) };")
  .replace("import { getThaiPublicHolidays } from './thaiHolidays';", "const getThaiPublicHolidays = () => [{ date: '2026-12-02', title: 'วันหยุดแม่แบบ' }];"));
assert.equal((await loadSchoolDay('school-a', '2026-12-01')).blocked, true);
assert.equal((await loadSchoolDay('school-a', '2026-12-02')).blocked, false);
await assert.rejects(() => loadSchoolDay('school-a', '2026-12-03'));
console.log('PASS: draft isolation/expiry/recovery, lesson context/dates, school holiday/makeup/error policies');
