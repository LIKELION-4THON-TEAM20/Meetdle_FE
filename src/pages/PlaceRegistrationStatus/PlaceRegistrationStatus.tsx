import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useRoomNavigation, useRoomLink, useRoomBack } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import RegistrationParticipantList from './components/RegistrationParticipantList';
import RegistrationStatusModal from './components/RegistrationStatusModal';
import ParticipationShareModal from '../ParticipationStatus/components/ParticipationShareModal';
import VoteDeadlineModal from '../VoteStart/components/VoteDeadlineModal';
import { createRegistrationStatusMock } from './mockData';
import { getRegistrationSummary } from './statusUtils';
import { useMockRoom } from '../../features/mockRoom/context';
import {
  canOpenBallot,
  candidateCategories,
  registrationParticipants,
} from '../../features/mockRoom/model';
import { isExplorationStatusPreview } from '../PlaceExploration/placeUtils';
import type { ExplorationStatusPreview } from '../PlaceExploration/types';
import { createCandidateMock, summarizeCandidates } from '../VoteStart/mockData';
import './PlaceRegistrationStatus.scss';

const MESSAGE = '얼른 입력 안하면 우리끼리 정하다~';
const HOST_MESSAGE = '우리 이제 다음 단계로 넘어갈 수 있대!';

function shareRegistrationMessage(message: string) {
  if (message) window.alert('카카오톡 공유 SDK는 아직 연동되지 않았어요.');
}

function RegistrationStatusScreen({
  scenario,
  preview,
}: {
  scenario: string | null;
  preview?: ExplorationStatusPreview;
}) {
  const navigate = useRoomNavigation();
  const goBack = useRoomBack(PATHS.info);
  const roomLink = useRoomLink();
  const { room, send, isolated } = useMockRoom();
  const { state } = useLocation();
  const host = !preview && room.role === 'host';
  const [fixture] = useState(() => createRegistrationStatusMock(Date.now(), scenario));
  const [localDeadline, setDeadline] = useState(
    isolated && Number.isFinite(state?.registrationDeadline)
      ? state.registrationDeadline
      : fixture.deadline,
  );
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState('');
  const [extend, setExtend] = useState(scenario === 'extend' && host);
  const [share, setShare] = useState<'reminder' | 'notifyHost' | null>(
    scenario === 'notifyHost' && !host
      ? 'notifyHost'
      : scenario === 'reminder' || scenario === 'reminderSelected'
        ? 'reminder'
        : null,
  );
  const [message, setMessage] = useState(scenario === 'reminderSelected' ? MESSAGE : '');
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = globalThis.setInterval(refresh, 1000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, []);

  const participants =
    preview?.participants ?? (isolated ? fixture.participants : registrationParticipants(room));
  const deadline = preview?.deadline ?? (isolated ? localDeadline : room.registrationDeadline);
  const summary = getRegistrationSummary(participants, deadline, now);
  const canManage =
    host &&
    !room.registrationClosed &&
    room.registrationStarted !== false &&
    room.phase === 'registration';
  const categories = candidateCategories(room);
  const nextPath =
    room.phase === 'registration'
      ? PATHS.startVote
      : !host && canOpenBallot(room, now)
        ? PATHS.vote
        : PATHS.voteStatus;
  const required = categories
    .filter(({ required }) => required)
    .map(({ name }) => name)
    .join('·');
  const optional = categories
    .filter(({ required }) => !required)
    .map(({ name }) => name)
    .join('·');
  const guidance = [
    required && `필수 카테고리 ${required}`,
    optional && `선택 카테고리 ${optional}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const phaseKey = `${summary.phase}:${deadline}`;
  const showStatus =
    canManage && !extend && !share && summary.phase !== 'ongoing' && dismissed !== phaseKey;
  const candidateScenario =
    scenario === 'insufficient' ? 'missingRequired' : (scenario ?? 'default');
  const query = isolated ? `?scenario=${encodeURIComponent(candidateScenario)}` : '';
  const navigationState = {
    completed: summary.completed,
    total: summary.total,
    registrationDeadline: deadline,
  };
  const goToClose = () => {
    if (!canManage) return;
    navigate(`${PATHS.closeRegistration}${query}`, {
      state: navigationState,
    });
  };
  const proceedFromModal = () => {
    if (!canManage) return;
    if (summary.phase === 'partial') {
      goToClose();
      return;
    }
    const candidates = isolated ? createCandidateMock('close', candidateScenario) : categories;
    const { total, missingRequired } = summarizeCandidates(candidates);
    if (!total || missingRequired.length) {
      goToClose();
      return;
    }
    if (!isolated && !send({ type: 'closeRegistration' })) return;
    navigate(`${PATHS.startVote}${query}`, {
      state: { ...navigationState, categories: candidates, fromRegistrationStatus: true },
    });
  };

  return (
    <div className="page place-registration-status">
      <Header title="등록 현황" showBackButton onBack={goBack} />
      <main className="place-registration-status__content">
        <section className="place-registration-status__summary" aria-label="장소 등록 완료 현황">
          <h2>
            {summary.completed} / {summary.total}명
          </h2>
          <p>{guidance}</p>
          {preview && <p>SCREEN 09 목 현황 · 등록 장소 {preview.registeredPlaceCount}곳</p>}
          {!host && summary.phase === 'allCompleted' && (
            <p role="status">모두 장소 등록을 마쳤어요.</p>
          )}
          {!host && summary.expired && <p role="status">장소 등록 시간이 끝났어요.</p>}
          {room.registrationClosed && (
            <p>
              장소 등록이 마감됐어요.{' '}
              {room.phase !== 'registration' || host ? (
                <Link to={roomLink(nextPath)}>다음 단계 확인</Link>
              ) : null}
            </p>
          )}
          <div
            className="place-registration-status__progress"
            role="progressbar"
            aria-label="등록 완료율"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.progress}
            aria-valuetext={`${summary.total}명 중 ${summary.completed}명 등록 완료`}
          >
            <span style={{ width: `${summary.progress}%` }} />
          </div>
        </section>
        <RegistrationParticipantList participants={participants} />
      </main>
      <footer className="place-registration-status__footer">
        {summary.hasIncomplete && !summary.expired && !room.registrationClosed && (
          <Button
            onClick={() => {
              setMessage('');
              setShare('reminder');
            }}
          >
            등록 재촉하기
          </Button>
        )}
        {host && (
          <Button
            className="registration-secondary"
            disabled={!canManage}
            onClick={summary.phase === 'ongoing' ? goToClose : () => setDismissed('')}
          >
            등록 마감하고 투표 시작하기
          </Button>
        )}
        {!host && scenario === 'notifyHost' && (
          <Button onClick={() => setShare('notifyHost')}>방장에게 알리기</Button>
        )}
      </footer>
      {showStatus && (
        <RegistrationStatusModal
          phase={summary.phase}
          completed={summary.completed}
          participants={participants}
          onClose={() => setDismissed(phaseKey)}
          onProceed={proceedFromModal}
          onExtend={() => setExtend(true)}
        />
      )}
      {extend && canManage && (
        <VoteDeadlineModal
          registrationExtension
          deadline={deadline}
          now={now}
          meeting={room.meetingAt}
          onClose={() => setExtend(false)}
          onConfirm={(value) => {
            if (isolated) setDeadline(value);
            else if (!send({ type: 'extendRegistration', deadline: value, now: Date.now() }))
              return;
            setExtend(false);
          }}
        />
      )}
      <ParticipationShareModal
        kind={share}
        className={
          share === 'reminder' && !message
            ? 'registration-share--select'
            : 'registration-share--compact'
        }
        onClose={() => setShare(null)}
        copy={
          share === 'notifyHost'
            ? { title: '방장에게 알리기', description: HOST_MESSAGE }
            : {
                title: '입력 안 한 친구 재촉하기',
                description: message || '친구에게 보낼 메시지를 선택해보세요',
              }
        }
        disabled={share === 'reminder' && !message}
        onSend={() => shareRegistrationMessage(share === 'notifyHost' ? HOST_MESSAGE : message)}
      >
        {share === 'reminder' && !message && (
          <select
            className="registration-share-message"
            aria-label="메시지 선택하기"
            value={message}
            onChange={(event) => {
              const dialog = event.currentTarget.closest('dialog');
              setMessage(event.target.value);
              window.requestAnimationFrame(() => dialog?.querySelector('button')?.focus());
            }}
          >
            <option value="">메시지 선택하기</option>
            <option value={MESSAGE}>{MESSAGE}</option>
          </select>
        )}
      </ParticipationShareModal>
    </div>
  );
}

export default function PlaceRegistrationStatus() {
  const [params] = useSearchParams();
  const { state } = useLocation();
  const preview = isExplorationStatusPreview(state) ? state : undefined;
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  return (
    <RegistrationStatusScreen
      key={preview ? `exploration-${preview.registeredPlaceCount}` : (scenario ?? 'default')}
      scenario={scenario}
      preview={preview}
    />
  );
}
