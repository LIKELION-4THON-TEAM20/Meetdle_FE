import { useRef, useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import type { ResultCategory, ResultRole } from '../types';
import { moveVisitOrder } from '../resultUtils';

interface Props {
  categories: ResultCategory[];
  order: string[];
  role: ResultRole;
  onClose: () => void;
  onSave: (order: string[]) => void;
}

export default function VisitOrderSheet({ categories, order, role, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(() => [...order]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const rows = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<{ id: string; pointerId: number; original: string[] } | null>(null);
  const host = role === 'host';
  const move = (id: string, target: number) => {
    if (!host) return;
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
        <button
          type="button"
          className="vote-result__text-button"
          onClick={onClose}
          aria-label="방문 순서 닫기"
        >
          닫기
        </button>
      </div>
      <p id="visit-order-description">
        {host
          ? '드래그해서 방문 순서를 바꿀 수 있어요'
          : '방장이 정한 방문 순서예요. 순서 변경은 방장만 할 수 있어요.'}
      </p>
      <ol className="visit-order-sheet__list">
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
                      event.currentTarget.setPointerCapture(event.pointerId);
                      drag.current = { id, pointerId: event.pointerId, original: [...draft] };
                      setDragging(id);
                    }}
                    onPointerMove={(event) => {
                      if (!drag.current || drag.current.pointerId !== event.pointerId || !host)
                        return;
                      const positions = draft.map((rowId, rowIndex) => {
                        const rect = rows.current.get(rowId)?.getBoundingClientRect();
                        return {
                          index: rowIndex,
                          distance: rect
                            ? Math.abs(event.clientY - (rect.top + rect.height / 2))
                            : Infinity,
                        };
                      });
                      const nearest = positions.reduce((best, position) =>
                        position.distance < best.distance ? position : best,
                      );
                      if (nearest.index !== draft.indexOf(drag.current.id))
                        move(drag.current.id, nearest.index);
                    }}
                    onPointerUp={(event) => {
                      if (drag.current?.pointerId !== event.pointerId) return;
                      drag.current = null;
                      setDragging(null);
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => {
                      if (drag.current) setDraft(drag.current.original);
                      drag.current = null;
                      setDragging(null);
                    }}
                    onLostPointerCapture={() => {
                      if (drag.current) setDraft(drag.current.original);
                      drag.current = null;
                      setDragging(null);
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
            disabled={dragging !== null}
            onClick={() => {
              if (host) onSave(draft);
            }}
          >
            순서 저장하기
          </Button>
        </>
      )}
    </Modal>
  );
}
