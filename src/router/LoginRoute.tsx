import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Login from '../pages/Login/Login';
import { startKakaoLogin } from '../api/auth';
import { useAuthSession, sessionStore } from '../features/auth/session';
import { authErrorMessage } from '../features/auth/errors';
import {
  consumeLoginReturn,
  kakaoLoginOptions,
  inviteReturnPath,
  loginErrorMessage,
  rememberLoginReturn,
} from '../features/auth/loginReturn';
import { PATHS, safeReturnTo } from './paths';
import AuthStatus from './AuthStatus';

export default function LoginRoute() {
  const auth = useAuthSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const token = params.get('inviteToken') ?? undefined;
  const returnTo = token ? inviteReturnPath(token) : safeReturnTo(params.get('returnTo'));
  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let saved = PATHS.home as string;
    try {
      saved = consumeLoginReturn(sessionStorage);
    } catch {
      /* Server still handles its own OAuth return. */
    }
    navigate(returnTo !== PATHS.home ? returnTo : saved, { replace: true });
  }, [auth.status, navigate, returnTo]);
  if (auth.status === 'checking' || auth.status === 'authenticated')
    return <AuthStatus message="로그인 상태를 확인하고 있어요." />;
  return (
    <Login
      message={
        error ||
        loginErrorMessage(params.get('loginError')) ||
        (auth.status === 'error' ? authErrorMessage(auth.error) : undefined)
      }
      onRetry={auth.status === 'error' ? () => void sessionStore.refresh() : undefined}
      busy={starting}
      onKakaoLogin={() => {
        setError('');
        try {
          if (token && !/^[A-Za-z0-9_-]{43}$/.test(token)) {
            setError('초대 링크를 확인해주세요.');
            return;
          }
          try {
            rememberLoginReturn(sessionStorage, returnTo);
          } catch {
            /* The backend retains inviteToken. */
          }
          setStarting(true);
          startKakaoLogin(kakaoLoginOptions(window.location.origin, returnTo, token));
        } catch {
          setStarting(false);
          setError('로그인 연결 설정을 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
        }
      }}
    />
  );
}
