import type { ResultPlace } from '../types';
import ResultPlaceCard from './ResultPlaceCard';

// The Figma variant is a full content panel rather than an overlay.
export default function TieBreakModal({
  category,
  candidates,
  onSelect,
}: {
  category: string;
  candidates: ResultPlace[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="tie-break-panel" aria-labelledby="tie-break-title">
      <h2 id="tie-break-title">{category} 카테고리가 동률이에요</h2>
      <p>두 곳 중 하나를 방장이 최종 선택해주세요.</p>
      {candidates.map((place) => (
        <ResultPlaceCard
          key={place.id}
          place={place}
          category={category}
          onSelect={() => onSelect(place.id)}
        />
      ))}
    </section>
  );
}
