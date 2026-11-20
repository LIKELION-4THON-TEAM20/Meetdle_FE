import RoomShareDialog from '../../features/sharing/RoomShareDialog';

export default function ServerRegistrationShare({
  roomId,
  kind,
  voting = false,
  onClose,
}: {
  roomId: string;
  kind: 'reminder' | 'notifyHost' | 'result';
  voting?: boolean;
  onClose: () => void;
}) {
  const shareKind =
    kind === 'result'
      ? 'finalResult'
      : kind === 'notifyHost'
        ? 'hostRequest'
        : voting
          ? 'votingReminder'
          : 'registrationReminder';
  return <RoomShareDialog key={shareKind} roomId={roomId} kind={shareKind} onClose={onClose} />;
}
