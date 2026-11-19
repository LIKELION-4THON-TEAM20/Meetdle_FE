import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../../components/common/Button/Button';
import Toast, { type ToastMessage } from '../../components/common/Toast/Toast';
import type { RoomState } from '../../api/types';
import { toUiCategory } from '../../api/mappers';
import { prepareKakaoShare, shareKakaoText } from '../../features/serverRoom/kakaoInviteShare';
import {
  meetingActions,
  meetingDetails,
  meetingShareText,
  seoulDateTime,
} from '../../features/serverRoom/meeting';
import { roomScreen, serverScreenUrl } from '../../features/serverRoom/routing';
import { PATHS } from '../../router/paths';
import MeetingConfirmationLayout from './components/MeetingConfirmationLayout';
import '../MeetingInfo/MeetingInfo.scss';

const categoryNames = { restaurant: '음식점', cafe: '카페', culture: '문화시설', pub: '술집' };

export default function ServerMeeting({
  room,
  now,
  confirmation,
}: {
  room: RoomState;
  now: number;
  confirmation: boolean;
}) {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<ToastMessage | null>(null);
  const sharing = useRef<AbortController | null>(null);
  const meeting = meetingDetails(room);
  const payload = meetingShareText(room);
  const shareAvailable = confirmation && payload !== null;
  const actions = meetingActions(room, now);
  const registration = room.registration;

  useEffect(() => {
    if (shareAvailable) void prepareKakaoShare().catch(() => undefined);
    return () => sharing.current?.abort();
  }, [shareAvailable]);

  async function share() {
    if (!payload || (sharing.current && !sharing.current.signal.aborted)) return;
    const request = new AbortController();
    sharing.current = request;
    try {
      await shareKakaoText(payload.text, payload.url, request.signal);
    } catch {
      if (!request.signal.aborted) {
        setNotice({
          tone: 'error',
          title: '카카오톡 공유를 열지 못했어요.',
          description: '잠시 후 다시 시도해주세요.',
        });
      }
    } finally {
      if (sharing.current === request) sharing.current = null;
    }
  }

  if (!meeting || !room.meeting) return null;
  const selectionId = room.meeting.selectionId;
  const link = (path: string) => serverScreenUrl(path, room.roomId, selectionId);
  const stage = roomScreen(room);
  const progressPath = stage === PATHS.info ? PATHS.registration : stage;
  const registrationDeadline = registration && seoulDateTime(registration.closesAt);

  return (
    <MeetingConfirmationLayout
      meeting={meeting}
      onBack={() => navigate(PATHS.home)}
      details={
        <section className="meeting-info__summary" aria-label="약속방 정보">
          <h3>{room.title ?? '약속방'}</h3>
          <p>
            참여 {room.joinedCount} / {room.capacity}명
          </p>
          {!!room.members?.length && (
            <p>{room.members.map(({ nickname }) => nickname).join(', ')}</p>
          )}
        </section>
      }
    >
      {confirmation ? (
        <footer className="meeting-confirmed__footer">
          {actions.canSetup && (
            <Button
              className="meeting-confirmed__action"
              onClick={() => navigate(link(PATHS.setup))}
            >
              장소 등록 설정하기
            </Button>
          )}
          {actions.canReselect && <Link to={link(PATHS.candidates)}>일시·지역 다시 선택하기</Link>}
          <Button
            variant="secondary"
            className="meeting-confirmed__action meeting-confirmed__action--outline"
            disabled={!payload}
            onClick={() => void share()}
          >
            카카오톡으로 공유하기
          </Button>
        </footer>
      ) : (
        <footer
          className={`meeting-info__footer${actions.open ? '' : ' meeting-info__footer--divider'}`}
        >
          <section className="meeting-info__summary" aria-label="약속 요약">
            <h3>{meeting.dateTime}</h3>
            <p>
              {meeting.area} · 참여 {room.joinedCount} / {room.capacity}명
            </p>
          </section>
          {actions.beforeRegistration ? (
            <>
              <p className="meeting-info__notice meeting-info__notice--waiting">
                아직 장소 후보를 모으기 전이에요.
              </p>
              {actions.canSetup && (
                <Button
                  className="meeting-confirmed__action"
                  onClick={() => navigate(link(PATHS.setup))}
                >
                  장소 등록 설정하기
                </Button>
              )}
              {actions.canReselect && (
                <Link to={link(PATHS.candidates)}>일시·지역 다시 선택하기</Link>
              )}
            </>
          ) : (
            <>
              {registrationDeadline && (
                <p className="meeting-info__notice">등록 마감 {registrationDeadline}</p>
              )}
              {!!registration?.categories.length && (
                <ul aria-label="장소 등록 카테고리">
                  {registration.categories.map((category) => (
                    <li key={category.category}>
                      {categoryNames[toUiCategory[category.category]]} ·{' '}
                      {category.required ? '필수' : '선택'}
                      {category.available ? '' : ' · 등록 불가'}
                    </li>
                  ))}
                </ul>
              )}
              <p className="meeting-info__notice">
                {actions.open
                  ? registration?.myCompleted
                    ? '장소 등록을 완료했어요.'
                    : actions.canRegister
                      ? '장소 등록이 시작되었어요. 가고 싶은 곳을 등록해주세요.'
                      : '현재 장소를 등록할 수 없어요.'
                  : '장소 등록이 마감됐어요.'}
              </p>
              {actions.canRegister ? (
                <Button
                  className="meeting-confirmed__action"
                  onClick={() => navigate(link(PATHS.places))}
                >
                  가고 싶은 장소 등록하기
                </Button>
              ) : (
                <Link to={link(progressPath)}>현재 진행 상황 확인하기</Link>
              )}
            </>
          )}
        </footer>
      )}
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </MeetingConfirmationLayout>
  );
}
