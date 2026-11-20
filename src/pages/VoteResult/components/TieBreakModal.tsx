import type { ResultPlace } from '../types';
import { getSelectionReason } from '../resultUtils';
import ResultPlaceCard from './ResultPlaceCard';

export default function TieBreakModal({
  categoryId,
  category,
  candidates,
  selectedId,
  onSelect,
}: {
  categoryId: string;
  category: string;
  candidates: ResultPlace[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="tie-break-panel">
      <h2>{category} 카테고리가 동률이에요</h2>
      <p>
        {candidates.length === 2 ? '두 곳 중 하나를' : '후보 중 한 곳을'} 방장이 최종 선택해주세요.
      </p>
      {candidates.map((place) => (
        <div className="tie-break-panel__candidate" key={place.id}>
          <span className="vote-result__reason">{getSelectionReason(place, candidates)}</span>
          <ResultPlaceCard
            place={place}
            categoryId={categoryId}
            selected={selectedId === undefined ? undefined : selectedId === place.id}
            onSelect={() => onSelect(place.id)}
          />
        </div>
      ))}
    </section>
  );
}
