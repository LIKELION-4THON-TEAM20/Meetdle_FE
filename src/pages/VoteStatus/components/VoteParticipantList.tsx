import type { VoteParticipant } from '../types';
import '../../ParticipationStatus/components/ParticipantList.scss';

export default function VoteParticipantList({ participants }: { participants: VoteParticipant[] }) {
  return (
    <ul className="participant-list" aria-label="참여자별 투표 현황">
      {participants.map((participant) => (
        <li key={participant.id} className="participant-list__row">
          <span className="participant-list__avatar" aria-hidden="true" />
          <span className="participant-list__name">{participant.name}</span>
          <span
            className={`participant-list__badge participant-list__badge--${participant.completed ? 'completed' : 'notStarted'}`}
          >
            {participant.completed ? '투표 완료' : '미투표'}
          </span>
        </li>
      ))}
    </ul>
  );
}
