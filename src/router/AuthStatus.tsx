import { Link } from 'react-router';
import Button from '../components/common/Button/Button';
import './AuthStatus.scss';
import { PATHS } from './paths';

export default function AuthStatus({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="page auth-status" aria-live="polite">
      <p role={onRetry ? 'alert' : 'status'}>{message}</p>
      {onRetry && <Button onClick={onRetry}>다시 시도</Button>}
      {onRetry && <Link to={PATHS.login}>로그인 화면으로 이동</Link>}
    </main>
  );
}
