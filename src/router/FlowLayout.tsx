import RequestStatus, { RequestStatusPage } from '../components/common/RequestStatus/RequestStatus';
import { Link, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { PATHS } from './paths';
import { ROOM_SCREENS, serverRoomId } from './roomRoutes';
import { ServerRoomCreated } from '../pages/RoomCreated/RoomCreated';
import { serverRoomUrl } from '../features/serverRoom/routing';
import { ServerSchedule } from './ScheduleApiRoutes';
import { ServerRoomHandoff } from '../features/serverRoom/RoomStatus';

export default function FlowLayout() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search),
    id = serverRoomId(search);
  if (ROOM_SCREENS.includes(pathname)) {
    if (!id) return <RoomRecovery message="약속방을 선택해주세요. 홈에서 약속을 열어주세요." />;
    if (pathname === PATHS.created) return <ServerRoomCreated key={id} roomId={id} />;
    if (pathname === PATHS.schedule) return <ServerSchedule key={id} roomId={id} />;
    return <ServerRoomHandoff key={id + pathname} roomId={id} path={pathname} />;
  }
  if (
    params.get('mode') === 'api' &&
    pathname.startsWith('/rooms/') &&
    pathname !== PATHS.create &&
    pathname !== PATHS.invitation
  ) {
    if (!id) return <RoomRecovery message="서버 약속방 주소가 올바르지 않아요." />;
    return <Navigate to={serverRoomUrl(id)} replace />;
  }
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
export function RoomRecovery({ message }: { message: string }) {
  return (
    <RequestStatusPage footer={<Link to={PATHS.home}>홈으로 가기</Link>}>
      <RequestStatus title="약속방을 확인해주세요" description={message} />
    </RequestStatusPage>
  );
}

export function LegacyJoinRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${PATHS.invitation}${search}`} replace />;
}
