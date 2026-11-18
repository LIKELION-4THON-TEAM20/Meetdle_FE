import { isCreateRoomState, type CreateRoomState } from '../../pages/CreateRoom/createRoomState';
import { MOCK_CREATED_ROOM } from '../../pages/RoomCreated/mockData';

export const CREATED_ROOM_STORAGE_KEY = 'meetdle:development-created-rooms:v1';
export const CREATED_ROOM_PREVIEW_ID = 'mock-created-preview';
export interface CreatedRoomPreview {
  id: string;
  inviteCode: string;
  creation: CreateRoomState;
}
const memory = new Map<string, CreatedRoomPreview>();
const PREVIEW: CreatedRoomPreview = {
  id: CREATED_ROOM_PREVIEW_ID,
  inviteCode: MOCK_CREATED_ROOM.inviteCode,
  creation: {
    name: MOCK_CREATED_ROOM.meeting.name,
    capacity: MOCK_CREATED_ROOM.meeting.capacity,
    dateRange: { start: '2026-11-14', end: '2026-11-17' },
  },
};

function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function isPreview(value: unknown): value is CreatedRoomPreview {
  if (!value || typeof value !== 'object') return false;
  const item = value as CreatedRoomPreview;
  return (
    typeof item.id === 'string' &&
    /^mock-created-[\w-]+$/.test(item.id) &&
    typeof item.inviteCode === 'string' &&
    /^[A-Z0-9]{6}$/.test(item.inviteCode) &&
    isCreateRoomState(item.creation)
  );
}

export function getCreatedRooms(): CreatedRoomPreview[] {
  try {
    const saved: unknown = JSON.parse(storage()?.getItem(CREATED_ROOM_STORAGE_KEY) ?? '[]');
    if (Array.isArray(saved))
      for (const item of saved) if (isPreview(item)) memory.set(item.id, item);
  } catch {
    /* 저장소가 차단되어도 현재 탭의 메모리 상태를 사용한다. */
  }
  return [...memory.values()];
}

export function getCreatedRoom(id: string | null): CreatedRoomPreview | undefined {
  return !id || id === PREVIEW.id ? PREVIEW : getCreatedRooms().find((room) => room.id === id);
}

export function findCreatedRoomByCode(code: string): CreatedRoomPreview | undefined {
  return [PREVIEW, ...getCreatedRooms()].find((room) => room.inviteCode === code);
}

export function createRoomPreview(creation: CreateRoomState): CreatedRoomPreview {
  if (!isCreateRoomState(creation)) throw new Error('유효하지 않은 생성 입력입니다.');
  const known = getCreatedRooms();
  let room: CreatedRoomPreview;
  do {
    const id = globalThis.crypto.randomUUID();
    room = {
      id: `mock-created-${id}`,
      inviteCode: id.replaceAll('-', '').slice(0, 6).toUpperCase(),
      creation: structuredClone(creation),
    };
  } while (
    known.some((value) => value.inviteCode === room.inviteCode) ||
    room.inviteCode === PREVIEW.inviteCode
  );
  memory.set(room.id, room);
  try {
    storage()?.setItem(CREATED_ROOM_STORAGE_KEY, JSON.stringify([...memory.values()]));
  } catch {
    /* 메모리로 계속 사용한다. */
  }
  return room;
}
