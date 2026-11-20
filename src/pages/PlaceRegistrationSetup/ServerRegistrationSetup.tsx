import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { getCategoryAvailability, roomMutations } from '../../api/rooms';
import type { CategoryAvailability, RoomState } from '../../api/types';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import Modal from '../../components/common/Modal/Modal';
import { meetingDetails, meetingActions } from '../../features/serverRoom/meeting';
import { estimateServerNow } from '../../features/serverRoom/roomState';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import type { useRoomState } from '../../features/serverRoom/useRoomState';
import { PATHS } from '../../router/paths';
import CategorySelector from './components/CategorySelector';
import DeadlineSelector from './components/DeadlineSelector';
import { HOUR } from './deadlineUtils';
import RegistrationRulesCard from './components/RegistrationRulesCard';
import {
  formatSeoulDeadline,
  parseSeoulInput,
  registrationRequest,
  registrationWindow,
  seoulInput,
  setupCategories,
  setupError,
} from './serverSetupModel';
import type { CategoryId, DeadlineMode } from './types';
import './PlaceRegistrationSetup.scss';

export default function ServerRegistrationSetup({
  room,
  state,
  onOpened,
}: {
  room: RoomState;
  state: ReturnType<typeof useRoomState>;
  onOpened: (selectionId: string) => void;
}) {
  const navigate = useNavigate();
  const selectionId = room.meeting?.selectionId;
  const { roomId } = room;
  const { refresh } = state;
  const [availability, setAvailability] = useState<CategoryAvailability | null>(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [required, setRequired] = useState<CategoryId[]>([]);
  const [mode, setMode] = useState<DeadlineMode>('serverDefault');
  const [customDeadline, setCustomDeadline] = useState<number>();
  const [categoryBlocked, setCategoryBlocked] = useState(false);
  const [showShortage, setShowShortage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [wallTime, setWallTime] = useState(Date.now);
  const running = useRef(false);
  const retry = useRef<{
    key: string;
    handle: ReturnType<typeof roomMutations.openRegistration>;
  } | null>(null);

  useEffect(() => {
    const timer = globalThis.setInterval(() => setWallTime(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const startsAt = room.meeting?.meetingAt;
  const receivedAt = state.receivedAt;
  const sampledNow = room.serverNow;
  useEffect(() => {
    const crossesMinimum = Date.parse(startsAt ?? '') - 6 * HOUR - Date.parse(sampledNow);
    if (!Number.isFinite(crossesMinimum) || crossesMinimum < 0 || crossesMinimum >= 2 ** 31 - 1000)
      return;
    const timer = globalThis.setTimeout(
      () => void refresh(),
      Math.max(0, receivedAt + crossesMinimum + 100 - Date.now()),
    );
    return () => globalThis.clearTimeout(timer);
  }, [startsAt, sampledNow, receivedAt, refresh]);

  useEffect(() => {
    const request = new AbortController();
    void getCategoryAvailability(roomId, request.signal)
      .then((value) => {
        if (request.signal.aborted) return;
        if (value.selectionId !== selectionId) {
          throw new ApiRequestError(409, {
            code: 'STALE_SELECTION',
            message: 'Category selection changed',
          });
        }
        setAvailability(value);
        setRequired([
          ...new Set(
            setupCategories(value)
              .filter(({ id, required, available }) => required && available && id !== 'culture')
              .map(({ id }) => id),
          ),
        ]);
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return;
        setLoadError(setupError(error));
        if (error instanceof ApiRequestError && error.status === 409) void refresh();
      });
    return () => request.abort();
  }, [roomId, selectionId, attempt, refresh]);

  function reloadCategories() {
    setAvailability(null);
    setLoadError('');
    setAttempt((value) => value + 1);
  }

  const now = estimateServerNow(room, state.receivedAt, wallTime);
  const window = registrationWindow(room, now);
  const meeting = meetingDetails(room);
  const categories = availability ? setupCategories(availability) : [];
  const available = categories.filter((item) => item.available).map(({ id }) => id);
  const deadline = mode === 'serverDefault' ? window.minimum : (customDeadline ?? NaN);
  const canStart =
    availability &&
    !busy &&
    !state.loading &&
    registrationRequest(
      room,
      availability,
      required,
      now,
      mode === 'serverDefault' ? undefined : deadline,
    );
  const before = serverScreenUrl(PATHS.confirmed, roomId, selectionId);
  const insufficient = !window.canOpen || (Number.isFinite(deadline) && deadline > window.maximum);

  async function start() {
    if (!availability || !canStart || running.current) return;
    running.current = true;
    setBusy(true);
    setSubmitError('');
    try {
      await state.mutate('OPEN_COLLECTION', async (latest) => {
        const currentTime = estimateServerNow(latest, state.receivedAt);
        const body = registrationRequest(
          latest,
          availability,
          required,
          currentTime,
          mode === 'serverDefault' ? undefined : deadline,
        );
        if (!body)
          throw new ApiRequestError(400, {
            code: 'INVALID_DEADLINE',
            message: 'Invalid registration settings',
          });
        const key = JSON.stringify(body);
        if (retry.current?.key !== key) {
          retry.current = { key, handle: roomMutations.openRegistration(roomId, body) };
        }
        const response = await retry.current.handle.execute();
        onOpened(body.selectionId);
        return response;
      });
    } catch (error) {
      setSubmitError(setupError(error));
      if (error instanceof ApiRequestError) {
        if (error.code === 'INSUFFICIENT_TIME') setShowShortage(true);
        if (error.code === 'STALE_SELECTION' || error.code === 'INVALID_REQUIRED_CATEGORIES')
          reloadCategories();
        if (error.code === 'KEY_REUSED' || error.code === 'SESSION_CHANGED') retry.current = null;
        if (['INVALID_DEADLINE', 'INSUFFICIENT_TIME', 'NETWORK_ERROR'].includes(error.code))
          void refresh();
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="page registration-setup" data-room-screen={PATHS.setup}>
      <Header title="등록 설정" showBackButton onBack={() => navigate(before)} />
      <main className="registration-setup__content">
        <div className="registration-setup__intro">
          <h2>어떤 장소를 함께 모아볼까요?</h2>
          <p>한 사람당 한 곳 이상 등록할 수 있어요. 필수 카테고리는 방 전체에서 채워요.</p>
          {meeting && <p>확정된 약속 일시 · {meeting.dateTime}</p>}
        </div>
        {availability ? (
          <div className="registration-setup__categories">
            <CategorySelector
              categories={categories}
              selected={available}
              requiredIds={required}
              disabled={busy}
              onMove={(id, isRequired) => {
                if (id === 'culture' && isRequired) {
                  setCategoryBlocked(true);
                  return;
                }
                if (!available.includes(id)) return;
                setRequired((current) =>
                  isRequired
                    ? [...new Set([...current, id])]
                    : current.filter((value) => value !== id),
                );
              }}
            />
            <RegistrationRulesCard selected={available} requiredIds={required} server />
          </div>
        ) : loadError ? (
          <>
            <RequestStatus title="장소 등록 설정을 불러오지 못했어요." description={loadError} />
            <Button variant="secondary" onClick={reloadCategories}>
              다시 시도
            </Button>
          </>
        ) : (
          <RequestStatus
            loading
            title="등록 가능한 카테고리를 확인하는 중이에요."
            description="잠시만 기다려주세요."
          />
        )}
        {insufficient && (
          <p className="registration-setup__banner registration-setup__banner--blocked">
            마감 이후 약속까지 남은 시간이 짧아 장소 등록을 진행하기 어려워요. 마감을 앞당기거나
            약속 시간을 다시 선택해주세요.
          </p>
        )}
        {window.canOpen && (
          <DeadlineSelector
            now={now}
            meetingStartsAt={Date.parse(room.meeting?.meetingAt ?? '')}
            deadline={deadline}
            mode={mode}
            allowInvalidSelection
            serverPolicy={{
              window,
              minimumMinutes: window.minimumMinutes,
              format: formatSeoulDeadline,
              toInput: seoulInput,
              fromInput: parseSeoulInput,
            }}
            onChange={(next, timestamp) => {
              setMode(next);
              setCustomDeadline(timestamp);
            }}
          />
        )}
        {submitError && (
          <RequestStatus title="장소 등록을 시작하지 못했어요." description={submitError} />
        )}
        {state.notice && <p role="status">{state.notice}</p>}
      </main>
      <footer className="registration-setup__footer">
        {(insufficient || showShortage) && meetingActions(room).canReselect && (
          <Button
            variant="secondary"
            onClick={() =>
              navigate(`${serverScreenUrl(PATHS.candidates, roomId, selectionId)}&reselectTime=1`)
            }
          >
            약속 시간 다시 정하기
          </Button>
        )}
        <Button
          className="registration-setup__start"
          disabled={!canStart || showShortage}
          onClick={() => void start()}
        >
          {busy ? '장소 등록 시작 중…' : '장소 등록 시작하기'}
        </Button>
      </footer>
      <Modal
        open={categoryBlocked}
        onClose={() => setCategoryBlocked(false)}
        className="registration-setup__category-modal"
        aria-labelledby="server-category-blocked"
      >
        <h2 id="server-category-blocked">분류를 변경할 수 없어요</h2>
        <p>문화시설은 선택 카테고리에만 둘 수 있어요.</p>
        <Button onClick={() => setCategoryBlocked(false)}>확인</Button>
      </Modal>
      <Modal
        open={showShortage}
        onClose={() => setShowShortage(false)}
        className="registration-setup__category-modal"
        aria-labelledby="server-deadline-blocked"
      >
        <h2 id="server-deadline-blocked">장소 등록 시간이 부족해요</h2>
        <p>장소를 모을 수 있는 시간을 확보해야 해요.</p>
        {meetingActions(room).canReselect && (
          <Link to={serverScreenUrl(PATHS.candidates, roomId, selectionId)}>
            일시·지역 다시 선택하기
          </Link>
        )}
        <Button variant="secondary" onClick={() => setShowShortage(false)}>
          닫기
        </Button>
      </Modal>
    </div>
  );
}
