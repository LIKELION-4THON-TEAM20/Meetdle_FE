import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { roomMutations } from '../../api/rooms';
import { createdRoomDestination } from '../../features/serverRoom/routing';
import { authErrorMessage } from '../../features/auth/errors';
import { PATHS } from '../../router/paths';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import DateCalendar from './DateCalendar';
import type { DateRange } from './DateCalendar';
import CapacityPicker, { MIN_CAPACITY, MAX_CAPACITY } from './CapacityPicker';
import './CreateRoom.scss';

function CreateRoom() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const request = useRef<{ key: string; handle: ReturnType<typeof roomMutations.create> } | null>(
    null,
  );
  const [roomName, setRoomName] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [capacity, setCapacity] = useState(4);
  const canCreate =
    roomName.trim().length > 0 &&
    dateRange !== null &&
    dateRange.end !== null &&
    capacity >= MIN_CAPACITY &&
    capacity <= MAX_CAPACITY;

  return (
    <div className="page create-room">
      <Header title="새 약속 잡기" showBackButton onBack={() => navigate(PATHS.home)} />
      <form
        className="create-room__form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canCreate || !dateRange || !dateRange.end || lock.current) return;
          lock.current = true;
          setBusy(true);
          setError('');
          try {
            const body = {
              title: roomName.trim(),
              dates: { from: dateRange.start, through: dateRange.end },
              capacity,
            };
            const key = JSON.stringify(body);
            if (!request.current || request.current.key !== key)
              request.current = { key, handle: roomMutations.create(body) };
            const response = await request.current.handle.execute();
            const destination = createdRoomDestination(response);
            navigate(destination.to, { state: destination.state, replace: true });
          } catch (cause) {
            setError(authErrorMessage(cause));
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <main className="create-room__content">
          <div className="create-room__intro">
            <h2>새 약속방 만들기</h2>
            <p>날짜·시간·장소를 모아서 한 번에 정해요</p>
          </div>
          <div className="create-room__fields">
            <div className="create-room__field">
              <label className="create-room__label" htmlFor="room-name">
                약속 이름
              </label>
              <input
                id="room-name"
                className="create-room__name"
                placeholder="11월 친구들 모임"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                required
              />
            </div>
            <section
              className="create-room__field"
              aria-labelledby="candidate-dates-label"
              aria-describedby="candidate-dates-help"
            >
              <h3 className="create-room__label" id="candidate-dates-label">
                후보 날짜
              </h3>
              <DateCalendar value={dateRange} onChange={setDateRange} />
              <p className="create-room__date-help" id="candidate-dates-help" aria-live="polite">
                {!dateRange
                  ? '후보 날짜를 선택해주세요'
                  : !dateRange.end
                    ? '종료 날짜를 선택해주세요 (같은 날짜 선택 가능)'
                    : `${dateRange.start} ~ ${dateRange.end}`}
              </p>
            </section>
            <fieldset className="create-room__field create-room__capacity">
              <legend className="create-room__label">참여 정원</legend>
              <CapacityPicker value={capacity} onChange={setCapacity} />
            </fieldset>
          </div>
          <p className="create-room__notice">방장만 약속 정보를 수정할 수 있어요.</p>
        </main>
        {error && <p role="alert">{error}</p>}
        <footer className="create-room__footer">
          <Button type="submit" disabled={!canCreate || busy}>
            {busy ? '생성 중…' : '약속방 만들기'}
          </Button>
        </footer>
      </form>
    </div>
  );
}

export default CreateRoom;
