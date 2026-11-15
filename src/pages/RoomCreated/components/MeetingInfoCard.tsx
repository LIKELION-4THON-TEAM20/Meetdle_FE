import profileIcon from '../../../assets/icons/room-created/profile.svg';
import type { MeetingInfo } from '../types';
import './MeetingInfoCard.scss';

type MeetingInfoCardProps = {
  meeting: MeetingInfo;
} & (
  { variant?: 'host' } | { variant: 'participant'; hostName: string; participantAvatarsSrc: string }
);

function MeetingInfoCard(props: MeetingInfoCardProps) {
  const { meeting } = props;
  const isParticipant = props.variant === 'participant';
  return (
    <section
      className={`meeting-info-card${isParticipant ? ' meeting-info-card--participant' : ''}`}
      aria-label="약속 정보"
    >
      {isParticipant && <h3 className="meeting-info-card__title">{meeting.name}</h3>}
      <dl className="meeting-info-card__details">
        {isParticipant ? (
          <div className="meeting-info-card__row">
            <dt>방장</dt>
            <dd>{props.hostName}</dd>
          </div>
        ) : (
          <div className="meeting-info-card__row meeting-info-card__row--name">
            <dt>약속 이름</dt>
            <dd>{meeting.name}</dd>
          </div>
        )}
        <div className="meeting-info-card__row">
          <dt>후보 날짜</dt>
          <dd>{meeting.candidateDates}</dd>
        </div>
        <div className="meeting-info-card__row">
          <dt>참여 정원</dt>
          <dd>{meeting.capacity}명</dd>
        </div>
        {isParticipant && (
          <div className="meeting-info-card__row">
            <dt>현재 참여 상태</dt>
            <dd className="meeting-info-card__participation">
              <img src={props.participantAvatarsSrc} width={42} height={24} alt="" />
              <span>
                {meeting.participantCount} / {meeting.capacity}명 참여 중
              </span>
            </dd>
          </div>
        )}
      </dl>
      {!isParticipant && (
        <div className="meeting-info-card__participants">
          <img src={profileIcon} width={36} height={36} alt="" />
          <p>
            현재 {meeting.participantCount} / {meeting.capacity}명 참여 중
          </p>
        </div>
      )}
    </section>
  );
}

export default MeetingInfoCard;
