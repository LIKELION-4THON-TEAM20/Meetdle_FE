import type { RegistrationParticipant } from '../types';
import '../../ParticipationStatus/components/ParticipantList.scss';

const STATUS_LABELS = { completed: '등록 완료', inProgress: '등록중', notStarted: '미등록' };

function RegistrationParticipantList({
  participants,
}: {
  participants: RegistrationParticipant[];
}) {
  return (
    <ul className="participant-list registration-participants" aria-label="참여자별 장소 등록 현황">
      {participants.map((participant) => (
        <li className="participant-list__row" key={participant.id}>
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

export default RegistrationParticipantList;
