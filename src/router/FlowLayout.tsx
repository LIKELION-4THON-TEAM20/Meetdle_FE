import { Link, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import Header from '../components/common/Header/Header';
import {
  CREATED_ROOM_PREVIEW_ID,
  findCreatedRoomByCode,
  getCreatedRoom,
  hasFullRecruitment,
} from '../features/createdRoom/model';
import { PATHS, roomPath } from './paths';
import { isServerRoomId } from '../api/rooms';
import { ServerRoomCreated } from '../pages/RoomCreated/RoomCreated';
import { serverRoomUrl } from '../features/serverRoom/routing';
import { ServerSchedule } from './ScheduleApiRoutes';
import { ServerRoomHandoff } from '../features/serverRoom/RoomStatus';

export default function FlowLayout() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const id = params.get('roomId');
  if (id && isServerRoomId(id) && !getCreatedRoom(id)) {
    if (pathname === PATHS.schedule) return <ServerSchedule key={id} roomId={id} />;
    if ([PATHS.participation, PATHS.candidates, PATHS.confirmed].some((path) => path === pathname))
      return <ServerRoomHandoff key={id + pathname} roomId={id} path={pathname} />;
  }
  if (params.get('mode') === 'api' && pathname.startsWith('/rooms/')) {
    if (!id || !isServerRoomId(id) || getCreatedRoom(id)) {
      return <RoomRecovery message="서버 약속방 주소가 올바르지 않아요." />;
    }
    if (pathname === PATHS.created) return <ServerRoomCreated key={id} roomId={id} />;
    if (
      [
        PATHS.recruitment,
        PATHS.participation,
        PATHS.schedule,
        PATHS.candidates,
        PATHS.confirmed,
        PATHS.info,
        PATHS.setup,
        PATHS.places,
        PATHS.registration,
        PATHS.closeRegistration,
        PATHS.startVote,
        PATHS.vote,
        PATHS.voteStatus,
        PATHS.result,
      ].some((path) => path === pathname)
    ) {
      return <ServerRoomHandoff roomId={id} path={pathname} />;
    }
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
    <div className="page">
      <Header title="약속 정보 확인" />
      <main style={{ padding: 27 }}>
        <p role="alert">{message}</p>
        <Link to={PATHS.home}>내 약속 홈으로 이동</Link>
      </main>
    </div>
  );
}

export function CreatedRoomLayout() {
  const { search, pathname } = useLocation();
  const params = new URLSearchParams(search);
  const id = params.get('roomId');
  if (
    id &&
    isServerRoomId(id) &&
    (pathname === PATHS.participation || pathname === PATHS.candidates)
  )
    return <Outlet />;
  const code = params.get('code');
  // #26의 실제 서버 입력·현황만 통과시키고, 목 방 복구는 기존 경로를 유지한다.
  if (id && isServerRoomId(id) && (pathname === PATHS.schedule || pathname === PATHS.participation))
    return <Outlet />;
  const room = id ? getCreatedRoom(id) : code ? findCreatedRoomByCode(code) : getCreatedRoom(null);
  if ((params.has('roomId') && !id) || !room || (code !== null && code !== room.inviteCode)) {
    return (
      <RoomRecovery message="이 브라우저에서 확인할 수 없는 약속방 또는 초대 코드예요. 실제 초대 코드 조회 API는 아직 연결되지 않았어요." />
    );
  }
  // 참여 현황의 독립 fixture를 새로 만든 방의 실제 참여 결과로 노출하지 않는다.
  if (
    ((pathname === PATHS.schedule && !hasFullRecruitment(room)) ||
      pathname === PATHS.participation ||
      pathname === PATHS.candidates) &&
    room.id !== CREATED_ROOM_PREVIEW_ID
  ) {
    return <RoomRecovery message="이 목 약속방의 참여 현황·후보 조회는 아직 연결되지 않았어요." />;
  }
  if (pathname === PATHS.candidates && params.get('role') === 'participant') {
    return <Navigate to={roomPath(PATHS.participation, search)} replace />;
  }
  if (pathname === PATHS.recruitment && params.get('role') === 'participant') {
    return <RoomRecovery message="모임 시작은 방장만 할 수 있어요." />;
  }
  return <Outlet context={room} />;
}

export function LegacyJoinRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${PATHS.invitation}${search}`} replace />;
}
