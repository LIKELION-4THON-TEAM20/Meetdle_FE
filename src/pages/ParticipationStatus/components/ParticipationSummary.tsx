import { useId } from 'react';

interface ParticipationSummaryProps {
  count: number;
  total: number;
  label: '입력 완료' | '참여 완료';
  description: string;
}

function ParticipationSummary({ count, total, label, description }: ParticipationSummaryProps) {
  const id = useId();
  const progress = total > 0 ? (count / total) * 100 : 0;

  return (
    <section className="participation-status__summary" aria-labelledby={id}>
      <h2 id={id}>
        <span>
          {count} / {total}명
        </span>{' '}
        {label}
      </h2>
      <p>{description}</p>
      <div
        className="participation-status__progress"
        role="progressbar"
        aria-label={`참여자 ${label}율`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${total}명 중 ${count}명 ${label}`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

export default ParticipationSummary;
