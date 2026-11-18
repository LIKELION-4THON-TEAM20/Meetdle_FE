import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useRoomNavigation, useRoomLink, useRoomBack } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import ParticipationShareModal from '../ParticipationStatus/components/ParticipationShareModal';
import VoteDeadlineModal from '../VoteStart/components/VoteDeadlineModal';
import { HOUR } from '../PlaceRegistrationSetup/deadlineUtils';
import { formatVoteRemaining } from '../PlaceVote/voteUtils';
import VoteParticipantList from './components/VoteParticipantList';
import VoteCloseModal from './components/VoteCloseModal';
import { createVoteStatusMock, FIXED_STATUS_NOW } from './mockData';
import { getVoteStatusSummary } from './statusUtils';
import './VoteStatus.scss';
import { useMockRoom } from '../../features/mockRoom/context';
import { completedVoters } from '../../features/mockRoom/model';

const REMINDER = '아직 투표하지 않았다면 장소 후보를 골라주세요!';

function VoteStatusScreen({
  scenario,
  fixedClock,
}: {
  scenario: string | null;
  fixedClock: boolean;
}) {
  const navigate = useRoomNavigation();
  const goBack = useRoomBack(PATHS.info);
  const roomLink = useRoomLink();
  const { room, send, isolated } = useMockRoom();
  const host = room.role === 'host';
  const [fixture] = useState(() => {
    const now = fixedClock && !scenario ? FIXED_STATUS_NOW : Date.now();
    return { ...createVoteStatusMock(now, scenario), now };
  });
  const [now, setNow] = useState(fixture.now);
  const [localDeadline, setDeadline] = useState(fixture.deadline);
  const [modal, setModal] = useState<'majority' | 'final' | 'extend' | 'remind' | null>(
    host && scenario === 'extend' ? 'extend' : null,
  );
  const [message, setMessage] = useState('');
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

  const submitted = new Set(completedVoters(room).map(({ id }) => id));
  const participants = isolated
    ? fixture.participants
    : room.participants.map(({ id, name, profileImageUrl }) => ({
        id,
        name,
        profileImageUrl,
        completed: submitted.has(id),
      }));
  const deadline = isolated ? localDeadline : room.voteDeadline;
  const summary = getVoteStatusSummary(participants, deadline, now);
  const hasStarted = isolated || room.phase !== 'registration';
  const active = isolated || room.phase === 'voting';
  const ongoing = active && !summary.expired && !summary.allCompleted;

  const closeAndCount = () => {
    if (!host || !summary.hasMajority) return;
    if (isolated) {
      navigate(`${PATHS.result}?scenario=default`);
      return;
    }
    const current = Date.now();
    if (room.phase === 'voting' && !send({ type: 'closeVote', now: current })) return;
    if (room.phase === 'result' || send({ type: 'count', now: current })) navigate(PATHS.result);
  };

  return (
    <div className="page vote-status">
      <Header title="투표 현황" showBackButton onBack={goBack} />
      <main className="vote-status__content">
        {!hasStarted ? (
          <p>
            아직 투표를 시작하지 않았어요.{' '}
            <Link to={roomLink(PATHS.registration)}>등록 현황으로 이동</Link>
          </p>
        ) : (
          <>
            {ongoing ? (
              <section className="vote-status__summary" aria-labelledby="vote-status-title">
                <h2 id="vote-status-title">
                  {summary.completed} / {summary.total}명
                </h2>
                <p>
                  투표가 진행 중이에요. 마감까지{' '}
                  <span role="timer">{formatVoteRemaining(deadline, now)}</span> 남았어요.
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
            ) : (
              <h2 className="vote-status__ended">
                {summary.allCompleted ? '모두 투표를 마쳤어요.' : '투표 시간이 끝났어요'}
              </h2>
            )}
            <VoteParticipantList participants={participants} />
          </>
        )}
      </main>
      {hasStarted && (active || room.phase === 'counting' || room.phase === 'result') && (
        <footer className="vote-status__footer">
          {ongoing && (
            <Button
              onClick={() => {
                setMessage('');
                setModal('remind');
              }}
            >
              투표 재촉하기
            </Button>
          )}
          {host && ongoing && !summary.hasMajority && (
            <p>*과반수가 참여하지 않아 투표를 미리 마감할 수 없어요.</p>
          )}
          {host && active && summary.expired && !summary.allCompleted && (
            <Button onClick={() => setModal('extend')}>조금 더 기다리기</Button>
          )}
          {host && active && summary.hasMajority && (
            <Button
              className={summary.allCompleted ? undefined : 'vote-status__outline'}
              onClick={ongoing ? () => setModal('majority') : closeAndCount}
            >
              투표 마감하기
            </Button>
          )}
          {host && active && summary.expired && !summary.hasMajority && (
            <p>과반수가 참여하지 않아 현재 투표를 집계할 수 없어요.</p>
          )}
          {host && room.phase === 'counting' && !isolated && (
            <Button onClick={closeAndCount}>개발용 목 결과 확인</Button>
          )}
          {room.phase === 'result' && !isolated && (
            <Link to={roomLink(PATHS.result)}>투표 결과 보기</Link>
          )}
        </footer>
      )}
      {host && ongoing && summary.hasMajority && (modal === 'majority' || modal === 'final') && (
        <VoteCloseModal
          final={modal === 'final'}
          completed={summary.completed}
          participants={participants}
          onClose={() => setModal(null)}
          onConfirm={modal === 'majority' ? () => setModal('final') : closeAndCount}
        />
      )}
      {host && active && summary.expired && modal === 'extend' && (
        <VoteDeadlineModal
          voteExtension
          deadline={deadline}
          now={now}
          meeting={isolated ? fixture.now + 12 * HOUR : room.meetingAt}
          onClose={() => setModal(null)}
          onConfirm={(value) => {
            if (isolated) setDeadline(value);
            else if (!send({ type: 'extendVote', deadline: value, now: Date.now() })) return;
            setNow(Date.now());
            setModal(null);
          }}
        />
      )}
      <ParticipationShareModal
        kind={ongoing && modal === 'remind' ? 'reminder' : null}
        onClose={() => setModal(null)}
        copy={{
          title: '투표 안 한 친구 재촉하기',
          description: message || '친구에게 보낼 메시지를 선택해보세요',
        }}
        disabled={!message}
      >
        {!message && (
          <select
            className="vote-status__message"
            aria-label="메시지 선택하기"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          >
            <option value="">메시지 선택하기</option>
            <option value={REMINDER}>{REMINDER}</option>
          </select>
        )}
      </ParticipationShareModal>
    </div>
  );
}

export default function VoteStatus() {
  const [params] = useSearchParams();
  const requested = import.meta.env.DEV ? params.get('scenario') : null;
  const scenario = [
    'ongoing',
    'oneCompleted',
    'twoCompleted',
    'allCompleted',
    'expired',
    'insufficient',
    'extend',
  ].includes(requested ?? '')
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
