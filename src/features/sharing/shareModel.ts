import type { RoomState, SharePurpose } from '../../api/types';
import { meetingDetails, seoulDateTime } from '../serverRoom/meeting';

const copy = {
  invite: [
    '함께 만날 약속이 도착했어요 💌',
    '초대를 확인하고 약속에 참여해주세요!',
    '초대 확인하기',
  ],
  inputRequest: [
    '우리 약속 조건을 모으는 중이에요 👀',
    '가능한 시간과 출발역을 입력해주세요!',
    '내 조건 입력하기',
  ],
  inputReminder: [
    '우리 약속 조건을 모으는 중이에요 👀',
    '아직 입력하지 않았다면 가능한 시간과 출발역을 알려주세요!',
    '내 조건 입력하기',
  ],
  hostRequest: [
    '함께 만날 조건이 모였어요 🙌',
    '입력 현황을 확인하고 가능한 일시와 지역을 정해주세요!',
    '입력 현황 확인하기',
  ],
  meetingConfirmed: [
    '약속 일시와 만날 지역이 정해졌어요 🗓️',
    '언제, 어디서 만날지 확인해주세요!',
    '약속 정보 확인하기',
  ],
  meetingChanged: [
    '약속 일시와 만날 지역이 변경됐어요 🗓️',
    '새로 정한 약속 정보를 확인해주세요!',
    '변경된 약속 확인하기',
  ],
  registrationRequest: [
    '장소 등록이 진행 중이에요 📍',
    '함께 가고 싶은 장소를 등록해주세요!',
    '장소 등록하러 가기',
  ],
  registrationReminder: [
    '장소 등록이 진행 중이에요 📍',
    '아직 등록하지 않았다면 함께 가고 싶은 장소를 골라주세요!',
    '장소 등록하러 가기',
  ],
  votingRequest: [
    '장소 투표가 진행 중이에요 🗳️',
    '마음에 드는 장소에 투표해주세요!',
    '투표하러 가기',
  ],
  votingReminder: [
    '장소 투표가 진행 중이에요 🗳️',
    '아직 투표하지 않았다면 마음에 드는 장소를 선택해주세요!',
    '투표하러 가기',
  ],
  finalResult: [
    '우리 만남 일정이 확정됐어요 🎉',
    '함께 정한 일정과 방문할 장소를 확인해주세요!',
    '최종 일정 확인하기',
  ],
  registrationExtended: [
    '장소 등록 시간이 연장됐어요 ⏰',
    '아직 등록하지 않았다면 새 마감 전에 참여해주세요!',
    '장소 등록하러 가기',
  ],
  votingExtended: [
    '장소 투표 시간이 연장됐어요 ⏰',
    '아직 투표하지 않았다면 새 마감 전에 참여해주세요!',
    '투표하러 가기',
  ],
  registrationRestarted: [
    '함께 갈 장소를 다시 모으고 있어요 📍',
    '새롭게 장소를 등록하고 다시 골라봐요!',
    '장소 다시 등록하기',
  ],
} as const;
export type ShareKind = keyof typeof copy;
export interface ShareMessage {
  kind: ShareKind;
  title: string;
  description: string;
  buttonTitle: string;
  rows: Array<{ label: string; value: string }>;
  text: string;
  url: string;
  recipients: string[];
}
export function sharePurpose(kind: ShareKind): SharePurpose | null {
  if (kind === 'invite' || kind === 'meetingConfirmed' || kind === 'meetingChanged') return null;
  if (kind === 'hostRequest') return 'HOST';
  if (kind === 'finalResult') return 'RESULT';
  if (kind.startsWith('input')) return 'INPUT';
  if (kind.startsWith('voting')) return 'VOTING';
  return 'REGISTRATION';
}
export function assertShareStage(room: RoomState, kind: ShareKind) {
  const now = Date.parse(room.serverNow);
  const host = room.me.role === 'HOST';
  let valid: boolean;
  switch (sharePurpose(kind)) {
    case 'INPUT':
      valid =
        room.phase === 'WAITING_FOR_DEPARTURE' &&
        (!!room.startedAt ||
          room.allowedActions.includes('COMPLETE_INPUT') ||
          room.allowedActions.includes('EDIT_INPUT'));
      break;
    case 'HOST':
      valid =
        room.phase === 'WAITING_FOR_DEPARTURE' &&
        !host &&
        room.inputProgress.completedCount >=
          Math.max(2, Math.ceil(room.inputProgress.capacity / 2));
      break;
    case 'REGISTRATION':
      valid =
        room.phase === 'PLACE_SUBMISSION_OPEN' &&
        !!room.registration &&
        !room.registration.closedAt &&
        now < Date.parse(room.registration.closesAt);
      break;
    case 'VOTING':
      valid =
        room.phase === 'VOTING_OPEN' && !!room.voting && now < Date.parse(room.voting.closesAt);
      break;
    case 'RESULT':
      valid =
        room.phase === 'FINAL_PLACE_CONFIRMED' && !!room.result && room.result.confirmed !== false;
      break;
    default:
      valid =
        kind === 'invite'
          ? host && !!room.invite && now < Date.parse(room.invite.expiresAt)
          : room.phase === 'REGION_CONFIRMED' && !!room.meeting;
  }
  if (!valid) throw new Error('진행 단계가 바뀌었어요. 최신 화면에서 다시 공유해주세요.');
}
export function buildShareMessage(
  room: RoomState,
  kind: ShareKind,
  url: string,
  recipients: string[] = [],
): ShareMessage {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error('공유 링크를 확인할 수 없어요.');
  const [title, description, buttonTitle] = copy[kind];
  const rows: ShareMessage['rows'] = [{ label: '약속', value: room.title ?? '약속방' }];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value !== undefined && value !== null && String(value).length)
      rows.push({ label, value: String(value) });
  };
  const progress = (count: number, total: number, label: string) =>
    add(label, `${count} / ${total}명 ${label}`);
  const purpose = sharePurpose(kind);
  if (kind === 'invite') {
    add('후보 날짜', `${room.dates.from} ~ ${room.dates.through}`);
    progress(room.joinedCount, room.capacity, '참여 중');
    add('초대 코드', room.invite?.code);
  } else if (purpose === 'INPUT' || purpose === 'HOST')
    progress(room.inputProgress.completedCount, room.inputProgress.capacity, '입력 완료');
  else if (purpose === 'REGISTRATION' && room.registration) {
    progress(
      room.registration.progress.completedCount,
      room.registration.progress.capacity,
      '등록 완료',
    );
    add('등록 마감', seoulDateTime(room.registration.closesAt));
    if (kind === 'registrationRestarted') add('등록 회차', `${room.registration.round}회차`);
  } else if (purpose === 'VOTING' && room.voting) {
    progress(room.voting.progress.completedCount, room.voting.progress.capacity, '투표 완료');
    add('투표 마감', seoulDateTime(room.voting.closesAt));
  } else {
    const meeting = meetingDetails({
      ...room,
      meeting: kind === 'finalResult' ? (room.result?.meeting ?? room.meeting) : room.meeting,
    });
    add('일시', meeting?.dateTime);
    add('만날 역', meeting?.area);
    if (kind === 'finalResult' && room.result) {
      const byId = new Map(room.result.selected.map((item) => [item.candidateId, item]));
      room.result.visitOrder.forEach((id, i) => add(`${i + 1}번째 장소`, byId.get(id)?.place.name));
    }
  }
  const raw = `[Meetdle] ${title}\n${description}\n\n${rows.map((row) => `${row.label}: ${row.value}`).join('\n')}`;
  let text = raw;
  if (raw.length > 200) {
    text = '';
    for (const char of raw) {
      if (text.length + char.length > 199) break;
      text += char;
    }
    text += '…';
  }
  return { kind, title, description, buttonTitle, rows, text, url: parsed.href, recipients };
}
