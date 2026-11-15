import { useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import { toLocalDateTime } from '../../PlaceRegistrationSetup/deadlineUtils';
import { getVoteDeadlineWindow, isValidVoteDeadline } from '../voteUtils';
import './VoteDeadlineModal.scss';

interface Props {
  deadline: number;
  now: number;
  meeting: number;
  onClose: () => void;
  onConfirm: (deadline: number) => void;
}
export default function VoteDeadlineModal({ deadline, now, meeting, onClose, onConfirm }: Props) {
  const [value, setValue] = useState(() => toLocalDateTime(deadline));
  const parsed = new Date(value);
  const valid = isValidVoteDeadline(parsed, new Date(now), new Date(meeting));
  const range = getVoteDeadlineWindow(new Date(now), new Date(meeting));
  return (
    <Modal
      open
      onClose={onClose}
      className="vote-deadline-modal"
      aria-labelledby="vote-deadline-title"
      aria-describedby="vote-deadline-help"
    >
      <h2 id="vote-deadline-title">투표 마감 시간 설정</h2>
      <input
        aria-label="투표 마감 일시"
        aria-describedby="vote-deadline-help"
        aria-invalid={!valid}
        type="datetime-local"
        value={value}
        min={toLocalDateTime(Math.ceil(range.minimum / 60000) * 60000)}
        max={toLocalDateTime(range.maximum)}
        onChange={(event) => setValue(event.target.value)}
      />
      <p id="vote-deadline-help">
        투표 시간은 최소 30분 이상이어야 하고, 약속 시작 3시간 전까지는 종료돼야 해요.
      </p>
      {!range.canOpen && (
        <p role="status">설정 가능한 투표 시간이 없어요. 약속 시간을 확인해 주세요.</p>
      )}
      <Button
        disabled={!valid}
        onClick={() => {
          if (isValidVoteDeadline(parsed, new Date(), new Date(meeting)))
            onConfirm(parsed.getTime());
        }}
      >
        확인
      </Button>
    </Modal>
  );
}
