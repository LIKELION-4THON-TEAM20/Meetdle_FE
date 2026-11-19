import { useEffect, useRef, useState } from 'react';
import { getRoomShare } from '../../api/rooms';
import { ApiRequestError } from '../../api/client';
import type { RoomShare } from '../../api/types';
import Button from '../../components/common/Button/Button';
import { prepareKakaoShare, shareKakaoText } from '../../features/serverRoom/kakaoInviteShare';
import { flowErrors } from '../../features/serverRoom/registrationFlow';
import ParticipationShareModal from '../ParticipationStatus/components/ParticipationShareModal';

export default function ServerRegistrationShare({
  roomId,
  kind,
  voting = false,
  onClose,
}: {
  roomId: string;
  kind: 'reminder' | 'notifyHost';
  voting?: boolean;
  onClose: () => void;
}) {
  const [share, setShare] = useState<RoomShare>();
  const [messageId, setMessageId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const sendRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const request = new AbortController();
    const purpose = kind === 'notifyHost' ? 'HOST' : voting ? 'VOTING' : 'REGISTRATION';
    void getRoomShare(roomId, purpose, request.signal)
      .then((result) => {
        if (request.signal.aborted) return;
        if (result.purpose !== purpose) throw new Error('Unexpected purpose');
        setShare(result);
        if (result.recipients.length === 1) setRecipient(result.recipients[0].participantId);
        void prepareKakaoShare().catch(() => undefined);
      })
      .catch((failure: unknown) => {
        if (!request.signal.aborted)
          setError(
            failure instanceof ApiRequestError
              ? (flowErrors[failure.code] ?? '공유 정보를 불러오지 못했어요.')
              : '공유 정보를 불러오지 못했어요.',
          );
      });
    return () => {
      request.abort();
      sendRequest.current?.abort();
    };
  }, [roomId, kind, voting, attempt]);

  const message = share?.messages.find(({ id }) => id === messageId);
  const send = async () => {
    if (!share || !message || !recipient || sendRequest.current) return;
    const request = new AbortController();
    sendRequest.current = request;
    setSending(true);
    setError('');
    try {
      await shareKakaoText(message.text, share.shareUrl, request.signal);
      if (!request.signal.aborted) onClose();
    } catch {
      if (!request.signal.aborted)
        setError(
          import.meta.env.VITE_KAKAO_SHARE_APP_KEY?.trim()
            ? '카카오톡 공유를 열지 못했어요. 공유 설정을 확인해주세요.'
            : '카카오톡 공유 키가 설정되지 않았어요.',
        );
    } finally {
      if (sendRequest.current === request) sendRequest.current = null;
      if (!request.signal.aborted) setSending(false);
    }
  };

  return (
    <ParticipationShareModal
      kind={kind}
      onClose={onClose}
      onSend={() => void send()}
      className="registration-share--select"
      disabled={!message || !recipient || sending}
      copy={{
        title:
          kind === 'reminder'
            ? `${voting ? '투표' : '등록'} 안 한 친구 재촉하기`
            : '방장에게 알리기',
        description: '공유 문구와 대상을 확인해주세요.',
      }}
    >
      {!share && !error && <p role="status">공유 정보를 불러오는 중이에요.</p>}
      {share && (
        <>
          <select
            className="registration-share-message"
            aria-label="메시지 선택하기"
            value={messageId}
            onChange={(event) => setMessageId(event.target.value)}
          >
            <option value="">메시지 선택하기</option>
            {share.messages.map(({ id, text }) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </select>
          {share.recipients.length > 0 ? (
            <>
              <select
                className="registration-share-message"
                aria-label="대상 확인"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
              >
                <option value="">대상 선택하기</option>
                {share.recipients.map(({ participantId, nickname }) => (
                  <option key={participantId} value={participantId}>
                    {nickname}
                  </option>
                ))}
              </select>
              <p>카카오톡에서 보낼 친구를 선택해주세요.</p>
            </>
          ) : (
            <p>공유할 대상이 없어요.</p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {error && !share && (
        <Button
          variant="secondary"
          onClick={() => {
            setError('');
            setAttempt((count) => count + 1);
          }}
        >
          다시 시도
        </Button>
      )}
    </ParticipationShareModal>
  );
}
