import type { KakaoMaps, Marker } from './types';

interface MotionClock {
  request?: (callback: FrameRequestCallback) => number;
  cancel?: (id: number) => void;
  now: () => number;
  reducedMotion: boolean;
}

export function createMarkerMotion(
  maps: KakaoMaps,
  marker: Marker,
  normal: string,
  registered: string,
  clock: MotionClock = {
    request: globalThis.requestAnimationFrame?.bind(globalThis),
    cancel: globalThis.cancelAnimationFrame?.bind(globalThis),
    now: () => performance.now(),
    reducedMotion:
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
) {
  let width = 20;
  let target = 20;
  let purple = false;
  let frame: number | undefined;
  let disposed = false;
  const paint = () => {
    const height = width * 1.5698;
    marker.setImage(
      new maps.MarkerImage(purple ? registered : normal, new maps.Size(width, height), {
        offset: new maps.Point(width / 2, height),
      }),
    );
  };
  const cancel = () => {
    if (frame !== undefined) clock.cancel?.(frame);
    frame = undefined;
  };
  return {
    update(selected: boolean, isRegistered: boolean) {
      if (disposed) return;
      if (purple !== isRegistered) {
        purple = isRegistered;
        paint();
      }
      const next = selected ? 30 : 20;
      if (next === target) return;
      cancel();
      target = next;
      if (clock.reducedMotion || !clock.request) {
        width = target;
        paint();
        return;
      }
      const from = width;
      const start = clock.now();
      const tick: FrameRequestCallback = (time) => {
        if (disposed) return;
        const progress = Math.min(1, Math.max(0, (time - start) / 260));
        const eased = 1 - (1 - progress) ** 3;
        width = from + (target - from) * eased;
        paint();
        frame = progress < 1 ? clock.request!(tick) : undefined;
      };
      frame = clock.request(tick);
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
