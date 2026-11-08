import assert from 'node:assert/strict';
import test from 'node:test';

import { createQuickDepositDraft, getNextQuickDepositDraft } from '../src/lib/savingsDrafts';

test('sets a custom 5-baht deposit for each selected student', () => {
  assert.deepEqual(createQuickDepositDraft(['student-1', 'student-2'], 5), {
    'student-1': 5,
    'student-2': 5,
  });
});

test('cycles a student draft from selected amount to double amount then clears it', () => {
  const once = getNextQuickDepositDraft({}, 'student-1', 5);
  const twice = getNextQuickDepositDraft(once, 'student-1', 5);
  const cleared = getNextQuickDepositDraft(twice, 'student-1', 5);

  assert.deepEqual(once, { 'student-1': 5 });
  assert.deepEqual(twice, { 'student-1': 10 });
  assert.deepEqual(cleared, {});
});

test('does not create a draft for an invalid amount', () => {
  assert.deepEqual(createQuickDepositDraft(['student-1'], 0), {});
  assert.deepEqual(getNextQuickDepositDraft({}, 'student-1', Number.NaN), {});
});
