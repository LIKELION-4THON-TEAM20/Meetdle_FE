import type { ScheduleRoom, Station } from './types';

export const MOCK_SCHEDULE_ROOM: ScheduleRoom = {
  id: 'schedule-preview-room',
  candidateDates: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'],
};

// 검색 UI 검증용 부분 목록이며, 전체 역 목록/API가 아니다.
export const MOCK_STATIONS: readonly Station[] = [
  {
    id: 'nowon',
    name: '노원역',
    lines: [
      { id: '4', name: '4호선' },
      { id: '7', name: '7호선' },
    ],
  },
  {
    id: 'sangbong',
    name: '상봉역',
    lines: [
      { id: 'gyeongchun', name: '경춘선' },
      { id: 'gyeongui-jungang', name: '경의중앙선' },
      { id: '7', name: '7호선' },
    ],
  },
  { id: 'gimyujeong', name: '김유정역', lines: [{ id: 'gyeongchun', name: '경춘선' }] },
];
