import { useEffect } from 'react';
import { useParams } from 'react-router';
import ServerRoomStatus from '../features/serverRoom/RoomStatus';
import { clearMatchingLoginReturn } from '../features/auth/loginReturn';

export default function ServerRoomRoute() {
  const { roomId = '' } = useParams();
  useEffect(() => {
    try {
      clearMatchingLoginReturn(sessionStorage, `/rooms/${roomId}`);
    } catch {
      /* Storage can be unavailable. */
    }
  }, [roomId]);
  return <ServerRoomStatus />;
}
