import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import lockIcon from '../../assets/screen11/lock.svg';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { roomMutations } from '../../api/rooms';
import type { RoomState } from '../../api/types';
import { rememberShareNotice } from '../../features/sharing/shareNotice';
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
type RegistrationDialog = Intent | 'PROGRESS' | 'EXPIRED';
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
  const location = useLocation();
  const [wallTime, setWallTime] = useState(Date.now);
  const [dialog, setDialog] = useState<RegistrationDialog | null>(null);
  const [dismissedPrompt, setDismissedPrompt] = useState<string>(
    () => location.state?.registrationPromptDismissed ?? '',
  );
  const [voteDeadline, setVoteDeadline] = useState<number | null>(null);
  const [share, setShare] = useState<'reminder' | 'notifyHost' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const retry = useRef<{ signature: string; handle: Handle }>(undefined);
  const [lastDeadline, setLastDeadline] = useState<{ kind: DeadlineKind; time: number }>();
  const expiry = useRef('');
  const [elapsedDeadline, setElapsedDeadline] = useState('');
  const expiryKey = `${room.registration.round}:${room.registration.closesAt}`;
  const observedNow = estimateServerNow(room, state.receivedAt, wallTime);
  const now = elapsedDeadline === expiryKey
    ? Math.max(observedNow, Date.parse(room.registration.closesAt))
    : observedNow;
  const status = registrationFlow(room, now);
  const { refresh } = state;

  useEffect(() => {
    const timer = window.setInterval(() => setWallTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlineDelay = state.receivedAt + status.closesAt - Date.parse(room.serverNow) - wallTime;
  useEffect(() => {
    if (!Number.isFinite(deadlineDelay) || deadlineDelay > 2 ** 31 - 1 || elapsedDeadline === expiryKey) return;
    const timer = window.setTimeout(() => setElapsedDeadline(expiryKey), Math.max(0, deadlineDelay));
    return () => window.clearTimeout(timer);
  }, [deadlineDelay, elapsedDeadline, expiryKey]);

  // Keep the deadline notification stable if a later server clock sample is behind.
  const expired = room.phase === 'PLACE_SUBMISSION_OPEN' &&
    (now >= status.closesAt || elapsedDeadline === expiryKey);
  useEffect(() => {
    if (expired && expiry.current !== expiryKey) {
      expiry.current = expiryKey;
      void refresh({ checkSession: false });
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
  const isRegistration = screen === PATHS.registration;
  const isVote = screen === PATHS.startVote;
  const link = (path: string) => serverScreenUrl(path, room.roomId, room.meeting?.selectionId);
  const progress = status.members
    ? Math.min(100, Math.round((status.completed / status.members) * 100))
    : 0;
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
  const activeDeadline =
    dialog && ['MINI_TIMER', 'EXTEND', 'VOTE'].includes(dialog) && allowed(dialog as Intent)
      ? (dialog as DeadlineKind)
      : null;
  const initialDeadline = activeDeadline && defaultDeadline(room, activeDeadline, now);
  const chosenVoteDeadline = voteDeadline ?? defaultDeadline(room, 'VOTE', now);
  const voteRange = flowDeadline(room, 'VOTE', now);
  const validVote =
    chosenVoteDeadline !== null &&
    chosenVoteDeadline >= voteRange.minimum &&
    chosenVoteDeadline <= voteRange.maximum;

  const automatic =
    status.host && isRegistration
      ? status.closed || expired
        ? 'EXPIRED'
        : status.open && status.completed >= Math.ceil(status.capacity / 2)
          ? 'PROGRESS'
          : null
      : null;
  const promptKey = `${room.registration.round}:${room.registration.closesAt}:${automatic}`;
  const prompt = dialog ?? (automatic && dismissedPrompt !== promptKey ? automatic : null);
  const dismissPrompt = () => {
    setDialog(null);
    setDismissedPrompt(promptKey);
  };

  async function run(intent: Intent, deadline?: number) {
    if (sending.current || state.loading || !allowed(intent)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    dismissPrompt();
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
    let acceptedRevision = room.revision;
    try {
      await state.mutate(action, async (latest, latestReceivedAt) => {
        acceptedRevision = latest.revision;
        const currentTime = estimateServerNow(latest, latestReceivedAt);
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
        if ((intent === 'EXTEND' || intent === 'MINI_TIMER') && closesAt)
          rememberShareNotice(latest, { kind: 'registrationExtended', round, closesAt });
        if ((intent === 'EXTEND' || intent === 'MINI_TIMER') && closesAt)
          setDismissedPrompt(`${round}:${closesAt}:PROGRESS`);
        return response;
      });
      onAccepted(acceptedRevision);
      if (intent === 'CLOSE') navigate(link(PATHS.startVote));
      else if (intent === 'EXTEND' || intent === 'MINI_TIMER')
        navigate(link(PATHS.registration), {
          state: {
            registrationPromptDismissed: `${room.registration.round}:${new Date(deadline!).toISOString()}:PROGRESS`,
          },
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
        onBack={() => navigate(isRegistration ? PATHS.home : link(isVote ? PATHS.closeRegistration : PATHS.info))}
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
                {status.rows.filter(({ required }) => required).map(({ name }) => name).join('·')}은 필수예요.
                {status.rows.some(({ required }) => !required) &&
                  ` ${status.rows.filter(({ required }) => !required).map(({ name }) => name).join('·')}은 선택이에요.`}
              </p>
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
            {isVote ? (
              <>
                <section className="vote-start__hero">
                  <span className="vote-start__emoji" aria-hidden="true">🗳️</span>
                  <h2>장소 후보가 모두 모였어요.</h2>
                  <p>이제 투표로 함께 갈 곳을 정해요.</p>
                </section>
                <dl className="vote-start__categories" aria-label="카테고리별 후보 수">
                  {status.rows.map((row) => <div key={row.category}>
                    <dt>{row.name}</dt><dd>{row.count === undefined ? '비공개' : `${row.count}곳`}</dd>
                  </div>)}
                </dl>
                <dl className="vote-start__summary">
                  <div><dt>모인 후보</dt><dd>{room.registration.uniqueCandidateCount === undefined ? '비공개' : `${room.registration.uniqueCandidateCount}곳`}</dd></div>
                  <div><dt>등록 완료 인원</dt><dd>{status.completed} / {status.members}명</dd></div>
                </dl>
              </>
            ) : (<>
            <section className={'registration-close__intro'}>
              <h2>{status.open ? '장소 등록을 마감할까요?' : '장소 등록이 마감됐어요.'}</h2>
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
            </>)}
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
                    * 최소 {room.deadlinePolicy?.votingMinimumMinutes ?? 30}분 동안 진행돼요.<br />
                    * 약속 시작 3시간 전에는 투표가 끝나야 해요.
                  </p>
                )}
                {!validVote && <p role="status">유효한 마감 시간을 선택해주세요.</p>}
              </section>
            )}
            {isVote && <p className="vote-start__privacy"><img src={lockIcon} width={16} height={16} alt="" />후보 장소 이름은 투표 화면에서 처음 공개돼요.</p>}
          </>
        )}
        {state.notice && <p role="status">{state.notice}</p>}
        {error && <RequestStatus title="장소 등록 요청을 처리하지 못했어요." description={error} />}
      </main>
      <footer className={`${rootClass}__footer`}>
        {busy && (
          <RequestStatus
            loading
            title="장소 등록 상태를 변경하는 중이에요."
            description="잠시만 기다려주세요."
          />
        )}
        {isRegistration && status.open &&
          participants.some(
            ({ id, status }) => id !== room.me.participantId && status !== 'completed',
          ) && <Button onClick={() => setShare('reminder')}>등록 재촉하기</Button>}
        {status.host && isRegistration && !status.closed && (
          <Button
            variant="secondary"
            className="registration-secondary"
            disabled={busy || state.loading}
            onClick={() => setDialog('PROGRESS')}
          >
            등록 마감하고 투표 시작하기
          </Button>
        )}
        {status.host && !isRegistration && !isVote && status.open && (
          <>
            <Button
              disabled={!status.canClose || busy || state.loading}
              onClick={() => void run('CLOSE')}
            >
              등록 마감하고 투표 시작
            </Button>
            {!status.canClose && (
              <p>절반 이상이 등록을 완료하고 필수 카테고리 후보가 있어야 마감할 수 있어요.</p>
            )}
          </>
        )}
        {status.host && !isRegistration && !isVote && status.closed && status.canVote && (
          <Button onClick={() => navigate(link(PATHS.startVote))}>현재 후보로 투표 시작하기</Button>
        )}
        {status.host && !isRegistration && !isVote && (status.canMini || status.canExtend) && (
          <Button
            variant="secondary"
            disabled={busy || state.loading}
            onClick={() => openDeadline(status.canExtend ? 'EXTEND' : 'MINI_TIMER')}
          >
            등록 마감시간 연장하기
          </Button>
        )}
        {status.closed && isRegistration && status.canVote && (
          <Button onClick={() => navigate(link(PATHS.startVote))}>현재 후보로 투표 시작하기</Button>
        )}
        {status.closed && isRegistration && status.canExtend && (
          <Button variant="secondary" onClick={() => openDeadline('EXTEND')}>
            등록 마감시간 연장하기
          </Button>
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
      {(prompt === 'PROGRESS' || prompt === 'EXPIRED') && status.host && (
        <Modal
          open
          onClose={dismissPrompt}
          closeOnBackdropClick={false}
          closeOnEscape={false}
          className={`registration-status-modal${prompt === 'EXPIRED' ? ' registration-status-modal--expired' : ''}`}
          aria-labelledby="registration-prompt-title"
        >
          <h2 id="registration-prompt-title">
            {prompt === 'EXPIRED'
              ? '장소 등록 시간이 끝났어요.'
              : `${status.completed} / ${status.capacity}명 등록 완료`}
          </h2>
          <RegistrationParticipantList
            participants={
              prompt === 'PROGRESS'
                ? participants.filter((p) => p.status === 'completed')
                : participants
            }
          />
          {prompt === 'PROGRESS' ? (
            <div className="registration-status-modal__actions">
              <Button className="registration-status-modal__wait" onClick={dismissPrompt}>
                조금 더 기다리기
              </Button>
              <Button
                onClick={() => {
                  dismissPrompt();
                  navigate(link(PATHS.closeRegistration));
                }}
              >
                다음 단계로 이동
              </Button>
            </div>
          ) : (
            <>
              <Button
                disabled={!status.canVote || busy || state.loading}
                onClick={() => {
                  dismissPrompt();
                  navigate(link(PATHS.startVote));
                }}
              >
                현재 후보로 투표 시작하기
              </Button>
              <Button
                variant="secondary"
                disabled={!status.canExtend || busy || state.loading}
                onClick={() => {
                  dismissPrompt();
                  openDeadline('EXTEND');
                }}
              >
                등록 마감시간 연장하기
              </Button>
              {(!status.canVote || !status.canExtend) && (
                <p role="status">
                  {state.error
                    ? '마감 상태를 불러오지 못했어요. 다시 확인해주세요.'
                    : !status.canVote && !status.canExtend
                      ? '현재 후보와 마감 상태에서는 투표 시작이나 시간 연장을 할 수 없어요.'
                      : !status.canExtend
                        ? '현재는 등록 시간을 연장할 수 없어요.'
                        : '필수 카테고리에 후보가 있어야 투표를 시작할 수 있어요.'}
                </p>
              )}

            </>
          )}
        </Modal>
      )}
      {activeDeadline && initialDeadline !== null && (
        <VoteDeadlineModal
          confirmDisabled={busy || state.loading}
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
