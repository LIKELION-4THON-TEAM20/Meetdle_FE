import { createBrowserRouter, Link, Navigate } from 'react-router';
import CreateRoom from '../pages/CreateRoom/CreateRoom';
import RoomCreated from '../pages/RoomCreated/RoomCreated';
import RoomInvitation from '../pages/RoomInvitation/RoomInvitation';
import ParticipationStatus from '../pages/ParticipationStatus/ParticipationStatus';
import MeetingConfirmed from '../pages/MeetingConfirmed/MeetingConfirmed';

export const router = createBrowserRouter([
  // 홈 화면 구현 전까지 약속방 생성 화면을 진입점으로 사용한다.
  {
    path: '/',
    element: <Navigate to="/rooms/create" replace />,
  },
  {
    path: '/rooms/create',
    element: <CreateRoom />,
  },
  {
    path: '/rooms/create/complete',
    element: <RoomCreated />,
  },
  {
    path: '/rooms/invite',
    element: <RoomInvitation />,
  },
  {
    path: '/rooms/participation-status',
    element: <ParticipationStatus />,
  },
  {
    path: '/rooms/confirmed',
    element: <MeetingConfirmed />,
  },
  {
    path: '*',
    element: (
      <main className="page">
        <h1>페이지를 찾을 수 없어요.</h1>
        <Link to="/rooms/create">약속방 만들기로 이동</Link>
      </main>
    ),
  },
]);
