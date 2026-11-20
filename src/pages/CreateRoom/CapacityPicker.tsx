import { useEffect, useRef, useState } from 'react';

export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 6;
const ITEM_WIDTH = 42;

interface CapacityPickerProps {
  value: number;
  onChange: (value: number) => void;
}

function CapacityPicker({ value, onChange }: CapacityPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [position, setPosition] = useState(value);
  const initialValueRef = useRef(value);
  const didDragRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = (initialValueRef.current - MIN_CAPACITY) * ITEM_WIDTH;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      element.scrollLeft +=
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  function scrollToValue(next: number) {
    const bounded = Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, next));
    scrollRef.current?.scrollTo({
      left: (bounded - MIN_CAPACITY) * ITEM_WIDTH,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  return (
    <div className="capacity-picker">
      <div className="capacity-picker__highlight" aria-hidden="true" />
      <div
        ref={scrollRef}
        className="capacity-picker__scroll"
        role="slider"
        tabIndex={0}
        aria-label="참여 정원"
        aria-orientation="horizontal"
        aria-valuemin={MIN_CAPACITY}
        aria-valuemax={MAX_CAPACITY}
        aria-valuenow={value}
        aria-valuetext={`${value}명`}
        onScroll={(event) => {
          const next = MIN_CAPACITY + event.currentTarget.scrollLeft / ITEM_WIDTH;
          setPosition(next);
          onChangeRef.current(Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.round(next))));
        }}
        onKeyDown={(event) => {
          const next = {
            ArrowLeft: value - 1,
            ArrowDown: value - 1,
            ArrowRight: value + 1,
            ArrowUp: value + 1,
            Home: MIN_CAPACITY,
            End: MAX_CAPACITY,
          }[event.key];
          if (next !== undefined) {
            event.preventDefault();
            scrollToValue(next);
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse') return;
          didDragRef.current = false;
          dragRef.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current || event.buttons !== 1) return;
          if (Math.abs(dragRef.current.x - event.clientX) > 4) didDragRef.current = true;
          event.currentTarget.scrollLeft =
            dragRef.current.scrollLeft + dragRef.current.x - event.clientX;
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {Array.from({ length: MAX_CAPACITY - MIN_CAPACITY + 1 }, (_, index) => {
          const people = index + MIN_CAPACITY;
          const distance = Math.min(2, Math.abs(people - position));
          return (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              key={people}
              className="capacity-picker__number"
              style={{
                fontSize: `${distance < 1 ? 36 - distance * 12 : 24 - (distance - 1) * 6}px`,
                color: distance < 0.5 ? '#fff' : distance < 1.5 ? '#969696' : '#c4c4c4',
              }}
              onClick={() => {
                if (!didDragRef.current) scrollToValue(people);
                didDragRef.current = false;
              }}
            >
              {people}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CapacityPicker;
