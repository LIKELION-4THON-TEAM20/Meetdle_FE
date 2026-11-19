import type { CategoryId } from '../types';

function RegistrationRulesCard({
  selected,
  requiredIds,
}: {
  selected: CategoryId[];
  requiredIds: CategoryId[];
  server?: boolean;
}) {
  const requiredCount = requiredIds.filter((id) => selected.includes(id)).length;
  return (
    <dl className="setup-rules" aria-label="등록 규칙 요약">
      <div>
        <dt>선택한 카테고리</dt>
        <dd>
          {selected.length}개 (필수 {requiredCount} · 선택 {selected.length - requiredCount})
        </dd>
      </div>
      <div>
        <dt>1인 최소 등록</dt>
        <dd>1곳 이상</dd>
      </div>
    </dl>
  );
}

export default RegistrationRulesCard;
