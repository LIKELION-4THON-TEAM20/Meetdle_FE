import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useRoomLink, useRoomBack } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import MeetingConfirmationLayout from '../MeetingConfirmed/components/MeetingConfirmationLayout';
import { getMeetingConfirmation } from '../MeetingConfirmed/confirmationData';
import ResultPlaceCard from './components/ResultPlaceCard';
import VoteBreakdown, { type BreakdownCategory } from './components/VoteBreakdown';
import VisitOrderSheet from './components/VisitOrderSheet';
import TieBreakModal from './components/TieBreakModal';
import ResultPending from './components/ResultPending';
import RevoteNotice from './components/RevoteNotice';
import { createResultMock, tieCandidates } from './mockData';
import { getSelectionReason, saveVisitOrder, incrementMockRevote } from './resultUtils';
import type { ResultRole } from './types';
import { useMockRoom } from '../../features/mockRoom/context';
import {
  canFinalizeResult,
  resultCandidates,
  resultTieOptions,
} from '../../features/mockRoom/model';
import './VoteResult.scss';

const scenarios = [
  'review',
  'breakdown',
  'map',
  'order',
  'tie',
  'tieModal',
  'tieSelected',
  'multipleTies',
  'pending',
  'noResult',
  'revoteUsed',
  'zeroVotes',
  'finalized',
];

function VoteResultScreen({
  scenario,
  role: fixtureRole,
}: {
  scenario: string | null;
  role: ResultRole;
}) {
  const goBack = useRoomBack(PATHS.voteStatus);
  const roomLink = useRoomLink();
  const { room, send, isolated } = useMockRoom();
  const role = isolated ? fixtureRole : room.role;
  const [fixture, setFixture] = useState(() => createResultMock(scenario));
  const [fixtureSelections, setFixtureSelections] = useState<Record<string, string>>(
    scenario === 'tieSelected' ? { cafe: tieCandidates[0].id } : {},
  );
  const [panel, setPanel] = useState<'votes' | 'map' | null>(
    scenario === 'map'
      ? 'map'
      : scenario === 'breakdown' || scenario === 'zeroVotes'
        ? 'votes'
        : null,
  );
  const [sheetOpen, setSheetOpen] = useState(scenario === 'order');
  const [tieNoticeOpen, setTieNoticeOpen] = useState(scenario === 'tieModal');
  const [notice, setNotice] = useState('');
  const result = isolated ? fixture : room.result;
  const meeting = getMeetingConfirmation(room);
  const finalized = result?.finalized === true;
  const noResult =
    !result?.categories.length || scenario === 'noResult' || scenario === 'revoteUsed';
  const pending =
    !result || scenario === 'pending' || (role === 'participant' && !finalized && !noResult);
  const fixtureTies = ['tie', 'tieModal', 'tieSelected', 'multipleTies'].includes(scenario ?? '')
    ? [
        { id: 'cafe', name: '카페', places: tieCandidates },
        ...(scenario === 'multipleTies'
          ? [
              {
                id: 'pub',
                name: '주점',
                places: fixture.categories
                  .filter(({ id }) => id === 'pub')
                  .flatMap(({ place }) => [place, { ...place, id: 'pub-e', name: 'E 주점' }]),
              },
            ]
          : []),
      ]
    : [];
  const ties = isolated ? fixtureTies : resultTieOptions(room);
  const unresolved = isolated
    ? fixtureTies.some(({ id }) => !fixtureSelections[id])
    : room.ties.length > 0;
  const canFinalize =
    !finalized && role === 'host' && (isolated ? !unresolved : canFinalizeResult(room));
  const candidates: BreakdownCategory[] = isolated
    ? [
        ...fixture.categories.map(({ id, name, place }) => ({
          id,
          name,
          places: fixtureTies.find((tie) => tie.id === id)?.places ?? [place],
        })),
        { id: 'culture', name: '문화시설', places: [] },
      ]
    : resultCandidates(room).map((category) => ({
        ...category,
        autoSelected: category.places.length === 1,
      }));
  const visitOrder =
    result?.order.flatMap((id) => result.categories.filter((category) => category.id === id)) ?? [];

  function selectTie(categoryId: string, placeId: string) {
    if (role !== 'host' || finalized) return;
    if (!isolated) {
      send({ type: 'tie', categoryId, placeId });
      return;
    }
    const place = fixtureTies
      .find(({ id }) => id === categoryId)
      ?.places.find(({ id }) => id === placeId);
    if (!place) return;
    setFixtureSelections((previous) => ({ ...previous, [categoryId]: placeId }));
    setFixture((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId ? { ...category, place } : category,
      ),
    }));
  }

  const details = (
    <>
      <div className="vote-result__links">
        <button
          className="vote-result__text-button"
          type="button"
          aria-pressed={panel === 'votes'}
          onClick={() => setPanel(panel === 'votes' ? null : 'votes')}
        >
          {finalized ? '투표 결과 펼쳐보기' : '투표 결과 보기'}
        </button>
        <span aria-hidden="true">•</span>
        <button
          className="vote-result__text-button"
          type="button"
          aria-pressed={panel === 'map'}
          onClick={() => setPanel(panel === 'map' ? null : 'map')}
        >
          {panel === 'map' ? '지도에서 보기' : '지도 보기'}
        </button>
      </div>
      {panel === 'votes' && <VoteBreakdown categories={candidates} />}
      {panel === 'map' && (
        <section className="vote-result__map" aria-label="지도 보기">
          <strong>{meeting.area}</strong>
          <p>선정 장소와 역의 지도 좌표가 준비되면 지도에서 확인할 수 있어요.</p>
        </section>
      )}
    </>
  );

  if (finalized) {
    return (
      <MeetingConfirmationLayout
        meeting={meeting}
        onBack={goBack}
        title="만남 일정이 확정됐어요"
        showTravelSummary={false}
      >
        <section
          className="vote-result__content vote-result__confirmed"
          aria-label="최종 방문 순서"
        >
          <ol className="vote-result__itinerary">
            {visitOrder.map(({ id, place }) => (
              <li key={id}>
                <ResultPlaceCard place={place} categoryId={id} />
              </li>
            ))}
          </ol>
          {details}
          <Button onClick={() => setNotice('카카오톡 공유 SDK는 아직 연동되지 않았어요.')}>
            카카오톡으로 공유하기
          </Button>
          {notice && (
            <p className="vote-result__notice" role="status">
              {notice}
            </p>
          )}
        </section>
      </MeetingConfirmationLayout>
    );
  }

  return (
    <div className="page vote-result">
      <Header title="최종 결과" showBackButton onBack={goBack} />
      <main className="vote-result__content">
        {pending ? (
          <>
            <ResultPending waitingForHost={Boolean(result && scenario !== 'pending')} />
            {!result && <Link to={roomLink(PATHS.voteStatus)}>투표 현황으로 이동</Link>}
          </>
        ) : noResult ? (
          <RevoteNotice
            used={result?.revotesUsed ?? 0}
            canRevote={role === 'host'}
            onRevote={() => {
              if (role !== 'host') return;
              if (isolated) setFixture(incrementMockRevote);
              else send({ type: 'revoteNotice' });
            }}
          />
        ) : (
          <>
            <div className="vote-result__intro">
              <h2>모두가 함께 갈 수 있는 곳으로 정했어요</h2>
              <p>
                {meeting.dateTime} · {meeting.area}
              </p>
            </div>
            {visitOrder.map(({ id, name, place }) => {
              const tie = ties.find((option) => option.id === id);
              const category = candidates.find((item) => item.id === id);
              const selectedId = isolated
                ? fixtureSelections[id]
                : room.ties.some((option) => option.id === id)
                  ? undefined
                  : place.id;
              return tie ? (
                <TieBreakModal
                  key={id}
                  categoryId={id}
                  category={name}
                  candidates={tie.places}
                  selectedId={selectedId}
                  onSelect={(placeId) => selectTie(id, placeId)}
                />
              ) : (
                <section
                  className="vote-result__category"
                  key={id}
                  aria-labelledby={`result-${id}`}
                >
                  <div className="vote-result__category-heading">
                    <h2 id={`result-${id}`}>{name}</h2>
                    <span className="vote-result__reason">
                      {getSelectionReason(place, category?.places ?? [], category?.autoSelected)}
                    </span>
                  </div>
                  <ResultPlaceCard place={place} categoryId={id} />
                </section>
              );
            })}
            {details}
            <footer className="vote-result__footer">
              <Button variant="secondary" disabled={unresolved} onClick={() => setSheetOpen(true)}>
                방문 순서 변경하기
              </Button>
              <Button
                disabled={!canFinalize}
                onClick={() => {
                  if (!canFinalize) return;
                  if (isolated) setFixture((previous) => ({ ...previous, finalized: true }));
                  else send({ type: 'finalizeResult' });
                }}
              >
                결과 확정하기
              </Button>
            </footer>
          </>
        )}
      </main>
      {sheetOpen && !pending && !noResult && !unresolved && result && role === 'host' && (
        <VisitOrderSheet
          categories={result.categories}
          order={result.order}
          role={role}
          onClose={() => setSheetOpen(false)}
          onSave={(order) => {
            if (isolated) setFixture((previous) => saveVisitOrder(previous, order, role));
            else send({ type: 'order', order });
            setSheetOpen(false);
          }}
        />
      )}
      {!pending && !noResult && role === 'host' && tieNoticeOpen && ties[0] && (
        <Modal
          open
          onClose={() => setTieNoticeOpen(false)}
          className="vote-result__tie-dialog"
          aria-label="투표 동률 안내"
        >
          <TieBreakModal
            categoryId={ties[0].id}
            category={ties[0].name}
            candidates={ties[0].places}
            onSelect={(id) => {
              selectTie(ties[0].id, id);
              setTieNoticeOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default function VoteResult() {
  const [params] = useSearchParams();
  const requested = import.meta.env.DEV ? params.get('scenario') : null;
  const scenario = requested && scenarios.includes(requested) ? requested : null;
  const role: ResultRole =
    import.meta.env.DEV && params.get('role') === 'participant' ? 'participant' : 'host';
  return (
    <VoteResultScreen key={`${scenario ?? 'default'}-${role}`} scenario={scenario} role={role} />
  );
}
