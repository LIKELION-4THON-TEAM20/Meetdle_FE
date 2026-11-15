import { Link, useSearchParams } from 'react-router';
import { useRoomNavigation, useRoomLink } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import { useMockRoom } from '../../features/mockRoom/context';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import shareIcon from '../../assets/icons/meeting-info/share.svg';
import { MOCK_MEETING_INFO } from './mockData';
import './MeetingInfo.scss';

function MeetingInfo() {
  const navigate = useRoomNavigation();
  const roomLink = useRoomLink();
  const { room } = useMockRoom();
  const [searchParams] = useSearchParams();
  const meeting = {
    ...MOCK_MEETING_INFO,
    dateTime: new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(room.meetingAt),
    weekday: new Intl.DateTimeFormat('ko-KR', { weekday: 'long', timeZone: 'Asia/Seoul' }).format(
      room.meetingAt,
    ),
    area: room.area,
    participantCount: room.participants.length,
    hostName:
      room.participants.find(({ id }) => id === 'sangmin')?.name ?? MOCK_MEETING_INFO.hostName,
    registrationStatus:
      !room.registrationClosed && room.phase === 'registration'
        ? 'registrationOpen'
        : 'beforeRegistration',
    registrationCategories: room.categories.map(({ name }) => name),
    registrationDeadline: new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(room.registrationDeadline),
  };
  const requestedStatus = searchParams.get('status');
  const registrationStatus =
    import.meta.env.DEV &&
    (requestedStatus === 'beforeRegistration' || requestedStatus === 'registrationOpen')
      ? requestedStatus
      : meeting.registrationStatus;
  const isRegistrationOpen = registrationStatus === 'registrationOpen';
  const registrationClosed =
    room.registrationClosed &&
    !(
      import.meta.env.DEV &&
      (requestedStatus === 'beforeRegistration' || requestedStatus === 'registrationOpen')
    );
  const handleBack = () => navigate(PATHS.home);
  const handleShare = () => {
    window.alert('공유 API는 아직 연동되지 않았어요. 실제 공유는 수행되지 않습니다.');
  };
  const handleRegisterPlace = () => {
    window.alert(
      '장소 탐색 화면(SCREEN 09)이 현재 브랜치에 없어요. #11 관련 PR 반영과 등록 API 연결이 필요합니다.',
    );
  };

  return (
    <div className="page meeting-info">
      <Header
        title={isRegistrationOpen ? '장소 등록' : '약속 정보'}
        showBackButton
        onBack={handleBack}
        rightAction={
          <button
            type="button"
            className="meeting-info__share"
            aria-label="약속 정보 공유"
            onClick={handleShare}
          >
            <img src={shareIcon} width={20} height={20} alt="" />
          </button>
        }
      />
      <main className="meeting-info__content">
        <p>개발용 목 약속 정보예요. 서버 상태가 아니에요.</p>
        <section className="meeting-info__confirmed" aria-labelledby="meeting-info-date">
          <span className="meeting-info__badge">{meeting.statusLabel}</span>
          <h2 id="meeting-info-date">{meeting.dateTime}</h2>
          <p>{meeting.area}</p>
        </section>
        <dl className="meeting-info__details" aria-label="약속 기본 정보">
          <div>
            <dt>요일</dt>
            <dd>{meeting.weekday}</dd>
          </div>
          <div>
            <dt>방장</dt>
            <dd>{meeting.hostName}</dd>
          </div>
          <div>
            <dt>참여 인원</dt>
            <dd>{meeting.participantCount}명</dd>
          </div>
        </dl>
        {registrationClosed ? (
          <section className="meeting-info__empty">
            <p>장소 등록이 마감됐어요.</p>
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
          </section>
        ) : isRegistrationOpen ? (
          <section
            className="meeting-info__registration"
            aria-labelledby="meeting-info-registration-title"
          >
            <div className="meeting-info__registration-card">
              <h3 id="meeting-info-registration-title">장소 등록이 시작됐어요</h3>
              <dl>
                <div>
                  <dt>카테고리</dt>
                  <dd>{meeting.registrationCategories.join(' · ')}</dd>
                </div>
                <div>
                  <dt>마감까지</dt>
                  <dd className="meeting-info__deadline">{meeting.registrationDeadline}</dd>
                </div>
              </dl>
            </div>
            <Button className="meeting-info__register" onClick={handleRegisterPlace}>
              가고 싶은 장소 등록하기
            </Button>
          </section>
        ) : (
          <section className="meeting-info__empty" aria-labelledby="meeting-info-empty-title">
            <h3 id="meeting-info-empty-title">아직 장소 후보를 모으기 전이에요.</h3>
            <p>방장이 장소 등록을 시작하면 여기에서 바로 등록할 수 있어요.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default MeetingInfo;
