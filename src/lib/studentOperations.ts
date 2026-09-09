import type { SupabaseClient } from '@supabase/supabase-js';

export interface PurgeStudentsParams {
  actorEmail?: string;
  actorProfileId?: string;
  isDemo?: boolean;
  reason?: string;
  studentIds: string[];
  supabase: SupabaseClient | null;
  workspaceId: string;
}

export interface PurgeStudentsResult {
  deletedCount: number;
  purgedCount: number;
  error?: string;
  success: boolean;
}

// All known tables with foreign key references to public.students(id)
const KNOWN_STUDENT_CHILD_TABLES = [
  'student_guardians',
  'student_roster_reviews',
  'student_behaviors',
  'student_health_records',
  'student_daily_health_logs',
  'student_nutrition_growth',
  'student_savings_transactions',
  'attendance_records',
  'score_records',
  'desirable_characteristic_records',
  'student_competency_records',
  'student_activity_evaluations',
  'term_student_promotions',
  'student_year_transitions',
  'student_care_cases',
  'student_home_visits',
  'official_academic_documents',
  'classroom_duty_rosters',
  'student_profile_links',
];

/**
 * Robust, foolproof student purge function.
 * Deletes students and all their associated records completely from the database.
 * Does NOT prematurely set status to 'archived' on error, preventing phantom archived rows.
 */
export async function purgeStudentsPermanently({
  actorProfileId,
  isDemo = false,
  studentIds,
  supabase,
  workspaceId,
}: PurgeStudentsParams): Promise<PurgeStudentsResult> {
  const cleanIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (cleanIds.length === 0) {
    return { deletedCount: 0, purgedCount: 0, success: true };
  }

  if (isDemo || !supabase || !workspaceId) {
    return { deletedCount: cleanIds.length, purgedCount: cleanIds.length, success: true };
  }

  // Chunk IDs into batches of 50 to avoid request URL length limits
  const CHUNK_SIZE = 50;
  let totalDeleted = 0;
  const errors: string[] = [];

  for (let i = 0; i < cleanIds.length; i += CHUNK_SIZE) {
    const chunk = cleanIds.slice(i, i + CHUNK_SIZE);
    let chunkSucceeded = false;
    let chunkError = '';

    // Step 1: Call dedicated RPC `delete_students_permanently`
    try {
      const { data: rpcCount, error: rpcError } = await supabase.rpc('delete_students_permanently', {
        target_student_ids: chunk,
        target_workspace_id: workspaceId,
      });

      if (!rpcError) {
        chunkSucceeded = true;
        totalDeleted += typeof rpcCount === 'number' ? rpcCount : chunk.length;
      } else {
        chunkError = rpcError.message;
      }
    } catch (rpcEx) {
      chunkError = rpcEx instanceof Error ? rpcEx.message : 'RPC call failed';
    }

    // Step 2: Fallback to client-side cascade cleanup across all child tables
    if (!chunkSucceeded) {
      try {
        // Snapshot to trash_items for safety if trash_items exists
        try {
          const { data: studentRows } = await supabase
            .from('students')
            .select('*')
            .in('id', chunk)
            .eq('workspace_id', workspaceId);

          if (studentRows && studentRows.length > 0) {
            const trashRows = studentRows.map((s) => ({
              deleted_by: actorProfileId || null,
              display_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.student_code || 'นักเรียน',
              entity_id: s.id,
              entity_type: 'student',
              expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
              metadata: {
                classroom_id: s.classroom_id,
                deleted_at: new Date().toISOString(),
                status: s.status,
                student_code: s.student_code,
              },
              payload: s,
              reason: 'permanent_delete',
              workspace_id: workspaceId,
            }));

            await supabase.from('trash_items').insert(trashRows).setHeader('x-silent', 'true');
          }
        } catch {
          // Non-blocking: trash items might have RLS or table might differ
        }

        // Delete child rows from all known child tables
        for (const tableName of KNOWN_STUDENT_CHILD_TABLES) {
          try {
            await supabase
              .from(tableName)
              .delete()
              .in('student_id', chunk)
              .setHeader('x-silent', 'true');
          } catch {
            // Ignore non-blocking child table deletions (table might not exist yet)
          }
        }

        // Also clean classroom_duty_rosters substitute_student_id
        try {
          await supabase
            .from('classroom_duty_rosters')
            .update({ substitute_student_id: null })
            .in('substitute_student_id', chunk)
            .setHeader('x-silent', 'true');
        } catch {
          // Ignore
        }

        // Delete from students table directly
        const { data: deletedStudents, error: directDeleteError } = await supabase
          .from('students')
          .delete()
          .in('id', chunk)
          .eq('workspace_id', workspaceId)
          .select('id');

        if (!directDeleteError && deletedStudents) {
          chunkSucceeded = true;
          totalDeleted += deletedStudents.length;
        } else if (directDeleteError) {
          chunkError = directDeleteError.message;
        }
      } catch (cascadeEx) {
        chunkError = cascadeEx instanceof Error ? cascadeEx.message : 'Cascade delete failed';
      }
    }

    if (!chunkSucceeded) {
      errors.push(chunkError || `ไม่สามารถลบชุดข้อมูล ${chunk.length} คนได้`);
    }
  }

  if (errors.length > 0 && totalDeleted === 0) {
    return {
      deletedCount: 0,
      purgedCount: 0,
      error: errors.join('; '),
      success: false,
    };
  }

  return {
    deletedCount: totalDeleted,
    purgedCount: totalDeleted,
    error: errors.length > 0 ? `ลบได้บางส่วน (${totalDeleted} คน): ${errors.join('; ')}` : undefined,
    success: true,
  };
}
