import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useRoomNavigation } from '../../router/useRoomNavigation';
import { PATHS } from '../../router/paths';
import { useMockRoom } from '../../features/mockRoom/context';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import CategorySelector from './components/CategorySelector';
import RegistrationRulesCard from './components/RegistrationRulesCard';
import DeadlineSelector from './components/DeadlineSelector';
import { validRegistrationCategories } from '../../features/mockRoom/model';
import { CATEGORIES, createSetupMock } from './mockData';
import { getMeetingConfirmation } from '../MeetingConfirmed/confirmationData';
import { formatDeadline, getDeadlineWindow, HOUR, isValidDeadline } from './deadlineUtils';
import type { DeadlineMode } from './types';
import './PlaceRegistrationSetup.scss';

function SetupForm({ scenario }: { scenario: string | null }) {
  const navigate = useRoomNavigation();
  const location = useLocation();
  const { room, send, isolated } = useMockRoom();
  const started = room.registrationStarted === true;
  const [initial] = useState(() => ({
    ...createSetupMock(Date.now(), scenario),
    ...(!isolated ? { meetingStartsAt: room.meetingAt } : {}),
  }));
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState(
    room.registrationCategoryIds ?? initial.selectedCategories,
  );
  const [requiredIds, setRequiredIds] = useState(
    room.requiredRegistrationCategoryIds ??
      CATEGORIES.filter(({ required }) => required).map(({ id }) => id),
  );
  const [categoryBlocked, setCategoryBlocked] = useState(false);
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
  const validCategories = validRegistrationCategories(selected, requiredIds);
  const canStart =
    room.role === 'host' &&
    room.phase === 'registration' &&
    !room.registrationClosed &&
    !started &&
    validCategories &&
    isValidDeadline(deadline, now, initial.meetingStartsAt);

  return (
    <div className="page registration-setup">
      <Header title="등록 설정" showBackButton onBack={() => navigate(PATHS.confirmed)} />
      <main className="registration-setup__content">
        <div className="registration-setup__intro">
          <h2>어떤 장소를 함께 모아볼까요?</h2>
          <p>한 사람당 최소 1곳을 등록해요. 카테고리마다 최대 1곳씩 등록할 수 있어요.</p>
          <p>확정된 약속 일시 · {getMeetingConfirmation(room).dateTime}</p>
        </div>
        <div className="registration-setup__categories">
          <CategorySelector
            selected={selected}
            requiredIds={requiredIds}
            disabled={started}
            onMove={(id, required) => {
              if (id === 'culture' && required) {
                setCategoryBlocked(true);
                return;
              }
              setRequiredIds((current) =>
                required ? [...current, id] : current.filter((value) => value !== id),
              );
              if (required)
                setSelected((current) => (current.includes(id) ? current : [...current, id]));
            }}
            onToggle={(id) =>
              setSelected((current) =>
                current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
              )
            }
          />
          <RegistrationRulesCard selected={selected} requiredIds={requiredIds} />
        </div>
        {started ? (
          <section className="setup-deadline" aria-label="저장된 장소 등록 마감">
            <h3>장소 등록 마감</h3>
            <p className="setup-deadline__field setup-deadline__field--saved">
              {formatDeadline(room.registrationDeadline, now)}
            </p>
          </section>
        ) : window.canOpen ? (
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
        {!started && !isValidDeadline(deadline, now, initial.meetingStartsAt) && (
          <Button onClick={() => navigate(PATHS.create)}>약속 다시 만들러 가기</Button>
        )}
      </main>
      <footer className="registration-setup__footer">
        <Button
          className="registration-setup__start"
          disabled={!canStart}
          onClick={() => {
            if (!canStart) return;
            const submittedAt = Date.now();
            const submittedDeadline = deadlineAt(submittedAt);
            if (
              !validCategories ||
              !isValidDeadline(submittedDeadline, submittedAt, initial.meetingStartsAt)
            ) {
              setNow(submittedAt);
              return;
            }
            const preview = new URLSearchParams({
              roomId: isolated ? 'exploration-preview' : room.id,
              returnTo: `${location.pathname}${location.search}`,
            });
            if (!isolated) {
              if (
                !send({
                  type: 'startRegistration',
                  categoryIds: selected,
                  requiredCategoryIds: requiredIds,
                  deadline: submittedDeadline,
                  now: submittedAt,
                })
              )
                return;
              preview.set('from', 'confirmation');
            }
            navigate(`${PATHS.places}?${preview}`);
          }}
        >
          장소 등록 시작하기
        </Button>
      </footer>
      <Modal
        open={categoryBlocked}
        onClose={() => setCategoryBlocked(false)}
        className="registration-setup__category-modal"
        aria-labelledby="registration-category-blocked"
      >
        <h2 id="registration-category-blocked">분류를 변경할 수 없어요</h2>
        <p>문화시설은 선택 카테고리에만 둘 수 있어요.</p>
        <Button onClick={() => setCategoryBlocked(false)}>확인</Button>
      </Modal>
    </div>
  );
}

function PlaceRegistrationSetup() {
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  return <SetupForm key={scenario ?? 'default'} scenario={scenario} />;
}

export default PlaceRegistrationSetup;
