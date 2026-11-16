import { useLocation, useNavigate, type NavigateOptions } from 'react-router';
import { getRoomBackPath, roomPath } from './paths';

export function useRoomNavigation() {
  const navigate = useNavigate();
  const { search } = useLocation();
  return (path: string, options?: NavigateOptions) => navigate(roomPath(path, search), options);
}

export function useRoomLink() {
  const { search } = useLocation();
  return (path: string) => roomPath(path, search);
}

export function useRoomBack(fallback: string) {
  const { search } = useLocation();
  const navigate = useRoomNavigation();
  return () => navigate(getRoomBackPath(fallback, search));
}
