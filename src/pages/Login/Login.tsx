import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import circlesTop from '../../assets/images/login/circles-top.svg';
import circlesBottom from '../../assets/images/login/circles-bottom.svg';
import wordmark from '../../assets/images/login/wordmark.svg';
import tagline from '../../assets/images/login/tagline.svg';
import kakao from '../../assets/images/login/kakao.svg';
import helpUnderline from '../../assets/images/login/help-underline.svg';
import './Login.scss';

interface LoginProps {
  onKakaoLogin?: () => void;
  helpUrl?: string;
  message?: string;
  busy?: boolean;
  onRetry?: () => void;
}

function Login({ onKakaoLogin, helpUrl, message, busy = false, onRetry }: LoginProps) {
  return (
    <main className="page login-page">
      <div className="login-page__brand">
        <img className="login-page__circles-top" src={circlesTop} alt="" draggable={false} />
        <p className="login-page__tagline">
          <img src={tagline} alt="우리 사이 중간지점부터 만날 곳까지" draggable={false} />
        </p>
        <h1 className="login-page__wordmark">
          <img src={wordmark} alt="Meetdle" draggable={false} />
        </h1>
        <img className="login-page__circles-bottom" src={circlesBottom} alt="" draggable={false} />
      </div>
      <div className="login-page__actions">
        {message && (
          <RequestStatus
            title="로그인을 완료하지 못했어요."
            description={message}
            onRetry={onRetry}
            disabled={busy}
          />
        )}

        <button
          className="login-page__kakao"
          type="button"
          disabled={!onKakaoLogin || busy}
          aria-busy={busy}
          onClick={onKakaoLogin}
        >
          <img src={kakao} alt="" draggable={false} />
          {busy ? '카카오로 이동 중…' : '카카오로 로그인하기'}
        </button>
        {helpUrl ? (
          <a className="login-page__help" href={helpUrl}>
            로그인에 문제가 있나요?
            <img src={helpUnderline} alt="" draggable={false} />
          </a>
        ) : (
          <span className="login-page__help" role="link" aria-disabled="true">
            로그인에 문제가 있나요?
            <img src={helpUnderline} alt="" draggable={false} />
          </span>
        )}
      </div>
    </main>
  );
}

export default Login;
