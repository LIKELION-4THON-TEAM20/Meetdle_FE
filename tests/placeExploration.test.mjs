import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const { createExplorationMock } = await server.ssrLoadModule(
  '/src/pages/PlaceExploration/mockData.ts',
);
const { createMockExplorationRepository } = await server.ssrLoadModule(
  '/src/pages/PlaceExploration/mockRepository.ts',
);
const { registrationBlock, statusPreview, isExplorationStatusPreview } = await server.ssrLoadModule(
  '/src/pages/PlaceExploration/placeUtils.ts',
);
const { createPlaceMap } = await server.ssrLoadModule('/src/lib/kakaoMaps/controller.ts');
const { attemptKakaoPlace, safeKakaoMapUrl, isMobileBrowser } = await server.ssrLoadModule(
  '/src/lib/kakaoMaps/placeLink.ts',
);
const now = Date.now();
const signal = () => new AbortController().signal;

test('registration limits use the current user/category, not other participants, selection, or map viewport', () => {
  const snapshot = createExplorationMock(now);
  const cafe = snapshot.recommendations.find((p) => p.categoryId === 'cafe');
  const restaurant = snapshot.recommendations.find((p) => p.id === 'restaurant-b');
  assert.equal(registrationBlock(snapshot, cafe, now), null);
  assert.match(registrationBlock(snapshot, restaurant, now), /카테고리마다/);
  snapshot.registrations.push({
    id: 'other',
    userId: 'other',
    placeId: cafe.id,
    categoryId: cafe.categoryId,
  });
  assert.equal(registrationBlock(snapshot, cafe, now), null);
  assert.match(registrationBlock(snapshot, { ...cafe, eligible: false }, now), /범위를 벗어난/);
  assert.match(registrationBlock(snapshot, cafe, snapshot.deadline), /마감/);
});

test('mock failure preserves records and a retry updates place count independently of completed participants', async () => {
  const initial = createExplorationMock(now);
  const repo = createMockExplorationRepository(initial, 'registerError');
  const request = { roomId: initial.roomId, placeId: 'cafe-a' };
  await assert.rejects(repo.register(request, signal()), /목 등록 요청에 실패/);
  assert.equal((await repo.load(signal())).registrations.length, 1);
  const response = await repo.register(request, signal());
  assert.equal(response.source, 'mock');
  assert.equal(response.registeredPlaceCount, 9);
  assert.equal(response.registrations.filter((r) => r.userId === response.currentUserId).length, 2);
  assert.equal(response.participants.filter((p) => p.status === 'completed').length, 4);
  assert.equal(initial.registeredPlaceCount, 8);
  assert.equal(initial.registrations.length, 1);
  await assert.rejects(repo.register(request, signal()), /이미 등록/);
  assert.equal(isExplorationStatusPreview(statusPreview(response)), true);
});

test('aborted requests, loading retries and server-provided expanded areas never manufacture registrations', async () => {
  const repo = createMockExplorationRepository(createExplorationMock(now), 'loadError');
  await assert.rejects(repo.load(signal()));
  assert.equal((await repo.load(signal())).source, 'mock');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(repo.register({ roomId: 'x', placeId: 'x' }, controller.signal), {
    name: 'AbortError',
  });
  const expanded = await createMockExplorationRepository(
    createExplorationMock(now),
    'expanded',
  ).load(signal());
  assert.equal(expanded.area.radiusMeters, 3000);
  assert.equal(expanded.registrations.length, 1);
});

function sdkFixture() {
  const log = {
    maps: [],
    circles: [],
    markers: [],
    listeners: new globalThis.Map(),
    bounds: [],
    removed: 0,
  };
  class LatLng {
    constructor(lat, lng) {
      this.lat = lat;
      this.lng = lng;
    }
    getLat() {
      return this.lat;
    }
    getLng() {
      return this.lng;
    }
  }
  class Map {
    constructor(node, options) {
      this.center = options.center;
      this.level = options.level;
      log.maps.push(this);
    }
    setBounds(bounds, ...padding) {
      log.bounds.push({ bounds, padding });
      this.center = new LatLng(0, 0);
      this.level = 6;
    }
    getCenter() {
      return this.center;
    }
    setCenter(value) {
      this.center = value;
    }
    getLevel() {
      return this.level;
    }
    setLevel(value) {
      this.level = value;
    }
    relayout() {
      this.relayoutCalls = (this.relayoutCalls ?? 0) + 1;
    }
    addControl() {}
    removeControl() {
      log.removed++;
    }
    setDraggable() {}
    setZoomable() {}
    setKeyboardShortcuts() {}
  }
  class Circle {
    constructor(options) {
      this.options = options;
      this.bounds = { circle: this };
      log.circles.push(this);
    }
    getBounds() {
      return this.bounds;
    }
    setMap(map) {
      this.map = map;
    }
  }
  class Marker {
    constructor(options) {
      this.options = options;
      log.markers.push(this);
    }
    setMap(map) {
      this.map = map;
    }
    setImage(image) {
      this.image = image;
    }
    setZIndex(z) {
      this.z = z;
    }
  }
  class MarkerImage {
    constructor(url, size, options) {
      Object.assign(this, { url, size, options });
    }
  }
  class Size {
    constructor(width, height) {
      Object.assign(this, { width, height });
    }
  }
  class Point {
    constructor(x, y) {
      Object.assign(this, { x, y });
    }
  }
  class MarkerClusterer {
    constructor() {
      this.markers = [];
    }
    addMarkers(markers) {
      this.markers = markers;
    }
    clear() {
      this.markers.forEach((m) => m.setMap(null));
      this.markers = [];
    }
  }
  const event = {
    addListener(target, name, callback) {
      const events = log.listeners.get(target) ?? new globalThis.Map();
      events.set(name, callback);
      log.listeners.set(target, events);
    },
    removeListener(target, name) {
      log.listeners.get(target)?.delete(name);
    },
  };
  return {
    log,
    maps: {
      LatLng,
      Map,
      Circle,
      Marker,
      MarkerImage,
      Size,
      Point,
      MarkerClusterer,
      ZoomControl: class {},
      ControlPosition: { RIGHT: 1 },
      event,
    },
  };
}

test('SDK contract: Circle uses backend coordinates/meters; reset fits bounds and cleanup removes overlays/listeners', () => {
  const { log, maps } = sdkFixture();
  const snapshot = createExplorationMock(now);
  let selected = null;
  const node = {
    replaceChildren() {
      this.cleared = true;
    },
  };
  const controller = createPlaceMap(maps, node, snapshot.area, (id) => (selected = id));
  assert.equal(log.maps.length, 1);
  assert.equal(log.circles[0].options.radius, 2500);
  assert.equal(log.circles[0].options.center.getLat(), snapshot.area.center.latitude);
  assert.equal(log.bounds[0].bounds, log.circles[0].getBounds());
  assert.deepEqual(log.bounds[0].padding, [36, 36, 36, 36]);
  controller.update(snapshot.recommendations, null);
  const first = log.markers[0];
  log.listeners.get(first).get('click')();
  assert.equal(selected, snapshot.recommendations[0].id);
  log.maps[0].setCenter(new maps.LatLng(37, 128));
  log.maps[0].setLevel(10);
  const before = log.bounds.length;
  controller.update(snapshot.recommendations, selected);
  assert.equal(log.maps.length, 1);
  assert.equal(log.bounds.length, before);
  assert.equal(first.z, 10);
  controller.resize();
  assert.equal(log.maps[0].getCenter().getLng(), 128);
  assert.equal(log.maps[0].getLevel(), 10);
  controller.fit();
  assert.equal(log.bounds.at(-1).bounds, log.circles[0].getBounds());
  assert.equal(log.circles[0].options.radius, 2500);
  controller.dispose();
  assert.equal(log.circles[0].map, null);
  assert.equal(node.cleared, true);
  assert.equal(log.removed, 1);
  assert(log.markers.every((m) => m.map === null));
  assert([...log.listeners.values()].every((m) => m.size === 0));
});

test('Kakao links use provided web URLs and mobile capability rather than internal IDs', () => {
  assert.equal(safeKakaoMapUrl('javascript:alert(1)'), null);
  assert.equal(safeKakaoMapUrl('https://other.invalid/1'), null);
  assert.equal(
    safeKakaoMapUrl('https://place.map.kakao.com/18577297'),
    'https://place.map.kakao.com/18577297',
  );
  assert.equal(
    isMobileBrowser({ userAgent: 'Mozilla Android', platform: 'Linux', maxTouchPoints: 1 }),
    true,
  );
  assert.equal(
    isMobileBrowser({ userAgent: 'Mozilla Mac', platform: 'MacIntel', maxTouchPoints: 5 }),
    true,
  );
  assert.equal(
    isMobileBrowser({ userAgent: 'Mozilla Mac', platform: 'MacIntel', maxTouchPoints: 0 }),
    false,
  );
});

test('app fallback cancels on visibility/pagehide/unmount and falls back only while visible', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new EventTarget();
  document.visibilityState = 'visible';
  const window = new EventTarget();
  const navigations = [];
  window.location = { assign: (url) => navigations.push(url) };
  attemptKakaoPlace('18577297', 'https://place.map.kakao.com/18577297', { document, window });
  assert.equal(navigations[0], 'kakaomap://place?id=18577297');
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(2000);
  assert.equal(navigations.length, 1);
  document.visibilityState = 'visible';
  attemptKakaoPlace('18577297', 'https://place.map.kakao.com/18577297', { document, window });
  window.dispatchEvent(new Event('pagehide'));
  t.mock.timers.tick(2000);
  assert.equal(navigations.length, 2);
  const cancel = attemptKakaoPlace('18577297', 'https://place.map.kakao.com/18577297', {
    document,
    window,
  });
  cancel();
  t.mock.timers.tick(2000);
  assert.equal(navigations.length, 3);
  attemptKakaoPlace('18577297', 'https://place.map.kakao.com/18577297', { document, window });
  t.mock.timers.tick(1500);
  assert.equal(navigations.at(-1), 'https://place.map.kakao.com/18577297');
});
