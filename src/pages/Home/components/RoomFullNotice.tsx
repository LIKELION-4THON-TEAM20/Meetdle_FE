import Button from '../../../components/common/Button/Button';

interface RoomFullNoticeProps {
  capacity: number;
  onConfirm: () => void;
}

function RoomFullNotice({ capacity, onConfirm }: RoomFullNoticeProps) {
  return (
    <div className="room-full-notice">
      <h2 id="room-full-title">방이 가득 찼어요.</h2>
      <p id="room-full-description">이 약속방은 정원 {capacity}명이 모두 참여했어요.</p>
      <Button onClick={onConfirm} autoFocus>
        확인
      </Button>
    </div>
  );
}

export default RoomFullNotice;
