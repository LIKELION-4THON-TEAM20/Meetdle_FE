import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import CategorySelector from './components/CategorySelector';
import RegistrationRulesCard from './components/RegistrationRulesCard';
import DeadlineSelector from './components/DeadlineSelector';
import { CATEGORIES, createSetupMock, REGISTRATION_RULES } from './mockData';
import { getDeadlineWindow, HOUR, isValidDeadline } from './deadlineUtils';
import type { DeadlineMode } from './types';
import './PlaceRegistrationSetup.scss';

function SetupForm({ scenario }: { scenario: string | null }) {
  const navigate = useNavigate();
  const [initial] = useState(() => createSetupMock(Date.now(), scenario));
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState(initial.selectedCategories);
  const [mode, setMode] = useState<DeadlineMode>(initial.initialMode);
  const [customDeadline, setCustomDeadline] = useState(initial.initialDeadline);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = globalThis.setInterval(refresh, 1000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, []);
  const deadlineAt = (time: number) =>
    mode === 'oneHour' ? time + HOUR : mode === 'threeHours' ? time + 3 * HOUR : customDeadline;
  const deadline = deadlineAt(now);
  const window = getDeadlineWindow(now, initial.meetingStartsAt);
  const validCategories =
    CATEGORIES.filter((category) => category.required).every((category) =>
      selected.includes(category.id),
    ) && selected.length >= REGISTRATION_RULES.minimumPlacesPerPerson;
  const canStart = validCategories && isValidDeadline(deadline, now, initial.meetingStartsAt);

  return (
    <div className="page registration-setup">
      <Header title="등록 설정" showBackButton onBack={() => navigate(-1)} />
      <main className="registration-setup__content">
        <div className="registration-setup__intro">
          <h2>어떤 장소를 함께 모아볼까요?</h2>
          <p>한 사람당 최소 1곳을 등록해요. 카테고리마다 최대 1곳씩 등록할 수 있어요.</p>
        </div>
        <div className="registration-setup__categories">
          <CategorySelector
            selected={selected}
            onToggle={(id) =>
              setSelected((current) =>
                current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
              )
            }
          />
          <RegistrationRulesCard selected={selected} />
        </div>
        {window.canOpen ? (
          <DeadlineSelector
            now={now}
            meetingStartsAt={initial.meetingStartsAt}
            deadline={deadline}
            mode={mode}
            onChange={(nextMode, timestamp) => {
              setMode(nextMode);
              setCustomDeadline(timestamp);
            }}
          />
        ) : (
          <p className="registration-setup__banner registration-setup__banner--blocked">
            약속까지 남은 시간이 짧아 장소 등록을 진행하기 어려워요.
          </p>
        )}
      </main>
      <footer className="registration-setup__footer">
        <Button
          className="registration-setup__start"
          disabled={!canStart}
          onClick={() => {
            const submittedAt = Date.now();
            if (
              !validCategories ||
              !isValidDeadline(deadlineAt(submittedAt), submittedAt, initial.meetingStartsAt)
            ) {
              setNow(submittedAt);
              return;
            }
            windowAlert();
          }}
        >
          장소 등록 시작하기
        </Button>
      </footer>
    </div>
  );
}

function windowAlert() {
  globalThis.alert('장소 등록 시작 API는 아직 연동되지 않았어요. 실제 등록은 시작되지 않습니다.');
}

function PlaceRegistrationSetup() {
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  return <SetupForm key={scenario ?? 'default'} scenario={scenario} />;
}

export default PlaceRegistrationSetup;
