import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import PlaceVoteCard from './components/PlaceVoteCard';
import { createVoteMock, FIXED_VOTE_NOW } from './mockData';
import { formatVoteRemaining, getVoteProgress, updateVote } from './voteUtils';
import './PlaceVote.scss';

function PlaceVoteScreen({
  scenario,
  fixedClock,
}: {
  scenario: string | null;
  fixedClock: boolean;
}) {
  const navigate = useNavigate();
  const [initial] = useState(() => {
    const now = fixedClock ? FIXED_VOTE_NOW : Date.now();
    return { ...createVoteMock(now, scenario), now };
  });
  const [now, setNow] = useState(initial.now);
  const [vote, setVote] = useState(initial.state);
  const [showStatusNotice, setShowStatusNotice] = useState(false);
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
  const progress = getVoteProgress(initial.categories, vote.responses);
  const expired = now >= initial.deadline;
  const locked = vote.submitted || expired;
  const pageRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const footer = footerRef.current;
    if (!page || !footer || vote.submitted) return;

    const reserveFooterSpace = () => {
      page.style.setProperty(
        '--place-vote-footer-height',
        `${footer.getBoundingClientRect().height}px`,
      );
    };
    reserveFooterSpace();
    const observer = new ResizeObserver(reserveFooterSpace);
    observer.observe(footer);
    return () => {
      observer.disconnect();
      page.style.removeProperty('--place-vote-footer-height');
    };
  }, [vote.submitted]);

  return (
    <div
      ref={pageRef}
      className={`page place-vote${vote.submitted ? '' : ' place-vote--with-fixed-cta'}`}
    >
      <Header title={initial.roomName} showBackButton onBack={() => navigate(-1)} />
      <main className="place-vote__content">
        <section className="place-vote__intro" aria-labelledby="place-vote-title">
          <div className="place-vote__title-row">
            <h2 id="place-vote-title">장소 투표</h2>
            <span className="place-vote__timer" role="timer">
              {expired ? '투표 마감' : `마감까지 ${formatVoteRemaining(initial.deadline, now)}`}
            </span>
          </div>
          <div
            className="place-vote__progress"
            role="progressbar"
            aria-label="장소 선택 완료율"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.percent)}
            aria-valuetext={`${progress.total}곳 중 ${progress.completed}곳 선택 완료`}
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="place-vote__count" aria-live="polite">
            {progress.completed} / {progress.total}곳 선택 완료 ·{' '}
            {vote.submitted ? '제출 완료' : '제출 전'}
          </p>
          <p className="place-vote__description">
            각 후보마다 하나씩 골라주세요. 내 선택은 나만 볼 수 있어요.
          </p>
          {vote.submitted && (
            <div className="place-vote__submitted" role="status">
              <h3>투표 제출 완료</h3>
              <p>제출한 투표는 수정할 수 없어요.</p>
              <p>현재 화면에서만 반영된 목 상태이며, 서버에 저장되지 않았어요.</p>
            </div>
          )}
        </section>
        {initial.categories
          .filter((category) => category.places.length > 0)
          .map((category) => (
            <section
              className="place-vote__category"
              key={category.id}
              aria-labelledby={`category-${category.id}`}
            >
              <h3 id={`category-${category.id}`}>
                {category.name}
                <span>{category.places.length}곳</span>
              </h3>
              {category.places.map((place) => (
                <PlaceVoteCard
                  key={place.id}
                  place={place}
                  category={category.name}
                  automatic={category.places.length === 1}
                  choice={vote.responses[place.id]}
                  locked={locked}
                  onChoose={(choice) => {
                    const time = fixedClock ? initial.now : Date.now();
                    setNow(time);
                    setVote((previous) =>
                      updateVote(
                        previous,
                        { type: 'choose', placeId: place.id, choice, now: time },
                        initial.categories,
                        initial.deadline,
                      ),
                    );
                  }}
                />
              ))}
            </section>
          ))}
      </main>
      <footer ref={footerRef} className="place-vote__footer">
        {vote.submitted ? (
          <>
            <p>제출한 투표는 수정할 수 없어요.</p>
            <a
              className="place-vote__status-link"
              href="#vote-status"
              onClick={(event) => {
                event.preventDefault();
                setShowStatusNotice(true);
              }}
            >
              투표 현황 보기
            </a>
            {showStatusNotice && (
              <p id="vote-status" role="status">
                투표 현황 화면은 준비 중이에요. 현재 선택은 서버에 저장되지 않았어요.
              </p>
            )}
          </>
        ) : (
          <>
            {!progress.complete && (
              <p className="place-vote__incomplete">
                아직 선택하지 않은 장소가 있어요. 모두 선택해야 제출할 수 있어요.
              </p>
            )}
            {expired && <p role="status">투표가 마감되어 더 이상 선택하거나 제출할 수 없어요.</p>}
            <Button
              disabled={!progress.complete || expired}
              onClick={() => {
                const time = fixedClock ? initial.now : Date.now();
                setNow(time);
                setVote((previous) =>
                  updateVote(
                    previous,
                    { type: 'submit', now: time },
                    initial.categories,
                    initial.deadline,
                  ),
                );
              }}
            >
              투표 제출
            </Button>
            <p>제출 전에는 수정할 수 있고, 제출 후에는 수정할 수 없어요.</p>
          </>
        )}
      </footer>
    </div>
  );
}

export default function PlaceVote() {
  const [params] = useSearchParams();
  const requested = import.meta.env.DEV ? params.get('scenario') : null;
  const scenario = ['partial', 'complete', 'submitted'].includes(requested ?? '')
    ? requested
    : null;
  const fixedClock = import.meta.env.DEV && (scenario !== null || params.get('clock') === 'fixed');
  return (
    <PlaceVoteScreen
      key={`${scenario ?? 'default'}-${fixedClock}`}
      scenario={scenario}
      fixedClock={fixedClock}
    />
  );
}
