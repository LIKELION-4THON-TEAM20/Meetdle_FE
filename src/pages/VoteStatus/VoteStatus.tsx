import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import { formatVoteRemaining } from '../PlaceVote/voteUtils';
import VoteParticipantList from './components/VoteParticipantList';
import VoteCloseModal from './components/VoteCloseModal';
import VoteResultPending from './components/VoteResultPending';
import { createVoteStatusMock, FIXED_STATUS_NOW } from './mockData';
import { getVoteStatusSummary } from './statusUtils';
import './VoteStatus.scss';

function VoteStatusScreen({
  scenario,
  fixedClock,
}: {
  scenario: string | null;
  fixedClock: boolean;
}) {
  const navigate = useNavigate();
  const [initial] = useState(() => {
    const now = fixedClock ? FIXED_STATUS_NOW : Date.now();
    return { ...createVoteStatusMock(now, scenario), now };
  });
  const [now, setNow] = useState(initial.now);
  const [closedEarly, setClosedEarly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    if (fixedClock) return;
    const refresh = () => setNow(Date.now());
    const timer = globalThis.setInterval(refresh, 1000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, [fixedClock]);
  const summary = getVoteStatusSummary(initial.participants, initial.deadline, now, closedEarly);
  const ongoing = summary.phase === 'ongoing';
  return (
    <div className="page vote-status">
      <Header title="투표 현황" showBackButton onBack={() => navigate(-1)} />
      <main className="vote-status__content">
        {summary.phase === 'ongoing' ? (
          <>
            <section className="vote-status__summary" aria-labelledby="vote-status-title">
              <h2 id="vote-status-title">
                {summary.completed} / {summary.total}명
              </h2>
              <p>
                투표가 진행 중이에요. 마감까지{' '}
                <span role="timer">{formatVoteRemaining(initial.deadline, now)}</span> 남았어요.
              </p>
              <div
                className="vote-status__progress"
                role="progressbar"
                aria-label="투표 완료율"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.progress}
                aria-valuetext={`${summary.total}명 중 ${summary.completed}명 투표 완료`}
              >
                <span style={{ width: `${summary.progress}%` }} />
              </div>
            </section>
            <VoteParticipantList participants={initial.participants} />
          </>
        ) : (
          <VoteResultPending
            phase={summary.phase}
            completed={summary.completed}
            total={summary.total}
            closedEarly={closedEarly}
          />
        )}
      </main>
      {ongoing && (
        <footer className="vote-status__footer">
          <Button
            onClick={() => {
              const current = fixedClock ? initial.now : Date.now();
              setNow(current);
              if (
                getVoteStatusSummary(initial.participants, initial.deadline, current, closedEarly)
                  .phase === 'ongoing'
              )
                setModalOpen(true);
            }}
          >
            투표 마감하기
          </Button>
        </footer>
      )}
      <VoteCloseModal
        open={modalOpen && ongoing}
        onClose={() => setModalOpen(false)}
        onConfirm={() => {
          const current = fixedClock ? initial.now : Date.now();
          setNow(current);
          if (
            getVoteStatusSummary(initial.participants, initial.deadline, current, closedEarly)
              .phase === 'ongoing'
          )
            setClosedEarly(true);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

export default function VoteStatus() {
  const [params] = useSearchParams();
  const requested = import.meta.env.DEV ? params.get('scenario') : null;
  const scenario = ['ongoing', 'allCompleted', 'expired', 'insufficient'].includes(requested ?? '')
    ? requested
    : null;
  const fixedClock = import.meta.env.DEV && (scenario !== null || params.get('clock') === 'fixed');
  return (
    <VoteStatusScreen
      key={`${scenario ?? 'default'}-${fixedClock}`}
      scenario={scenario}
      fixedClock={fixedClock}
    />
  );
}
