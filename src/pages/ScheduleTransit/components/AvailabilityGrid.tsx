import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { cellKey, formatCandidateDate } from '../scheduleUtils';
import { TIME_SLOT_GROUPS, TIME_SLOTS } from '../timeSlots';
import type { AvailabilityCellKey } from '../types';

interface AvailabilityGridProps {
  dates: readonly string[];
  selected: ReadonlySet<AvailabilityCellKey>;
  onPaint: (keys: readonly AvailabilityCellKey[], select: boolean) => void;
}

interface Stroke {
  pointerId: number;
  select: boolean;
  visited: Set<AvailabilityCellKey>;
  x: number;
  y: number;
}

function AvailabilityGrid({ dates, selected, onPaint }: AvailabilityGridProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const [focused, setFocused] = useState<AvailabilityCellKey | null>(null);
  const firstKey = dates.length ? cellKey(dates[0], TIME_SLOTS[0].id) : null;
  const activeKey =
    focused && dates.some((date) => TIME_SLOTS.some((slot) => cellKey(date, slot.id) === focused))
      ? focused
      : firstKey;

  function visit(keys: AvailabilityCellKey[], stroke: Stroke) {
    const fresh = keys.filter((key) => !stroke.visited.has(key));
    if (!fresh.length) return;
    fresh.forEach((key) => stroke.visited.add(key));
    onPaint(fresh, stroke.select);
  }

  function getCell(element: Element | null) {
    const button = element?.closest<HTMLButtonElement>('button[data-availability-key]');
    return button && gridRef.current?.contains(button) ? button : null;
  }

  function handlePointerDown(event: PointerEvent<HTMLTableElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const button = getCell(event.target instanceof Element ? event.target : null);
    if (!button) return;
    event.preventDefault();
    const key = button.dataset.availabilityKey as AvailabilityCellKey;
    const stroke = {
      pointerId: event.pointerId,
      select: !selected.has(key),
      visited: new Set<AvailabilityCellKey>(),
      x: event.clientX,
      y: event.clientY,
    };
    strokeRef.current = stroke;
    button.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    visit([key], stroke);
  }

  function handlePointerMove(event: PointerEvent<HTMLTableElement>) {
    const stroke = strokeRef.current;
    if (!stroke || event.pointerId !== stroke.pointerId) return;
    const distance = Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y);
    const steps = Math.max(1, Math.ceil(distance / 10));
    const keys: AvailabilityCellKey[] = [];
    // 빠른 이동에서도 이벤트 사이의 칸을 빠뜨리지 않도록 경로를 확인한다.
    for (let step = 1; step <= steps; step += 1) {
      const x = stroke.x + ((event.clientX - stroke.x) * step) / steps;
      const y = stroke.y + ((event.clientY - stroke.y) * step) / steps;
      const button = getCell(document.elementFromPoint(x, y));
      if (button) keys.push(button.dataset.availabilityKey as AvailabilityCellKey);
    }
    visit(keys, stroke);
    stroke.x = event.clientX;
    stroke.y = event.clientY;
  }

  function finishStroke(event: PointerEvent<HTMLTableElement>) {
    if (event.pointerId === strokeRef.current?.pointerId) strokeRef.current = null;
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    dateIndex: number,
    slotIndex: number,
  ) {
    let column = dateIndex;
    let row = slotIndex;
    if (event.key === 'ArrowLeft') column -= 1;
    else if (event.key === 'ArrowRight') column += 1;
    else if (event.key === 'ArrowUp') row -= 1;
    else if (event.key === 'ArrowDown') row += 1;
    else if (event.key === 'Home') {
      column = 0;
      if (event.ctrlKey) row = 0;
    } else if (event.key === 'End') {
      column = dates.length - 1;
      if (event.ctrlKey) row = TIME_SLOTS.length - 1;
    } else return;
    event.preventDefault();
    column = Math.min(dates.length - 1, Math.max(0, column));
    row = Math.min(TIME_SLOTS.length - 1, Math.max(0, row));
    const key = cellKey(dates[column], TIME_SLOTS[row].id);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-availability-key="${CSS.escape(key)}"]`)
      ?.focus();
  }

  return (
    <div className="availability-grid" aria-describedby="availability-help">
      <p className="schedule-transit__sr-only" id="availability-help">
        시간 칸에서 드래그하면 연속 선택하며, 시간 표시와 날짜 머리글에서는 화면을 스크롤할 수
        있어요. 방향키로 칸을 이동하고 Enter 또는 Space로 선택·해제하세요.
      </p>
      <table
        ref={gridRef}
        style={{ '--date-count': dates.length } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onLostPointerCapture={finishStroke}
        onDragStart={(event) => event.preventDefault()}
      >
        <caption className="schedule-transit__sr-only">후보 날짜별 가능한 시간</caption>
        <colgroup>
          <col className="availability-grid__time-column" />
          {dates.map((date) => (
            <col key={date} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th aria-label="시간" />
            {dates.map((date) => {
              const { dateLabel, weekday } = formatCandidateDate(date);
              return (
                <th scope="col" key={date}>
                  <time dateTime={date}>
                    {dateLabel}
                    <br />
                    {weekday}
                  </time>
                </th>
              );
            })}
          </tr>
        </thead>
        {TIME_SLOT_GROUPS.map((group) => (
          <tbody key={group.label}>
            <tr className="availability-grid__group">
              <th colSpan={dates.length + 1} scope="rowgroup">
                {group.label}
              </th>
            </tr>
            {group.slots.map((slot) => {
              const slotIndex = TIME_SLOTS.findIndex((item) => item.id === slot.id);
              return (
                <tr key={slot.id}>
                  <th className="availability-grid__hour" scope="row">
                    {slot.id}
                  </th>
                  {dates.map((date, dateIndex) => {
                    const key = cellKey(date, slot.id);
                    return (
                      <td key={key}>
                        <button
                          type="button"
                          data-availability-key={key}
                          aria-label={`${date} ${slot.startHour}시부터 ${slot.endHour}시`}
                          aria-pressed={selected.has(key)}
                          tabIndex={key === activeKey ? 0 : -1}
                          onFocus={() => setFocused(key)}
                          onClick={(event) => {
                            if (event.detail === 0) onPaint([key], !selected.has(key));
                          }}
                          onKeyDown={(event) => handleCellKeyDown(event, dateIndex, slotIndex)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export default AvailabilityGrid;
