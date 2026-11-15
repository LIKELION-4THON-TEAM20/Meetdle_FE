import { summarizeCandidates, type CandidateCategory } from '../../VoteStart/mockData';

export default function CategoryCandidateSummary({
  categories,
}: {
  categories: CandidateCategory[];
}) {
  const { rows } = summarizeCandidates(categories);
  return (
    <section className="registration-close__card" aria-labelledby="candidate-summary-title">
      <h3 id="candidate-summary-title">카테고리별 등록 현황</h3>
      <dl>
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{row.name}</dt>
            <dd className={row.count === 0 ? 'is-empty' : undefined}>
              {row.count
                ? `유효 후보 ${row.count}곳${row.autoSelected ? ' · 자동 선정' : ''}`
                : '후보 없음'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
