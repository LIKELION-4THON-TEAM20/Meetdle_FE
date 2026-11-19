import { useState } from 'react';
import type { ResultPlace, VoteCounts } from '../types';
import { getVotePercentages } from '../resultUtils';

export interface BreakdownCategory {
  id: string;
  name: string;
  places: ResultPlace[];
  autoSelected?: boolean;
}

export default function VoteBreakdown({
  categories,
  countsOnly,
}: {
  categories: Array<
    Omit<BreakdownCategory, 'places'> & {
      places: Array<Pick<ResultPlace, 'id' | 'name'> & { votes?: VoteCounts }>;
    }
  >;
  countsOnly?: boolean;
}) {
  const [selected, setSelected] = useState(categories[0]?.id);
  const category = categories.find(({ id }) => id === selected) ?? categories[0];
  return (
    <section className="vote-breakdown" id="vote-breakdown" aria-labelledby="vote-breakdown-title">
      <h2 id="vote-breakdown-title">카테고리별 투표 결과</h2>
      <div className="vote-breakdown__filters" aria-label="카테고리">
        {categories.map(({ id, name }) => (
          <button
            type="button"
            key={id}
            aria-pressed={id === category?.id}
            onClick={() => setSelected(id)}
          >
            {name}
          </button>
        ))}
      </div>
      {!category?.places.length && <p>후보가 없어요.</p>}
      {category?.places.map((place) => {
        const percentages =
          place.votes && !countsOnly ? getVotePercentages(place.votes) : undefined;
        return (
          <div className="vote-breakdown__item" key={place.id}>
            <h3>
              {category.name} · {place.name}
            </h3>
            {category.autoSelected ? (
              <p>후보가 1곳이라 투표 없이 자동 선정됐어요.</p>
            ) : percentages ? (
              <>
                <div
                  className="vote-breakdown__bar"
                  role="progressbar"
                  aria-label={`${place.name} 좋아요 비율`}
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
              </>
            ) : place.votes ? (
              <p>
                좋아요 {place.votes.like} · 상관없어요 {place.votes.neutral} · 싫어요{' '}
                {place.votes.dislike}
              </p>
            ) : null}
          </div>
        );
      })}
      <p>누가 어떤 선택을 했는지는 공개되지 않아요.</p>
    </section>
  );
}
