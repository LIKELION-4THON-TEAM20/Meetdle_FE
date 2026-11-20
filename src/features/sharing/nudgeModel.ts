import { formatShareText, type ShareKind, type ShareMessage } from './shareModel';

export function isReminder(kind: ShareKind) {
  return kind === 'inputReminder' || kind === 'registrationReminder' || kind === 'votingReminder';
}
export function nudgeTitle(kind: ShareKind) {
  if (kind === 'hostRequest') return '방장에게 알리기';
  if (kind === 'registrationReminder') return '등록 안 한 친구 재촉하기';
  if (kind === 'votingReminder') return '투표 안 한 친구 재촉하기';
  return '입력 안 한 친구 재촉하기';
}
export function nudgeOptions(message: ShareMessage) {
  const nickname = message.recipients.length === 1 ? message.recipients[0] : null;
  const last = nickname?.charCodeAt(nickname.length - 1) ?? 0;
  const address = nickname
    ? `${nickname}${last >= 0xac00 && last <= 0xd7a3 ? ((last - 0xac00) % 28 ? '아' : '야') : ''}`
    : '얘들아';
  const deadline = message.rows.find((row) => row.label.includes('마감'))?.value;
  if (message.kind === 'inputReminder')
    return [
      '얼른 입력 안하면 우리끼리 정한다~',
      `${address} 가능한 시간과 출발역만 입력하면 끝!`,
      `${address} 우리 얼른 정해서 즐겁게 놀자!`,
    ];
  return [
    `${address} ${deadline ? `${deadline}까지 ` : ''}${message.kind === 'votingReminder' ? '선택' : '등록'}만 하면 우리 약속 결정 끝!`,
    `${address} 얼마나 좋은 곳 가려고 아직도 고민하냐~`,
    `${address} 우리 얼른 정해서 즐겁게 놀자!`,
  ];
}
export function editedNudge(message: ShareMessage, description: string): ShareMessage {
  const text = description.trim();
  if (!text || text.length > 120) throw new Error('보낼 메시지를 1~120자로 입력해주세요.');
  const title = nudgeTitle(message.kind);
  return { ...message, title, description: text, text: formatShareText(title, text, message.rows) };
}
