import { createContext, useContext } from 'react';
import type { Action, MockRoom } from './model';

export const MockRoomContext = createContext<{
  room: MockRoom;
  send: (action: Action) => boolean;
  isolated: boolean;
} | null>(null);

export function useMockRoom() {
  const context = useContext(MockRoomContext);
  if (!context) throw new Error('MockRoomProvider is required for SCREEN 10–14');
  return context;
}
