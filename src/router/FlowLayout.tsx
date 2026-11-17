import { Link, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import Header from '../components/common/Header/Header';
import { findCreatedRoomByCode, getCreatedRoom } from '../features/createdRoom/model';
import { PATHS } from './paths';

export default function FlowLayout() {
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
  const code = params.get('code');
  const room = id ? getCreatedRoom(id) : code ? findCreatedRoomByCode(code) : getCreatedRoom(null);
  if ((params.has('roomId') && !id) || !room || (code !== null && code !== room.inviteCode)) {
    return (
      <RoomRecovery message="이 브라우저에서 확인할 수 없는 약속방 또는 초대 코드예요. 실제 초대 코드 조회 API는 아직 연결되지 않았어요." />
    );
  }
  // 참여 현황의 독립 fixture를 새로 만든 방의 실제 참여 결과로 노출하지 않는다.
  if (
    (pathname === PATHS.participation || pathname === PATHS.candidates) &&
    id &&
    id !== 'mock-created-preview'
  ) {
    return <RoomRecovery message="이 목 약속방의 참여 현황·후보 조회는 아직 연결되지 않았어요." />;
  }
  return <Outlet />;
}

export function LegacyJoinRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${PATHS.invitation}${search}`} replace />;
}
