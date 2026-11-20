import RequestStatus, {
  RequestStatusPage,
} from '../../components/common/RequestStatus/RequestStatus';
import RoomNotFound from '../../components/common/RoomNotFound/RoomNotFound';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useState } from 'react';
import { startKakaoLogin } from '../../api/auth';
import { ApiRequestError } from '../../api/client';
import { isServerRoomId } from '../../api/rooms';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import { PATHS } from '../../router/paths';
import { roomScreenForEntry, serverRoomUrl, serverScreenUrl, shouldPollRoom } from './routing';
import { ServerSchedule } from '../../router/ScheduleApiRoutes';
import { ServerCandidates } from '../planning/PlanningRoutes';
import ServerPlaceExploration from '../../pages/PlaceExploration/ServerPlaceExploration';
import { useRoomState } from './useRoomState';
import ServerParticipation from '../../pages/ParticipationStatus/ServerParticipation';
import ServerMeeting from '../../pages/MeetingConfirmed/ServerMeeting';
import { meetingDetails } from './meeting';
import ServerRegistrationSetup from '../../pages/PlaceRegistrationSetup/ServerRegistrationSetup';
import ServerRegistrationFlow from '../../pages/PlaceRegistrationStatus/ServerRegistrationFlow';
import ServerPlaceVote from '../../pages/PlaceVote/ServerPlaceVote';
import ServerVoteStatus from '../../pages/VoteStatus/ServerVoteStatus';
import ServerVoteResult from '../../pages/VoteResult/ServerVoteResult';

function serverErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 401:
        return '카카오 로그인이 필요해요.';
      case 403:
        return '이 약속방을 볼 수 있는 권한이 없어요.';
      case 404:
        return '약속방을 찾을 수 없어요.';
    }
    if (error.code === 'NETWORK_ERROR')
      return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.';
  }
  return '약속 정보를 불러오지 못했어요.';
}

export function RoomRequestStatus({
  roomId,
  error,
  retry,
}: {
  roomId: string;
  error: unknown;
  retry: () => void;
}) {
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
              ? serverErrorMessage(error)
              : '약속 정보를 불러오는 중이에요.'
        }
        description={
          error
            ? login
              ? '로그인하면 이 약속방으로 다시 돌아와요.'
              : '잠시 후 다시 시도해주세요.'
            : '잠시만 기다려주세요.'
        }
        onRetry={error && !login ? retry : undefined}
      >
        {login && (
          <Button
            className="request-status__kakao"
            onClick={() =>
              startKakaoLogin({ returnTo: serverRoomUrl(roomId), returnOrigin: location.origin })
            }
          >
            카카오 로그인
          </Button>
        )}
      </RequestStatus>
    </RequestStatusPage>
  );
}

const screenTitles: Partial<Record<string, string>> = {
  [PATHS.recruitment]: '인원 모집',
  [PATHS.schedule]: '가능한 시간 및 출발역 입력',
  [PATHS.participation]: '참여자 입력 현황',
  [PATHS.candidates]: '일시·지역 후보',
  [PATHS.confirmed]: '일시·지역 확정',
  [PATHS.info]: '확정 약속 정보',
  [PATHS.setup]: '장소 등록 설정',
  [PATHS.places]: '장소 후보 등록',
  [PATHS.registration]: '장소 등록 현황',
  [PATHS.closeRegistration]: '장소 등록 종료',
  [PATHS.startVote]: '장소 투표 시작',
  [PATHS.vote]: '장소 투표',
  [PATHS.voteStatus]: '투표 진행 현황',
  [PATHS.result]: '약속 결과',
};

const registrationScreens: readonly string[] = [
  PATHS.registration,
  PATHS.closeRegistration,
  PATHS.startVote,
];

function ServerRoomStatus({ roomId, requested }: { roomId: string; requested?: string }) {
  const state = useRoomState(roomId, (room) => {
    const screen = roomScreenForEntry(room, requested);
    return screen === PATHS.recruitment || screen === PATHS.participation || shouldPollRoom(room);
  });
  const navigate = useNavigate();
  const [opened, setOpened] = useState<{ selectionId: string; participantId: string } | null>(null);
  const [accepted, setAccepted] = useState<{ revision: number; participantId: string } | null>(
    null,
  );
  const [submittedBallot, setSubmittedBallot] = useState<string>();
  if (!state.room) {
    return (
      <RoomRequestStatus roomId={roomId} error={state.error} retry={() => void state.refresh()} />
    );
  }

  const room = state.room;
  const screen = roomScreenForEntry(room, requested);
  if (screen === PATHS.created)
    return <Navigate to={serverScreenUrl(PATHS.created, roomId)} replace />;
  const ballotKey = `${room.me.participantId}:${room.voting?.round}`;
  const keepReceipt =
    (requested === PATHS.vote || !requested) &&
    submittedBallot === ballotKey &&
    (screen === PATHS.voteStatus ||
      ['RESULT_READY', 'WAITING_FOR_HOST_DECISION'].includes(room.phase));
  const requestedVoteScreen =
    requested === PATHS.vote || requested === PATHS.voteStatus || requested === PATHS.result;
  if (
    (!requested && screen === PATHS.result) ||
    (requested &&
      requested !== screen &&
      (requestedVoteScreen ||
        registrationScreens.includes(requested) ||
        requested === PATHS.setup ||
        ((requested === PATHS.confirmed || requested === PATHS.info) &&
          room.phase === 'PLACE_SUBMISSION_OPEN')) &&
      !keepReceipt &&
      !state.error)
  ) {
    return <Navigate to={serverScreenUrl(screen, roomId, room.meeting?.selectionId)} replace />;
  }
  if ((screen === PATHS.vote || keepReceipt) && room.voting) {
    return (
      <ServerPlaceVote
        key={ballotKey}
        room={{ ...room, voting: room.voting }}
        state={state}
        accepted={submittedBallot === ballotKey}
        onAccepted={() => setSubmittedBallot(ballotKey)}
      />
    );
  }
  if (screen === PATHS.result) {
    return (
      <ServerVoteResult
        key={`${room.me.participantId}:${room.result?.round ?? room.tieDecision?.round ?? room.recovery?.round}`}
        room={room}
        state={state}
      />
    );
  }
  if (state.error && screen !== PATHS.voteStatus) {
    return (
      <RoomRequestStatus roomId={roomId} error={state.error} retry={() => void state.refresh()} />
    );
  }
  if (screen === PATHS.voteStatus) {
    return (
      <ServerVoteStatus
        key={`${room.me.participantId}:${room.voteReview?.round ?? room.voting?.round}:${room.phase}`}
        room={room}
        state={state}
      />
    );
  }
  if (registrationScreens.includes(screen)) {
    if (
      !room.registration ||
      (accepted?.participantId === room.me.participantId && room.revision <= accepted.revision)
    ) {
      return (
        <RoomRequestStatus
          roomId={roomId}
          error={state.loading ? null : new Error('Registration state unavailable')}
          retry={() => void state.refresh()}
        />
      );
    }
    return (
      <ServerRegistrationFlow
        key={room.me.participantId + ':' + room.registration.round}
        room={{ ...room, registration: room.registration }}
        state={state}
        screen={screen}
        onAccepted={(revision) => setAccepted({ revision, participantId: room.me.participantId })}
      />
    );
  }
  if (screen === PATHS.places)
    return (
      <ServerPlaceExploration
        key={room.roomId + ':' + room.me.participantId + ':' + room.registration?.round}
        roomId={room.roomId}
      />
    );
  if (screen === PATHS.setup) {
    if (
      opened?.selectionId === room.meeting?.selectionId &&
      opened?.participantId === room.me.participantId
    ) {
      return (
        <RoomRequestStatus
          roomId={roomId}
          error={state.loading ? null : new Error('Registration state has not updated yet')}
          retry={() => void state.refresh()}
        />
      );
    }
    return (
      <ServerRegistrationSetup
        key={room.me.participantId + room.meeting?.selectionId}
        room={room}
        state={state}
        onOpened={(selectionId) => setOpened({ selectionId, participantId: room.me.participantId })}
      />
    );
  }
  if (screen === PATHS.confirmed || screen === PATHS.info) {
    if (!meetingDetails(room)) {
      return (
        <RoomRequestStatus
          roomId={roomId}
          error={new Error('Meeting data unavailable')}
          retry={() => void state.refresh()}
        />
      );
    }
    return (
      <ServerMeeting
        key={room.me.participantId + screen + room.meeting?.selectionId}
        room={room}
        now={state.serverNow ?? Date.parse(room.serverNow)}
        confirmation={screen === PATHS.confirmed}
      />
    );
  }
  if (screen === PATHS.recruitment || screen === PATHS.participation) {
    return (
      <ServerParticipation
        key={room.me.participantId + screen}
        room={room}
        state={state}
        recruitment={
          screen === PATHS.recruitment || (room.me.role === 'HOST' && room.startedAt === null)
        }
      />
    );
  }
  if (screen === PATHS.schedule) return <ServerSchedule key={roomId} roomId={roomId} />;
  if (screen === PATHS.candidates) {
    if (requested !== screen) return <Navigate to={serverScreenUrl(screen, roomId)} replace />;
    if (room.me.role !== 'HOST')
      return (
        <RoomRequestStatus
          roomId={roomId}
          error={new ApiRequestError(403, { code: 'FORBIDDEN', message: 'Host only' })}
          retry={() => void state.refresh()}
        />
      );
    return (
      <ServerCandidates
        key={`${room.roomId}:${room.me.participantId}:${room.options?.optionsId}:${room.meeting?.selectionId}`}
        state={room}
        sampledAt={state.receivedAt}
        reload={() => void state.refresh()}
      />
    );
  }
  const deadline =
    room.voting?.closesAt ??
    room.registration?.closesAt ??
    (room.phase === 'REGION_CONFIRMED' ? room.deadlinePolicy?.registrationCutoff : null);
  const title = screenTitles[screen] ?? '약속 정보';
  return (
    <div className="page" data-room-screen={screen}>
      <Header title={title} showBackButton onBack={() => navigate(PATHS.home)} />
      <main style={{ padding: 27 }}>
        <h2>{room.title ?? '약속방'}</h2>
        <p>
          {room.me.role === 'HOST' ? '방장' : '참여자'} · {room.joinedCount} / {room.capacity}명
        </p>
        {deadline && (
          <p>
            마감 {new Date(deadline).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
            {state.serverNow !== null && Date.parse(deadline) <= state.serverNow
              ? ' (마감 시각 경과)'
              : ''}
          </p>
        )}
        {state.notice && <p role="status">{state.notice}</p>}
        {state.can('START_ROOM') && room.invite && (
          <Link to={`${PATHS.created}?mode=api&roomId=${roomId}`}>초대 정보 보기</Link>
        )}
        <p>이 단계의 상세 화면은 연동 준비 중이에요.</p>
      </main>
    </div>
  );
}

export function ServerRoomHandoff({ roomId, path }: { roomId: string; path: string }) {
  return <ServerRoomStatus key={roomId} roomId={roomId} requested={path} />;
}

export default function ServerRoomRoute() {
  const { roomId = '' } = useParams();
  if (!isServerRoomId(roomId)) {
    return (
      <RoomRequestStatus
        roomId={roomId}
        error={new ApiRequestError(404, { code: 'NOT_FOUND', message: 'Invalid room ID' })}
        retry={() => location.reload()}
      />
    );
  }
  return <ServerRoomStatus key={roomId} roomId={roomId} />;
}
