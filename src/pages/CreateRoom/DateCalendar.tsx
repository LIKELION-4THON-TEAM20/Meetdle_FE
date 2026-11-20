import { useState } from 'react';
import chevronLeft from '../../assets/icons/create-room/chevron-left.svg';
import chevronRight from '../../assets/icons/create-room/chevron-right.svg';

export interface DateRange {
  start: string;
  end: string | null;
}

interface DateCalendarProps {
  value: DateRange | null;
  onChange: (value: DateRange) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function DateCalendar({ value, onChange }: DateCalendarProps) {
  const [today] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = visibleMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function selectDate(date: string) {
    if (!value || value.end) {
      onChange({ start: date, end: null });
    } else {
      onChange({
        start: date < value.start ? date : value.start,
        end: date < value.start ? value.start : date,
      });
    }
  }

  return (
    <div className="date-calendar" aria-label="후보 날짜 달력">
      <div className="date-calendar__navigation">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
        >
          <img src={chevronLeft} alt="" draggable={false} />
        </button>
        <span aria-live="polite">
          {year}년 {month + 1}월
        </span>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
        >
          <img src={chevronRight} alt="" draggable={false} />
        </button>
      </div>
      <div className="date-calendar__grid">
        {WEEKDAYS.map((day) => (
          <span className="date-calendar__weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - firstWeekday + 1;
          if (day < 1 || day > daysInMonth)
            return (
              <span className="date-calendar__empty" key={index} aria-hidden="true">
                ·
              </span>
            );
          const date = dateKey(year, month, day);
          const isEndpoint = date === value?.start || date === value?.end;
          const isWithinRange = !!value?.end && date > value.start && date < value.end;
          return (
            <button
              type="button"
              className={`date-calendar__day${isEndpoint ? ' date-calendar__day--endpoint' : ''}${isWithinRange ? ' date-calendar__day--within' : ''}`}
              key={date}
              disabled={date < todayKey}
              aria-label={`${year}년 ${month + 1}월 ${day}일`}
              aria-pressed={isEndpoint || isWithinRange}
              aria-current={date === todayKey ? 'date' : undefined}
              onClick={() => selectDate(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DateCalendar;
