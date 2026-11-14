import Button from '../../../components/common/Button/Button';

export default function RevoteNotice({
  used,
  onRevote,
  canRevote = true,
}: {
  used: number;
  onRevote: () => void;
  canRevote?: boolean;
}) {
  return (
    <section className="revote-notice" aria-labelledby="revote-title">
      <h2 id="revote-title">이번 후보에서는 함께 갈 장소를 찾지 못했어요.</h2>
      <p>강한 비선호가 있는 장소는 결과에서 제외했어요.</p>
      <p className="vote-result__mock-note">재투표는 최대 1회까지 가능해요.</p>
      <Button disabled={used >= 1 || !canRevote} onClick={onRevote}>
        다시 투표하기
      </Button>
      {used >= 1 && (
        <p role="status">
          재투표 안내를 1회 확인했어요. 목 횟수만 반영했으며, 실제 재투표는 시작되지 않았어요.
        </p>
      )}
      <p className="vote-result__mock-note">
        선정 실패 예시예요. 실제 제외 기준과 재투표 후보 구성은 기획 확인 중이에요.
      </p>
    </section>
  );
}
