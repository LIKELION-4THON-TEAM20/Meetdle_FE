import { Link, useLocation, useSearchParams } from 'react-router';
import { useRoomNavigation, useRoomLink } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import { useMockRoom } from '../../features/mockRoom/context';
import Button from '../../components/common/Button/Button';
import MeetingConfirmed from '../MeetingConfirmed/MeetingConfirmed';
import MeetingConfirmationLayout from '../MeetingConfirmed/components/MeetingConfirmationLayout';
import {
  getConfirmationRegistrationStatus,
  getMeetingConfirmation,
} from '../MeetingConfirmed/confirmationData';
import './MeetingInfo.scss';

function MeetingInfo() {
  const navigate = useRoomNavigation();
  const roomLink = useRoomLink();
  const { room } = useMockRoom();
  const { pathname, search } = useLocation();
  const [params] = useSearchParams();
  if (room.role === 'host') return <MeetingConfirmed />;

  const meeting = getMeetingConfirmation(room);
  const previewStatus = import.meta.env.DEV ? params.get('status') : null;
  const status = getConfirmationRegistrationStatus(room, previewStatus);
  const registrationOpen = status === 'registrationOpen';
  const handleRegisterPlace = () => {
    if (!registrationOpen) return;
    const query = new URLSearchParams({
      roomId: room.id,
      from: 'confirmation',
      returnTo: `${pathname}${search}`,
    });
    if (previewStatus === 'registrationOpen') query.set('status', previewStatus);
    navigate(`${PATHS.places}?${query}`);
  };

  return (
    <MeetingConfirmationLayout meeting={meeting} onBack={() => navigate(PATHS.home)}>
      <footer
        className={`meeting-info__footer${registrationOpen ? '' : ' meeting-info__footer--divider'}`}
      >
        <section className="meeting-info__summary" aria-label="약속 요약">
          <h3>{meeting.summaryDateTime}</h3>
          <p>
            {meeting.area} · 참여 {meeting.totalCount} / {meeting.totalCount}명
          </p>
        </section>
        {registrationOpen ? (
          <>
            <p className="meeting-info__notice">
              장소 등록이 시작되었어요. 가고 싶은 곳을 등록해주세요.
            </p>
            <Button className="meeting-confirmed__action" onClick={handleRegisterPlace}>
              가고 싶은 장소 등록하기
            </Button>
          </>
        ) : status === 'registrationClosed' ? (
          <>
            <p className="meeting-info__notice">장소 등록이 마감됐어요.</p>
            <Link
              to={roomLink(
                room.result
                  ? PATHS.result
                  : room.phase === 'registration'
                    ? PATHS.registration
                    : PATHS.voteStatus,
              )}
            >
              현재 진행 상황 확인하기
            </Link>
          </>
        ) : (
          <p className="meeting-info__notice meeting-info__notice--waiting">
            아직 장소 후보를 모으기 전이에요.
          </p>
        )}
      </footer>
    </MeetingConfirmationLayout>
  );
}

export default MeetingInfo;
