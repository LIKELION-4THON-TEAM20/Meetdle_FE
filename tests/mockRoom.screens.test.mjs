import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null } });
after(() => server.close());
const { MockRoomContext } = await server.ssrLoadModule('/src/features/mockRoom/context.ts');
const { createMockRoom, reduceRoom } = await server.ssrLoadModule(
  '/src/features/mockRoom/model.ts',
);
const screens = {};
for (const name of [
  'PlaceRegistrationStatus',
  'RegistrationClose',
  'VoteStart',
  'PlaceVote',
  'VoteStatus',
  'VoteResult',
]) {
  screens[name] = (await server.ssrLoadModule(`/src/pages/${name}/${name}.tsx`)).default;
}
function render(name, room, { isolated = false, url = '/' } = {}) {
  return renderToString(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(
        MockRoomContext.Provider,
        { value: { room, isolated, send: () => false } },
        createElement(screens[name]),
      ),
    ),
  ).replaceAll('<!-- -->', '');
}
function button(html, text) {
  return html.match(new RegExp(`<button[^>]*>\\s*${text}\\s*</button>`))?.[0] ?? '';
}
const now = Date.now();

test('host/participant management controls and direct-entry recovery render', () => {
  const room = createMockRoom(now);
  const participant = { ...room, role: 'participant', currentUserId: 'haneul' };
  assert.doesNotMatch(
    button(render('PlaceRegistrationStatus', room), '등록 마감하고 투표 시작하기'),
    /disabled/,
  );
  assert.match(
    button(render('PlaceRegistrationStatus', participant), '등록 마감하고 투표 시작하기'),
    /disabled/,
  );
  assert.match(
    button(render('RegistrationClose', participant), '등록 마감하고 투표 시작'),
    /disabled/,
  );
  assert.match(button(render('VoteStart', room), '투표 시작하기'), /disabled/);
  assert.match(render('PlaceVote', room), /아직 목 투표가 시작되지 않았어요/);
  assert.match(button(render('PlaceVote', room), '투표 제출'), /disabled/);
  assert.match(render('VoteResult', room), /투표 현황으로 이동/);
  assert.doesNotMatch(render('VoteResult', room), /방문 순서 확인하기/);
});

test('submission renders status link and live completion count; counting is explicit', () => {
  let room = reduceRoom(createMockRoom(now), { type: 'closeRegistration' });
  room = reduceRoom(room, { type: 'start', now, deadline: now + 3600000 });
  assert.match(render('PlaceVote', room), /place-vote--with-fixed-cta/);
  assert.match(render('VoteStatus', room), /투표 마감하기/);
  const participant = { ...room, role: 'participant', currentUserId: 'haneul' };
  assert.doesNotMatch(render('VoteStatus', participant), /투표 마감하기/);
  for (const category of room.categories.filter(({ places }) => places.length > 1)) {
    for (const place of category.places)
      room = reduceRoom(room, {
        type: 'vote',
        action: { type: 'choose', placeId: place.id, choice: 'like', now },
      });
  }
  room = reduceRoom(room, { type: 'vote', action: { type: 'submit', now } });
  assert.match(render('PlaceVote', room), /href="\/rooms\/vote\/status"/);
  assert.match(render('VoteStatus', room), /aria-valuenow="75"/);
  room = reduceRoom(room, { type: 'closeVote', now });
  assert.match(render('VoteStatus', room), /개발용 목 결과 확인/);
  assert.match(render('VoteStatus', room), /실제 서버 집계가 아니에요/);
  room = reduceRoom(room, { type: 'count', now });
  assert.match(render('VoteResult', room), /방문 순서 확인하기/);
});

test('isolated development scenarios render without using the connected room data', () => {
  const room = createMockRoom(now);
  const submitted = render('PlaceVote', room, {
    isolated: true,
    url: '/rooms/vote?scenario=submitted',
  });
  assert.match(submitted, /투표 제출 완료/);
  const expired = render('VoteStatus', room, {
    isolated: true,
    url: '/rooms/vote/status?scenario=insufficient',
  });
  assert.match(expired, /과반에 미달/);
  const tie = render('VoteResult', room, {
    isolated: true,
    url: '/rooms/vote/result?scenario=tie',
  });
  assert.match(tie, /카페 카테고리가 동률/);
  const participantTie = render('VoteResult', room, {
    isolated: true,
    url: '/rooms/vote/result?scenario=tie&role=participant',
  });
  assert.doesNotMatch(participantTie, /이곳으로 선택/);
  assert.match(
    button(
      render('VoteStart', room, { isolated: true, url: '/rooms/vote/start?scenario=empty' }),
      '투표 시작하기',
    ),
    /disabled/,
  );
});
