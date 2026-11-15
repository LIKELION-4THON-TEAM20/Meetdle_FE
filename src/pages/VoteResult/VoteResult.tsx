import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import ResultPlaceCard from './components/ResultPlaceCard';
import VoteBreakdown from './components/VoteBreakdown';
import VisitOrderSheet from './components/VisitOrderSheet';
import TieBreakModal from './components/TieBreakModal';
import ResultPending from './components/ResultPending';
import RevoteNotice from './components/RevoteNotice';
import { createResultMock, meetingSummary, tieCandidates } from './mockData';
import { saveVisitOrder, selectTiePlace, incrementMockRevote } from './resultUtils';
import type { ResultRole } from './types';
import './VoteResult.scss';
import { useMockRoom } from '../../features/mockRoom/context';

function VoteResultScreen({
  scenario,
  role: fixtureRole,
}: {
  scenario: string | null;
  role: ResultRole;
}) {
  const navigate = useNavigate();
  const { room, send, isolated } = useMockRoom();
  const role = isolated ? fixtureRole : room.role;
  const [localResult, setResult] = useState(() => createResultMock(scenario));
  const result = isolated
    ? localResult
    : (room.result ?? { categories: [], order: [], unresolvedTie: false, revotesUsed: 0 });
  const tie = isolated ? { id: 'cafe', name: '카페', places: tieCandidates } : room.ties[0];
  const [breakdown, setBreakdown] = useState(scenario === 'breakdown' || scenario === 'zeroVotes');
  const [sheetOpen, setSheetOpen] = useState(scenario === 'order');
  const [notice, setNotice] = useState('');
  const pending =
    (!isolated && room.result === null) ||
    scenario === 'pending' ||
    (result.unresolvedTie && role === 'participant');
  const noResult =
    (!isolated && room.result !== null && !result.categories.length) ||
    scenario === 'noResult' ||
    scenario === 'revoteUsed';
  const normal = !pending && !noResult && !result.unresolvedTie;
  return (
    <div className="page vote-result">
      <Header title="최종 결과" showBackButton onBack={() => navigate(-1)} />
      <main className="vote-result__content">
        <p className="vote-result__mock-note">
          개발용 목 결과예요. 서버에서 확정된 결과가 아니에요.
        </p>
        {!isolated && !room.result && <Link to="/rooms/vote/status">투표 현황으로 이동</Link>}
        {pending ? (
          <ResultPending />
        ) : noResult ? (
          <RevoteNotice
            used={result.revotesUsed}
            canRevote={role === 'host'}
            onRevote={() => {
              if (role !== 'host') return;
              if (isolated) setResult((previous) => incrementMockRevote(previous));
              else send({ type: 'revoteNotice' });
            }}
          />
        ) : result.unresolvedTie ? (
          <TieBreakModal
            category={tie?.name ?? ''}
            candidates={tie?.places ?? []}
            onSelect={(id) => {
              if (role !== 'host') return;
              if (isolated)
                setResult((previous) => selectTiePlace(previous, 'cafe', id, tieCandidates, role));
              else if (tie) send({ type: 'tie', categoryId: tie.id, placeId: id });
              setNotice('선택한 후보를 현재 화면에 반영했어요. 서버에는 저장되지 않았어요.');
            }}
          />
        ) : (
          <>
            <div className="vote-result__intro">
              <h2>모두가 함께 갈 수 있는 곳으로 정했어요</h2>
              <p>
                {isolated
                  ? meetingSummary
                  : `${new Date(room.meetingAt).toLocaleString('ko-KR')} · ${room.area}`}
              </p>
            </div>
            {result.categories.map((category) => (
              <section
                className="vote-result__category"
                key={category.id}
                aria-labelledby={`result-${category.id}`}
              >
                <h2 id={`result-${category.id}`}>{category.name}</h2>
                <ResultPlaceCard place={category.place} category={category.name} />
              </section>
            ))}
            <div className="vote-result__links">
              <button
                className="vote-result__text-button"
                type="button"
                aria-expanded={breakdown}
                aria-controls="vote-breakdown"
                onClick={() => setBreakdown((previous) => !previous)}
              >
                {breakdown ? '투표 결과 접어보기' : '투표 결과 펼쳐보기'}
              </button>
              <button
                className="vote-result__text-button"
                type="button"
                onClick={() =>
                  setNotice(
                    '연결할 수 있는 지도 화면 경로가 아직 없어요. 지도 연동을 준비 중이에요.',
                  )
                }
              >
                지도 보기
              </button>
            </div>
            {breakdown && <VoteBreakdown categories={result.categories} />}
            <p className="vote-result__mock-note">목 데이터로 구성한 예시 결과예요.</p>
          </>
        )}
        {notice && (
          <p className="vote-result__notice" role="status">
            {notice}
          </p>
        )}
      </main>
      {normal && (
        <footer className="vote-result__footer">
          <Button onClick={() => setSheetOpen(true)}>방문 순서 확인하기</Button>
        </footer>
      )}
      {sheetOpen && normal && (
        <VisitOrderSheet
          categories={result.categories}
          order={result.order}
          role={role}
          onClose={() => setSheetOpen(false)}
          onSave={(order) => {
            if (role !== 'host') return;
            if (isolated) setResult((previous) => saveVisitOrder(previous, order, role));
            else send({ type: 'order', order });
            setSheetOpen(false);
            setNotice('');
          }}
        />
      )}
    </div>
  );
}

export default function VoteResult() {
  const [params] = useSearchParams();
  const requested = import.meta.env.DEV ? params.get('scenario') : null;
  const scenario = [
    'breakdown',
    'order',
    'tie',
    'pending',
    'noResult',
    'revoteUsed',
    'zeroVotes',
  ].includes(requested ?? '')
    ? requested
    : null;
  const role: ResultRole =
    import.meta.env.DEV && params.get('role') === 'participant' ? 'participant' : 'host';
  return (
    <VoteResultScreen key={`${scenario ?? 'default'}-${role}`} scenario={scenario} role={role} />
  );
}
