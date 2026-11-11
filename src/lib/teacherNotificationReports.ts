import { isDemoSession } from './auth';
import { supabase } from './supabaseClient';
import type { AppSessionContext } from '../types/core';
import { formatAttendanceReport, type AttendanceReportDetails } from './parentReportFormat';

export type TeacherReportKind = 'attendance_homeroom' | 'attendance_subject' | 'savings_saved' | 'daily_brief_saved';

interface TeacherReportInput {
  body: string;
  eventId: string;
  kind: TeacherReportKind;
  session: AppSessionContext;
  title: string;
  attendance?: AttendanceReportDetails;
}

/** Sends a privacy-safe summary to the signed-in teacher's own verified Telegram only. */
export async function sendTeacherReport({ body, eventId, kind, session, title, attendance }: TeacherReportInput) {
  const workspaceId = session.workspace?.id;
  if (!supabase || !workspaceId || isDemoSession(session)) return;

  if (attendance) {
    const { data, error } = await supabase.from('teacher_notification_preferences')
      .select('preferences').eq('workspace_id', workspaceId).eq('profile_id', session.profile.id).maybeSingle();
    // When settings cannot be read, keep names private.
    body = formatAttendanceReport(attendance, Boolean(error) || data?.preferences?.summaryOnly !== false);
  }

  const { error } = await supabase.functions.invoke('dispatch-notification', {
    body: {
      body,
      channels: ['telegram'],
      eventId,
      personalReport: true,
      profileId: session.profile.id,
      title,
      type: kind,
      workspaceId,
    },
    // Report delivery is a secondary background action. Its network failure
    // must not be presented as if the savings/attendance record itself failed.
    headers: { 'x-silent': 'true' },
  });

  if (error) console.warn('Unable to deliver personal teacher report:', error.message);
}
