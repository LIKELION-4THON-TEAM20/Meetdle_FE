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
const { formatCandidateDate, reconcileSelection, getConfirmationRequest } =
  await server.ssrLoadModule('/src/pages/TimeRegionCandidates/candidateUtils.ts');
const { MOCK_CANDIDATE_DATA: data } = await server.ssrLoadModule(
  '/src/pages/TimeRegionCandidates/mockData.ts',
);
const { default: TimeCard } = await server.ssrLoadModule(
  '/src/pages/TimeRegionCandidates/components/TimeCandidateCard.tsx',
);
const { default: RegionCard } = await server.ssrLoadModule(
  '/src/pages/TimeRegionCandidates/components/RegionCandidateCard.tsx',
);
const { TimeRegionCandidatesView } = await server.ssrLoadModule(
  '/src/pages/TimeRegionCandidates/TimeRegionCandidates.tsx',
);
const selected = {
  timeCandidateId: data.timeCandidates[0].id,
  regionCandidateId: data.regionCandidates[0].id,
};

test('날짜의 요일을 계산한다 (컴포넌트에 고정하지 않는다)', () => {
  assert.equal(formatCandidateDate('2026-11-15'), '11월 15일 일요일');
  assert.equal(formatCandidateDate('2026-11-16', true), '11월 16일 (월)');
  assert.equal(formatCandidateDate('2027-01-01'), '1월 1일 금요일');
});

test('시간/지역 중 하나라도 없으면 확정 요청을 만들지 않는다', () => {
  for (const selection of [
    { timeCandidateId: null, regionCandidateId: null },
    { ...selected, timeCandidateId: null },
    { ...selected, regionCandidateId: null },
  ])
    assert.equal(getConfirmationRequest(data, selection), null);
  assert.deepEqual(getConfirmationRequest(data, selected), selected);
});

test('시간과 지역 선택 변경을 각각 보존하며 요청에는 두 ID만 전달한다', () => {
  const next = {
    timeCandidateId: data.timeCandidates[1].id,
    regionCandidateId: data.regionCandidates[1].id,
  };
  assert.deepEqual(getConfirmationRequest(data, next), next);
  assert.equal(reconcileSelection(data, next), next);
});

test('목록에서 사라진 후보는 해제하고 남은 유효한 선택은 보존한다', () => {
  const withoutTime = { ...data, timeCandidates: data.timeCandidates.slice(1) };
  const withoutRegion = { ...data, regionCandidates: data.regionCandidates.slice(1) };
  assert.deepEqual(reconcileSelection(withoutTime, selected), {
    ...selected,
    timeCandidateId: null,
  });
  assert.deepEqual(reconcileSelection(withoutRegion, selected), {
    ...selected,
    regionCandidateId: null,
  });
  assert.equal(getConfirmationRequest(withoutTime, selected), null);
  assert.equal(getConfirmationRequest(withoutRegion, selected), null);
  assert.equal(getConfirmationRequest(data, { ...selected, timeCandidateId: 'unknown' }), null);
});

test('추천 시간은 날짜·시간을 나누고 전원 가능 설명을 표시한다', () => {
  const markup = renderToStaticMarkup(
    createElement(TimeCard, {
      candidate: data.timeCandidates[0],
      groupName: 'time',
      selected: false,
      onSelect() {},
    }),
  );
  assert.match(markup, /candidate-card--all-available/);
  assert.match(markup, /추천/);
  assert.match(markup, /11월 15일 일요일/);
  assert.match(markup, /18:00 - 20:00/);
  assert.match(markup, /평균 대기 0분 · 전원 참여 가능/);
  assert.doesNotMatch(markup, /checked=/);
});

test('회색 시간 후보도 선택 가능하며 변경된 인원과 날짜를 데이터에서 표시한다', () => {
  const candidate = {
    ...data.timeCandidates[1],
    date: '2027-01-01',
    availableCount: 2,
    totalCount: 6,
  };
  const markup = renderToStaticMarkup(
    createElement(TimeCard, { candidate, groupName: 'time', selected: true, onSelect() {} }),
  );
  assert.match(markup, /checked=""/);
  assert.match(markup, /1월 1일 금요일/);
  assert.match(markup, /2 \/ 6명 가능/);
  assert.doesNotMatch(markup, /disabled=/);
});

test('이동정보는 미선택 카드에서도 펼쳐지고 라디오와 별도 버튼이다', () => {
  const markup = renderToStaticMarkup(
    createElement(RegionCard, {
      candidate: data.regionCandidates[0],
      groupName: 'region',
      selected: false,
      expanded: true,
      onSelect() {},
      onToggleDetails() {},
    }),
  );
  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, /aria-controls=/);
  assert.match(markup, /민지/);
  assert.match(markup, /도보 12분/);
  assert.match(markup, /환승 1회/);
  assert.doesNotMatch(markup, /checked=|hidden=""/);
  assert.match(markup, /<\/label><button/);
});

test('접은 상세는 접근성 트리에서 숨긴다', () => {
  const markup = renderToStaticMarkup(
    createElement(RegionCard, {
      candidate: data.regionCandidates[0],
      groupName: 'region',
      selected: true,
      expanded: false,
      onSelect() {},
      onToggleDetails() {},
    }),
  );
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /hidden=""/);
});


test('추천 후보를 입력 순서와 관계없이 상단에 배치하고 기본 선택한다', () => {
  const markup = renderToStaticMarkup(
    createElement(TimeRegionCandidatesView, {
      data: {
        timeCandidates: [...data.timeCandidates].reverse(),
        regionCandidates: [...data.regionCandidates].reverse(),
      },
      onBack() {},
    }),
  );
  assert.ok(markup.indexOf('11월 15일') < markup.indexOf('11월 16일'));
  assert.ok(markup.indexOf('건대입구역') < markup.indexOf('왕십리역'));
  assert.match(markup, /checked="" value="time-1115-evening"/);
  assert.match(markup, /checked="" value="region-konkuk"/);
  assert.doesNotMatch(markup, /disabled=""|이동시간 상세/);
  assert.match(markup, /이 후보로 확정하기/);
});
