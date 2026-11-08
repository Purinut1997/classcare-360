# Dashboard Post-it Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shortcuts dashboard’s top header with a responsive, paper-and-post-it home board that directs teachers to their live daily tasks.

**Architecture:** `DashboardPage` remains the data and navigation owner. A new presentational `DashboardPostItBoard` composes supplied stats, daily tasks, school context, and the existing classroom selector slot; no Supabase call, route, or state transition moves out of `DashboardPage`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react, existing `ContextLink` routing.

**Spec:** `docs/superpowers/specs/2026-11-08-dashboard-postit-home-design.md`

## Global Constraints

- Do not add database, RLS, migration, route, or AI showcase changes.
- Preserve the existing classroom selector, advisory-room shortcut, and `/app/dashboard?view=teacher-work` attendance route.
- Use live `stats` and `dynamicTodayTasks` only; no fake classroom or student data.
- Keep keyboard focus visible and disable decorative transitions for reduced-motion users.

## Review Focus

- A teacher with no classrooms must still see a usable home board and attendance link.
- Long Thai names and task labels must wrap or truncate without covering controls.
- A classroom switch must continue to update the dashboard state instead of being trapped in the presentation component.
- All task cards must keep their existing navigation targets.
- The board must collapse to a readable single column below tablet width.

---

### Task 1: Create the presentational post-it board

**Files:**
- Create: `src/components/dashboard/DashboardPostItBoard.tsx`

**Interfaces:**
- Consumes: `DashboardStatItem[]`, a compact daily-task shape, strings for teacher/school/classroom/date, and `classroomControl: ReactNode`.
- Produces: `DashboardPostItBoard`, a route-preserving dashboard header section.

- [ ] **Step 1: Implement `DashboardPostItBoard` with only supplied props**

Render the greeting, existing context control, attendance CTA, three linked daily task notes, and four stats in a semantic responsive section. Use the post-it token palette from the spec and no local data fetching.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc -b`

Expected: exit code 0.

### Task 2: Integrate the board without changing workflow behavior

**Files:**
- Modify: `src/pages/app/DashboardPage.tsx:1241-1350`

**Interfaces:**
- Consumes: `DashboardPostItBoard` from Task 1.
- Produces: The existing dashboard with the old greeting header replaced by the new board.

- [ ] **Step 1: Pass existing dashboard values and the current classroom selector as the control slot**

Keep the advisory shortcut callback, selector value, selector change handler, and attendance route intact. Use the first three `dynamicTodayTasks`; render no duplicate top header.

- [ ] **Step 2: Verify project checks**

Run: `npm run lint && npm run build && git diff --check`

Expected: all commands exit code 0.

### Task 3: Visual QA of the complete first page

**Files:**
- Verify: `src/components/dashboard/DashboardPostItBoard.tsx`
- Verify: `src/pages/app/DashboardPage.tsx`

**Interfaces:**
- Consumes: development server and the existing dashboard route.
- Produces: visual confirmation at desktop and mobile widths.

- [ ] **Step 1: Run the development server and open the dashboard**

Run: `npm run dev`

Expected: Vite provides a local URL.

- [ ] **Step 2: Inspect desktop and mobile layouts**

Verify the home board, classroom selector, task routes, metric notes, no horizontal overflow, and visible focus indicators.

- [ ] **Step 3: Re-run final project checks**

Run: `npx tsc -b && npm run lint && npm run build && git diff --check`

Expected: all commands exit code 0.
