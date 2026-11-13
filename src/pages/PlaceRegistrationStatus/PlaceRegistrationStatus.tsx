import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import RegistrationParticipantList from './components/RegistrationParticipantList';
import RegistrationStatusModal from './components/RegistrationStatusModal';
import { createRegistrationStatusMock } from './mockData';
import { extendRegistrationDeadline, getRegistrationSummary } from './statusUtils';
import './PlaceRegistrationStatus.scss';

function RegistrationStatusScreen({ scenario }: { scenario: string | null }) {
  const navigate = useNavigate();
  const [initial] = useState(() => createRegistrationStatusMock(Date.now(), scenario));
  const [deadline, setDeadline] = useState(initial.deadline);
  const [now, setNow] = useState(() => Date.now());
  const [modal, setModal] = useState<'summary' | 'waiting' | null>(() =>
    ['partial', 'allCompleted', 'expired', 'waiting', 'insufficient'].includes(scenario ?? '')
      ? 'summary'
      : null,
  );
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = globalThis.setInterval(refresh, 1000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, []);
  const summary = getRegistrationSummary(initial.participants, deadline, now);

  const showVoteNotice = () => {
    if (initial.votingEligibility === 'insufficient') {
      window.alert(
        '목 데이터상 유효한 등록 후보가 부족해 투표를 진행할 수 없어요. 구체적인 후보 판정 기준은 기획 확인이 필요합니다.',
      );
      return;
    }
    setModal(null);
    window.alert(
      '후보 검증·투표 시작 API와 SCREEN 11은 아직 연동되지 않았어요. 실제 등록 마감이나 투표 시작은 수행되지 않습니다.',
    );
  };

  const handleExtend = (additionalMinutes: number) => {
    const currentTime = Date.now();
    const extended = extendRegistrationDeadline(deadline, additionalMinutes, currentTime);
    setNow(currentTime);
    if (extended === null) {
      window.alert(
        '마감시간이 종료됐거나 추가 시간이 유효하지 않아 연장할 수 없어요. 종료 후 연장 정책은 기획 확인이 필요합니다.',
      );
      return;
    }
    setDeadline(extended);
    setModal(null);
    window.alert(
      `목 데이터의 마감시간만 ${additionalMinutes}분 연장했어요. 변경된 마감: ${new Date(extended).toLocaleString('ko-KR')}. 서버에는 반영되지 않습니다.`,
    );
  };

  return (
    <div className="page place-registration-status">
      <Header title="등록 현황" showBackButton onBack={() => navigate(-1)} />
      <main className="place-registration-status__content">
        <section className="place-registration-status__summary" aria-label="장소 등록 완료 현황">
          <h2>
            {summary.completed} / {summary.total}명
          </h2>
          <p>식당·카페 등록을 완료했어요. 주점·문화시설은 선택이에요.</p>
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
        <RegistrationParticipantList participants={initial.participants} />
      </main>
      <footer className="place-registration-status__footer">
        <Button
          className="place-registration-status__start"
          onClick={() => {
            setNow(Date.now());
            setModal('summary');
          }}
        >
          등록 마감하고 투표 시작하기
        </Button>
      </footer>
      {modal !== null && (
        <RegistrationStatusModal
          open
          waiting={modal === 'waiting'}
          participants={initial.participants}
          deadline={deadline}
          now={now}
          onClose={() => setModal(null)}
          onNext={() => setModal('waiting')}
          onVote={showVoteNotice}
          onExtend={handleExtend}
        />
      )}
    </div>
  );
}

function PlaceRegistrationStatus() {
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  return <RegistrationStatusScreen key={scenario ?? 'default'} scenario={scenario} />;
}

export default PlaceRegistrationStatus;
