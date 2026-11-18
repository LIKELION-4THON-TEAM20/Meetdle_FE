import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import PlaceExploration from '../pages/PlaceExploration/PlaceExploration';
import { MOCK_ROOM_ID, PATHS, roomPath, safeReturnTo } from './paths';
import { RoomRecovery } from './FlowLayout';
import { CREATED_ROOM_PREVIEW_ID } from '../features/createdRoom/model';
import { restoreRoom } from '../features/mockRoom/model';
import { getConfirmationRegistrationStatus } from '../pages/MeetingConfirmed/confirmationData';

// SCREEN 09는 SCREEN 10–14와 분리된 기존 목 repository를 사용한다.
export default function PlaceExplorationRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [openedAt] = useState(Date.now);
  const roomId = params.get('roomId');
  const fromConfirmation =
    params.get('from') === 'confirmation' &&
    (roomId === MOCK_ROOM_ID || roomId === CREATED_ROOM_PREVIEW_ID);
  if (roomId && roomId !== 'exploration-preview' && !fromConfirmation) {
    return (
      <RoomRecovery message="이 약속방의 장소 탐색 데이터는 아직 연결되지 않았어요. 다른 목 방의 장소를 대신 표시하지 않습니다." />
    );
  }
  if (fromConfirmation) {
    const room = restoreRoom(window.sessionStorage, openedAt, roomId);
    const status = import.meta.env.DEV ? params.get('status') : null;
    if (getConfirmationRegistrationStatus(room, status) !== 'registrationOpen') {
      return <RoomRecovery message="장소 등록이 열려 있지 않아요." />;
    }
  }
  const returnTo = params.get('returnTo');
  const backPath = returnTo ? safeReturnTo(returnTo) : PATHS.setup;
  return (
    <PlaceExploration
      onBack={() => navigate(backPath)}
      onViewStatus={
        fromConfirmation ? () => navigate(roomPath(PATHS.registration, `?${params}`)) : undefined
      }
    />
  );
}
