import { useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import { toLocalDateTime } from '../../PlaceRegistrationSetup/deadlineUtils';
import { getVoteDeadlineWindow, isValidVoteDeadline } from '../voteUtils';
import {
  getRegistrationExtensionWindow,
  isValidRegistrationExtension,
} from '../../PlaceRegistrationStatus/statusUtils';
import './VoteDeadlineModal.scss';

interface Props {
  deadline: number;
  now: number;
  meeting: number;
  registrationExtension?: boolean;
  voteExtension?: boolean;
  onClose: () => void;
  onConfirm: (deadline: number) => void;
}
export default function VoteDeadlineModal({
  deadline,
  now,
  meeting,
  registrationExtension,
  voteExtension,
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState(() => toLocalDateTime(deadline));
  const parsed = new Date(value);
  const validate = (at: number) =>
    registrationExtension
      ? isValidRegistrationExtension(parsed.getTime(), deadline, at, meeting)
      : (!voteExtension || parsed.getTime() > deadline) &&
        isValidVoteDeadline(parsed, new Date(at), new Date(meeting));
  const valid = validate(now);
  const range = registrationExtension
    ? getRegistrationExtensionWindow(deadline, now, meeting)
    : getVoteDeadlineWindow(new Date(now), new Date(meeting));
  const minimum =
    Math.ceil(Math.max(range.minimum, voteExtension ? deadline + 1 : 0) / 60000) * 60000;
  const maximum = Math.floor(range.maximum / 60000) * 60000;
  return (
    <Modal
      open
      onClose={onClose}
      className={`vote-deadline-modal${registrationExtension || voteExtension ? ' vote-deadline-modal--registration' : ''}`}
      aria-labelledby="vote-deadline-title"
      aria-describedby="vote-deadline-help"
    >
      <h2 id="vote-deadline-title">
        {registrationExtension
          ? '장소 등록 마감 시간 연장'
          : voteExtension
            ? '투표 마감 시간 연장'
            : '투표 마감 시간 설정'}
      </h2>
      {(registrationExtension || voteExtension) && <p>마감 일시를 선택해주세요</p>}
      <input
        aria-label={registrationExtension ? '등록 마감 일시' : '투표 마감 일시'}
        aria-describedby="vote-deadline-help"
        aria-invalid={!valid}
        type="datetime-local"
        value={value}
        min={toLocalDateTime(minimum)}
        max={toLocalDateTime(maximum)}
        onChange={(event) => setValue(event.target.value)}
      />
      <p id="vote-deadline-help">
        {registrationExtension && '등록은 지금부터 최소 1시간 열어둬야 해요. '}
        투표 시간은 최소 30분 이상이어야 하고, 약속 시작 3시간 전까지는 종료돼야 해요.
      </p>
      {minimum > maximum && (
        <p role="status">설정 가능한 마감시간이 없어요. 약속 시간을 확인해 주세요.</p>
      )}
      <Button
        disabled={!valid}
        onClick={() => {
          if (validate(Date.now())) onConfirm(parsed.getTime());
        }}
      >
        {registrationExtension
          ? '등록 마감시간 연장하기'
          : voteExtension
            ? '투표 마감시간 연장하기'
            : '확인'}
      </Button>
    </Modal>
  );
}
