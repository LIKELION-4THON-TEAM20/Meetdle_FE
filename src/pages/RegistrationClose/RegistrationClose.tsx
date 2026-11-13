import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import CategoryCandidateSummary from './components/CategoryCandidateSummary';
import { createCandidateMock, summarizeCandidates } from '../VoteStart/mockData';
import {
  EmptyCandidates,
  ExcludedCategories,
  MissingRequiredModal,
} from '../VoteStart/components/CandidateNotices';
import './RegistrationClose.scss';

export default function RegistrationClose() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  const categories = createCandidateMock('close', scenario);
  const summary = summarizeCandidates(categories);
  const [missingOpen, setMissingOpen] = useState(false);
  return (
    <div className="page registration-close">
      <Header title="등록 마감" showBackButton onBack={() => navigate(-1)} />
      <main className="registration-close__content">
        <div className="registration-close__intro">
          <h2>장소 등록을 마감할까요?</h2>
          <p>마감하면 투표가 시작되고 더 이상 등록할 수 없어요</p>
        </div>
        {summary.total === 0 ? (
          <EmptyCandidates />
        ) : (
          <>
            <CategoryCandidateSummary categories={categories} />
            <ExcludedCategories categories={summary.excluded} />
          </>
        )}
      </main>
      <footer className="registration-close__footer">
        <Button
          disabled={summary.total === 0}
          onClick={() => {
            if (summary.missingRequired.length) {
              setMissingOpen(true);
              return;
            }
            navigate(
              `/rooms/vote/start${import.meta.env.DEV && scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''}`,
              { state: { categories } },
            );
          }}
        >
          등록 마감하고 투표 시작
        </Button>
      </footer>
      <MissingRequiredModal
        categories={summary.missingRequired}
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
      />
    </div>
  );
}
