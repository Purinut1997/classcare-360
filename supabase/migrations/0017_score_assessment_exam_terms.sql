-- ClassCare 360 - Score assessment exam terms.
-- Allows explicit midterm/final score categories for full course gradebooks.

alter table public.score_assessments
drop constraint if exists score_assessments_category_check;

alter table public.score_assessments
add constraint score_assessments_category_check
check (category in ('quiz', 'assignment', 'midterm', 'final', 'exam', 'project', 'reading', 'other'));
