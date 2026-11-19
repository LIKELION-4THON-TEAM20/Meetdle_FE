import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { roomMutations } from '../../api/rooms';
import type { RoomState } from '../../api/types';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import Modal from '../../components/common/Modal/Modal';
import {
  flowDeadline,
  flowErrors,
  registrationFlow,
  type DeadlineKind,
} from '../../features/serverRoom/registrationFlow';
import { estimateServerNow } from '../../features/serverRoom/roomState';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import type { useRoomState } from '../../features/serverRoom/useRoomState';
import { PATHS } from '../../router/paths';
import {
  formatSeoulDeadline,
  parseSeoulInput,
  seoulInput,
} from '../PlaceRegistrationSetup/serverSetupModel';
import RegistrationParticipantList from './components/RegistrationParticipantList';
import ServerRegistrationShare from './ServerRegistrationShare';
import VoteDeadlineModal from '../VoteStart/components/VoteDeadlineModal';
import '../RegistrationClose/RegistrationClose.scss';
import '../VoteStart/VoteStart.scss';
import './PlaceRegistrationStatus.scss';

type Intent = DeadlineKind | 'CLOSE';
type Handle = { execute: () => Promise<unknown> };
const MINUTE = 60_000;
function defaultDeadline(room: RoomState, kind: DeadlineKind, now: number) {
  const { minimum, maximum } = flowDeadline(room, kind, now);
  const earliest = Math.ceil(minimum / MINUTE) * MINUTE;
  const latest = Math.floor(maximum / MINUTE) * MINUTE;
  return earliest <= latest ? Math.min(latest, earliest + 5 * MINUTE) : null;
}

export default function ServerRegistrationFlow({
  room,
  state,
  screen,
  onAccepted,
}: {
  room: RoomState & { registration: NonNullable<RoomState['registration']> };
  state: ReturnType<typeof useRoomState>;
  screen: string;
  onAccepted: (revision: number) => void;
}) {
  const navigate = useNavigate();
  const [wallTime, setWallTime] = useState(Date.now);
  const [dialog, setDialog] = useState<Intent | null>(null);
  const [voteDeadline, setVoteDeadline] = useState<number | null>(null);
  const [share, setShare] = useState<'reminder' | 'notifyHost' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const retry = useRef<{ signature: string; handle: Handle }>(undefined);
  const [lastDeadline, setLastDeadline] = useState<{ kind: DeadlineKind; time: number }>();
  const expiry = useRef('');
  const now = estimateServerNow(room, state.receivedAt, wallTime);
  const status = registrationFlow(room, now);
  const { refresh } = state;
  const expiryKey = `${room.registration.round}:${room.registration.closesAt}`;

  useEffect(() => {
    const timer = window.setInterval(() => setWallTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = room.phase === 'PLACE_SUBMISSION_OPEN' && now >= status.closesAt;
  useEffect(() => {
    if (expired && expiry.current !== expiryKey) {
      expiry.current = expiryKey;
      void refresh();
    }
  }, [expired, expiryKey, refresh]);

  const allowed = (intent: Intent) =>
    intent === 'CLOSE'
      ? status.canClose
      : intent === 'MINI_TIMER'
        ? status.canMini
        : intent === 'EXTEND'
          ? status.canExtend
          : status.canVote;
  const isRegistration = screen === PATHS.registration && !status.closed;
  const isVote = screen === PATHS.startVote;
  const link = (path: string) => serverScreenUrl(path, room.roomId, room.meeting?.selectionId);
  const progress = status.members
    ? Math.min(100, Math.round((status.completed / status.members) * 100))
    : 0;
  const seconds = Math.max(0, Math.ceil((status.closesAt - now) / 1000));
  const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  const participants = room.registration.completion.map((entry) => ({
    id: entry.participantId,
    name: entry.nickname,
    profileImageUrl: entry.profileImageUrl ?? undefined,
    status: entry.completed
      ? ('completed' as const)
      : entry.status === 'IN_PROGRESS'
        ? ('inProgress' as const)
        : ('notStarted' as const),
  }));
  const activeDeadline = dialog && dialog !== 'CLOSE' && allowed(dialog) ? dialog : null;
  const initialDeadline = activeDeadline && defaultDeadline(room, activeDeadline, now);
  const chosenVoteDeadline = voteDeadline ?? defaultDeadline(room, 'VOTE', now);
  const voteRange = flowDeadline(room, 'VOTE', now);
  const validVote =
    chosenVoteDeadline !== null &&
    chosenVoteDeadline >= voteRange.minimum &&
    chosenVoteDeadline <= voteRange.maximum;

  async function run(intent: Intent, deadline?: number) {
    if (sending.current || state.loading || !allowed(intent)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setDialog(null);
    if (intent !== 'CLOSE' && deadline !== undefined) {
      setLastDeadline({ kind: intent, time: deadline });
      if (intent === 'VOTE') setVoteDeadline(deadline);
    }
    const action =
      intent === 'CLOSE'
        ? 'CLOSE_COLLECTION'
        : intent === 'MINI_TIMER'
          ? 'START_MINI_TIMER'
          : intent === 'EXTEND'
            ? 'EXTEND_COLLECTION'
            : 'START_VOTING';
    try {
      await state.mutate(action, async (latest) => {
        const currentTime = estimateServerNow(latest, state.receivedAt);
        const live = registrationFlow(latest, currentTime);
        const permitted =
          intent === 'CLOSE'
            ? live.canClose
            : intent === 'MINI_TIMER'
              ? live.canMini
              : intent === 'EXTEND'
                ? live.canExtend
                : live.canVote;
        const round = latest.registration?.round;
        if (round === undefined || round !== room.registration.round || !permitted) {
          throw new ApiRequestError(409, { code: 'STALE_ROUND', message: 'Round unavailable' });
        }
        const range = intent === 'CLOSE' ? null : flowDeadline(latest, intent, currentTime);
        if (
          range &&
          (deadline === undefined ||
            !Number.isFinite(deadline) ||
            !(deadline >= range.minimum && deadline <= range.maximum))
        ) {
          throw new ApiRequestError(400, { code: 'INVALID_DEADLINE', message: 'Invalid deadline' });
        }
        const closesAt = deadline === undefined ? undefined : new Date(deadline).toISOString();
        const signature = JSON.stringify([latest.roomId, round, intent, closesAt]);
        if (retry.current?.signature !== signature) {
          const handle =
            intent === 'CLOSE'
              ? roomMutations.closeRegistration(latest.roomId, { round })
              : intent === 'VOTE'
                ? roomMutations.startVoting(latest.roomId, { round, closesAt: closesAt! })
                : roomMutations.extendRegistration(latest.roomId, {
                    round,
                    mode: intent,
                    closesAt: closesAt!,
                  });
          retry.current = { signature, handle };
        }
        const response = await retry.current.handle.execute();
        onAccepted(latest.revision);
        return response;
      });
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError
          ? (flowErrors[failure.code] ?? '요청을 처리하지 못했어요.')
          : '요청을 처리하지 못했어요.',
      );
      if (failure instanceof ApiRequestError) {
        if (intent === 'CLOSE' || ['KEY_REUSED', 'SESSION_CHANGED'].includes(failure.code))
          retry.current = undefined;
        if (failure.code === 'NETWORK_ERROR' || failure.code === 'INVALID_DEADLINE')
          await refresh();
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function openDeadline(kind: DeadlineKind) {
    if (defaultDeadline(room, kind, now) === null) {
      setError('마감을 설정할 시간이 부족해요.');
      return;
    }
    setDialog(kind);
  }

  const rootClass = isRegistration
    ? 'place-registration-status'
    : isVote
      ? 'vote-start'
      : 'registration-close';
  return (
    <div className={`page ${rootClass}`} data-room-screen={screen}>
      <Header
        title={isRegistration ? '등록 현황' : isVote ? '투표 시작' : '등록 마감'}
        showBackButton
        onBack={() => navigate(link(isVote ? PATHS.closeRegistration : PATHS.info))}
      />
      <main className={`${rootClass}__content`}>
        {isRegistration ? (
          <>
            <section
              className="place-registration-status__summary"
              aria-label="장소 등록 완료 현황"
            >
              <h2>
                {status.completed} / {status.members}명
              </h2>
              <p>
                정원 {status.capacity}명 ·{' '}
                {room.registration.myCompleted ? '내 등록 완료' : '내 등록 미완료'}
              </p>
              {status.rows.map(({ category, name, required }) => (
                <span key={category}>
                  {name} · {required ? '필수' : '선택'}{' '}
                </span>
              ))}
              {Number.isFinite(status.closesAt) && (
                <p>
                  등록 마감 {formatSeoulDeadline(status.closesAt, now)} · <time>{clock}</time>
                </p>
              )}
              {expired && <p role="status">등록 시간이 끝났어요. 서버 상태를 확인하고 있어요.</p>}
              <div
                className="place-registration-status__progress"
                role="progressbar"
                aria-label="등록 완료율"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
            </section>
            <RegistrationParticipantList participants={participants} />
          </>
        ) : (
          <>
            <section className={isVote ? 'vote-start__hero' : 'registration-close__intro'}>
              <h2>장소 등록이 마감됐어요.</h2>
              <p>
                회차 {room.registration.round} · 등록 완료 {status.completed} / {status.members}명
              </p>
            </section>
            <section className="registration-close__card" aria-label="카테고리별 등록 현황">
              <h3>카테고리별 등록 현황</h3>
              <dl>
                {status.rows
                  .filter(({ required, count }) => required || count !== 0)
                  .map((row) => (
                    <div key={row.category}>
                      <dt>
                        {row.name} · {row.required ? '필수' : '선택'}
                      </dt>
                      <dd>
                        {row.count === undefined
                          ? '후보 수 비공개'
                          : row.count === 0
                            ? '후보 없음'
                            : `${row.count}곳 · ${row.count === 1 ? '자동 선정' : '투표 대상'}`}
                      </dd>
                    </div>
                  ))}
              </dl>
              {status.rows.some(({ required, count }) => !required && count === 0) && (
                <p>
                  투표 제외 ·{' '}
                  {status.rows
                    .filter(({ required, count }) => !required && count === 0)
                    .map(({ name }) => name)
                    .join('·')}
                </p>
              )}
              {!!status.missing.length && (
                <p role="status">
                  필수 후보 부족 · {status.missing.map(({ name }) => name).join('·')}
                </p>
              )}
            </section>
            {isVote && status.canVote && (
              <section className="vote-start__deadline">
                <h3>투표 마감</h3>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  disabled={busy}
                  onClick={() => openDeadline('VOTE')}
                >
                  {chosenVoteDeadline === null
                    ? '마감 설정 가능 시간 없음'
                    : formatSeoulDeadline(chosenVoteDeadline, now)}
                </button>
                {Number.isFinite(voteRange.maximum) && (
                  <p>
                    최소 {room.deadlinePolicy?.votingMinimumMinutes ?? 30}분 · 상한{' '}
                    {formatSeoulDeadline(voteRange.maximum, now)}
                  </p>
                )}
                {!validVote && <p role="status">유효한 마감 시간을 선택해주세요.</p>}
              </section>
            )}
          </>
        )}
        {state.notice && <p role="status">{state.notice}</p>}
        {error && <p role="alert">{error}</p>}
      </main>
      <footer className={`${rootClass}__footer`}>
        {busy && <p role="status">요청을 처리 중이에요.</p>}
        {status.open &&
          participants.some(
            ({ id, status }) => id !== room.me.participantId && status !== 'completed',
          ) && <Button onClick={() => setShare('reminder')}>등록 재촉하기</Button>}
        {!status.host && <Button onClick={() => setShare('notifyHost')}>방장에게 알리기</Button>}
        {status.canMini && (
          <Button
            variant="secondary"
            disabled={busy || state.loading}
            onClick={() => openDeadline('MINI_TIMER')}
          >
            미니 타이머 설정하기
          </Button>
        )}
        {status.canClose && (
          <Button disabled={busy || state.loading} onClick={() => setDialog('CLOSE')}>
            등록 조기 마감하기
          </Button>
        )}
        {status.canExtend && (
          <Button
            variant="secondary"
            disabled={busy || state.loading}
            onClick={() => openDeadline('EXTEND')}
          >
            등록 마감시간 연장하기
          </Button>
        )}
        {!isVote && status.canVote && (
          <Link to={link(PATHS.startVote)}>투표 시작 화면으로 이동</Link>
        )}
        {isVote && status.canVote && (
          <Button
            disabled={!validVote || busy || state.loading}
            onClick={() => void run('VOTE', chosenVoteDeadline ?? undefined)}
          >
            투표 시작하기
          </Button>
        )}
      </footer>
      <Modal
        open={dialog === 'CLOSE' && status.canClose}
        onClose={() => setDialog(null)}
        className="screen11-modal"
        aria-labelledby="server-registration-close-title"
      >
        <h2 id="server-registration-close-title">장소 등록을 마감할까요?</h2>
        <p>마감하면 현재 방의 후보로 다음 단계를 진행해요.</p>
        <Button variant="secondary" onClick={() => setDialog(null)}>
          더 기다리기
        </Button>
        <Button disabled={busy || state.loading} onClick={() => void run('CLOSE')}>
          등록 마감하기
        </Button>
      </Modal>
      {activeDeadline && initialDeadline !== null && (
        <VoteDeadlineModal
          deadline={
            activeDeadline === 'VOTE'
              ? (chosenVoteDeadline ?? initialDeadline)
              : lastDeadline?.kind === activeDeadline
                ? lastDeadline.time
                : initialDeadline
          }
          now={now}
          meeting={Date.parse(room.meeting?.meetingAt ?? '')}
          registrationExtension={activeDeadline !== 'VOTE'}
          serverRange={{
            ...flowDeadline(room, activeDeadline, now),
            toInput: seoulInput,
            fromInput: parseSeoulInput,
            hint:
              activeDeadline === 'VOTE'
                ? '서버가 허용하는 서울 시간 범위에서 투표 마감을 선택해주세요.'
                : activeDeadline === 'MINI_TIMER'
                  ? '현재 마감보다 늦은 서울 시각을 선택해주세요.'
                  : '현재 시각보다 늦은 마감을 선택해주세요.',
          }}
          onClose={() => setDialog(null)}
          onConfirm={(value) => {
            if (activeDeadline === 'VOTE') {
              setVoteDeadline(value);
              setDialog(null);
            } else void run(activeDeadline, value);
          }}
        />
      )}
      {share && (
        <ServerRegistrationShare roomId={room.roomId} kind={share} onClose={() => setShare(null)} />
      )}
    </div>
  );
}
