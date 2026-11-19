import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
const { registrationBlock, missingRequiredCategories, statusPreview, isExplorationStatusPreview } =
  await server.ssrLoadModule('/src/pages/PlaceExploration/placeUtils.ts');
const { createPlaceMap } = await server.ssrLoadModule('/src/lib/kakaoMaps/controller.ts');
const { attemptKakaoPlace, safeKakaoMapUrl, isMobileBrowser } = await server.ssrLoadModule(
  '/src/lib/kakaoMaps/placeLink.ts',
);
const { default: PlaceCard } = await server.ssrLoadModule(
  '/src/pages/PlaceExploration/components/ExplorationPlaceCard.tsx',
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
  assert.equal(response.participants.filter((p) => p.status === 'completed').length, 3);
  const completed = await repo.complete(initial.roomId, signal());
  assert.equal(completed.participants.filter((p) => p.status === 'completed').length, 4);
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
    getProjection() {
      return {
        containerPointFromCoords: (coords) => ({
          x: 167.5 + ((coords.getLng() - this.center.getLng()) * 10000) / 2 ** (this.level - 6),
          y: 209.5 - ((coords.getLat() - this.center.getLat()) * 10000) / 2 ** (this.level - 6),
        }),
      };
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
      this.bounds = {
        circle: this,
        getSouthWest: () =>
          new LatLng(options.center.getLat() - 0.025, options.center.getLng() - 0.025),
        getNorthEast: () =>
          new LatLng(options.center.getLat() + 0.025, options.center.getLng() + 0.025),
      };
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
  const makeElement = () => ({
    style: {},
    children: [],
    setAttribute() {},
    append(child) {
      this.children.push(child);
    },
    remove() {
      this.removed = true;
    },
  });
  const parent = makeElement();
  const node = {
    clientWidth: 335,
    clientHeight: 430,
    parentElement: parent,
    ownerDocument: { createElement: makeElement },
    replaceChildren() {
      this.cleared = true;
    },
  };
  const controller = createPlaceMap(maps, node, snapshot.area, (id) => (selected = id));
  assert.equal(log.maps.length, 1);
  assert.equal(log.circles[0].options.radius, 2500);
  assert.equal(log.circles[0].options.center.getLat(), snapshot.area.center.latitude);
  assert.equal(log.bounds[0].bounds, log.circles[0].getBounds());
  assert.deepEqual(log.bounds[0].padding, [12, 12, 12, 12]);
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
  assert.match(decodeURIComponent(first.image.url), /#ABA9B2/i);
  assert.equal(first.image.size.width, 30);
  assert.equal(first.image.options.offset.y, first.image.size.height);
  controller.update(snapshot.recommendations, selected, [selected]);
  assert.match(decodeURIComponent(first.image.url), /#7C5CFF/i);
  assert.equal(first.image.size.width, 30);
  controller.update(snapshot.recommendations, null, [selected]);
  assert.equal(first.image.size.width, 20);
  assert.match(decodeURIComponent(first.image.url), /#7C5CFF/i);
  const cafe = snapshot.recommendations.find((place) => place.categoryId === 'cafe');
  controller.update(snapshot.recommendations, cafe.id, [selected]);
  const cafeMarker = log.markers.find((entry) => entry.options.title === cafe.name);
  assert.match(decodeURIComponent(cafeMarker.image.url), /#ABA9B2/i);
  assert.equal(cafeMarker.image.size.width, 30);
  controller.update(snapshot.recommendations, cafe.id, [cafe.id]);
  assert.match(decodeURIComponent(cafeMarker.image.url), /#7C5CFF/i);
  const shade = parent.children[0];
  const tile = shade.children[0];
  assert.match(decodeURIComponent(tile.children[0].src), /#EEEEF0/);
  const beforeTransform = tile.style.transform;
  log.maps[0].setLevel(8);
  assert.equal(log.listeners.get(log.maps[0])?.has('bounds_changed') ?? false, false);
  assert.equal(tile.style.transform, beforeTransform);
  log.maps[0].setLevel(10);
  assert.equal(log.circles[0].options.fillOpacity, 0);
  controller.resize();
  assert.equal(log.maps[0].getCenter().getLng(), 128);
  assert.equal(log.maps[0].getLevel(), 10);
  assert.equal(tile.style.transform, beforeTransform);
  controller.fit();
  assert.equal(log.bounds.at(-1).bounds, log.circles[0].getBounds());
  assert.equal(log.circles[0].options.radius, 2500);
  controller.dispose();
  assert.equal(log.circles[0].map, null);
  assert.equal(node.cleared, true);
  assert.equal(shade.removed, true);
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

test('completion requires the current user to register every required category', async () => {
  const initial = createExplorationMock(Date.now());
  const repo = createMockExplorationRepository(initial);
  assert.deepEqual(
    missingRequiredCategories(initial).map((item) => item.id),
    ['cafe'],
  );
  await assert.rejects(repo.complete(initial.roomId, signal()), /필수 카테고리/);
  await repo.register({ roomId: initial.roomId, placeId: 'cafe-a' }, signal());
  const completed = await repo.complete(initial.roomId, signal());
  assert.deepEqual(missingRequiredCategories(completed), []);
  assert.equal(
    completed.participants.find((p) => p.id === completed.currentUserId).status,
    'completed',
  );
  assert.equal(completed.registrations.length, 2);
});

test('completion rejects a closed room or wrong room without changing participant status', async () => {
  const initial = createExplorationMock(Date.now());
  const repo = createMockExplorationRepository(initial, 'closed');
  await assert.rejects(repo.complete('wrong-room', signal()), /약속방/);
  await assert.rejects(repo.complete(initial.roomId, signal()), /마감/);
  assert.equal(
    (await repo.load(signal())).participants.filter((p) => p.status === 'completed').length,
    3,
  );
});

test('place cards keep Kakao navigation separate and disable registration for already registered places', () => {
  const place = createExplorationMock(now).recommendations[0];
  const render = (registered) =>
    renderToStaticMarkup(
      createElement(PlaceCard, {
        place,
        categoryLabel: '식당',
        blocked: registered ? '이미 등록한 장소예요.' : null,
        pending: false,
        registered,
        onRegister() {},
      }),
    );
  const available = render(false);
  assert.match(available, /역에서 320m/);
  assert.match(available, /카카오맵 바로가기/);
  assert.doesNotMatch(available, /disabled=""/);
  const registered = render(true);
  assert.match(registered, /disabled=""/);
  assert.match(registered, /이미 등록한 장소/);
  assert.match(registered, /<a[^>]+href="https:\/\/map.kakao.com/);
});
