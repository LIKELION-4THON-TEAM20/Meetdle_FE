import RequestStatus from '../../../components/common/RequestStatus/RequestStatus';
export default function ResultPending({ waitingForHost = false }: { waitingForHost?: boolean }) {
  return (
    <RequestStatus
      loading
      title={waitingForHost ? '방장이 결과를 확정하는 중이에요.' : '결과를 정리하고 있어요.'}
      description="방장이 결과를 확정하면 확인할 수 있어요."
    />
  );
}
