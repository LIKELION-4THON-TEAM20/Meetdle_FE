import { useEffect, useRef, useState } from 'react';
import { getSession } from '../../api/auth';
import { api } from '../../api/client';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import { prepareKakaoShare, shareKakaoMessage } from '../serverRoom/kakaoInviteShare';
import { prepareRoomShare } from './prepareShare';
import type { ShareKind } from './shareModel';
import './RoomShareDialog.scss';

export default function RoomShareDialog({
  roomId,
  kind,
  onClose,
}: {
  roomId: string;
  kind: ShareKind;
  onClose: () => void;
}) {
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareRoomShare>>>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const running = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    let owner: Awaited<ReturnType<typeof getSession>> | undefined;
    const unsubscribe = api.subscribeSession((session) => {
      if (
        owner &&
        (!session ||
          session.user.userId !== owner.user.userId ||
          session.csrfToken !== owner.csrfToken)
      ) {
        controller.abort();
        setPrepared(undefined);
        setSending(false);
        setError('로그인 상태가 바뀌었어요. 다시 열어주세요.');
      }
    });
    void prepareRoomShare(roomId, kind, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        owner = value.session;
        setPrepared(value);
        void prepareKakaoShare().catch(() => undefined);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '공유 정보를 불러오지 못했어요.');
      });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [roomId, kind, attempt]);
  async function send() {
    if (!prepared || running.current || !request.current || request.current.signal.aborted) return;
    running.current = true;
    setSending(true);
    setError('');
    const signal = request.current.signal;
    try {
      const current = await getSession({ refresh: true });
      signal.throwIfAborted();
      if (
        current.user.userId !== prepared.session.user.userId ||
        current.csrfToken !== prepared.session.csrfToken
      )
        throw new Error('로그인 상태가 바뀌었어요.');
      const fresh = await prepareRoomShare(roomId, kind, signal);
      if (
        fresh.session.user.userId !== prepared.session.user.userId ||
        fresh.session.csrfToken !== prepared.session.csrfToken
      )
        throw new Error('로그인 상태가 바뀌었어요.');
      await shareKakaoMessage(fresh.message, signal);
      if (!signal.aborted) onClose();
    } catch (cause) {
      if (!signal.aborted)
        setError(
          cause instanceof Error && /진행 단계|공유 링크|대상|로그인 상태/.test(cause.message)
            ? cause.message
            : '카카오톡 공유를 열지 못했어요. 공유 키와 도메인 설정을 확인한 뒤 다시 시도해주세요.',
        );
    } finally {
      running.current = false;
      if (!signal.aborted) setSending(false);
    }
  }
  const message = prepared?.message;
  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      className="room-share-dialog"
      aria-labelledby="room-share-title"
    >
      <h2 id="room-share-title">{message?.title ?? '카카오톡 공유하기'}</h2>
      {message ? (
        <>
          <p>{message.description}</p>
          <dl className="room-share-dialog__info">
            {message.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <strong className="room-share-dialog__brand">Meetdle</strong>
          {message.recipients.length > 0 && (
            <p className="room-share-dialog__recipients">
              참여 요청 대상: {message.recipients.join(', ')}
            </p>
          )}
          <p>카카오톡에서 보낼 친구나 채팅방을 직접 선택해주세요.</p>
        </>
      ) : (
        !error && <p role="status">최신 공유 정보를 확인하고 있어요.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {!prepared && error && (
        <Button
          onClick={() => {
            setPrepared(undefined);
            setError('');
            setAttempt((n) => n + 1);
          }}
        >
          다시 불러오기
        </Button>
      )}
      <Button
        className="room-share-dialog__send"
        disabled={!message || sending}
        onClick={() => void send()}
      >
        {sending ? '카카오톡 공유를 여는 중…' : '카카오톡으로 전송하기'}
      </Button>
      <Button variant="secondary" onClick={onClose}>
        닫기
      </Button>
    </Modal>
  );
}
