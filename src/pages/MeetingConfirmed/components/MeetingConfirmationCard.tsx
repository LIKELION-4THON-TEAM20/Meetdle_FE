import pinIcon from '../../../assets/icons/meeting-confirmed/pin.svg';
import './MeetingConfirmationCard.scss';

export interface MeetingConfirmation {
  dateTime: string;
  area: string;
  averageTravelMinutes: number;
  maximumTravelMinutes: number;
  averageTransfers: number;
  availableCount: number;
  totalCount: number;
}

interface MeetingConfirmationCardProps {
  meeting: MeetingConfirmation;
}

function MeetingConfirmationCard({ meeting }: MeetingConfirmationCardProps) {
  const summary = [
    { label: '평균 이동시간', value: `${meeting.averageTravelMinutes}분` },
    { label: '최대 이동시간', value: `${meeting.maximumTravelMinutes}분` },
    { label: '평균 환승', value: `${meeting.averageTransfers}회` },
    { label: '참여 가능 인원', value: `${meeting.availableCount} / ${meeting.totalCount}명` },
  ];

  return (
    <section className="meeting-confirmation-card" aria-label="확정된 약속 정보">
      <h3 className="meeting-confirmation-card__date">{meeting.dateTime}</h3>
      <div className="meeting-confirmation-card__area">
        <img src={pinIcon} width={18} height={18} alt="" />
        <p>{meeting.area}</p>
      </div>
      <div className="meeting-confirmation-card__summary">
        <h4>이동시간 요약</h4>
        <dl>
          {summary.map(({ label, value }) => (
            <div className="meeting-confirmation-card__row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default MeetingConfirmationCard;
