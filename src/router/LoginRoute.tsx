import { useSearchParams } from 'react-router';
import Login from '../pages/Login/Login';
import { getKakaoLoginUrl } from '../api/auth';
import { LOGIN_RETURN_KEY, safeReturnTo } from './paths';

export default function LoginRoute() {
  const [params] = useSearchParams();
  const loginUrl = getKakaoLoginUrl(import.meta.env.VITE_KAKAO_LOGIN_URL);
  const returnTo = safeReturnTo(params.get('returnTo'));
  return (
    <Login
      onKakaoLogin={
        loginUrl
          ? () => {
              try {
                sessionStorage.setItem(LOGIN_RETURN_KEY, returnTo);
              } catch {
                window.alert(
                  '브라우저 저장소를 사용할 수 없어 로그인 후 초대 주소로 자동 복귀할 수 없어요. 초대 링크를 보관해주세요.',
                );
              }
              // 복귀 주소를 백엔드에 전달하는 방식과 인증 콜백은 API 계약 확정 후 연결한다.
              window.location.assign(loginUrl);
            }
          : undefined
      }
    />
  );
}
