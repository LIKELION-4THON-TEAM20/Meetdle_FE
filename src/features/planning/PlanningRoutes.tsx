import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { isServerRoomId } from '../../api/rooms';
import type { RoomState } from '../../api/types';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import MockRoomLayout from '../mockRoom/MockRoomLayout';
import ParticipationStatus from '../../pages/ParticipationStatus/ParticipationStatus';
import ParticipationSummary from '../../pages/ParticipationStatus/components/ParticipationSummary';
import ParticipantList from '../../pages/ParticipationStatus/components/ParticipantList';
import TimeRegionCandidates, {
  TimeRegionCandidatesView,
} from '../../pages/TimeRegionCandidates/TimeRegionCandidates';
import type { CandidateConfirmationRequest } from '../../pages/TimeRegionCandidates/types';
import MeetingConfirmed from '../../pages/MeetingConfirmed/MeetingConfirmed';
import { PATHS } from '../../router/paths';
import { planningCandidates, meetingSelection, seoulDateTime } from './model';
import { calculationOperation, selectionOperation } from './operations';
import { usePlanningRoom } from './usePlanningRoom';
import './planning.scss';

function message(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.code === 'SESSION_CHANGED')
      return '로그인이 필요해요. 다시 로그인한 뒤 방을 열어주세요.';
    if (error.status === 403) return '이 방에 접근하거나 요청을 실행할 권한이 없어요.';
    if (error.status === 404 || error.status === 410)
      return '약속방을 찾을 수 없어요. 홈에서 방을 다시 확인해주세요.';
    if (error.code === 'NO_FEASIBLE_OPTION')
      return '비교 가능한 후보가 없어요. 참여자의 입력을 확인해주세요.';
    if (error.code === 'NOT_ENOUGH_INPUTS') return '입력을 완료한 참여자가 부족해요.';
    if (error.status === 409)
      return '방 상태나 입력 버전이 바뀌었어요. 최신 상태를 다시 조회해주세요.';
    if (error.status === 429) return '요청이 많아요. 잠시 후 다시 시도해주세요.';
    if (error.status === 503) return '이동정보를 계산할 수 없어요. 잠시 후 다시 시도해주세요.';
    if (error.code === 'NETWORK_ERROR')
      return '서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.';
  }
  if (error instanceof TypeError)
    return '서버 설정 또는 응답을 확인할 수 없어요. 다시 조회해주세요.';
  return error instanceof Error ? error.message : '요청을 처리하지 못했어요.';
}

function ErrorNotice({ error }: { error: unknown }) {
  const login =
    error instanceof ApiRequestError && (error.status === 401 || error.code === 'SESSION_CHANGED');
  return (
    <div className="planning-notice">
      <p role="alert">{message(error)}</p>
      {login && <Link to={PATHS.login}>로그인하기</Link>}
    </div>
  );
}

function LoadingOrError({ error, reload }: { error: unknown; reload: () => void }) {
  return (
    <div className="page planning-status">
      <Header title="약속 정보 확인" />
      <main>
        {error ? (
          <>
            <ErrorNotice error={error} />
            <Button onClick={reload}>다시 조회하기</Button>
          </>
        ) : (
          <p role="status">약속 정보를 불러오는 중이에요.</p>
        )}
        <Link to={PATHS.home}>내 약속 홈으로 이동</Link>
      </main>
    </div>
  );
}

function ServerPlanning({
  roomId,
  screen,
}: {
  roomId: string;
  screen: 'participation' | 'candidates' | 'confirmed';
}) {
  const { state, error, reload } = usePlanningRoom(roomId);
  if (!state) return <LoadingOrError error={error} reload={reload} />;
  return (
    <PlanningContent
      key={`${state.revision}:${state.options?.optionsId}:${state.meeting?.selectionId}`}
      state={state}
      screen={screen}
      reload={reload}
    />
  );
}

function PlanningContent({
  state,
  screen,
  reload,
}: {
  state: RoomState;
  screen: 'participation' | 'candidates' | 'confirmed';
  reload: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const operation = useRef<{ execute: () => Promise<RoomState> } | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const path = (target: string) => `${target}?roomId=${encodeURIComponent(state.roomId)}`;
  const run = async (
    makeOperation: () => { execute: () => Promise<RoomState> },
    target: string,
  ) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      operation.current ??= makeOperation();
      const fresh = await operation.current.execute();
      if (alive.current)
        navigate(path(target), { state: { meeting: fresh.meeting, roomId: fresh.roomId } });
    } catch (cause) {
      if (alive.current) setError(cause);
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const feedback = (
    <>
      {error && <ErrorNotice error={error} />}
      {busy && <p role="status">서버에서 처리 중이에요.</p>}
    </>
  );
  const refresh = (
    <Button variant="secondary" disabled={busy} onClick={reload}>
      최신 상태 다시 조회
    </Button>
  );
  if (screen === 'confirmed') {
    if (!state.meeting)
      return (
        <LoadingOrError
          error={new Error('확정된 약속이 없어요. 참여 현황에서 확인해주세요.')}
          reload={reload}
        />
      );
    const start = seoulDateTime(state.meeting.meetingAt);
    const end = seoulDateTime(state.meeting.endsAt);
    return (
      <div className="page planning-status">
        <Header title="약속 확정" showBackButton onBack={() => navigate(PATHS.home)} />
        <main>
          <h2>우리 여기서 만나요</h2>
          <section className="meeting-confirmation-card" aria-label="확정된 약속 정보">
            <h3>
              {start.date} {start.time} – {end.date === start.date ? '' : `${end.date} `}
              {end.time}
            </h3>
            <p>{state.meeting.station.name}</p>
            <p>{state.meeting.station.lines.join(' · ')}</p>
          </section>
          {state.allowedActions.includes('SELECT_MEETING') && (
            <Button onClick={() => navigate(path(PATHS.candidates))}>후보 다시 선택하기</Button>
          )}

          {refresh}
          <Link to={PATHS.home}>내 약속 홈으로 이동</Link>
        </main>
      </div>
    );
  }
  if (screen === 'participation') {
    const canCalculate =
      state.me.role === 'HOST' && state.allowedActions.includes('CALCULATE_OPTIONS');
    return (
      <div className="page participation-status">
        <Header title="참여 현황" showBackButton onBack={() => navigate(PATHS.home)} />
        <main className="participation-status__content">
          <ParticipationSummary
            count={state.inputProgress.completedCount}
            total={state.inputProgress.capacity}
            label="입력 완료"
            description="입력 완료한 참여자를 기준으로 후보를 계산해요."
          />
          {state.members && (
            <ParticipantList
              participants={state.members.map((member) => ({
                id: member.participantId,
                name: member.nickname,
                status: member.inputComplete ? 'completed' : 'notStarted',
              }))}
            />
          )}
          {feedback}
          {!canCalculate && !state.options && (
            <p>후보 계산은 서버에서 허용된 상태의 방장만 할 수 있어요.</p>
          )}
        </main>
        <footer className="participation-status__footer">
          {state.options ? (
            <Button onClick={() => navigate(path(PATHS.candidates))}>계산된 후보 확인하기</Button>
          ) : (
            <Button
              disabled={!canCalculate || busy}
              onClick={() => void run(() => calculationOperation(state), PATHS.candidates)}
            >
              {busy ? '후보 계산 중…' : error ? '같은 요청 다시 시도' : '후보 계산하기'}
            </Button>
          )}
          {state.meeting && (
            <Button onClick={() => navigate(path(PATHS.confirmed))}>확정된 약속 확인하기</Button>
          )}
          {refresh}
        </footer>
      </div>
    );
  }
  const data = planningCandidates(state);
  if (!data.timeCandidates.length || !data.regionCandidates.length)
    return (
      <div className="page planning-status">
        <Header title="후보 비교" />
        <main>
          <p role="status">
            비교 가능한 후보가 없어요. 참여 현황에서 입력 및 계산 상태를 확인해주세요.
          </p>
          <Button onClick={() => navigate(path(PATHS.participation))}>참여 현황으로 이동</Button>
          {refresh}
        </main>
      </div>
    );
  const canSelect = state.me.role === 'HOST' && state.allowedActions.includes('SELECT_MEETING');
  const confirm = (request: CandidateConfirmationRequest) =>
    void run(() => selectionOperation(state, meetingSelection(state, request)), PATHS.confirmed);
  return (
    <TimeRegionCandidatesView
      data={data}
      showTravelDetails
      preserveOrder
      onBack={() => navigate(path(PATHS.participation))}
      onConfirm={confirm}
      busy={busy}
      choicesDisabled={!!error}
      confirmationDisabled={!canSelect || !!error}
      previewNotice={
        canSelect
          ? '최초 후보 계산 당시 입력을 완료한 참여자 기준이에요.'
          : '현재 방 상태에서는 후보를 확정할 수 없어요.'
      }
      feedback={
        <>
          {feedback}
          {error && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(() => {
                  throw new Error('확정 요청이 없어요.');
                }, PATHS.confirmed)
              }
            >
              서버 확정 결과 다시 확인
            </Button>
          )}
          {refresh}
        </>
      }
    />
  );
}

function PlanningRoute({
  screen,
  mock,
}: {
  screen: 'participation' | 'candidates' | 'confirmed';
  mock: React.ReactNode;
}) {
  const { search } = useLocation();
  const roomId = new URLSearchParams(search).get('roomId');
  return roomId && isServerRoomId(roomId) ? (
    <ServerPlanning key={`${roomId}:${screen}`} roomId={roomId} screen={screen} />
  ) : (
    mock
  );
}
export function ParticipationRoute() {
  return <PlanningRoute screen="participation" mock={<ParticipationStatus />} />;
}
export function CandidatesRoute() {
  return <PlanningRoute screen="candidates" mock={<TimeRegionCandidates />} />;
}
export function ConfirmedRoute() {
  return <PlanningRoute screen="confirmed" mock={<MeetingConfirmed />} />;
}
export function ConfirmedLayout() {
  const { pathname, search } = useLocation();
  const id = new URLSearchParams(search).get('roomId');
  return pathname === PATHS.confirmed && id && isServerRoomId(id) ? <Outlet /> : <MockRoomLayout />;
}
