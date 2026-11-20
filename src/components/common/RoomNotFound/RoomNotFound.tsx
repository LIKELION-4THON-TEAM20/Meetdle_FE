import { useNavigate } from 'react-router';
import Button from '../Button/Button';
import { PATHS } from '../../../router/paths';
import './RoomNotFound.scss';

export default function RoomNotFound() {
  const navigate = useNavigate();
  return (
    <main className="page room-not-found">
      <section
        className="room-not-found__message"
        role="alert"
        aria-labelledby="room-not-found-title"
      >
        <div className="room-not-found__illustration" aria-hidden="true" />
        <h1 id="room-not-found-title">약속방을 찾을 수 없어요</h1>
        <p>링크가 잘못되었거나 더 이상 사용할 수 없는 약속방이에요.</p>
      </section>
      <footer className="room-not-found__footer">
        <Button onClick={() => navigate(PATHS.home, { replace: true })}>홈으로 가기</Button>
        <p>초대 링크를 다시 확인해주세요.</p>
      </footer>
    </main>
  );
}
