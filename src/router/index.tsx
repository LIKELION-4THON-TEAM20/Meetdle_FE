import { ROOM_SCREENS } from './roomRoutes';
import { createBrowserRouter, Link } from 'react-router';
import CreateRoom from '../pages/CreateRoom/CreateRoom';
import InvitationRoute from './InvitationRoute';
import ServerRoomRoute from './ServerRoomRoute';
import FlowLayout, { RoomRecovery, LegacyJoinRedirect } from './FlowLayout';
import LoginRoute from './LoginRoute';
import HomeRoute from './HomeRoute';
import { PATHS } from './paths';

export const router = createBrowserRouter([
  {
    element: <FlowLayout />,
    children: [
      { path: PATHS.home, element: <HomeRoute /> },
      { path: '/rooms', element: <HomeRoute /> },
      { path: PATHS.login, element: <LoginRoute /> },
      { path: PATHS.create, element: <CreateRoom /> },
      { path: PATHS.invitation, element: <InvitationRoute /> },
      { path: '/invite/:token', element: <InvitationRoute /> },
      { path: '/invitations/:token', element: <InvitationRoute /> },
      { path: '/rooms/:roomId', element: <ServerRoomRoute /> },
      { path: PATHS.legacyJoin, element: <LegacyJoinRedirect /> },
      ...ROOM_SCREENS.map((path) => ({
        path,
        element: <RoomRecovery message="약속방을 선택해주세요. 홈에서 약속을 열어주세요." />,
      })),
      {
        path: '*',
        element: (
          <main className="page">
            <h1>페이지를 찾을 수 없어요.</h1>
            <Link to={PATHS.home}>홈으로 이동</Link>
          </main>
        ),
      },
    ],
  },
]);
