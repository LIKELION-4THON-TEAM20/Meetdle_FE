import { useNavigate, useSearchParams } from 'react-router';
import PlaceExploration from '../pages/PlaceExploration/PlaceExploration';
import { PATHS, safeReturnTo } from './paths';
import { RoomRecovery } from './FlowLayout';

// SCREEN 09는 SCREEN 10–14와 분리된 기존 목 repository를 사용한다.
export default function PlaceExplorationRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roomId = params.get('roomId');
  if (roomId && roomId !== 'exploration-preview') {
    return (
      <RoomRecovery message="이 약속방의 장소 탐색 데이터는 아직 연결되지 않았어요. 다른 목 방의 장소를 대신 표시하지 않습니다." />
    );
  }
  const returnTo = params.get('returnTo');
  const backPath = returnTo ? safeReturnTo(returnTo) : PATHS.setup;
  return <PlaceExploration onBack={() => navigate(backPath)} />;
}
