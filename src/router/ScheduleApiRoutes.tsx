import { startKakaoLogin } from '../api/auth';
import Button from '../components/common/Button/Button';
import RequestStatus, { RequestStatusPage } from '../components/common/RequestStatus/RequestStatus';
import RoomNotFound from '../components/common/RoomNotFound/RoomNotFound';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { getRoomState } from '../api/rooms';
import type { RoomState, SessionResponse } from '../api/types';
import ScheduleTransit from '../pages/ScheduleTransit/ScheduleTransit';
import ApiStationSearch from '../pages/ScheduleTransit/api/ApiStationSearch';
import { candidateDates, restoreScheduleInput } from '../pages/ScheduleTransit/api/model';
import {
  createScheduleSaver,
  ScheduleConflictError,
} from '../pages/ScheduleTransit/api/saveSchedule';
import { scheduleErrorMessage } from '../pages/ScheduleTransit/api/errors';
import { useScheduleRoom } from '../pages/ScheduleTransit/api/useScheduleRoom';
import { PATHS } from './paths';
import { serverScreenUrl } from '../features/serverRoom/routing';

function ApiState({ error, reload }: { error?: unknown; reload?: () => void }) {
  const [params] = useSearchParams();
  const loginReturn = `${PATHS.schedule}?roomId=${encodeURIComponent(params.get('roomId') ?? '')}`;
  if (error instanceof ApiRequestError && error.status === 404) return <RoomNotFound />;
  const login =
    error instanceof ApiRequestError && (error.status === 401 || error.code === 'SESSION_CHANGED');
  return (
    <RequestStatusPage footer={error ? <Link to={PATHS.home}>홈으로 돌아가기↗︎</Link> : undefined}>
      <RequestStatus
        loading={!error}
        title={
          login
            ? '카카오 로그인이 필요해요.'
            : error
              ? scheduleErrorMessage(error)
              : '일정 정보를 불러오는 중이에요.'
        }
        description={
          error
            ? login
              ? '로그인하면 이 약속방으로 다시 돌아와요.'
              : '잠시 후 다시 시도해주세요.'
            : '선택할 날짜와 기존 입력을 확인하고 있어요.'
        }
        onRetry={error && !login ? reload : undefined}
      >
        {login && (
          <Button
            className="request-status__kakao"
            onClick={() =>
              startKakaoLogin({ returnTo: loginReturn, returnOrigin: window.location.origin })
            }
          >
            카카오 로그인
          </Button>
        )}
      </RequestStatus>
    </RequestStatusPage>
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
    navigate(serverScreenUrl(PATHS.participation, room.roomId), { replace: true });
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
      onBack={() => navigate(PATHS.home)}
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
              ? '서버 입력이 변경되거나 잠겼어요. 다시 시도를 눌러 최신 내용을 확인해주세요.'
              : scheduleErrorMessage(error),
            { cause: error },
          );
        }
      }}
    />
  );
}

export function ServerSchedule({ roomId }: { roomId: string }) {
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
