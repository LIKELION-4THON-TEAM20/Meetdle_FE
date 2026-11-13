import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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

function VoteResultScreen({ scenario, role }: { scenario: string | null; role: ResultRole }) {
  const navigate = useNavigate();
  const [result, setResult] = useState(() => createResultMock(scenario));
  const [breakdown, setBreakdown] = useState(scenario === 'breakdown' || scenario === 'zeroVotes');
  const [sheetOpen, setSheetOpen] = useState(scenario === 'order');
  const [notice, setNotice] = useState('');
  const pending = scenario === 'pending' || (result.unresolvedTie && role === 'participant');
  const noResult = scenario === 'noResult' || scenario === 'revoteUsed';
  const normal = !pending && !noResult && !result.unresolvedTie;
  return (
    <div className="page vote-result">
      <Header title="최종 결과" showBackButton onBack={() => navigate(-1)} />
      <main className="vote-result__content">
        {pending ? (
          <ResultPending />
        ) : noResult ? (
          <RevoteNotice
            used={result.revotesUsed}
            onRevote={() => setResult((previous) => incrementMockRevote(previous))}
          />
        ) : result.unresolvedTie ? (
          <TieBreakModal
            category="카페"
            candidates={tieCandidates}
            onSelect={(id) => {
              if (role !== 'host') return;
              setResult((previous) => selectTiePlace(previous, 'cafe', id, tieCandidates, role));
              setNotice('선택한 후보를 현재 화면에 반영했어요. 서버에는 저장되지 않았어요.');
            }}
          />
        ) : (
          <>
            <div className="vote-result__intro">
              <h2>모두가 함께 갈 수 있는 곳으로 정했어요</h2>
              <p>{meetingSummary}</p>
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
            setResult((previous) => saveVisitOrder(previous, order, role));
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
