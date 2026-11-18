import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { getRoomState, isServerRoomId } from '../api/rooms';
import type { RoomState, SessionResponse } from '../api/types';
import ScheduleTransit, {
  ScheduleTransitRoute as MockScheduleTransitRoute,
} from '../pages/ScheduleTransit/ScheduleTransit';
import MockParticipationStatus from '../pages/ParticipationStatus/ParticipationStatus';
import Header from '../components/common/Header/Header';
import Button from '../components/common/Button/Button';
import ApiStationSearch from '../pages/ScheduleTransit/api/ApiStationSearch';
import { candidateDates, restoreScheduleInput } from '../pages/ScheduleTransit/api/model';
import {
  createScheduleSaver,
  ScheduleConflictError,
} from '../pages/ScheduleTransit/api/saveSchedule';
import { scheduleErrorMessage } from '../pages/ScheduleTransit/api/errors';
import { useScheduleRoom } from '../pages/ScheduleTransit/api/useScheduleRoom';
import { PATHS } from './paths';

function ApiState({ error, reload }: { error?: unknown; reload?: () => void }) {
  const [params] = useSearchParams();
  const loginReturn = `${PATHS.schedule}?roomId=${encodeURIComponent(params.get('roomId') ?? '')}`;
  return (
    <div className="page schedule-transit">
      <Header title="일정 입력" />
      <main className="schedule-api-state">
        <p role={error ? 'alert' : 'status'}>
          {error ? scheduleErrorMessage(error) : '서버의 일정 정보를 불러오는 중이에요.'}
        </p>
        {!!error && reload && <Button onClick={reload}>다시 불러오기</Button>}
        {error instanceof ApiRequestError && error.status === 401 && (
          <Link to={`${PATHS.login}?returnTo=${encodeURIComponent(loginReturn)}`}>로그인하기</Link>
        )}
        {!!error && <Link to={PATHS.home}>홈으로 이동</Link>}
      </main>
    </div>
  );
}

function ServerScheduleForm({
  room,
  session,
  reload,
}: {
  room: RoomState;
  session: SessionResponse;
  reload: () => void;
}) {
  const navigate = useNavigate();
  const saver = useMemo(() => createScheduleSaver(room, session), [room, session]);
  const [freeze, setFreeze] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [sessionError, setSessionError] = useState<unknown>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const dates = candidateDates(room.dates);
  const restored = restoreScheduleInput(dates, room.myInput);
  const locked = !!room.myInput.completedAt || !room.allowedActions.includes('COMPLETE_INPUT');
  const viewStatus = () =>
    navigate(`${PATHS.participation}?roomId=${encodeURIComponent(room.roomId)}`, { replace: true });
  if (sessionError) return <ApiState error={sessionError} reload={reload} />;
  return (
    <ScheduleTransit
      room={{ id: room.roomId, candidateDates: dates }}
      stations={[]}
      initialInput={restored}
      renderStationSearch={(kind, value, onChange) => (
        <ApiStationSearch kind={kind} value={value} onChange={onChange} />
      )}
      disabled={locked}
      freeze={freeze}
      requiresReload={requiresReload}
      statusMessage={
        room.myInput.completedAt
          ? '이미 입력을 완료했어요. 서버에 저장된 내용이며 수정할 수 없어요.'
          : locked
            ? '현재 서버 상태에서는 입력을 변경할 수 없어요.'
            : freeze
              ? '저장 결과를 확인해야 해요. 입력 완료를 다시 누르면 서버 상태부터 확인해요.'
              : undefined
      }
      onReload={reload}
      onBack={() => navigate(`${PATHS.participation}?roomId=${encodeURIComponent(room.roomId)}`)}
      onViewStatus={() => {
        void getRoomState(room.roomId).then(
          () => {
            if (mounted.current) viewStatus();
          },
          (error) => {
            if (mounted.current) setSessionError(error);
          },
        );
      }}
      onComplete={async (input) => {
        try {
          await saver.run(input);
          if (mounted.current) viewStatus();
        } catch (error) {
          if (mounted.current) {
            setFreeze(saver.freeze);
            if (error instanceof ScheduleConflictError) setRequiresReload(true);
            if (
              error instanceof ApiRequestError &&
              (error.status === 401 || error.code === 'SESSION_CHANGED')
            )
              setSessionError(error);
          }
          throw new Error(
            error instanceof ScheduleConflictError
              ? '서버 입력이 변경되거나 잠겼어요. 서버 입력 다시 불러오기를 눌러 최신 내용을 확인해주세요.'
              : scheduleErrorMessage(error),
            { cause: error },
          );
        }
      }}
    />
  );
}

function ServerSchedule({ roomId }: { roomId: string }) {
  const { result, reload } = useScheduleRoom(roomId);
  if (!result?.data) return <ApiState error={result?.error} reload={reload} />;
  return (
    <ServerScheduleForm
      key={`${roomId}:${result.data.session.user.userId}:${result.data.session.csrfToken}:${result.data.room.myInput.inputRevision}`}
      room={result.data.room}
      session={result.data.session}
      reload={reload}
    />
  );
}

export function ScheduleTransitEntryRoute() {
  const [params] = useSearchParams();
  const id = params.get('roomId');
  return id && isServerRoomId(id) ? (
    <ServerSchedule key={id} roomId={id} />
  ) : (
    <MockScheduleTransitRoute />
  );
}

function ServerParticipation({ roomId }: { roomId: string }) {
  const { result, reload } = useScheduleRoom(roomId);
  if (!result?.data) return <ApiState error={result?.error} reload={reload} />;
  const state = result.data.room;
  return (
    <div className="page schedule-transit">
      <Header title="참여 현황" />
      <main className="schedule-api-state">
        <h2>{state.title ?? '약속 참여 현황'}</h2>
        <p role="status">
          입력 완료 {state.inputProgress.completedCount} / {state.inputProgress.capacity}명
        </p>
        <p>
          참여 인원 {state.joinedCount} / {state.capacity}명
        </p>
        <p>
          {state.myInput.completedAt
            ? '내 입력이 서버에 완료 상태로 저장됐어요.'
            : '내 입력이 아직 완료되지 않았어요.'}
        </p>
        {state.members && (
          <ul>
            {state.members.map((member) => (
              <li key={member.participantId}>
                {member.nickname}
                {member.role === 'HOST' ? ' (방장)' : ''} ·{' '}
                {member.inputComplete ? '입력 완료' : '입력 전'}
              </li>
            ))}
          </ul>
        )}
        {!state.myInput.completedAt && state.allowedActions.includes('COMPLETE_INPUT') && (
          <Link to={`${PATHS.schedule}?roomId=${roomId}`}>내 일정 입력하기</Link>
        )}
        <Button onClick={reload}>현황 새로고침</Button>
        <Link to={PATHS.home}>홈으로 이동</Link>
      </main>
    </div>
  );
}

export function ScheduleParticipationEntryRoute() {
  const [params] = useSearchParams();
  const id = params.get('roomId');
  return id && isServerRoomId(id) ? (
    <ServerParticipation key={id} roomId={id} />
  ) : (
    <MockParticipationStatus />
  );
}
