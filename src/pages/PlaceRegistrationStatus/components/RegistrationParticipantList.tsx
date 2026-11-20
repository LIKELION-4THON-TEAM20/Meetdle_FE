import ParticipantList from '../../ParticipationStatus/components/ParticipantList';
import type { RegistrationParticipant } from '../types';

export default function RegistrationParticipantList({
  participants,
}: {
  participants: RegistrationParticipant[];
}) {
  return <ParticipantList participants={participants} mode="registration" />;
}
