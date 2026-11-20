import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const server = await createServer({
  envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
after(() => server.close());
const { serverRoomId, ROOM_SCREENS } = await server.ssrLoadModule('/src/router/roomRoutes.ts');
const { default: Home } = await server.ssrLoadModule('/src/pages/Home/Home.tsx');
const { MemoryRouter } = await server.ssrLoadModule('react-router');
const render = (component, path) =>
  renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [path] }, createElement(component)),
  );
test('API 화면은 실제 UUID만 허용하며 목 ID·역할·시나리오로 방을 만들지 않는다', () => {
  for (const search of [
    '',
    '?roomId=mock-created-preview',
    '?roomId=mock-room-10-14&scenario=default',
    '?mode=api&roomId=invalid',
  ])
    assert.equal(serverRoomId(search), null);
  const id = '01234567-89ab-4cde-8f01-23456789abcd';
  assert.equal(serverRoomId('?roomId=' + id + '&role=host&scenario=default'), id);
  for (const path of [
    '/rooms/places',
    '/rooms/schedule-transit',
    '/rooms/candidates',
    '/rooms/vote/result',
  ])
    assert.ok(ROOM_SCREENS.includes(path));
});
test('기본 Home에는 예시 약속이 없으며 빈 상태를 표시한다', () => {
  const html = render(Home, '/');
  assert.match(html, /표시할 약속이 없어요/);
  assert.doesNotMatch(html, /가을 나들이|문화생활|전시 모임/);
});
test('앱 소스에 목 저장소와 mockData 파일이 남지 않는다', () => {
  function files(path) {
    return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)],
    );
  }
  assert.deepEqual(
    files('src').filter((file) => /mockData|mockRepository|appointments\.mock|mockRoom/.test(file)),
    [],
  );
});
