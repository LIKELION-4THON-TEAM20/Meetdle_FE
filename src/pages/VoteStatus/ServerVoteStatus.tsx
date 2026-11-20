import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { roomMutations } from '../../api/rooms';
import type { RoomState, VoteDecisionRequest } from '../../api/types';
import RoomShareButton from '../../features/sharing/RoomShareButton';
import { rememberShareNotice } from '../../features/sharing/shareNotice';
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
  const location = useLocation();
  const { now, deadline, expired } = useVoteClock(room, state);
  const [dialog, setDialog] = useState<
    'SUMMARY' | 'EXTEND' | 'PROCEED' | 'reminder' | 'notifyHost' | null
  >(null);
  const [dismissedPrompt, setDismissedPrompt] = useState('');
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
          if (action === 'EXTEND' && body.action === 'EXTEND')
            rememberShareNotice(latest, { kind: 'votingExtended', round, closesAt: body.closesAt });
          setAccepted(true);
        },
      );
      if (action === 'PROCEED') go(PATHS.result);
      if (action === 'EXTEND' && time !== undefined)
        navigate(serverScreenUrl(PATHS.voteStatus, room.roomId), {
          replace: true,
          state: { votePromptDismissed: `${round}:${new Date(time).toISOString()}` },
        });
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

  const allCompleted = capacity > 0 && completed >= capacity;
  const resultAvailable = ['RESULT_READY', 'WAITING_FOR_HOST_DECISION'].includes(room.phase);
  const promptKey = `${data?.round}:${room.voting?.closesAt}`;
  const automaticSummary =
    host &&
    open &&
    !allCompleted &&
    completed >= Math.ceil(capacity / 2) &&
    dismissedPrompt !== promptKey &&
    location.state?.votePromptDismissed !== promptKey;
  const activeDialog = dialog ?? (automaticSummary ? 'SUMMARY' : null);
  const waitUntilDeadline = () => {
    setDialog(null);
    setDismissedPrompt(promptKey);
  };
  return (
    <div className="page vote-status" data-room-screen={PATHS.voteStatus}>
      <Header title="투표 현황" showBackButton onBack={() => navigate(PATHS.home)} />
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
              {allCompleted && <h3>모두 장소 투표를 마쳤어요.</h3>}
              {expired && (
                <p role="status">투표 마감 시각이 지났어요. 서버 상태를 확인하고 있어요.</p>
              )}
              {reviewing && <h3>장소 투표 시간이 끝났어요.</h3>}
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
        {error && <RequestStatus title="투표 현황 요청을 처리하지 못했어요." description={error} />}
      </main>
      <footer className="vote-status__footer">
        {host && open && (
          <RoomShareButton room={room} kind="votingRequest" disabled={blocked}>
            투표 안내 공유하기
          </RoomShareButton>
        )}
        {busy && (
          <RequestStatus
            loading
            title="투표 상태를 변경하는 중이에요."
            description="잠시만 기다려주세요."
          />
        )}
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
        {permissions.extend && (
          <Button disabled={blocked || !validExtension} onClick={() => setDialog('EXTEND')}>
            조금 더 기다리기
          </Button>
        )}
        {permissions.extend && !validExtension && <p>투표를 연장할 시간이 부족해요.</p>}
        {host && open && (
          <Button disabled={blocked} onClick={() => setDialog('SUMMARY')}>
            투표 마감하기
          </Button>
        )}
        {host && resultAvailable && (
          <Button disabled={blocked} onClick={() => go(PATHS.result)}>
            투표 마감하기
          </Button>
        )}
        {permissions.proceed && (
          <Button disabled={blocked} onClick={() => void decide('PROCEED')}>
            투표 마감하기
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
      {activeDialog === 'SUMMARY' && host && (
        <VoteCloseModal
          final={false}
          participants={participants}
          completed={completed}
          onClose={waitUntilDeadline}
          onConfirm={() => setDialog('PROCEED')}
        />
      )}
      {activeDialog === 'PROCEED' && host && (
        <VoteCloseModal
          final
          participants={participants}
          completed={completed}
          confirmDisabled={blocked || (!permissions.proceed && !resultAvailable)}
          unavailableReason={
            !permissions.proceed && !resultAvailable
              ? '현재 서버는 마감 전 조기 종료를 지원하지 않아요. 마감까지 기다려주세요.'
              : undefined
          }
          onClose={waitUntilDeadline}
          onConfirm={() => (resultAvailable ? go(PATHS.result) : void decide('PROCEED'))}
        />
      )}
      {dialog === 'reminder' && canRemind && (
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
