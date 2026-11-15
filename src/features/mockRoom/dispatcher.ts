import { reduceRoom, type Action, type MockRoom } from './model';

// Advance synchronously so commands in the same React batch share the latest state.
export function createRoomDispatcher(initial: MockRoom, onChange: (room: MockRoom) => void) {
  let current = initial;
  return (action: Action) => {
    const next = reduceRoom(current, action);
    if (next === current) return false;
    current = next;
    onChange(next);
    return true;
  };
}
