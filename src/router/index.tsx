import { createBrowserRouter, Link } from 'react-router';
import CreateRoom from '../pages/CreateRoom/CreateRoom';
import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import { getKakaoLoginUrl } from '../api/auth';

const kakaoLoginUrl = getKakaoLoginUrl(import.meta.env.VITE_KAKAO_LOGIN_URL);

export const router = createBrowserRouter([
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
    path: '*',
    element: (
      <main className="page">
        <h1>페이지를 찾을 수 없어요.</h1>
        <Link to="/rooms/create">약속방 만들기로 이동</Link>
      </main>
    ),
  },
]);
