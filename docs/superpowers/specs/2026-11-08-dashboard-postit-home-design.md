# Dashboard Post-it Home Design

## Intent

Give teachers a warmer first screen that answers two questions immediately: “what room am I working in?” and “what should I do next?”.  The reference establishes a playful stationery language—cream paper, taped cards, gentle pastel colour, and a tidy dark navigation rail—without turning a data-heavy school system into a toy.

## Goals

- Rework the top of the `shortcuts` dashboard into one cohesive home board.
- Preserve every existing data source, route, classroom selector, role check, and dashboard-mode toggle.
- Make the primary daily actions and four existing workspace metrics readable at a glance.
- Work from one column on mobile through a two-column desktop composition, with visible keyboard focus and reduced decorative motion.

## Non-goals

- No database, RLS, route, menu entitlement, or AI-feature changes.
- No new tracking, no new dashboard data queries, and no change to analytics mode.
- Do not replace the canonical schedule, attendance, or score workflows.

## Approaches considered

1. **Cosmetic CSS pass on the existing hero.** Low-risk but keeps the dashboard’s information scattered; it would not satisfy the request to draft the whole first page.
2. **Replace the entire dashboard and rewrite existing shortcut components.** Visually flexible but too risky: it could regress menu routing and current teacher workflows.
3. **Add a focused home-board composition above the existing schedule and shortcut hub.** **Selected.** It promotes real daily data and routes into one recognisable “notebook” composition, while retaining the proven schedule, menu hub, onboarding, and analytics surfaces below.

## Design system

- **Canvas:** warm paper `#fffdf8`, ruled line `rgba(148,163,184,.12)`, with muted stone borders.
- **Notes:** mint for classroom work, sky for academic work, lilac for care, and butter yellow for reminders. Notes have one small paper-tape accent and a compact soft shadow.
- **Ink:** near-black `#1c1917` for labels and `#475569` for supportive copy; decorative colour never carries meaning alone.
- **Hero layout:** left: greeting, school/date, current-room control, and one attendance CTA. Right: three short, live “today” task notes. Bottom: four existing metric notes.
- **Interaction:** only task notes and buttons lift on hover; animations are disabled under `prefers-reduced-motion`.

## Implementation shape

Create a presentational `DashboardPostItBoard` component. It receives preloaded dashboard stats and daily tasks from `DashboardPage`, plus a JSX classroom-control slot so the current selector and advisory-room shortcut keep their exact behavior. Replace only the current top greeting header with this board. Keep the calendar alert, schedule preview, mode tabs, menu hub, onboarding card, and analytics dashboard in their current order.

## Verification

The repository has no automated test runner configured, so this visual prototype will be validated by TypeScript compilation, lint, production build, and browser checks at desktop and mobile widths. Existing data-loading behavior is unchanged because the new component is presentational and receives all state through props.
