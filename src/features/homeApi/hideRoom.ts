import { getSession } from '../../api/auth';
import { ApiRequestError } from '../../api/client';
import { isServerRoomId, roomMutations } from '../../api/rooms';
import type { SessionResponse } from '../../api/types';

export function createRoomHider(
  owner: SessionResponse,
  dependencies = {
    getSession,
    hide: roomMutations.hidePastRoom,
  },
) {
  const handles = new Map<string, ReturnType<typeof roomMutations.hidePastRoom>>();
  const pending = new Map<string, Promise<void>>();
  let disposed = false;
  async function assertOwner() {
    const current = await dependencies.getSession();
    if (
      disposed ||
      current.user.userId !== owner.user.userId ||
      current.csrfToken !== owner.csrfToken
    )
      throw new ApiRequestError(null, { code: 'SESSION_CHANGED', message: 'Session changed' });
  }
  return {
    hide(roomId: string): Promise<void> {
      if (!isServerRoomId(roomId))
        return Promise.reject(new TypeError('Expected server room UUID'));
      const running = pending.get(roomId);
      if (running) return running;
      const request = (async () => {
        await assertOwner();
        let handle = handles.get(roomId);
        if (!handle) {
          handle = dependencies.hide(roomId);
          handles.set(roomId, handle);
        }
        await handle.execute();
        await assertOwner();
      })().finally(() => pending.delete(roomId));
      pending.set(roomId, request);
      return request;
    },
    dispose() {
      disposed = true;
      handles.clear();
    },
  };
}
