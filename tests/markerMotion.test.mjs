import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
const { createMarkerMotion } = await server.ssrLoadModule('/src/lib/kakaoMaps/markerMotion.ts');
after(() => server.close());
function setup(reducedMotion = false) {
  let time = 0,
    next = 0;
  const pending = new Map();
  const images = [];
  const clock = {
    now: () => time,
    reducedMotion,
    request(cb) {
      pending.set(++next, cb);
      return next;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
  const maps = {
    MarkerImage: class {
      constructor(url, size, options) {
        Object.assign(this, { url, size, options });
      }
    },
    Size: class {
      constructor(width, height) {
        Object.assign(this, { width, height });
      }
    },
    Point: class {
      constructor(x, y) {
        Object.assign(this, { x, y });
      }
    },
  };
  const marker = {
    setImage(image) {
      images.push(image);
    },
  };
  const motion = createMarkerMotion(maps, marker, 'gray', 'purple', clock);
  return {
    motion,
    images,
    pending,
    step(ms) {
      time += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const cb of callbacks) cb(time);
    },
  };
}
test('핀은 중간 크기를 거쳐 확대·축소하며 끝점 앵커를 유지한다', () => {
  const s = setup();
  s.motion.update(true, false);
  s.step(80);
  let image = s.images.at(-1);
  assert.ok(image.size.width > 20 && image.size.width < 30);
  assert.equal(image.options.offset.y, image.size.height);
  assert.equal(image.options.offset.x, image.size.width / 2);
  s.step(180);
  assert.equal(s.images.at(-1).size.width, 30);
  s.motion.update(false, false);
  s.step(100);
  assert.ok(s.images.at(-1).size.width > 20 && s.images.at(-1).size.width < 30);
  s.step(160);
  assert.equal(s.images.at(-1).size.width, 20);
});
test('빠르게 다시 선택하면 현재 크기에서 이어가고 등록 색상은 확대 상태를 보존한다', () => {
  const s = setup();
  s.motion.update(true, false);
  s.step(60);
  const current = s.images.at(-1).size.width;
  s.motion.update(false, false);
  s.step(30);
  assert.ok(s.images.at(-1).size.width < current);
  s.motion.update(true, true);
  assert.equal(s.images.at(-1).url, 'purple');
  s.step(260);
  assert.equal(s.images.at(-1).size.width, 30);
  s.motion.update(false, true);
  assert.equal(s.pending.size, 1);
  s.motion.dispose();
  assert.equal(s.pending.size, 0);
});
test('모션 줄이기 설정은 애니메이션을 생략한다', () => {
  const s = setup(true);
  s.motion.update(true, true);
  assert.equal(s.images.at(-1).size.width, 30);
  assert.equal(s.images.at(-1).url, 'purple');
  assert.equal(s.pending.size, 0);
});
