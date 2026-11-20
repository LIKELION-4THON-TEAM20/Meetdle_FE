import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useNavigate } from 'react-router';
import { PATHS } from '../../router/paths';
import { useRef, useState } from 'react';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import AvailabilityGrid from './components/AvailabilityGrid';
import StationSearch from './components/StationSearch';
import { cellKey, paintAvailability, prepareScheduleInput } from './scheduleUtils';
import { TIME_SLOTS } from './timeSlots';
import type {
  AvailabilityCellKey,
  ScheduleRoom,
  ScheduleTransitInput,
  Station,
  StationSearchValue,
} from './types';
import './ScheduleTransit.scss';

interface ScheduleTransitProps {
  room: ScheduleRoom;
  stations?: readonly Station[];
  onComplete?: (input: ScheduleTransitInput) => void | Promise<void>;
  initialInput?: {
    selected: ReadonlySet<AvailabilityCellKey>;
    departure: StationSearchValue;
    destination: StationSearchValue;
  };
  renderStationSearch?: (
    kind: 'departure' | 'destination',
    value: StationSearchValue,
    onChange: (value: StationSearchValue) => void,
  ) => import('react').ReactNode;
  disabled?: boolean;
  freeze?: boolean;
  requiresReload?: boolean;
  statusMessage?: string;
  onReload?: () => void;
  onViewStatus?: () => void;
  onBack?: () => void;
}

function ScheduleTransit({
  room,
  stations = [],
  onComplete,
  initialInput,
  renderStationSearch,
  disabled = false,
  freeze = false,
  requiresReload = false,
  statusMessage,
  onReload,
  onViewStatus,
  onBack,
}: ScheduleTransitProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<AvailabilityCellKey>>(
    () => new Set(initialInput?.selected),
  );
  const [departure, setDeparture] = useState<StationSearchValue>(
    initialInput?.departure ?? { query: '', station: null },
  );
  const [destination, setDestination] = useState<StationSearchValue>(
    initialInput?.destination ?? { query: '', station: null },
  );
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const dates = [...new Set(room.candidateDates)];
  const selectedCount = dates.reduce(
    (total, date) =>
      total + TIME_SLOTS.filter((slot) => selected.has(cellKey(date, slot.id))).length,
    0,
  );
  const input = prepareScheduleInput(room, selected, departure, destination);

  return (
    <div className="page schedule-transit">
      <Header title="일정 입력" showBackButton onBack={onBack ?? (() => navigate(PATHS.home))} />
      <form
        className="schedule-transit__form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!input || disabled || requiresReload || submittingRef.current) return;
          if (!onComplete) {
            setNotice('일정·이동 정보 저장과 다음 화면은 아직 연결되지 않았어요.');
            return;
          }
          submittingRef.current = true;
          setSubmitting(true);
          setNotice('');
          try {
            await onComplete(input);
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해주세요.',
            );
          } finally {
            submittingRef.current = false;
            setSubmitting(false);
          }
        }}
      >
        <main className="schedule-transit__content">
          {statusMessage && (
            <p className="schedule-transit__notice" role="status">
              {statusMessage}
            </p>
          )}
          <fieldset
            className="schedule-transit__fields"
            disabled={disabled || freeze || submitting}
          >
            <div className="schedule-transit__intro">
              <h2>가능 시간 + 이동 정보 입력</h2>
              <p>가능한 시간대와 이동 정보를 알려주세요</p>
            </div>
            <section
              className="schedule-transit__availability"
              aria-labelledby="availability-title"
            >
              <p className="schedule-transit__section-label">시간 정보</p>
              <div className="schedule-transit__availability-heading">
                <h3 id="availability-title">가능한 시간을 모두 선택해주세요</h3>
                <span
                  className="schedule-transit__count schedule-transit__count--primary"
                  aria-hidden="true"
                >
                  {selectedCount}시간 선택
                </span>
              </div>
              {dates.length ? (
                <AvailabilityGrid
                  dates={dates}
                  selected={selected}
                  onPaint={(keys, select) => {
                    setSelected((previous) => paintAvailability(previous, keys, select));
                    setNotice('');
                  }}
                />
              ) : (
                <p>후보 날짜가 없어요.</p>
              )}
              <div className="schedule-transit__grid-hint">
                <span className="schedule-transit__count" role="status" aria-live="polite">
                  {selectedCount}시간 선택
                </span>
                <p>드래그하면 연속된 시간을 한 번에 선택해요</p>
              </div>
            </section>
            <section className="schedule-transit__transit" aria-labelledby="transit-title">
              <h3 className="schedule-transit__section-label" id="transit-title">
                이동 정보
              </h3>
              {renderStationSearch ? (
                renderStationSearch('departure', departure, (value) => {
                  setDeparture(value);
                  setNotice('');
                })
              ) : (
                <StationSearch
                  kind="departure"
                  stations={stations}
                  value={departure}
                  onChange={(value) => {
                    setDeparture(value);
                    setNotice('');
                  }}
                />
              )}
              {renderStationSearch ? (
                renderStationSearch('destination', destination, (value) => {
                  setDestination(value);
                  setNotice('');
                })
              ) : (
                <StationSearch
                  kind="destination"
                  stations={stations}
                  value={destination}
                  onChange={(value) => {
                    setDestination(value);
                    setNotice('');
                  }}
                />
              )}
            </section>
          </fieldset>
          {submitting && (
            <RequestStatus
              loading
              title="입력한 정보를 저장하는 중이에요."
              description="저장 후 참여 현황으로 이동해요."
            />
          )}
          {notice && (
            <RequestStatus
              title="입력 정보를 확인해주세요."
              description={notice}
              onRetry={requiresReload ? onReload : undefined}
            />
          )}
        </main>
        <footer className="schedule-transit__footer">
          {disabled && onViewStatus ? (
            <Button type="button" onClick={onViewStatus}>
              참여 현황 보기
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input || submitting || disabled || requiresReload}
              aria-busy={submitting}
            >
              {submitting ? '저장 확인 중…' : '입력 완료'}
            </Button>
          )}
        </footer>
      </form>
    </div>
  );
}

export default ScheduleTransit;
