import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import { formatVoteRemaining } from '../PlaceVote/voteUtils';
import VoteParticipantList from './components/VoteParticipantList';
import VoteCloseModal from './components/VoteCloseModal';
import VoteResultPending from './components/VoteResultPending';
import { createVoteStatusMock, FIXED_STATUS_NOW } from './mockData';
import { getVoteStatusSummary } from './statusUtils';
import './VoteStatus.scss';
import { useMockRoom } from '../../features/mockRoom/context';
import { canCount, completedVoters } from '../../features/mockRoom/model';

function VoteStatusScreen({
  scenario,
  fixedClock,
}: {
  scenario: string | null;
  fixedClock: boolean;
}) {
  const navigate = useNavigate();
  const { room, send, isolated } = useMockRoom();
  const [fixture] = useState(() => {
    const now = fixedClock ? FIXED_STATUS_NOW : Date.now();
    return { ...createVoteStatusMock(now, scenario), now };
  });
  const submitted = new Set(completedVoters(room).map(({ id }) => id));
  const initial = isolated
    ? fixture
    : {
        now: fixture.now,
        deadline: room.voteDeadline,
        participants: room.participants.map(({ id, name }) => ({
          id,
          name,
          completed: submitted.has(id),
        })),
      };
  const [now, setNow] = useState(initial.now);
  const [localClosedEarly, setClosedEarly] = useState(false);
  const closedEarly = isolated ? localClosedEarly : room.closedEarly;
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
  const ready =
    !isolated && (room.phase === 'voting' || room.phase === 'counting' || room.phase === 'result');
  return (
    <div className="page vote-status">
      <Header title="투표 현황" showBackButton onBack={() => navigate(-1)} />
      <main className="vote-status__content">
        <p>개발용 목 투표 현황이에요. 서버 상태가 아니에요.</p>
        {!isolated && room.phase === 'registration' && (
          <p>
            아직 투표를 시작하지 않았어요.{' '}
            <Link to="/rooms/registration/status">등록 현황으로 이동</Link>
          </p>
        )}
        {!isolated && room.phase === 'registration' ? null : summary.phase === 'ongoing' ? (
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
        {!isolated && ready && !ongoing && summary.phase !== 'insufficient' && (
          <section aria-label="개발용 목 집계">
            <p>
              목 응답을 집계하는 단계예요. 아래 동작으로만 예시 결과를 계산해요. 실제 서버 집계가
              아니에요.
            </p>
            <p>
              개발용 규칙: 좋아요 − 싫어요 점수, 과반 싫어요 후보 제외, 동점은 방장 선택. 실제 선정
              정책은 API 연동 시 교체해요.
            </p>
            <Button
              onClick={() => {
                if (
                  room.result ||
                  (canCount(room, Date.now()) && send({ type: 'count', now: Date.now() }))
                )
                  navigate('/rooms/vote/result');
              }}
            >
              개발용 목 결과 확인
            </Button>
          </section>
        )}
      </main>
      {ongoing && room.role === 'host' && (isolated || ready) && (
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
          if (room.role !== 'host') return;
          const current = fixedClock ? initial.now : Date.now();
          setNow(current);
          if (
            getVoteStatusSummary(initial.participants, initial.deadline, current, closedEarly)
              .phase === 'ongoing'
          ) {
            if (isolated) setClosedEarly(true);
            else send({ type: 'closeVote', now: current });
          }
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
