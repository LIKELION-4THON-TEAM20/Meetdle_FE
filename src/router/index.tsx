import { createBrowserRouter, Link } from 'react-router';
import CreateRoom from '../pages/CreateRoom/CreateRoom';
import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import { getKakaoLoginUrl } from '../api/auth';
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
import VoteResult from '../pages/VoteResult/VoteResult';
import MockRoomLayout from '../features/mockRoom/MockRoomLayout';
import PlaceExploration from '../pages/PlaceExploration/PlaceExploration';

const kakaoLoginUrl = getKakaoLoginUrl(import.meta.env.VITE_KAKAO_LOGIN_URL);

export const router = createBrowserRouter([
  {
    element: <MockRoomLayout />,
    children: [
      { path: '/rooms/vote/result', element: <VoteResult /> },
      { path: '/rooms/vote/status', element: <VoteStatus /> },
      { path: '/rooms/vote', element: <PlaceVote /> },
      { path: '/rooms/registration/close', element: <RegistrationClose /> },
      { path: '/rooms/vote/start', element: <VoteStart /> },
      { path: '/rooms/registration/status', element: <PlaceRegistrationStatus /> },
    ],
  },
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: (
      <Login
        onKakaoLogin={kakaoLoginUrl ? () => window.location.assign(kakaoLoginUrl) : undefined}
      />
    ),
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
    path: '/rooms/places',
    element: <PlaceExploration />,
  },
  {
    path: '/rooms/registration/setup',
    element: <PlaceRegistrationSetup />,
  },
  {
    path: '*',
    element: (
      <main className="page">
        <h1>페이지지를 찾을 수 없어요.</h1>
        <Link to="/rooms/create">약속방 만들기로 이동</Link>
      </main>
    ),
  },
]);
