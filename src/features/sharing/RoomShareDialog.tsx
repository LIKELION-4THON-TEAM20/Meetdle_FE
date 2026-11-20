import NudgeMessagePicker from './NudgeMessagePicker';
import { editedNudge, isReminder, nudgeOptions, nudgeTitle } from './nudgeModel';
import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useEffect, useRef, useState } from 'react';
import { getSession } from '../../api/auth';
import { api } from '../../api/client';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import { prepareKakaoShare, openPreparedKakaoShare } from '../serverRoom/kakaoInviteShare';
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
  const [selectedText, setSelectedText] = useState('');
  const reminder = isReminder(kind);
  const compact = reminder || kind === 'hostRequest';
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
    let expires: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const value = await prepareRoomShare(roomId, kind, controller.signal);
      await prepareKakaoShare();
      return value;
    })()
      .then((value) => {
        if (controller.signal.aborted) return;
        owner = value.session;
        setPrepared(value);
        expires = setTimeout(() => {
          if (running.current) return;
          setPrepared(undefined);
          setError('공유 정보가 오래됐어요. 다시 불러와주세요.');
        }, 60_000);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error && cause.message.includes('Kakao')
              ? '카카오 공유를 준비하지 못했어요. JavaScript 키와 SDK 로딩을 확인하고 다시 불러와주세요.'
              : cause instanceof Error
                ? cause.message
                : '공유 정보를 불러오지 못했어요.',
          );
      });
    return () => {
      controller.abort();
      clearTimeout(expires);
      unsubscribe();
    };
  }, [roomId, kind, attempt]);
  function send() {
    if (!prepared || running.current || !request.current || request.current.signal.aborted) return;
    running.current = true;
    setSending(true);
    setError('');
    try {
      // No await/API calls here: retain the browser's user activation for Kakao's popup/app link.
      const outgoing = compact
        ? editedNudge(
            prepared.message,
            kind === 'hostRequest' ? '우리 이제 다음 단계로 넘어갈 수 있대!' : selectedText,
          )
        : prepared.message;
      openPreparedKakaoShare(outgoing);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '카카오톡 공유를 열지 못했어요. 다시 시도해주세요.',
      );
      running.current = false;
      setSending(false);
    }
  }
  const message = prepared?.message;
  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      className={`room-share-dialog${compact ? ' room-share-dialog--nudge' : ''}`}
      aria-labelledby="room-share-title"
    >
      <h2 id="room-share-title">
        {compact ? nudgeTitle(kind) : (message?.title ?? '카카오톡 공유하기')}
      </h2>
      {message ? (
        <>
          <p>
            {compact
              ? kind === 'hostRequest'
                ? '우리 이제 다음 단계로 넘어갈 수 있대!'
                : '친구에게 보낼 메시지를 선택해보세요'
              : message.description}
          </p>
          {reminder && (
            <NudgeMessagePicker
              options={nudgeOptions(message)}
              value={selectedText}
              onChange={setSelectedText}
              disabled={sending}
            />
          )}
          {!compact && (
            <>
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
          )}
        </>
      ) : (
        !error && (
          <RequestStatus
            loading
            title="공유 정보를 준비하는 중이에요."
            description="잠시만 기다려주세요."
          />
        )
      )}
      {error && <RequestStatus title="카카오톡 공유를 준비하지 못했어요." description={error} />}
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
        disabled={!message || sending || (reminder && !selectedText.trim())}
        onClick={() => void send()}
      >
        {sending ? '카카오톡 공유 요청됨' : '카카오톡으로 전송하기'}
      </Button>
      {sending && (
        <p role="status">
          열린 카카오톡 공유창을 확인해주세요. 창이 없다면 브라우저의 팝업 차단 여부를 확인해주세요.
        </p>
      )}
      {compact ? (
        <button
          type="button"
          className="room-share-dialog__close"
          aria-label="닫기"
          onClick={onClose}
        >
          ×
        </button>
      ) : (
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      )}
    </Modal>
  );
}
