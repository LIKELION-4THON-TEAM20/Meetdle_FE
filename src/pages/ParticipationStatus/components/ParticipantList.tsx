import type { Participant, ParticipantStatus } from '../types';
import './ParticipantList.scss';

const STATUS_LABELS: Record<ParticipantStatus, string> = {
  completed: '입력 완료',
  inProgress: '진행중',
  notStarted: '미입력',
};

interface ParticipantListProps {
  participants: Participant[];
}

function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <ul className="participant-list" aria-label="참여자별 입력 현황">
      {participants.map((participant) => (
        <li key={participant.id} className="participant-list__row">
          <span className="participant-list__avatar" aria-hidden="true" />
          <span className="participant-list__name">{participant.name}</span>
          <span
            className={`participant-list__badge participant-list__badge--${participant.status}`}
          >
            {STATUS_LABELS[participant.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default ParticipantList;
