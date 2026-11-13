import { createBrowserRouter, Link, Navigate } from 'react-router';
import CreateRoom from '../pages/CreateRoom/CreateRoom';
import RoomCreated from '../pages/RoomCreated/RoomCreated';
import RoomInvitation from '../pages/RoomInvitation/RoomInvitation';
import ParticipationStatus from '../pages/ParticipationStatus/ParticipationStatus';
import MeetingConfirmed from '../pages/MeetingConfirmed/MeetingConfirmed';
import MeetingInfo from '../pages/MeetingInfo/MeetingInfo';
import PlaceRegistrationSetup from '../pages/PlaceRegistrationSetup/PlaceRegistrationSetup';
import PlaceRegistrationStatus from '../pages/PlaceRegistrationStatus/PlaceRegistrationStatus';
import RegistrationClose from '../pages/RegistrationClose/RegistrationClose';
import VoteStart from '../pages/VoteStart/VoteStart';
import PlaceVote from '../pages/PlaceVote/PlaceVote';
import VoteStatus from '../pages/VoteStatus/VoteStatus';

export const router = createBrowserRouter([
  { path: '/rooms/vote/status', element: <VoteStatus /> },
  { path: '/rooms/vote', element: <PlaceVote /> },
  { path: '/rooms/registration/close', element: <RegistrationClose /> },
  { path: '/rooms/vote/start', element: <VoteStart /> },
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
    path: '/rooms/info',
    element: <MeetingInfo />,
  },
  {
    path: '/rooms/registration/setup',
    element: <PlaceRegistrationSetup />,
  },
  {
    path: '/rooms/registration/status',
    element: <PlaceRegistrationStatus />,
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
