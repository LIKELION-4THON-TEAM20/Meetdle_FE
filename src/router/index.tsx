import { createBrowserRouter, Link, Navigate } from 'react-router';
import CreateRoom from '../pages/CreateRoom/CreateRoom';
import RoomCreated from '../pages/RoomCreated/RoomCreated';
import RoomInvitation from '../pages/RoomInvitation/RoomInvitation';
import { ScheduleTransitEntryRoute } from './ScheduleApiRoutes';
import ParticipationStatus from '../pages/ParticipationStatus/ParticipationStatus';
import RoomRecruitment from '../pages/ParticipationStatus/RoomRecruitment';
import TimeRegionCandidates from '../pages/TimeRegionCandidates/TimeRegionCandidates';
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

import FlowLayout, { CreatedRoomLayout, LegacyJoinRedirect } from './FlowLayout';
import LoginRoute from './LoginRoute';
import HomeRoute from './HomeRoute';
import { PATHS } from './paths';
import PlaceExplorationRoute from './PlaceExplorationRoute';
import ServerRoomRoute from '../features/serverRoom/RoomStatus';
import ServerRoomInvitation from '../pages/RoomInvitation/ServerRoomInvitation';

export const router = createBrowserRouter([
  {
    element: <FlowLayout />,
    children: [
      { path: '/rooms', element: <Navigate to={PATHS.home} replace /> },
      { path: '/rooms/:roomId', element: <ServerRoomRoute /> },
      { path: '/invite/:inviteToken', element: <ServerRoomInvitation /> },
      {
        element: <MockRoomLayout />,
        children: [
          { path: PATHS.confirmed, element: <MeetingConfirmed /> },
          { path: PATHS.info, element: <MeetingInfo /> },
          { path: PATHS.setup, element: <PlaceRegistrationSetup /> },
          { path: PATHS.result, element: <VoteResult /> },
          { path: PATHS.voteStatus, element: <VoteStatus /> },
          { path: PATHS.vote, element: <PlaceVote /> },
          { path: PATHS.closeRegistration, element: <RegistrationClose /> },
          { path: PATHS.startVote, element: <VoteStart /> },
          { path: PATHS.registration, element: <PlaceRegistrationStatus /> },
        ],
      },
      {
        path: PATHS.home,
        element: <HomeRoute />,
      },
      {
        path: PATHS.login,
        element: <LoginRoute />,
      },
      { path: PATHS.legacyJoin, element: <LegacyJoinRedirect /> },
      { path: PATHS.places, element: <PlaceExplorationRoute /> },
      {
        element: <CreatedRoomLayout />,
        children: [
          {
            path: PATHS.create,
            element: <CreateRoom />,
          },
          {
            path: PATHS.created,
            element: <RoomCreated />,
          },
          {
            path: PATHS.invitation,
            element: <RoomInvitation />,
          },
          {
            path: PATHS.schedule,
            element: <ScheduleTransitEntryRoute />,
          },
          {
            path: PATHS.recruitment,
            element: <RoomRecruitment />,
          },
          {
            path: PATHS.participation,
            element: <ParticipationStatus />,
          },
          {
            path: PATHS.candidates,
            element: <TimeRegionCandidates />,
          },
        ],
      },
      {
        path: '*',
        element: (
          <main className="page">
            <h1>페이지를 찾을 수 없어요.</h1>
            <Link to={PATHS.home}>내 약속 홈으로 이동</Link>
            <Link to="/rooms/create">약속방 만들기로 이동</Link>
          </main>
        ),
      },
    ],
  },
]);
