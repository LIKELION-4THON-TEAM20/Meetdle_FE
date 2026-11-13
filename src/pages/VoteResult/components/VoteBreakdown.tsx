import type { ResultCategory } from '../types';
import { getVotePercentages } from '../resultUtils';

export default function VoteBreakdown({ categories }: { categories: ResultCategory[] }) {
  return (
    <section className="vote-breakdown" id="vote-breakdown" aria-labelledby="vote-breakdown-title">
      <h2 id="vote-breakdown-title">카테고리별 투표 결과</h2>
      {categories.map((category) => {
        const percentages = getVotePercentages(category.place.votes);
        return (
          <div className="vote-breakdown__item" key={category.id}>
            <h3>
              {category.name} · {category.place.name}
            </h3>
            <div
              className="vote-breakdown__bar"
              role="progressbar"
              aria-label={`${category.place.name} 좋아요 비율`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentages.like}
            >
              <span style={{ width: `${percentages.like}%` }} />
            </div>
            <div className="vote-breakdown__labels">
              <span>좋아요 {percentages.like}%</span>
              <span>상관없어요 {percentages.neutral}%</span>
              <span>싫어요 {percentages.dislike}%</span>
            </div>
            {percentages.total === 0 && <p>아직 집계된 응답이 없어요.</p>}
          </div>
        );
      })}
      <p>누가 어떤 선택을 했는지는 공개되지 않아요.</p>
      <p className="vote-result__mock-note">예시 목 투표 결과이며 실제 서버 집계가 아니에요.</p>
    </section>
  );
}
