export interface CandidateCategory {
  id: string;
  name: string;
  required: boolean;
  candidates: { id: string; valid: boolean }[];
  // Explicit Figma fixture only; a general automatic-selection policy is not defined.
  autoSelected?: boolean;
}

export function createCandidateMock(
  screen: 'close' | 'vote',
  scenario: string | null,
): CandidateCategory[] {
  const counts = screen === 'close' ? [3, 2, 1, 0] : [3, 2, 2, 1];
  return ['식당', '카페', '주점', '문화시설'].map((name, index) => {
    const count =
      scenario === 'empty' ||
      (scenario === 'missingRequired' && index === 0) ||
      (scenario === 'missingOptional' && index === 3)
        ? 0
        : counts[index];
    return {
      id: ['restaurant', 'cafe', 'pub', 'culture'][index],
      name,
      required: index < 2,
      candidates: Array.from({ length: count }, (_, i) => ({ id: `${index}-${i}`, valid: true })),
      autoSelected: screen === 'close' && index === 2 && count === 1,
    };
  });
}

export function summarizeCandidates(categories: CandidateCategory[]) {
  const rows = categories.map((category) => ({
    ...category,
    count: category.candidates.filter((candidate) => candidate.valid).length,
  }));
  return {
    rows,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    missingRequired: rows.filter((row) => row.required && row.count === 0),
    excluded: rows.filter((row) => !row.required && row.count === 0),
  };
}
