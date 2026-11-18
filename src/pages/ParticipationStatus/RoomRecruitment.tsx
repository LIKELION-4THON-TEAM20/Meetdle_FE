import { useOutletContext, useSearchParams } from 'react-router';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import {
  CREATED_ROOM_PREVIEW_ID,
  getJoinedParticipants,
  type CreatedRoomPreview,
} from '../../features/createdRoom/model';
import { formatCandidateDates } from '../CreateRoom/createRoomState';
import { PATHS, roomPath } from '../../router/paths';
import { useRoomNavigation } from '../../router/useRoomNavigation';
import ParticipantList from './components/ParticipantList';
import ParticipationSummary from './components/ParticipationSummary';
import { getMockParticipants } from './mockData';
import './ParticipationStatus.scss';
import './RoomRecruitment.scss';

function RoomRecruitment() {
  const room = useOutletContext<CreatedRoomPreview>();
  const [params] = useSearchParams();
  const navigate = useRoomNavigation();
  const isPreview = room.id === CREATED_ROOM_PREVIEW_ID;
  const scenario = import.meta.env.DEV && isPreview ? params.get('scenario') : null;
  const roster = getMockParticipants(scenario === 'profiles' ? 'profiles' : null);
  const { capacity } = room.creation;
  // The preview has its own joined roster independently of schedule submissions.
  const joinedParticipants = isPreview
    ? roster.slice(0, scenario === 'allJoined' ? capacity : 2)
    : getJoinedParticipants(room).map((participant) => ({
        ...participant,
        status: 'notStarted' as const,
      }));
  const joinedCount = joinedParticipants.length;
  const full = joinedCount === capacity;
  const canStart = params.get('role') !== 'participant' && full;

  return (
    <div className="page participation-status room-recruitment">
      <Header title="참여 현황" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="participation-status__content">
        <section className="room-recruitment__intro" aria-labelledby="room-recruitment-title">
          <span className="room-recruitment__icon" aria-hidden="true">
            💌
          </span>
          <h2 id="room-recruitment-title">약속방 인원을 기다리는 중이에요</h2>
          <p>필요한 인원이 모두 참여하면 모임을 시작하세요.</p>
        </section>
        {!isPreview && (
          <section aria-label="약속방 정보">
            <h3>{room.creation.name}</h3>
            <p>{formatCandidateDates(room.creation.dateRange)}</p>
          </section>
        )}
        <ParticipantList participants={joinedParticipants} mode="waiting" />
        <ParticipationSummary
          count={joinedCount}
          total={capacity}
          label="참여 완료"
          description={
            full ? '모든 인원이 이 방에 참여했어요!' : `현재 ${joinedCount}명이 이 방에 참여했어요!`
          }
        />
      </main>
      <footer className="participation-status__footer">
        <Button
          className="participation-status__proceed"
          disabled={!canStart}
          onClick={() => {
            if (canStart) navigate(roomPath(PATHS.schedule, '?role=host', room.id));
          }}
        >
          이 인원으로 모임 시작
        </Button>
      </footer>
    </div>
  );
}

export default RoomRecruitment;
