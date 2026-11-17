import { useState } from 'react';
import { useNavigate } from 'react-router';
import Home from '../pages/Home/Home';
import { MOCK_APPOINTMENTS } from '../pages/Home/appointments.mock';
import type { Appointment } from '../pages/Home/appointment.types';
import { getCreatedRooms } from '../features/createdRoom/model';
import { createMockRoom, restoreRoom } from '../features/mockRoom/model';
import { getMockRoomEntryPath } from './roomEntryPath';
import { PATHS, roomPath } from './paths';

export default function HomeRoute() {
  const navigate = useNavigate();
  const [appointments] = useState<Appointment[]>(() => {
    let room;
    try {
      room = restoreRoom(sessionStorage, Date.now());
    } catch {
      room = createMockRoom(Date.now());
    }
    const stagePath = getMockRoomEntryPath(room);
    return [
      ...getCreatedRooms().map((created): Appointment => ({
        id: created.id,
        name: created.creation.name,
        status: 'in-progress',
        date: created.creation.dateRange.start,
        participants: [{ id: 'mock-host', name: '방장 (목)', imageUrl: null }],
        badgeLabel: '미확정 (목)',
        entryPath: roomPath(`${PATHS.created}?from=home`, '', created.id),
      })),
      {
        id: room.id,
        name: room.name,
        status: 'in-progress',
        date: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(room.meetingAt),
        participants: room.participants.map(({ id, name }) => ({ id, name, imageUrl: null })),
        badgeLabel: '개발용 목',
        entryPath: roomPath(`${stagePath}?from=home`, '', room.id),
      },
      ...MOCK_APPOINTMENTS,
    ];
  });
  return (
    <Home
      appointments={appointments}
      onJoinByCode={async (code) => {
        // 조회/참여 성공으로 처리하지 않고 초대 확인 화면으로만 이동한다.
        navigate(`${PATHS.invitation}?code=${encodeURIComponent(code)}`);
      }}
    />
  );
}
