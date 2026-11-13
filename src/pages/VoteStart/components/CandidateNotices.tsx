import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import type { CandidateCategory } from '../mockData';

export function EmptyCandidates() {
  return (
    <div className="candidate-empty">
      <p>아직 등록된 장소가 없어요.</p>
      <p>장소가 1곳 이상 있어야 투표를 시작할 수 있어요.</p>
    </div>
  );
}

export function ExcludedCategories({ categories }: { categories: CandidateCategory[] }) {
  if (!categories.length) return null;
  return (
    <p className="candidate-excluded">
      등록된 {categories.map((category) => category.name).join('·')}이 없어 이번 투표에서는
      제외돼요. 나머지 카테고리로 투표가 진행돼요.
    </p>
  );
}

export function MissingRequiredModal({
  categories,
  open,
  onClose,
}: {
  categories: CandidateCategory[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="screen11-modal"
      aria-labelledby="missing-required-title"
    >
      <h2 id="missing-required-title">필수 카테고리 후보가 아직 없어요</h2>
      <p>
        {categories.map((category) => category.name).join('·')} 카테고리에 등록된 장소가 없으면
        마감할 수 없어요.
      </p>
      <Button
        onClick={() => {
          onClose();
          window.alert(
            '장소 등록 화면의 경로와 보완 등록 흐름은 아직 확정되지 않았어요. 실제 이동이나 등록 마감은 수행하지 않습니다.',
          );
        }}
      >
        필수 카테고리 등록하러 가기
      </Button>
    </Modal>
  );
}
