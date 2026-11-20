import { getSession } from '../../api/auth';
import { getRoomShare, getRoomState } from '../../api/rooms';
import { assertShareStage, buildShareMessage, sharePurpose, type ShareKind } from './shareModel';
import { currentShareKind } from './shareNotice';
export async function prepareRoomShare(roomId: string, requested: ShareKind, signal: AbortSignal) {
  const owner = await getSession();
  signal.throwIfAborted();
  const room = await getRoomState(roomId, signal);
  signal.throwIfAborted();
  if (room.roomId !== roomId) throw new Error('약속방 정보를 다시 확인해주세요.');
  const kind = currentShareKind(room, requested);
  assertShareStage(room, kind);
  const purpose = sharePurpose(kind);
  const payload = purpose ? await getRoomShare(roomId, purpose, signal) : null;
  if (payload && payload.purpose !== purpose) throw new Error('공유 정보를 다시 확인해주세요.');
  if (payload && purpose !== 'RESULT' && !payload.recipients.length)
    throw new Error('지금은 요청할 대상이 없어요. 최신 진행 현황을 확인해주세요.');
  const current = await getSession();
  signal.throwIfAborted();
  if (current.user.userId !== owner.user.userId || current.csrfToken !== owner.csrfToken)
    throw new Error('로그인 상태가 바뀌었어요. 다시 공유해주세요.');
  const url = kind === 'invite' ? room.invite?.inviteUrl : (payload?.shareUrl ?? room.shareUrl);
  if (!url) throw new Error('공유 링크를 불러오지 못했어요.');
  return {
    message: buildShareMessage(
      room,
      kind,
      url,
      payload?.recipients.map((p) => p.nickname),
    ),
    session: current,
  };
}
