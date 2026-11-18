import { useState } from 'react';
import type { Participant, ParticipantStatus } from '../types';
import './ParticipantList.scss';

const STATUS_LABELS: Record<ParticipantStatus, string> = {
  completed: '입력 완료',
  inProgress: '진행중',
  notStarted: '미입력',
};

interface ParticipantListProps {
  participants: readonly Participant[];
  mode?: 'input' | 'waiting';
}

function ParticipantAvatar({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="participant-list__avatar" aria-hidden="true">
      {url && !failed && <img src={url} alt="" onError={() => setFailed(true)} />}
    </span>
  );
}

function ParticipantList({ participants, mode = 'input' }: ParticipantListProps) {
  const waiting = mode === 'waiting';

  return (
    <ul className="participant-list" aria-label={waiting ? '약속방 참여자' : '참여자별 입력 현황'}>
      {participants.map((participant) => (
        <li key={participant.id} className="participant-list__row">
          <ParticipantAvatar key={participant.profileImageUrl} url={participant.profileImageUrl} />
          <span className="participant-list__name">{participant.name}</span>
          <span
            className={`participant-list__badge participant-list__badge--${waiting ? 'waiting' : participant.status}`}
          >
            {waiting ? '대기중' : STATUS_LABELS[participant.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default ParticipantList;
