import type { AppSessionContext } from '../types/core';
import { supabase } from './supabaseClient';

export type AuditRiskLevel = 'low' | 'normal' | 'high' | 'critical';

interface WriteAuditLogInput {
  action: string;
  entityId: string;
  entityTable: string;
  metadata?: Record<string, unknown>;
  riskLevel?: AuditRiskLevel;
  source?: string;
}

export async function writeAuditLog(
  session: AppSessionContext,
  { action, entityId, entityTable, metadata = {}, riskLevel = 'normal', source }: WriteAuditLogInput,
) {
  if (!supabase || !session.workspace) return;

  const { error } = await supabase.from('audit_logs').insert({
    action,
    actor_profile_id: session.profile.id,
    actor_role: session.profile.role,
    entity_id: entityId,
    entity_table: entityTable,
    metadata: source ? { ...metadata, source } : metadata,
    risk_level: riskLevel,
    workspace_id: session.workspace.id,
  });

  if (error) {
    console.warn('audit log insert failed', error.message);
  }
}
