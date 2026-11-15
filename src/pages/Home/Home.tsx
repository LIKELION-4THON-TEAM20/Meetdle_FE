import type { JoinByCodeHandler } from './join-code.types';
import { useEffect, useRef, useState } from 'react';
import HomeHeader from '../../components/common/HomeHeader/HomeHeader';
import plus from '../../assets/icons/home/plus.svg';
import AppointmentCard from './components/AppointmentCard';
import AddAppointmentSheet from './components/AddAppointmentSheet';
import { MOCK_APPOINTMENTS } from './appointments.mock';
import type { Appointment, AppointmentFilter } from './appointment.types';
import { filterAppointments, getTodayKey } from './appointment.utils';
import './Home.scss';

const FILTERS: { value: AppointmentFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'upcoming', label: '다가오는 약속' },
  { value: 'past', label: '지난 약속' },
];

interface HomeProps {
  appointments?: Appointment[];
  onProfileClick?: () => void;
  onJoinByCode?: JoinByCodeHandler;
}

function Home({ appointments = MOCK_APPOINTMENTS, onProfileClick, onJoinByCode }: HomeProps) {
  const [filter, setFilter] = useState<AppointmentFilter>('all');
  const [today, setToday] = useState(getTodayKey);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const visibleAppointments = filterAppointments(appointments, filter, today);

  useEffect(() => {
    const refreshDate = () => setToday(getTodayKey());
    const timer = window.setInterval(refreshDate, 60_000);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, []);

  return (
    <div className="page home-page">
      <HomeHeader onProfileClick={onProfileClick} />
      <main className="home-page__content">
        <h1>내 약속</h1>
        <div className="home-page__filters" role="tablist" aria-label="약속 기간">
          {FILTERS.map((item, index) => (
            <button
              key={item.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`appointment-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              aria-controls="appointment-list"
              tabIndex={filter === item.value ? 0 : -1}
              onClick={() => setFilter(item.value)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === 'ArrowRight') next = (index + 1) % FILTERS.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + FILTERS.length - 1) % FILTERS.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = FILTERS.length - 1;
                else return;
                event.preventDefault();
                setFilter(FILTERS[next].value);
                tabRefs.current[next]?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <section
          className="home-page__list"
          id="appointment-list"
          role="tabpanel"
          aria-labelledby={`appointment-tab-${filter}`}
          tabIndex={0}
        >
          <div className="home-page__results" role="status" aria-live="polite">
            {visibleAppointments.length}개의 약속
          </div>
          {visibleAppointments.length ? (
            visibleAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} today={today} />
            ))
          ) : (
            <p className="home-page__empty">표시할 약속이 없어요.</p>
          )}
        </section>
      </main>
      <div className="home-page__floating-container">
        <button
          className="home-page__add"
          type="button"
          aria-label="약속 추가하기"
          aria-haspopup="dialog"
          aria-expanded={isSheetOpen}
          onClick={() => setIsSheetOpen(true)}
        >
          <img src={plus} alt="" draggable={false} />
        </button>
      </div>
      {isSheetOpen && (
        <AddAppointmentSheet onClose={() => setIsSheetOpen(false)} onSubmitCode={onJoinByCode} />
      )}
    </div>
  );
}

export default Home;
