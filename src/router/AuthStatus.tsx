import { Link } from 'react-router';
import RequestStatus, { RequestStatusPage } from '../components/common/RequestStatus/RequestStatus';
import { PATHS } from './paths';

export default function AuthStatus({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <RequestStatusPage footer={onRetry ? <Link to={PATHS.home}>홈으로 가기</Link> : undefined}>
      <RequestStatus
        title={message}
        loading={!onRetry}
        onRetry={onRetry}
        description={onRetry ? '잠시 후 다시 시도해주세요.' : '잠시만 기다려주세요.'}
      >
        {onRetry && <Link to={PATHS.login}>로그인하기</Link>}
      </RequestStatus>
    </RequestStatusPage>
  );
}
