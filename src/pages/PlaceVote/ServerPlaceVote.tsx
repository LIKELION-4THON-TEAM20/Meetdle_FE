import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { roomMutations } from '../../api/rooms';
import type { Draft, Preference, RoomState, Voting } from '../../api/types';
import RoomShareButton from '../../features/sharing/RoomShareButton';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import Modal from '../../components/common/Modal/Modal';
import { estimateServerNow } from '../../features/serverRoom/roomState';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import type { useRoomState } from '../../features/serverRoom/useRoomState';
import { useVoteClock } from '../../features/serverRoom/useVoteClock';
import {
  ballotPermissions,
  ballotSelections,
  cardChoices,
  categoryLabels,
  hasSubmittedVote,
  voteError,
  wireChoices,
} from '../../features/serverRoom/voting';
import { PATHS } from '../../router/paths';
import PlaceVoteCard from './components/PlaceVoteCard';
import { formatVoteRemaining } from './voteUtils';
import './PlaceVote.scss';

export default function ServerPlaceVote({
  room,
  state,
  accepted,
  onAccepted,
}: {
  room: RoomState & { voting: Voting };
  state: ReturnType<typeof useRoomState>;
  accepted: boolean;
  onAccepted: () => void;
}) {
  const navigate = useNavigate();
  const { now, deadline, expired } = useVoteClock(room, state);
  const [changes, setChanges] = useState<Preference[]>([]);
  const [receipt, setReceipt] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const sending = useRef(false);
  const page = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  const submitted = hasSubmittedVote(room);
  const round = room.voting.round;
  const permissions = ballotPermissions(room, now);
  const locked = accepted || submitted || busy || !!state.error;
  const savedDraft = (latest: RoomState) => {
    const remote = latest.voting?.myDraft;
    return receipt && receipt.draftRevision > (remote?.draftRevision ?? 0) ? receipt : remote;
  };
  const currentDraft = savedDraft(room);
  const ballot = ballotSelections(room, currentDraft?.selections ?? [], changes);
  const completed = ballot.selections.length;
  const needsSave =
    !currentDraft || changes.length > 0 || currentDraft.selections.length !== completed;
  const statusUrl = serverScreenUrl(PATHS.voteStatus, room.roomId);
  const categories = Array.from(new Set(room.voting.candidates.map(({ place }) => place.category)));

  useLayoutEffect(() => {
    const root = page.current;
    const bar = footer.current;
    if (!root || !bar || submitted) return;
    const measure = () =>
      root.style.setProperty(
        '--place-vote-footer-height',
        `${bar.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--place-vote-footer-height');
    };
  }, [submitted]);

  function assertCurrent(latest: RoomState, receivedAt: number, action: 'edit' | 'submit') {
    if (
      latest.voting?.round !== round ||
      latest.me.participantId !== room.me.participantId ||
      !ballotPermissions(latest, estimateServerNow(latest, receivedAt))[action]
    )
      throw new Error('Ballot unavailable');
  }

  async function run(submit: boolean) {
    if (locked || sending.current || state.loading || (submit && !permissions.submit)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setConfirm(false);
    try {
      let draft = currentDraft;
      if (needsSave && permissions.edit) {
        draft = await state.mutate('EDIT_PREFERENCES', async (latest, receivedAt) => {
          assertCurrent(latest, receivedAt, 'edit');
          const current = savedDraft(latest);
          const payload = ballotSelections(latest, current?.selections ?? [], changes);
          if (submit && !payload.complete) throw new Error('Incomplete ballot');
          const saved = await roomMutations
            .savePreferences(latest.roomId, {
              round,
              draftRevision: current?.draftRevision ?? 0,
              selections: payload.selections,
            })
            .execute();
          setReceipt(saved);
          setChanges([]);
          return saved;
        });
      }
      if (!submit) return;
      if (
        !draft ||
        !ballotSelections(room, draft.selections, []).complete ||
        (needsSave && !permissions.edit)
      )
        throw new Error('Unsaved ballot');
      const draftRevision = draft.draftRevision;
      await state.mutate('SUBMIT_VOTE', async (latest, receivedAt) => {
        assertCurrent(latest, receivedAt, 'submit');
        const remote = latest.voting?.myDraft;
        const validated = ballotSelections(latest, draft.selections, []);
        if (
          (remote && remote.draftRevision > draftRevision) ||
          !validated.complete ||
          validated.selections.length !== draft.selections.length
        )
          throw new Error('Ballot changed');
        await roomMutations.submitVote(latest.roomId, { round, draftRevision }).execute();
        onAccepted();
      });
    } catch (failure) {
      setError(voteError(failure));
      if (
        failure instanceof ApiRequestError &&
        (failure.status === 401 || failure.status === 403 || failure.code === 'NETWORK_ERROR')
      ) {
        await state.refresh({ replace: true });
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      ref={page}
      className={`page place-vote${submitted ? '' : ' place-vote--with-fixed-cta'}`}
      data-room-screen={PATHS.vote}
    >
      <Header title={room.title ?? '약속방'} showBackButton onBack={() => navigate(statusUrl)} />
      <main className="place-vote__content">
        {submitted ? (
          <h2 className="place-vote__submitted" role="status">
            투표 제출 완료
          </h2>
        ) : (
          <section className="place-vote__intro" aria-labelledby="place-vote-title">
            <div className="place-vote__title-row">
              <h2 id="place-vote-title">장소 투표</h2>
              <span className="place-vote__timer" role="timer">
                마감까지 {formatVoteRemaining(deadline, now)}
              </span>
            </div>
            <div
              className="place-vote__progress"
              role="progressbar"
              aria-label="장소 선택 완료율"
              aria-valuemin={0}
              aria-valuemax={ballot.total || 1}
              aria-valuenow={completed}
            >
              <span
                style={{ width: `${ballot.total ? (completed / ballot.total) * 100 : 100}%` }}
              />
            </div>
            <p className="place-vote__count">
              {completed} / {ballot.total}곳 선택 완료 · 제출 전
            </p>
            {room.me.role === 'HOST' && permissions.edit && (
              <RoomShareButton room={room} kind="votingRequest" disabled={busy}>
                투표 안내 공유하기
              </RoomShareButton>
            )}
            <p className="place-vote__description">
              투표 대상 후보마다 선호도를 골라주세요. 내 선택은 나만 볼 수 있어요.
            </p>
          </section>
        )}
        {categories.map((category) => {
          const candidates = room.voting.candidates.filter(
            ({ place }) => place.category === category,
          );
          const setting = room.registration?.categories.find(
            (entry) => entry.category === category,
          );
          return (
            <section
              className="place-vote__category"
              key={category}
              aria-labelledby={`category-${category}`}
            >
              <h3 id={`category-${category}`}>
                {categoryLabels[category]}
                <span>
                  {setting && (setting.required ? '필수 · ' : '선택 · ')}
                  {candidates.length}곳
                </span>
              </h3>
              {candidates.map(({ candidateId, place, mode }) => {
                const choice = ballot.selections.find(
                  (entry) => entry.candidateId === candidateId,
                )?.choice;
                return (
                  <PlaceVoteCard
                    key={candidateId}
                    place={{
                      id: candidateId,
                      name: place.name,
                      address: place.address,
                      kakaoMapUrl: place.detailUrl ?? undefined,
                      imageUrl: place.imageUrl ?? undefined,
                    }}
                    category={categoryLabels[category]}
                    automatic={mode === 'AUTO_SELECTED'}
                    serverProvided
                    choice={choice && cardChoices[choice]}
                    locked={locked || !permissions.edit}
                    onChoose={(value) => {
                      if (sending.current) return;
                      setChanges((previous) => [
                        ...previous.filter((entry) => entry.candidateId !== candidateId),
                        { candidateId, choice: wireChoices[value] },
                      ]);
                    }}
                  />
                );
              })}
            </section>
          );
        })}
      </main>
      <footer ref={footer} className="place-vote__footer">
        {submitted ? (
          <Link className="place-vote__status-link" to={statusUrl}>
            투표 현황 보기
          </Link>
        ) : (
          <>
            {state.notice && <p role="status">{state.notice}</p>}
            {error && (
              <RequestStatus
                title="투표를 저장하지 못했어요."
                description={error + ' 선택한 내용은 그대로 유지돼요.'}
              />
            )}
            {accepted || state.error ? (
              <>
                <p role="status">최신 투표 상태를 확인해주세요.</p>
                <Button disabled={state.loading || busy} onClick={() => void state.refresh()}>
                  투표 상태 다시 확인
                </Button>
              </>
            ) : (
              <>
                {expired && (
                  <p role="status">투표 마감 시각이 지났어요. 서버 상태를 확인하고 있어요.</p>
                )}
                {!ballot.complete && (
                  <p className="place-vote__incomplete">아직 선택하지 않은 후보가 있어요.</p>
                )}
                {changes.length > 0 && (
                  <Button
                    variant="secondary"
                    disabled={locked || !permissions.edit || state.loading}
                    onClick={() => void run(false)}
                  >
                    초안 저장
                  </Button>
                )}
                <Button
                  disabled={
                    locked ||
                    !permissions.submit ||
                    !ballot.complete ||
                    state.loading ||
                    (!permissions.edit && needsSave)
                  }
                  onClick={() => setConfirm(true)}
                >
                  {busy ? '처리 중…' : '투표 제출'}
                </Button>
              </>
            )}
          </>
        )}
      </footer>
      <Modal
        open={confirm && permissions.submit && !locked}
        onClose={() => setConfirm(false)}
        className="server-ballot-confirm"
        aria-labelledby="server-ballot-confirm"
      >
        <h2 id="server-ballot-confirm">투표를 제출할까요?</h2>
        <p>제출한 뒤에는 선택을 바꿀 수 없어요.</p>
        <Button variant="secondary" onClick={() => setConfirm(false)}>
          돌아가기
        </Button>
        <Button disabled={state.loading} onClick={() => void run(true)}>
          투표 제출하기
        </Button>
      </Modal>
    </div>
  );
}
