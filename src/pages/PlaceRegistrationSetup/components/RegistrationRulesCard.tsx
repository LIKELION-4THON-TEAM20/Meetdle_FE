import { CATEGORIES, REGISTRATION_RULES } from '../mockData';
import type { CategoryId } from '../types';

function RegistrationRulesCard({ selected }: { selected: CategoryId[] }) {
  const requiredCount = CATEGORIES.filter(
    (category) => category.required && selected.includes(category.id),
  ).length;
  return (
    <dl className="setup-rules" aria-label="등록 규칙 요약">
      <div>
        <dt>선택한 카테고리</dt>
        <dd>
          {selected.length}개 (필수 {requiredCount} · 선택 {selected.length - requiredCount})
        </dd>
      </div>
      <div>
        <dt>1인 최대 등록</dt>
        <dd>{selected.length}곳 (카테고리별 1곳)</dd>
      </div>
      <div>
        <dt>1인 최소 등록</dt>
        <dd>{REGISTRATION_RULES.minimumPlacesPerPerson}곳 이상</dd>
      </div>
    </dl>
  );
}

export default RegistrationRulesCard;
