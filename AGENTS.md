# AI Agent Guidelines & Operating Rules: ClassCare 360

This repository contains **ClassCare 360**, a mission-critical school and classroom management platform (SaaS) built with React (Vite + TypeScript) and Supabase (PostgreSQL with RLS).

## MANDATORY: Read Rules Before Any Modification
Before proposing, writing, or executing any code or database changes, you **MUST** consult and follow the rules located in `.agents/rules/`:

1. **Safe System Updates & Zero Downtime (`.agents/rules/safe-system-updates.md`)**:
   - **Never break active users**: Adhere strictly to the **Expand-and-Contract** migration pattern. No instant `DROP COLUMN`, `RENAME COLUMN`, or sudden `NOT NULL` constraints without defaults.
   - **Strict Multi-Tenancy**: Every new entity must have `workspace_id NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE`.
   - **Composite Foreign Keys**: All child entities referencing school entities (e.g. `classroom_id`, `student_id`) MUST use composite foreign keys with `workspace_id` to guarantee zero data leakage between schools.
   - **Row Level Security**: Every new table must enable RLS immediately in the same migration file with robust policies.
   - **Backward Compatibility**: Frontend queries and mutations must gracefully handle legacy and new payloads with fallback operators.

2. **AI Feature Showcase Maintenance (`.agents/rules/ai-feature-showcase.md`)**:
   - Every new/updated AI capability must be registered and showcased in `src/components/dashboard/AiFeatureShowcase.tsx`.

## Key Commands & Verification
- Dev Server: `npm run dev`
- Build Validation: `npm run build`
- Type Check: `npx tsc -b`
