import type { VoteStatusPhase } from '../types';

export default function VoteResultPending({
  phase,
  completed,
  total,
  closedEarly,
}: {
  phase: Exclude<VoteStatusPhase, 'ongoing'>;
  completed: number;
  total: number;
  closedEarly: boolean;
}) {
  const description =
    phase === 'allCompleted'
      ? '모든 참여자가 투표를 완료했어요. 결과를 계산하고 있어요.'
      : phase === 'counting'
        ? `${closedEarly ? '투표를 조기 마감했어요.' : '투표 마감 시간이 끝났어요.'} 과반 이상 참여해 결과를 집계하고 있어요.`
        : `${closedEarly ? '투표를 조기 마감했어요.' : '투표 마감 시간이 끝났어요.'} 과반에 미달해 결과를 집계하지 않아요.`;
  return (
    <section className="vote-status__pending" aria-labelledby="vote-pending-title" role="status">
      <h2 id="vote-pending-title">
        {completed} / {total}명 투표 완료
      </h2>
      <p>{description}</p>
      <div className="vote-status__state-card">
        {phase === 'allCompleted'
          ? '결과 계산 중...'
          : phase === 'counting'
            ? '결과를 집계하고 있어요.'
            : '참여 부족 시 후속 처리 방식은 아직 정해지지 않았어요.'}
      </div>
      {closedEarly && (
        <p className="vote-status__mock-notice">
          현재 화면의 목 상태만 변경했어요. 서버에는 마감이 반영되지 않았어요.
        </p>
      )}
    </section>
  );
}
