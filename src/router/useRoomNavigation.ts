import { useLocation, useNavigate, type NavigateOptions } from 'react-router';
import { roomPath } from './paths';

export function useRoomNavigation() {
  const navigate = useNavigate();
  const { search } = useLocation();
  return (path: string, options?: NavigateOptions) => navigate(roomPath(path, search), options);
}

export function useRoomLink() {
  const { search } = useLocation();
  return (path: string) => roomPath(path, search);
}
