import ParticipantList from '../../ParticipationStatus/components/ParticipantList';
import type { VoteParticipant } from '../types';

export default function VoteParticipantList({ participants }: { participants: VoteParticipant[] }) {
  return (
    <ParticipantList
      mode="vote"
      participants={participants.map((person) => ({
        id: person.id,
        name: person.name,
        profileImageUrl: person.profileImageUrl,
        status: person.completed ? 'completed' : 'notStarted',
      }))}
    />
  );
}
