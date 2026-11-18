import { useId, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useRoomNavigation } from '../../router/useRoomNavigation';
import { PATHS, roomPath } from '../../router/paths';
import { CREATED_ROOM_PREVIEW_ID } from '../../features/createdRoom/model';
import { saveRoom } from '../../features/mockRoom/model';
import { createCandidateConfirmation } from '../MeetingConfirmed/confirmationData';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import TimeCandidateCard from './components/TimeCandidateCard';
import RegionCandidateCard from './components/RegionCandidateCard';
import { getTimeRegionCandidates } from './candidateData';
import { getConfirmationRequest, reconcileSelection } from './candidateUtils';
import type { CandidateConfirmationRequest, CandidateData, CandidateSelection } from './types';
import type { Participant } from '../ParticipationStatus/types';
import './TimeRegionCandidates.scss';

interface TimeRegionCandidatesViewProps {
  data: CandidateData;
  onBack: () => void;
  onConfirm?: (request: CandidateConfirmationRequest) => void;
  previewNotice?: string;
}

export function TimeRegionCandidatesView({
  data,
  onBack,
  onConfirm,
  previewNotice,
}: TimeRegionCandidatesViewProps) {
  const groupId = useId();
  const [storedSelection, setSelection] = useState<CandidateSelection>({
    timeCandidateId: null,
    regionCandidateId: null,
  });
  const [expandedRegionIds, setExpandedRegionIds] = useState<readonly string[]>([]);
  const [showConnectionNotice, setShowConnectionNotice] = useState(false);
  const selection = reconcileSelection(data, storedSelection);
  // 새 목록에서 사라진 ID는 렌더 단계에서 정리해 다시 나타나도 자동 선택되지 않게 한다.
  if (selection !== storedSelection) setSelection(selection);
  const request = getConfirmationRequest(data, selection);

  const selectCandidate = (next: Partial<CandidateSelection>) => {
    setSelection({ ...selection, ...next });
    setShowConnectionNotice(false);
  };

  const handleConfirm = () => {
    const currentRequest = getConfirmationRequest(data, selection);
    if (!currentRequest) return;
    if (onConfirm) onConfirm(currentRequest);
    else setShowConnectionNotice(true);
  };

  return (
    <div className="page time-region-candidates">
      <Header title="후보 비교" showBackButton onBack={onBack} />
      <main className="time-region-candidates__content">
        <section className="time-region-candidates__intro" aria-labelledby={`${groupId}-title`}>
          <h2 id={`${groupId}-title`}>가능한 일시 + 중간지역 후보</h2>
          <p>참여자들의 입력을 모아 비교 가능한 후보를 만들었어요</p>
          {previewNotice && <p role="status">{previewNotice}</p>}
        </section>
        <fieldset className="time-region-candidates__group">
          <legend>가능한 일시</legend>
          <div className="time-region-candidates__list">
            {data.timeCandidates.map((candidate) => (
              <TimeCandidateCard
                key={candidate.id}
                candidate={candidate}
                groupName={`${groupId}-time`}
                selected={selection.timeCandidateId === candidate.id}
                onSelect={() => selectCandidate({ timeCandidateId: candidate.id })}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="time-region-candidates__group">
          <legend>중간지역 후보</legend>
          <div className="time-region-candidates__list">
            {data.regionCandidates.map((candidate) => (
              <RegionCandidateCard
                key={candidate.id}
                candidate={candidate}
                groupName={`${groupId}-region`}
                selected={selection.regionCandidateId === candidate.id}
                expanded={expandedRegionIds.includes(candidate.id)}
                onSelect={() => selectCandidate({ regionCandidateId: candidate.id })}
                onToggleDetails={() =>
                  setExpandedRegionIds((ids) =>
                    ids.includes(candidate.id)
                      ? ids.filter((id) => id !== candidate.id)
                      : [...ids, candidate.id],
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      </main>
      <footer className="time-region-candidates__footer">
        {!request && (
          <p id={`${groupId}-selection-hint`}>시간과 중간지역을 각각 1개씩 선택해주세요.</p>
        )}
        <Button
          className="time-region-candidates__confirm"
          disabled={!request}
          aria-describedby={!request ? `${groupId}-selection-hint` : undefined}
          onClick={handleConfirm}
        >
          {request ? '이 후보로 확정하기' : '후보 확정하기'}
        </Button>
        {showConnectionNotice && <p role="status">확정 API는 아직 연결되지 않았어요.</p>}
      </footer>
    </div>
  );
}

function TimeRegionCandidates() {
  const navigate = useRoomNavigation();
  const navigateHistory = useNavigate();
  const { state } = useLocation();
  const [params] = useSearchParams();
  const data = getTimeRegionCandidates();
  const participants: Participant[] | undefined = state?.completedParticipants;
  const included = participants?.map(({ name }) => name).join(', ');
  const previewNotice =
    '개발용 목 후보 예시예요. 선택한 후보는 이 브라우저의 약속 확정 미리보기에 반영돼요.';

  const confirm = (request: CandidateConfirmationRequest) => {
    if (params.get('role') === 'participant') return;
    const roomId = params.get('roomId') ?? CREATED_ROOM_PREVIEW_ID;
    const room = createCandidateConfirmation(data, request, Date.now(), roomId);
    if (!room) return;
    const path = roomPath(PATHS.confirmed, '', roomId);
    try {
      saveRoom(window.sessionStorage, room);
    } catch {
      navigate(path, { state: { fallbackRoom: room } });
      return;
    }
    navigate(path);
  };

  return (
    <TimeRegionCandidatesView
      data={data}
      onBack={() => (included ? navigateHistory(-1) : navigate(PATHS.participation))}
      onConfirm={confirm}
      previewNotice={included ? `후보 계산 대상: ${included}. ${previewNotice}` : previewNotice}
    />
  );
}

export default TimeRegionCandidates;
