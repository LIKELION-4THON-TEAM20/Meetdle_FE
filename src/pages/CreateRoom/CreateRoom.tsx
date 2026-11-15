import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { CreateRoomState } from './createRoomState';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import DateCalendar from './DateCalendar';
import type { DateRange } from './DateCalendar';
import CapacityPicker, { MIN_CAPACITY, MAX_CAPACITY } from './CapacityPicker';
import './CreateRoom.scss';

function CreateRoom() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [capacity, setCapacity] = useState(4);
  const canCreate =
    roomName.trim().length > 0 &&
    dateRange !== null &&
    capacity >= MIN_CAPACITY &&
    capacity <= MAX_CAPACITY;

  return (
    <div className="page create-room">
      <Header title="새 약속 잡기" />
      <form
        className="create-room__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canCreate || !dateRange) return;
          const state: CreateRoomState = { name: roomName.trim(), dateRange, capacity };
          navigate('/rooms/create/complete', { state });
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
        <footer className="create-room__footer">
          <Button type="submit" disabled={!canCreate}>
            약속방 만들기
          </Button>
        </footer>
      </form>
    </div>
  );
}

export default CreateRoom;
