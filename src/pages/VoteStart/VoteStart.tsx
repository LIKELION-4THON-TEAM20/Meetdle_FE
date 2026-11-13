import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import lockIcon from '../../assets/screen11/lock.svg';
import { formatDeadline, HOUR } from '../PlaceRegistrationSetup/deadlineUtils';
import { createCandidateMock, summarizeCandidates, type CandidateCategory } from './mockData';
import { isValidVoteDeadline } from './voteUtils';
import VoteDeadlineModal from './components/VoteDeadlineModal';
import {
  EmptyCandidates,
  ExcludedCategories,
  MissingRequiredModal,
} from './components/CandidateNotices';
import './VoteStart.scss';

function VoteStartScreen({ scenario }: { scenario: string | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [initial] = useState(() => {
    const now = Date.now();
    return {
      now,
      meeting: now + 12 * HOUR,
      categories:
        (location.state?.categories as CandidateCategory[] | undefined) ??
        createCandidateMock('vote', scenario),
    };
  });
  const [now, setNow] = useState(initial.now);
  const [deadline, setDeadline] = useState(
    () =>
      Math.ceil((initial.now + (scenario === 'invalidDeadline' ? HOUR / 6 : 2 * HOUR)) / 60000) *
      60000,
  );
  const [modal, setModal] = useState<'deadline' | 'missing' | 'notice' | null>(null);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = globalThis.setInterval(refresh, 1000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, []);
  const summary = summarizeCandidates(initial.categories);
  const valid = isValidVoteDeadline(new Date(deadline), new Date(now), new Date(initial.meeting));
  return (
    <div className="page vote-start">
      <Header title="투표 시작" showBackButton onBack={() => navigate(-1)} />
      <main className="vote-start__content">
        <section className="vote-start__hero">
          <span className="vote-start__emoji" aria-hidden="true">
            🗳️
          </span>
          <h2>장소 후보가 모두 모였어요.</h2>
          <p>이제 투표로 함께 갈 곳을 정해요.</p>
        </section>
        {summary.total === 0 ? (
          <EmptyCandidates />
        ) : (
          <>
            <dl className="vote-start__categories">
              {summary.rows.map((row) => (
                <div key={row.id}>
                  <dt>{row.name}</dt>
                  <dd>{row.count}곳</dd>
                </div>
              ))}
            </dl>
            <dl className="vote-start__summary">
              <div>
                <dt>모인 후보</dt>
                <dd>{summary.total}곳</dd>
              </div>
              <div>
                <dt>등록 완료 인원</dt>
                <dd>3 / 4명</dd>
              </div>
            </dl>
            <ExcludedCategories categories={summary.excluded} />
          </>
        )}
        <section className="vote-start__deadline" aria-labelledby="deadline-label">
          <h3 id="deadline-label">투표 마감</h3>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`투표 마감 시간 설정: ${formatDeadline(deadline, now)}`}
            onClick={() => {
              setNow(Date.now());
              setModal('deadline');
            }}
          >
            {formatDeadline(deadline, now)}
          </button>
          <p>
            * 최소 30분 동안 진행돼요.
            <br />* 약속 시작 3시간 전에는 투표가 끝나야 해요.
          </p>
          {!valid && (
            <p role="status">
              투표 시간은 최소 30분 이상이어야 하고, 약속 시작 3시간 전까지는 종료돼야 해요.
            </p>
          )}
        </section>
        <p className="vote-start__privacy">
          <img src={lockIcon} width="16" height="16" alt="" />
          후보 장소 이름은 투표 화면에서 처음 공개돼요.
        </p>
      </main>
      <footer className="vote-start__footer">
        <Button
          disabled={summary.total === 0 || !valid}
          onClick={() => {
            const current = Date.now();
            setNow(current);
            if (
              !isValidVoteDeadline(new Date(deadline), new Date(current), new Date(initial.meeting))
            )
              return;
            setModal(summary.missingRequired.length ? 'missing' : 'notice');
          }}
        >
          투표 시작하기
        </Button>
      </footer>
      {modal === 'deadline' && (
        <VoteDeadlineModal
          deadline={deadline}
          now={now}
          meeting={initial.meeting}
          onClose={() => setModal(null)}
          onConfirm={(value) => {
            setDeadline(value);
            setModal(null);
          }}
        />
      )}
      <MissingRequiredModal
        categories={summary.missingRequired}
        open={modal === 'missing'}
        onClose={() => setModal(null)}
      />
      <Modal
        open={modal === 'notice'}
        onClose={() => setModal(null)}
        className="screen11-modal"
        aria-labelledby="vote-mock-title"
      >
        <h2 id="vote-mock-title">투표 시작 연동 준비 중이에요</h2>
        <p>현재는 목 데이터 화면이에요. 실제 등록 마감이나 투표 시작은 수행되지 않았어요.</p>
        <Button onClick={() => setModal(null)}>확인</Button>
      </Modal>
    </div>
  );
}

export default function VoteStart() {
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  return <VoteStartScreen key={scenario ?? 'default'} scenario={scenario} />;
}
