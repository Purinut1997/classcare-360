export type SavingsDepositDraft = Record<string, number>;

function isValidDepositAmount(amount: number) {
  return Number.isFinite(amount) && amount > 0;
}

export function createQuickDepositDraft(studentIds: string[], amount: number): SavingsDepositDraft {
  if (!isValidDepositAmount(amount)) return {};

  return studentIds.reduce<SavingsDepositDraft>((draft, studentId) => {
    draft[studentId] = amount;
    return draft;
  }, {});
}

export function getNextQuickDepositDraft(
  draft: SavingsDepositDraft,
  studentId: string,
  amount: number,
): SavingsDepositDraft {
  if (!isValidDepositAmount(amount)) return draft;

  const currentAmount = draft[studentId] || 0;
  if (currentAmount === 0) return { ...draft, [studentId]: amount };
  if (currentAmount === amount) return { ...draft, [studentId]: amount * 2 };

  const nextDraft = { ...draft };
  delete nextDraft[studentId];
  return nextDraft;
}
