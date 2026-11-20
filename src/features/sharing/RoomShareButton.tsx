import { useState } from 'react';
import type { RoomState } from '../../api/types';
import Button from '../../components/common/Button/Button';
import RoomShareDialog from './RoomShareDialog';
import type { ShareKind } from './shareModel';
import { currentShareKind } from './shareNotice';
export default function RoomShareButton({
  room,
  kind,
  children,
  disabled,
  className,
  variant = 'secondary',
}: {
  room: RoomState;
  kind: ShareKind;
  children: string;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const resolved = currentShareKind(room, kind);
  const label =
    resolved === 'registrationExtended'
      ? '등록 시간 연장 안내 공유하기'
      : resolved === 'registrationRestarted'
        ? '장소 재등록 안내 공유하기'
        : resolved === 'votingExtended'
          ? '투표 시간 연장 안내 공유하기'
          : children;
  return (
    <>
      <Button
        className={className}
        variant={variant}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open && <RoomShareDialog roomId={room.roomId} kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}
