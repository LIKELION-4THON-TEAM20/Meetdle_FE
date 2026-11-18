import type { ReactNode } from 'react';
import Header from '../../../components/common/Header/Header';
import MeetingConfirmationCard, { type MeetingConfirmation } from './MeetingConfirmationCard';
import '../MeetingConfirmed.scss';

interface MeetingConfirmationLayoutProps {
  meeting: MeetingConfirmation;
  onBack: () => void;
  children: ReactNode;
  title?: string;
  showTravelSummary?: boolean;
}

function MeetingConfirmationLayout({
  meeting,
  onBack,
  children,
  title = '우리 여기서 만나요',
  showTravelSummary,
}: MeetingConfirmationLayoutProps) {
  return (
    <div className="page meeting-confirmed">
      <Header title="약속 확정" showBackButton onBack={onBack} />
      <main className="meeting-confirmed__content">
        <div className="meeting-confirmed__hero">
          <span className="meeting-confirmed__celebration" aria-hidden="true">
            🎉
          </span>
          <h2>{title}</h2>
          <p>확정된 일시와 지역을 친구들에게 알려주세요.</p>
        </div>
        <MeetingConfirmationCard meeting={meeting} showTravelSummary={showTravelSummary} />
      </main>
      {children}
    </div>
  );
}

export default MeetingConfirmationLayout;
