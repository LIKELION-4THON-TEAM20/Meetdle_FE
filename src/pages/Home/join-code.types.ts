// 실제 입장 API의 응답을 화면 상태로 변환하는 연결 지점.
export type JoinCodeResult =
  | 'invalid-code'
  | { status: 'error'; message: string }
  | { status: 'room-full'; capacity: number }
  | void;
export type JoinByCodeHandler = (code: string) => Promise<JoinCodeResult>;
