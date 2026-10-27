# Dashboard Mini Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an interactive, responsive Mini Calendar view in the Dashboard's "กิจกรรม / วันหยุดที่จะมาถึง" widget with a view toggle between `[ 🗓️ ปฏิทินย่อ ]` and `[ 📋 รายการ ]`, featuring continuous multi-day spanning ribbons and date selection.

---

### Task 1: Create `DashboardMiniCalendar` Component

**Files to create:**
- `src/components/dashboard/DashboardMiniCalendar.tsx`

**Responsibilities:**
- Renders month calendar with 7 columns (อา, จ, อ, พ, พฤ, ศ, ส).
- Thai Buddhist Era month/year header (e.g. "พฤศจิกายน 2567") with Previous/Next Month and "วันนี้" (Today) buttons.
- Supports multi-day spanning ribbons across consecutive days/weeks for events like "กีฬากลุ่ม" (purple ribbon with start/middle/end rounded corners) matching the visual design.
- Supports dot / badge indicators for holidays (rose), exams (indigo), activities (purple), makeups (amber).
- Interactive date selection: clicking any date updates `selectedDate` and displays events occurring on that date in an elegant preview footer.

**Steps:**
- [ ] Create `src/components/dashboard/DashboardMiniCalendar.tsx`.
- [ ] Implement calendar date grid calculation for any given Year/Month.
- [ ] Implement week-aware spanning bar detector for multi-day events.
- [ ] Implement selected date preview card.

---

### Task 2: Integrate Mini Calendar into Dashboard Widget

**Files to modify:**
- `src/pages/app/DashboardPage.tsx`

**Responsibilities:**
- Add view toggle state: `calendarViewMode: 'calendar' | 'list'` (persisted in `localStorage` under `'classcare:dashboard_calendar_view'`).
- Ensure calendar events loading fetches all events for the current active view range (e.g., current month ± 1 month) rather than just a limit of 10 upcoming events, so the calendar grid displays all days' events properly.
- Render the view switcher toggle pills (`[ 🗓️ ปฏิทินย่อ ]` and `[ 📋 รายการ ]`) in the card header next to "ดูปฏิทินทั้งหมด ->".
- Render `<DashboardMiniCalendar />` when in `'calendar'` mode, and the existing grouped list when in `'list'` mode.

**Steps:**
- [ ] Update `DashboardPage.tsx` to include `calendarViewMode` state.
- [ ] Enhance event loading to cover full month spans.
- [ ] Add view switcher buttons in the card header.
- [ ] Render `DashboardMiniCalendar` and list view conditionally.

---

### Task 3: Build, Verify and Deploy

**Responsibilities:**
- Run `npm run build` (`tsc -b && vite build`) to ensure zero TypeScript/JSX errors.
- Run `npm run check:deploy` to verify all 87 production readiness checks pass.
- Commit and push to `origin/main` to deploy to Cloudflare Pages.

**Steps:**
- [ ] Run `npm run build`.
- [ ] Run `npm run check:deploy`.
- [ ] Commit and push to `origin/main`.
- [ ] Verify live URL at `https://classcare-360.pages.dev`.
