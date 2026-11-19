import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { toUiCategory } from '../../api/mappers';
import { getRoomShare, getRoomState, roomMutations } from '../../api/rooms';
import type { Category, ResultPlace, RoomState } from '../../api/types';
import Button from '../../components/common/Button/Button';
import Header from '../../components/common/Header/Header';
import Modal from '../../components/common/Modal/Modal';
import { meetingDetails } from '../../features/serverRoom/meeting';
import {
  resultError,
  resultPermissions,
  tieChoices,
  validVisitOrder,
} from '../../features/serverRoom/result';
import { estimateServerNow } from '../../features/serverRoom/roomState';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import type { useRoomState } from '../../features/serverRoom/useRoomState';
import { categoryLabels } from '../../features/serverRoom/voting';
import { PATHS } from '../../router/paths';
import MeetingConfirmationLayout from '../MeetingConfirmed/components/MeetingConfirmationLayout';
import { prepareKakaoShare, shareKakaoText } from '../../features/serverRoom/kakaoInviteShare';
import {
  parseSeoulInput,
  registrationWindow,
  seoulInput,
} from '../PlaceRegistrationSetup/serverSetupModel';
import ResultPlaceCard from './components/ResultPlaceCard';
import VisitOrderSheet from './components/VisitOrderSheet';
import VoteBreakdown from './components/VoteBreakdown';
import './VoteResult.scss';

type Intent = 'tie' | 'order' | 'confirm' | 'recover';
const actions = {
  tie: 'RESOLVE_TIES',
  order: 'REORDER_VISIT',
  confirm: 'CONFIRM_RESULT',
  recover: 'RECOLLECT',
} as const;
const recoveryText: Record<NonNullable<RoomState['recovery']>['reason'], string> = {
  NO_ELIGIBLE_RESULT: '필수 카테고리에서 함께 갈 장소를 선정하지 못했어요.',
  INSUFFICIENT_TIME: '약속까지 남은 시간이 부족해요.',
  RETRY_EXHAUSTED: '장소 재등록 기회를 이미 사용했어요.',
  NO_SUBMITTED_VOTES: '제출된 투표가 없어 장소를 선정하지 못했어요.',
  DECISION_EXPIRED: '투표 마감 후 진행 방법을 결정할 시간이 지났어요.',
  REGISTRATION_EXPIRED: '장소를 등록할 시간이 지났어요.',
  HOST_DECISION_EXPIRED: '동률 후보를 선택할 시간이 지났어요.',
  CONFIRMATION_EXPIRED: '일정을 확정할 시간이 지났어요.',
};

function cardData({ place }: ResultPlace) {
  return {
    name: place.name,
    address: place.address,
    kakaoMapUrl: place.detailUrl ?? undefined,
    imageUrl: place.imageUrl ?? undefined,
  };
}

export default function ServerVoteResult({
  room,
  state,
}: {
  room: RoomState;
  state: ReturnType<typeof useRoomState>;
}) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Intent | 'share' | null>(null);
  const [editing, setEditing] = useState<{ revision: number; order: string[] }>();
  const [selection, setSelection] = useState<{
    revision: number;
    choices: Partial<Record<Category, string>>;
  }>();
  const [deadline, setDeadline] = useState('');
  const [confirmationVersion, setConfirmationVersion] = useState<number>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<{
    intent: Intent;
    phase: RoomState['phase'];
    version?: number;
    revision: number;
  }>();
  const sending = useRef(false);
  const shareRequest = useRef<AbortController | null>(null);
  useEffect(() => () => shareRequest.current?.abort(), []);
  const retry = useRef<{ signature: string; handle: ReturnType<typeof roomMutations.recollect> }>(
    undefined,
  );

  const result = room.result;
  const now = estimateServerNow(room, state.receivedAt);
  const permissions = resultPermissions(room, now);
  const awaitingRead =
    accepted &&
    room.phase === accepted.phase &&
    (accepted.intent === 'order'
      ? result?.resultRevision === accepted.version
      : accepted.intent === 'tie'
        ? room.tieDecision?.resultRevision === accepted.version
        : accepted.intent === 'confirm' || room.revision <= accepted.revision);
  const blocked = busy || state.loading || !!state.error || !!awaitingRead;
  const meeting = meetingDetails({ ...room, meeting: result?.meeting ?? room.meeting });
  const window = registrationWindow(room, now);
  const minimum = Math.ceil(window.minimum / 60_000) * 60_000;
  const maximum = Math.floor(window.maximum / 60_000) * 60_000;
  const deadlineAt = parseSeoulInput(deadline);
  const canRecover = permissions.recover && minimum <= maximum;
  const choices =
    selection && selection.revision === room.tieDecision?.resultRevision ? selection.choices : {};
  const selected = result?.selected ?? [];
  const details = Array.from(
    new Map(
      [...selected, ...(result?.details ?? [])]
        .filter(({ aggregate }) => aggregate)
        .map((entry) => [entry.candidateId, entry]),
    ).values(),
  );
  const breakdown = Array.from(new Set(details.map(({ place }) => place.category))).map(
    (category) => ({
      id: category,
      name: categoryLabels[category],
      places: details
        .filter(({ place }) => place.category === category)
        .map(({ candidateId, place, aggregate }) => ({
          id: candidateId,
          name: place.name,
          votes: aggregate ?? undefined,
        })),
    }),
  );
  const byId = new Map(selected.map((entry) => [entry.candidateId, entry]));
  const ordered = (result?.visitOrder ?? []).flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const visible = room.phase !== 'WAITING_FOR_HOST_DECISION' || room.me.role === 'HOST';
  const back = () => navigate(serverScreenUrl(PATHS.info, room.roomId, room.meeting?.selectionId));
  const modal = (intent: Intent | 'share') => {
    setError('');
    setDialog(intent);
  };

  async function run(intent: Intent, ids?: string[]) {
    if (blocked || sending.current || !permissions[intent]) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await state.mutate(actions[intent], async (latest, receivedAt) => {
        const liveNow = estimateServerNow(latest, receivedAt);
        if (
          latest.me.participantId !== room.me.participantId ||
          !resultPermissions(latest, liveNow)[intent]
        )
          throw new Error('Result action unavailable');
        let version: number | undefined;
        if (intent === 'recover') {
          const round = latest.recovery?.round;
          const range = registrationWindow(latest, liveNow);
          if (
            round === undefined ||
            round !== room.recovery?.round ||
            !(deadlineAt >= range.minimum && deadlineAt <= range.maximum)
          )
            throw new ApiRequestError(400, {
              code: 'INVALID_DEADLINE',
              message: 'Invalid deadline',
            });
          const closesAt = new Date(deadlineAt).toISOString();
          const signature = JSON.stringify([latest.roomId, round, closesAt]);
          if (retry.current?.signature !== signature)
            retry.current = {
              signature,
              handle: roomMutations.recollect(latest.roomId, { round, closesAt }),
            };
          await retry.current.handle.execute();
        } else if (intent === 'tie') {
          const live = latest.tieDecision;
          const validated = tieChoices(latest, choices);
          if (
            !live ||
            live.round !== room.tieDecision?.round ||
            live.resultRevision !== selection?.revision ||
            !validated
          )
            throw new Error('Tie choices changed');
          version = live.resultRevision;
          await roomMutations
            .resolveTies(latest.roomId, {
              round: live.round,
              resultRevision: version,
              choices: validated,
            })
            .execute();
          const resolved = await getRoomState(latest.roomId);
          const result = resolved.result;
          if (
            resolved.me.participantId !== latest.me.participantId ||
            !result ||
            !resultPermissions(resolved, estimateServerNow(resolved, Date.now())).confirm ||
            !validated.every((choice) =>
              result.selected.some(
                (item) =>
                  item.candidateId === choice.candidateId &&
                  item.place.category === choice.category,
              ),
            )
          )
            throw new Error('Resolved result changed');
          await roomMutations
            .confirmResult(latest.roomId, {
              round: result.round,
              resultRevision: result.resultRevision,
            })
            .execute();
        } else {
          const live = latest.result;
          const expected = intent === 'order' ? editing?.revision : confirmationVersion;
          if (!live || live.round !== result?.round || live.resultRevision !== expected)
            throw new Error('Result version changed');
          version = live.resultRevision;
          const body = { round: live.round, resultRevision: version };
          if (intent === 'order') {
            if (!ids || !validVisitOrder(latest, ids)) throw new Error('Invalid order');
            await roomMutations
              .reorderVisit(latest.roomId, { ...body, candidateIds: ids })
              .execute();
            setEditing(undefined);
          } else {
            await roomMutations.confirmResult(latest.roomId, body).execute();
          }
        }
        setAccepted({ intent, version, phase: latest.phase, revision: latest.revision });
        setDialog(null);
      });
    } catch (failure) {
      setError(resultError(failure));
      if (failure instanceof ApiRequestError) {
        if (failure.code === 'KEY_REUSED') retry.current = undefined;
        if ([401, 403].includes(failure.status ?? 0) || failure.code === 'NETWORK_ERROR')
          await state.refresh({ replace: true });
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (permissions.finalized) void prepareKakaoShare().catch(() => undefined);
  }, [permissions.finalized]);
  async function shareFinalResult() {
    if (busy || !permissions.finalized || shareRequest.current) return;
    const request = new AbortController();
    shareRequest.current = request;
    setBusy(true);
    setError('');
    try {
      const payload = await getRoomShare(room.roomId, 'RESULT', request.signal);
      const message = payload.messages.find((item) => item.id === 'DEFAULT') ?? payload.messages[0];
      if (!message) throw new Error('No share message');
      await shareKakaoText(message.text, payload.shareUrl, request.signal);
    } catch {
      if (!request.signal.aborted)
        setError('카카오톡 공유를 열지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      shareRequest.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  const orderChanged = editing && editing.revision !== result?.resultRevision;
  const orderSheet = dialog === 'order' && editing && permissions.order && (
    <VisitOrderSheet
      categories={selected.map((entry) => ({
        id: entry.candidateId,
        name: categoryLabels[entry.place.category],
        place: entry.place,
      }))}
      order={editing.order}
      role="host"
      busy={blocked || orderChanged}
      onRetry={state.error && !state.loading ? () => void state.refresh() : undefined}
      error={orderChanged ? '서버 순서가 바뀌었어요. 순서 변경을 다시 열어주세요.' : error}
      onClose={() => {
        if (!busy) {
          setDialog(null);
          setEditing(undefined);
        }
      }}
      onSave={(ids) => {
        if (ids.every((id, index) => id === editing.order[index])) {
          setEditing(undefined);
          setDialog(null);
          return;
        }
        void run('order', ids);
      }}
    />
  );
  const controls = (
    <footer className="vote-result__footer">
      {permissions.order && (
        <Button
          variant="secondary"
          disabled={blocked}
          onClick={() => {
            if (!result) return;
            setEditing({ revision: result.resultRevision, order: result.visitOrder });
            modal('order');
          }}
        >
          방문 순서 변경하기
        </Button>
      )}
      {permissions.confirm && (
        <Button
          disabled={blocked || !!editing}
          onClick={() => {
            setConfirmationVersion(result?.resultRevision);
            modal('confirm');
          }}
        >
          결과 확정하기
        </Button>
      )}
      {permissions.finalized && (
        <Button disabled={blocked} onClick={() => void shareFinalResult()}>
          카카오톡으로 공유하기
        </Button>
      )}
      <Link className="common-button common-button--secondary vote-result__home" to={PATHS.home}>
        홈으로 돌아가기 ↗︎
      </Link>
    </footer>
  );

  const cards = (
    <>
      <ol
        className="vote-result__itinerary"
        aria-label={validVisitOrder(room, result?.visitOrder ?? []) ? '방문 순서' : '선정 장소'}
      >
        {(validVisitOrder(room, result?.visitOrder ?? []) ? ordered : selected).map((entry) => {
          const category = entry.place.category;
          const automatic =
            result?.submittedCount === 0 ||
            (room.voting?.round === result?.round &&
              room.voting?.candidates.some(
                ({ candidateId, mode }) =>
                  candidateId === entry.candidateId && mode === 'AUTO_SELECTED',
              )) ||
            (room.registration?.round === result?.round &&
              room.registration?.categoryCounts?.some(
                (count) => count.category === category && count.count === 1,
              ));
          return (
            <li className="vote-result__category" key={entry.candidateId}>
              <div className="vote-result__category-heading">
                <h2>{categoryLabels[category]}</h2>
                {automatic && <span className="vote-result__reason">자동 선정</span>}
              </div>
              <ResultPlaceCard
                place={cardData(entry)}
                categoryId={toUiCategory[category]}
                serverProvided
              />
            </li>
          );
        })}
      </ol>
      {breakdown.length > 0 && (
        <>
          <button
            type="button"
            className="vote-result__text-button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            투표 결과 보기
          </button>
          {detailsOpen && <VoteBreakdown categories={breakdown} countsOnly />}
        </>
      )}
    </>
  );

  const status = (
    <>
      {state.notice && <p role="status">{state.notice}</p>}
      {error && dialog !== 'order' && <p role="alert">{error}</p>}
      {busy && <p role="status">요청을 처리 중이에요.</p>}
      {(awaitingRead || state.error) && (
        <Button disabled={busy || state.loading} onClick={() => void state.refresh()}>
          결과 상태 다시 확인
        </Button>
      )}
    </>
  );
  const dialogs = (
    <>
      {orderSheet}
      {dialog && dialog !== 'order' && dialog !== 'share' && permissions[dialog] && (
        <Modal
          open
          onClose={() => {
            if (!busy) setDialog(null);
          }}
          className="vote-result__tie-dialog"
          aria-labelledby="server-result-dialog"
        >
          <h2 id="server-result-dialog">
            {dialog === 'tie'
              ? '선택한 동률 후보로 결과를 확정할까요?'
              : dialog === 'recover'
                ? '장소 등록을 다시 시작할까요?'
                : '최종 일정을 확정할까요?'}
          </h2>
          {dialog === 'recover' && (
            <>
              <p>확정된 일시와 지역을 유지하며 새 장소 등록 회차를 열어요.</p>
              <label>
                새 등록 마감 (서울 시간)
                <input
                  type="datetime-local"
                  value={deadline}
                  min={seoulInput(minimum)}
                  max={seoulInput(maximum)}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </label>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {!!state.error && (
            <Button disabled={state.loading || busy} onClick={() => void state.refresh()}>
              결과 상태 다시 확인
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
            돌아가기
          </Button>
          {dialog === 'confirm' && confirmationVersion !== result?.resultRevision && (
            <p role="status">결과가 바뀌었어요. 최신 방문 순서를 다시 확인해주세요.</p>
          )}
          <Button
            disabled={
              blocked ||
              (dialog === 'recover' && !(deadlineAt >= minimum && deadlineAt <= maximum)) ||
              (dialog === 'confirm' && confirmationVersion !== result?.resultRevision) ||
              (dialog === 'tie' && !tieChoices(room, choices))
            }
            onClick={() => void run(dialog)}
          >
            확인
          </Button>
        </Modal>
      )}
    </>
  );

  if (
    room.me.role === 'MEMBER' &&
    !permissions.finalized &&
    ['RESULT_READY', 'WAITING_FOR_HOST_DECISION'].includes(room.phase)
  ) {
    return (
      <div className="page vote-result">
        <Header title="최종 일정 확정 대기" showBackButton onBack={() => navigate(PATHS.home)} />
        <main className="vote-result__content">
          <section className="result-pending">
            <h2>방장이 최종 일정을 확인하고 있어요</h2>
            <p>방장이 결과를 확정하면 약속 일정과 장소를 보여드릴게요.</p>
          </section>
          <Link className="common-button common-button--secondary" to={PATHS.home}>
            홈으로 돌아가기 ↗︎
          </Link>
        </main>
      </div>
    );
  }

  if (permissions.finalized && meeting && result) {
    return (
      <MeetingConfirmationLayout
        meeting={meeting}
        onBack={back}
        title="만남 일정이 확정됐어요"
        description="약속 일정과 방문할 장소가 모두 정해졌어요."
        showTravelSummary={false}
      >
        <section
          className="vote-result__content vote-result__confirmed"
          data-room-screen={PATHS.result}
        >
          <p>
            {room.title ?? '약속방'} · {result.round}회차
          </p>
          {cards}
          {status}
          {controls}
        </section>
        {dialogs}
      </MeetingConfirmationLayout>
    );
  }

  return (
    <div className="page vote-result" data-room-screen={PATHS.result}>
      <Header title="최종 결과" showBackButton onBack={back} />
      <main className="vote-result__content">
        {room.recovery || room.phase === 'RECOVERY_REQUIRED' || room.phase === 'ENDED' ? (
          <section className="revote-notice">
            <h2>
              {room.phase === 'ENDED' ? '약속 진행이 종료됐어요.' : '장소 선정에 실패했어요.'}
            </h2>
            {room.recovery && <p>{recoveryText[room.recovery.reason]}</p>}
            {canRecover && (
              <>
                <p>이 약속의 장소 등록을 한 번 다시 진행할 수 있어요.</p>
                <Button
                  disabled={blocked}
                  onClick={() => {
                    if (!(deadlineAt >= minimum && deadlineAt <= maximum))
                      setDeadline(seoulInput(Math.min(maximum, minimum + 60_000)));
                    modal('recover');
                  }}
                >
                  장소 다시 등록하기
                </Button>
              </>
            )}
            {room.phase === 'RECOVERY_REQUIRED' && !canRecover && (
              <p>
                {room.me.role === 'HOST'
                  ? '현재 장소 재등록을 시작할 수 없어요.'
                  : '방장이 다음 단계를 확인 중이에요.'}
              </p>
            )}
          </section>
        ) : (
          <>
            <div className="vote-result__intro">
              <h2>{room.title ?? '약속방'}</h2>
              {meeting && (
                <p>
                  {meeting.dateTime} · {meeting.area}
                </p>
              )}
              {visible && result && <p>{result.round}회차 · 최종 일정 확정 대기</p>}
            </div>
            {visible && cards}
            {room.phase === 'WAITING_FOR_HOST_DECISION' &&
              (permissions.tie ? (
                <>
                  {room.tieDecision?.groups.map(({ category, places }) => (
                    <section className="tie-break-panel" key={category}>
                      <h2>{categoryLabels[category]} 카테고리가 동률이에요</h2>
                      {places.map((entry) => (
                        <ResultPlaceCard
                          key={entry.candidateId}
                          place={cardData(entry)}
                          categoryId={toUiCategory[category]}
                          serverProvided
                          selected={
                            choices[category] ? choices[category] === entry.candidateId : undefined
                          }
                          onSelect={
                            blocked
                              ? undefined
                              : () =>
                                  setSelection({
                                    revision: room.tieDecision!.resultRevision,
                                    choices: { ...choices, [category]: entry.candidateId },
                                  })
                          }
                        />
                      ))}
                    </section>
                  ))}
                  <Button
                    disabled={blocked || !tieChoices(room, choices)}
                    onClick={() => modal('tie')}
                  >
                    결과 확정하기
                  </Button>
                </>
              ) : (
                <p role="status">방장의 동률 후보 결정을 기다리고 있어요.</p>
              ))}
            {room.phase === 'RESULT_READY' && !result && (
              <p role="status">결과를 정리하고 있어요.</p>
            )}
          </>
        )}
        {status}
        {controls}
      </main>
      {dialogs}
    </div>
  );
}
