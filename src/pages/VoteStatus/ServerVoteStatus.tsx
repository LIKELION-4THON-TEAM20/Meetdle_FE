import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { roomMutations } from '../../api/rooms';
import type { RoomState, VoteDecisionRequest } from '../../api/types';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import { estimateServerNow } from '../../features/serverRoom/roomState';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import type { useRoomState } from '../../features/serverRoom/useRoomState';
import { useVoteClock } from '../../features/serverRoom/useVoteClock';
import {
  ballotPermissions,
  hasSubmittedVote,
  voteDecisionPermissions,
  voteError,
  voteExtensionRange,
} from '../../features/serverRoom/voting';
import { PATHS } from '../../router/paths';
import ServerRegistrationShare from '../PlaceRegistrationStatus/ServerRegistrationShare';
import {
  formatSeoulDeadline,
  parseSeoulInput,
  seoulInput,
} from '../PlaceRegistrationSetup/serverSetupModel';
import { formatVoteRemaining } from '../PlaceVote/voteUtils';
import VoteDeadlineModal from '../VoteStart/components/VoteDeadlineModal';
import VoteCloseModal from './components/VoteCloseModal';
import VoteParticipantList from './components/VoteParticipantList';
import './VoteStatus.scss';

const MINUTE = 60_000;

export default function ServerVoteStatus({
  room,
  state,
}: {
  room: RoomState;
  state: ReturnType<typeof useRoomState>;
}) {
  const navigate = useNavigate();
  const { now, deadline, expired } = useVoteClock(room, state);
  const [dialog, setDialog] = useState<'EXTEND' | 'PROCEED' | 'reminder' | 'notifyHost' | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const retry = useRef<{ signature: string; handle: ReturnType<typeof roomMutations.decideVote> }>(
    undefined,
  );
  const go = (path: string) =>
    navigate(serverScreenUrl(path, room.roomId, room.meeting?.selectionId));
  const reviewing = room.phase === 'VOTE_REVIEW_REQUIRED';
  const data = reviewing ? (room.voteReview ?? room.voting) : room.voting;
  const open = room.phase === 'VOTING_OPEN' && !expired && now < deadline;
  const host = room.me.role === 'HOST';
  const submitted = hasSubmittedVote(room);
  const permissions = voteDecisionPermissions(room);
  const ballot = ballotPermissions(room, now);
  const blocked = busy || accepted || state.loading || !!state.error;
  const canRemind =
    open &&
    data?.completion.some(
      ({ participantId, completed }) => participantId !== room.me.participantId && !completed,
    );
  const canNotify = !host && (open || reviewing);
  const { minimum, maximum } = voteExtensionRange(room, now);
  const firstMinute = Math.ceil(minimum / MINUTE) * MINUTE;
  const lastMinute = Math.floor(maximum / MINUTE) * MINUTE;
  const validExtension = firstMinute <= lastMinute;
  const [chosenDeadline, setChosenDeadline] = useState<number>();

  async function decide(action: 'EXTEND' | 'PROCEED', time?: number) {
    if (blocked || sending.current || !room.voteReview) return;
    const round = room.voteReview.round;
    sending.current = true;
    setBusy(true);
    setError('');
    setDialog(null);
    if (time !== undefined) setChosenDeadline(time);
    try {
      await state.mutate(
        action === 'EXTEND' ? 'EXTEND_VOTE' : 'PROCEED_WITH_VOTES',
        async (latest, receivedAt) => {
          const live = voteDecisionPermissions(latest);
          if (
            latest.voteReview?.round !== round ||
            latest.me.participantId !== room.me.participantId ||
            !(action === 'EXTEND' ? live.extend : live.proceed)
          )
            throw new Error('Decision unavailable');
          let body: VoteDecisionRequest = { round, action: 'PROCEED' };
          if (action === 'EXTEND') {
            const range = voteExtensionRange(latest, estimateServerNow(latest, receivedAt));
            if (time === undefined || !(time >= range.minimum && time <= range.maximum))
              throw new ApiRequestError(400, {
                code: 'INVALID_DEADLINE',
                message: 'Invalid deadline',
              });
            body = { round, action, closesAt: new Date(time).toISOString() };
          }
          const signature = JSON.stringify(body);
          if (retry.current?.signature !== signature)
            retry.current = { signature, handle: roomMutations.decideVote(latest.roomId, body) };
          await retry.current.handle.execute();
          setAccepted(true);
        },
      );
    } catch (failure) {
      setError(voteError(failure));
      if (failure instanceof ApiRequestError) {
        if (failure.code === 'KEY_REUSED') retry.current = undefined;
        if (failure.status === 401 || failure.status === 403 || failure.code === 'NETWORK_ERROR')
          await state.refresh({ replace: true });
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const completed = data?.progress.completedCount ?? 0;
  const capacity = data?.progress.capacity ?? room.capacity;
  const progress = capacity ? Math.min(100, Math.round((completed / capacity) * 100)) : 0;
  const participants = (data?.completion ?? []).map(
    ({ participantId, nickname, completed, profileImageUrl }) => ({
      id: participantId,
      name: nickname,
      completed,
      profileImageUrl: profileImageUrl ?? undefined,
    }),
  );

  return (
    <div className="page vote-status" data-room-screen={PATHS.voteStatus}>
      <Header title="투표 현황" showBackButton onBack={() => go(PATHS.info)} />
      <main className="vote-status__content">
        {data ? (
          <>
            <section className="vote-status__summary" aria-labelledby="vote-status-title">
              <h2 id="vote-status-title">
                {completed} / {capacity}명
              </h2>
              <p>
                {data.round}회차 · 미완료 {Math.max(0, capacity - completed)}명 ·{' '}
                {submitted ? '내 투표 완료' : '내 투표 미완료'}
              </p>
              {open && (
                <p>
                  마감까지 <span role="timer">{formatVoteRemaining(deadline, now)}</span> 남았어요.{' '}
                  <time dateTime={room.voting?.closesAt}>{formatSeoulDeadline(deadline, now)}</time>
                </p>
              )}
              {expired && (
                <p role="status">투표 마감 시각이 지났어요. 서버 상태를 확인하고 있어요.</p>
              )}
              {reviewing && (
                <p>
                  {host ? '마감 후 진행 방법을 선택해주세요.' : '방장의 결정을 기다리고 있어요.'}
                </p>
              )}
              <div
                className="vote-status__progress"
                role="progressbar"
                aria-label="투표 완료율"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
            </section>
            <VoteParticipantList participants={participants} />
          </>
        ) : (
          <p role="status">투표 현황을 불러오지 못했어요.</p>
        )}
        {state.notice && <p role="status">{state.notice}</p>}
        {error && <p role="alert">{error}</p>}
      </main>
      <footer className="vote-status__footer">
        {busy && <p role="status">요청을 처리 중이에요.</p>}
        {(accepted || state.error || !data) && (
          <Button disabled={busy || state.loading} onClick={() => void state.refresh()}>
            투표 상태 다시 확인
          </Button>
        )}
        {(ballot.edit || ballot.submit) && (
          <Button disabled={blocked} onClick={() => go(PATHS.vote)}>
            장소 투표하기
          </Button>
        )}
        {canRemind && (
          <Button disabled={blocked} onClick={() => setDialog('reminder')}>
            투표 재촉하기
          </Button>
        )}
        {canNotify && (
          <Button disabled={blocked} onClick={() => setDialog('notifyHost')}>
            방장에게 알리기
          </Button>
        )}
        {permissions.extend && (
          <Button disabled={blocked || !validExtension} onClick={() => setDialog('EXTEND')}>
            조금 더 기다리기
          </Button>
        )}
        {permissions.extend && !validExtension && <p>투표를 연장할 시간이 부족해요.</p>}
        {permissions.proceed && (
          <Button disabled={blocked} variant="secondary" onClick={() => setDialog('PROCEED')}>
            제출된 투표로 결과 보기
          </Button>
        )}
        {reviewing && host && !permissions.extend && <p>현재 회차는 투표를 연장할 수 없어요.</p>}
        {reviewing && host && completed === 0 && <p>제출된 투표가 없어 결과를 진행할 수 없어요.</p>}
      </footer>
      {dialog === 'EXTEND' && permissions.extend && validExtension && (
        <VoteDeadlineModal
          voteExtension
          confirmDisabled={blocked}
          deadline={
            chosenDeadline !== undefined &&
            chosenDeadline >= firstMinute &&
            chosenDeadline <= lastMinute
              ? chosenDeadline
              : firstMinute
          }
          now={now}
          meeting={Date.parse(room.meeting?.meetingAt ?? '')}
          serverRange={{
            minimum,
            maximum,
            toInput: seoulInput,
            fromInput: parseSeoulInput,
            hint: '현재와 기존 마감보다 늦은 서울 시각을 선택해주세요.',
          }}
          onClose={() => setDialog(null)}
          onConfirm={(value) => void decide('EXTEND', value)}
        />
      )}
      {dialog === 'PROCEED' && permissions.proceed && (
        <VoteCloseModal
          final
          confirmDisabled={blocked}
          participants={participants}
          completed={completed}
          onClose={() => setDialog(null)}
          onConfirm={() => void decide('PROCEED')}
        />
      )}
      {((dialog === 'reminder' && canRemind) || (dialog === 'notifyHost' && canNotify)) && (
        <ServerRegistrationShare
          roomId={room.roomId}
          kind={dialog}
          voting
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
