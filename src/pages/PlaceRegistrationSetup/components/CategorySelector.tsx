import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CategoryId } from '../types';

interface CategorySelectorProps {
  selected: CategoryId[];
  requiredIds: CategoryId[];
  disabled?: boolean;
  categories?: ReadonlyArray<{
    id: CategoryId;
    label: string;
    available?: boolean;
    radiusMeters?: number;
  }>;
  onToggle?: (id: CategoryId) => void;
  onMove: (id: CategoryId, required: boolean) => void;
}

function CategorySelector({
  selected,
  requiredIds,
  disabled,
  categories = [],
  onToggle,
  onMove,
}: CategorySelectorProps) {
  const requiredCount = requiredIds.filter((id) => selected.includes(id)).length;
  const optionalCount = selected.length - requiredCount;
  const requiredNames = categories
    .filter(({ id }) => requiredIds.includes(id))
    .map(({ label }) => label);
  const drag = useRef<{
    pointerId: number; x: number; y: number; active: boolean;
    node: HTMLButtonElement; timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const previousBounds = useRef(new Map<CategoryId, DOMRect>());

  function clearDrag() {
    const current = drag.current;
    if (!current) return;
    clearTimeout(current.timer);
    current.node.style.removeProperty('transform');
    current.node.classList.remove('setup-chip--dragging');
    drag.current = null;
  }

  useEffect(() => () => {
    if (drag.current) clearTimeout(drag.current.timer);
  }, []);
  const suppressClick = useRef(false);
  const focusAfterMove = useRef<CategoryId | null>(null);
  const chips = useRef(new Map<CategoryId, HTMLButtonElement>());
  const groups = useRef(new Map<boolean, HTMLDivElement>());

  useLayoutEffect(() => {
    if (!globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const [id, before] of previousBounds.current) {
        const node = chips.current.get(id);
        if (!node) continue;
        const after = node.getBoundingClientRect();
        node.animate([
          { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width})` },
          { transform: 'translate(0, 0) scale(1)' },
        ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
    previousBounds.current.clear();
    if (!focusAfterMove.current) return;
    chips.current.get(focusAfterMove.current)?.focus();
    focusAfterMove.current = null;
  }, [requiredIds]);

  function move(id: CategoryId, required: boolean) {
    if (requiredIds.includes(id) === required) return;
    if (id !== 'culture') focusAfterMove.current = id;
    onMove(id, required);
  }

  return (
    <section className="setup-categories" aria-labelledby="setup-categories-title">
      <h3 id="setup-categories-title">
        카테고리 · 필수 {requiredCount} · 선택 {optionalCount}
      </h3>
      {[true, false].map((required) => (
        <div
          className={`setup-categories__group${required ? '' : ' setup-categories__group--optional'}`}
          data-category-group={required ? 'required' : 'optional'}
          ref={(node) => {
            if (node) groups.current.set(required, node);
            else groups.current.delete(required);
          }}
          key={String(required)}
        >
          <span>{required ? '필수' : '선택'}</span>
          <div className="setup-categories__chips">
            {categories
              .filter(({ id }) => requiredIds.includes(id) === required)
              .map(({ id, label, available }) => (
                <button
                  type="button"
                  className={`setup-chip${selected.includes(id) ? ' setup-chip--selected' : ''}`}
                  aria-pressed={onToggle ? selected.includes(id) : undefined}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  aria-describedby="setup-category-controls"
                  disabled={disabled || available === false}
                  key={id}
                  ref={(node) => {
                    if (node) chips.current.set(id, node);
                    else chips.current.delete(id);
                  }}
                  onClick={(event) => {
                    if (event.detail === 0 || !suppressClick.current) onToggle?.(id);
                    suppressClick.current = false;
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    move(id, event.key === 'ArrowUp');
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={(event) => {
                    if (!event.isPrimary || event.button !== 0) return;
                    clearDrag();
                    suppressClick.current = false;
                    const node = event.currentTarget;
                    const timer = setTimeout(() => {
                      if (!drag.current) return;
                      drag.current.active = true;
                      suppressClick.current = true;
                      node.classList.add('setup-chip--dragging');
                      node.style.transform = 'translate(0, -3px) scale(1.08)';
                    }, 220);
                    drag.current = {
                      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
                      active: false, node, timer,
                    };
                    node.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const start = drag.current;
                    if (start?.pointerId !== event.pointerId) return;
                    const x = event.clientX - start.x;
                    const y = event.clientY - start.y;
                    if (!start.active && Math.hypot(x, y) >= 8) {
                      clearTimeout(start.timer);
                      start.active = true;
                      suppressClick.current = true;
                      start.node.classList.add('setup-chip--dragging');
                    }
                    if (start.active) start.node.style.transform = `translate(${x}px, ${y - 3}px) scale(1.08)`;
                  }}
                  onPointerUp={(event) => {
                    const start = drag.current;
                    if (start?.pointerId !== event.pointerId) return;
                    if (start.active) {
                      previousBounds.current = new Map([...chips.current].map(([key, node]) => [key, node.getBoundingClientRect()]));
                      for (const [destination, group] of groups.current) {
                        const bounds = group.getBoundingClientRect();
                        if (event.clientY >= bounds.top - 7 && event.clientY <= bounds.bottom + 7 &&
                            event.clientX >= bounds.left && event.clientX <= bounds.right) {
                          move(id, destination);
                          break;
                        }
                      }
                    }
                    clearDrag();
                  }}
                  onPointerCancel={clearDrag}
                  onLostPointerCapture={clearDrag}
                >
                  {label}
                  {available === false && ' · 등록 불가'}
                </button>
              ))}
          </div>
        </div>
      ))}
      {!disabled && (
        <p className="registration-setup__help" id="setup-category-controls">
          드래그하거나 위·아래 방향키로 분류를 변경할 수 있어요.
        </p>
      )}
      {!onToggle && requiredIds.length === 0 && (
        <p className="registration-setup__warning" role="status">
          필수 카테고리를 1개 이상 지정해주세요.
        </p>
      )}
      {requiredNames.length > 0 && (
        <p className="registration-setup__help">
          {requiredNames.join('·')}은 방 전체에서 각각 최소 1곳의 후보가 필요해요.
        </p>
      )}
      {selected.length < 1 ? (
        <p className="registration-setup__warning" role="status">
          카테고리를 1개 이상 선택해주세요.
        </p>
      ) : (
        requiredCount < requiredIds.length && (
          <p className="registration-setup__warning" role="status">
            필수 카테고리를 모두 선택해주세요.
          </p>
        )
      )}
    </section>
  );
}

export default CategorySelector;
