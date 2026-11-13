import { CATEGORIES } from '../mockData';
import type { CategoryId } from '../types';

interface CategorySelectorProps {
  selected: CategoryId[];
  onToggle: (id: CategoryId) => void;
}

function CategorySelector({ selected, onToggle }: CategorySelectorProps) {
  const requiredCount = CATEGORIES.filter(
    (category) => category.required && selected.includes(category.id),
  ).length;
  const optionalCount = selected.length - requiredCount;
  return (
    <section className="setup-categories" aria-labelledby="setup-categories-title">
      <h3 id="setup-categories-title">
        카테고리 · 필수 {requiredCount} · 선택 {optionalCount}
      </h3>
      {[true, false].map((required) => (
        <div
          className={`setup-categories__group${required ? '' : ' setup-categories__group--optional'}`}
          key={String(required)}
        >
          <span>{required ? '필수' : '선택'}</span>
          <div className="setup-categories__chips">
            {CATEGORIES.filter((category) => category.required === required).map((category) => (
              <button
                type="button"
                className="setup-chip"
                aria-pressed={selected.includes(category.id)}
                key={category.id}
                onClick={() => onToggle(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="registration-setup__help">
        식당과 카페는 방 전체에서 최소 1곳의 후보가 필요해요.
      </p>
      {selected.length === 0 ? (
        <p className="registration-setup__warning" role="status">
          카테고리를 1개 이상 선택해야 등록을 시작할 수 있어요.
        </p>
      ) : (
        requiredCount < CATEGORIES.filter((category) => category.required).length && (
          <p className="registration-setup__warning" role="status">
            필수 카테고리인 식당과 카페를 모두 선택해주세요.
          </p>
        )
      )}
    </section>
  );
}

export default CategorySelector;
