import { isDemoSession } from './auth';
import { supabase } from './supabaseClient';
import type { AppSessionContext } from '../types/core';

export type TeacherReportKind = 'attendance_homeroom' | 'attendance_subject' | 'savings_saved' | 'daily_brief_saved';

interface TeacherReportInput {
  body: string;
  eventId: string;
  kind: TeacherReportKind;
  session: AppSessionContext;
  title: string;
}

/** Sends a privacy-safe summary to the signed-in teacher's own verified Telegram only. */
export async function sendTeacherReport({ body, eventId, kind, session, title }: TeacherReportInput) {
  const workspaceId = session.workspace?.id;
  if (!supabase || !workspaceId || isDemoSession(session)) return;

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
  });

  if (error) console.warn('Unable to deliver personal teacher report:', error.message);
}
