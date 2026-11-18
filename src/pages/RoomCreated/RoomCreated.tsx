import { Link, useSearchParams } from 'react-router';
import { formatCandidateDates } from '../CreateRoom/createRoomState';
import { getCreatedRoom, getJoinedParticipants } from '../../features/createdRoom/model';
import { PATHS, roomPath } from '../../router/paths';
import { useRoomBack } from '../../router/useRoomNavigation';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import MeetingInfoCard from './components/MeetingInfoCard';
import InviteCodeCopy from './components/InviteCodeCopy';
import './RoomCreated.scss';

function RoomCreated() {
  const goBack = useRoomBack(PATHS.create);
  const [params] = useSearchParams();
  const room = getCreatedRoom(params.get('roomId'))!;
  const { inviteCode, creation } = room;
  const meeting = {
    name: creation.name.trim(),
    candidateDates: formatCandidateDates(creation.dateRange),
    capacity: creation.capacity,
    participantCount: getJoinedParticipants(room).length,
  };

  const shareInviteOnKakao = () => {
    window.alert(
      '카카오톡 공유 SDK는 아직 연동되지 않았어요. 초대 코드나 링크를 복사해 공유해주세요.',
    );
  };

  const copyInviteLink = async () => {
    const inviteUrl = new URL(roomPath(PATHS.invitation, '', room.id), window.location.origin);
    inviteUrl.searchParams.set('code', inviteCode);

    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      window.alert(
        '개발용 초대 링크를 복사했어요. 같은 브라우저의 목 정보 확인용이며 실제 참여 API는 미연결이에요.',
      );
    } catch {
      window.alert('링크를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.');
    }
  };

  return (
    <div className="page room-created">
      <Header title="약속방 생성 완료" showBackButton onBack={goBack} />
      <main className="room-created__content">
        <div className="room-created__intro">
          <h2>약속 방이 생성되었어요!</h2>
          <p>친구들을 초대하고 함께 일정을 맞춰보세요</p>
        </div>
        <MeetingInfoCard meeting={meeting} />
        <InviteCodeCopy code={inviteCode} onShare={shareInviteOnKakao} />
      </main>
      <footer className="room-created__footer">
        <Button className="room-created__action" onClick={shareInviteOnKakao}>
          카카오톡으로 초대하기
        </Button>
        <Button
          variant="secondary"
          className="room-created__action room-created__action--link"
          onClick={copyInviteLink}
        >
          링크 복사하기
        </Button>
        <Link className="room-created__home-link" to={PATHS.home}>
          홈으로 돌아가기<span aria-hidden="true">↗</span>
        </Link>
      </footer>
    </div>
  );
}

export default RoomCreated;
