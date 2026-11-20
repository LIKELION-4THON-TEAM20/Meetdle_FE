import RequestStatus from '../../../components/common/RequestStatus/RequestStatus';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import type { ResultCategory, ResultRole } from '../types';
import { moveVisitOrder } from '../resultUtils';

interface Props {
  categories: Array<{ id: string; name: string; place: Pick<ResultCategory['place'], 'name'> }>;
  order: string[];
  role: ResultRole;
  onClose: () => void;
  onSave: (order: string[]) => void;
  busy?: boolean;
  error?: string;
  onRetry?: () => void;
}

export default function VisitOrderSheet({
  categories,
  order,
  role,
  onClose,
  onSave,
  busy,
  error,
  onRetry,
}: Props) {
  const [draft, setDraft] = useState(() => [...order]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<{
    id: string; pointerId: number; original: string[]; y: number; active: boolean;
    node: HTMLLIElement; timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const previousBounds = useRef(new Map<string, DOMRect>());
  const reducedMotion = () => globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clearDrag() {
    const current = drag.current;
    if (!current) return;
    clearTimeout(current.timer);
    current.node.style.removeProperty('transform');
    current.node.style.removeProperty('transition');
    drag.current = null;
    setDragging(null);
  }
  useEffect(() => () => {
    if (drag.current) clearTimeout(drag.current.timer);
  }, []);
  useLayoutEffect(() => {
    if (!reducedMotion()) for (const [id, before] of previousBounds.current) {
      const node = rows.current.get(id);
      if (!node) continue;
      const after = node.getBoundingClientRect();
      node.animate([
        { transform: `translateY(${before.top - after.top}px) scale(${before.width / after.width})` },
        { transform: 'translateY(0) scale(1)' },
      ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    previousBounds.current.clear();
  }, [draft]);
  const host = role === 'host';
  const move = (id: string, target: number) => {
    if (!host || busy) return;
    setDraft((previous) => moveVisitOrder(previous, id, target));
    setAnnouncement(`${target + 1}번째 순서로 이동했어요.`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      className="visit-order-sheet"
      aria-labelledby="visit-order-title"
      aria-describedby="visit-order-description"
    >
      <div className="visit-order-sheet__header">
        <h2 id="visit-order-title">{host ? '방문 순서 변경' : '방문 순서 확인'}</h2>
      </div>
      <p id="visit-order-description">
        {host
          ? '드래그해서 방문 순서를 바꿀 수 있어요'
          : '방장이 정한 방문 순서예요. 순서 변경은 방장만 할 수 있어요.'}
      </p>
      <ol
        className="visit-order-sheet__list"
        ref={list}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.pointerId !== event.pointerId) return;
          const delta = event.clientY - start.y;
          if (!start.active && Math.abs(delta) >= 8) {
            clearTimeout(start.timer);
            start.active = true;
            setDragging(start.id);
          }
          if (start.active) {
            start.node.style.transition = 'none';
            start.node.style.transform = `translateY(${delta - 3}px) scale(1.04)`;
          }
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start || start.pointerId !== event.pointerId) return;
          if (start.active) {
            previousBounds.current = new Map([...rows.current].map(([id, node]) => [id, node.getBoundingClientRect()]));
            const rects = start.original.map((id, index) => {
              const node = rows.current.get(id);
              const rect = node?.getBoundingClientRect();
              const center = rect ? rect.top + rect.height / 2 - (id === start.id ? event.clientY - start.y - 3 : 0) : Infinity;
              return { index, distance: Math.abs(event.clientY - center) };
            });
            const target = rects.reduce((best, row) => row.distance < best.distance ? row : best);
            move(start.id, target.index);
          }
          clearDrag();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={clearDrag}
        onLostPointerCapture={clearDrag}
      >
        {draft.map((id, index) => {
          const category = categories.find((item) => item.id === id);
          if (!category) return null;
          return (
            <li
              key={id}
              ref={(node) => {
                if (node) rows.current.set(id, node);
                else rows.current.delete(id);
              }}
              className={dragging === id ? 'is-dragging' : undefined}
            >
              <div className="visit-order-sheet__row">
                <span className="visit-order-sheet__number">{index + 1}</span>
                <span className="visit-order-sheet__name">
                  {category.place.name} · {category.name}
                </span>
                {host && (
                  <button
                    type="button"
                    disabled={busy}
                    className="visit-order-sheet__handle"
                    aria-label={`${category.place.name} 순서 변경, 위아래 방향키로 이동`}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                      event.preventDefault();
                      const target = index + (event.key === 'ArrowUp' ? -1 : 1);
                      if (target >= 0 && target < draft.length) move(id, target);
                    }}
                    onPointerDown={(event) => {
                      if (!host || event.button !== 0 || !event.isPrimary) return;
                      if (busy) return;
                      const node = rows.current.get(id);
                      if (!node) return;
                      clearDrag();
                      list.current?.setPointerCapture(event.pointerId);
                      const timer = setTimeout(() => {
                        const start = drag.current;
                        if (!start) return;
                        start.active = true;
                        setDragging(id);
                        if (!reducedMotion()) node.style.transition = 'transform 160ms cubic-bezier(.2,.8,.2,1)';
                        node.style.transform = 'translateY(-3px) scale(1.04)';
                      }, 220);
                      drag.current = { id, pointerId: event.pointerId, original: [...draft], y: event.clientY, active: false, node, timer };
                    }}
                  >
                    ≡
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="visit-order-sheet__announcement" role="status">
        {announcement}
      </p>
      {host && (
        <>
          <Button
            disabled={dragging !== null || busy}
            onClick={() => {
              if (host) onSave(draft);
            }}
          >
            순서 저장하기
          </Button>
        </>
      )}
      {error && <RequestStatus title="방문 순서를 저장하지 못했어요." description={error} />}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          결과 상태 다시 확인
        </Button>
      )}
    </Modal>
  );
}
