# SCREEN 10–14 개발용 목 흐름

실제 API, 서버 집계, 보안 검증이 없는 개발용 상태입니다. SCREEN 01–09에는 적용하지 않습니다.

- `model.ts`: 타입, 레거시 카테고리 매핑, 후보 어댑터, 상태 전이, 목 집계, 저장 데이터 검증.
- `context.ts`: 화면에서 사용하는 Context 계약.
- `MockRoomLayout.tsx`: SCREEN 10–14 전용 Provider, 세션 복원 및 저장.
- 저장 키: `meetdle:development-mock-room:v1`. 다른 탭/사용자/서버와 동기화하지 않습니다.
- 저장소 접근이 차단되면 메모리 상태로 동작합니다. 이 경우 새로고침 복원은 지원되지 않습니다.
- API 교체 시 화면의 Context 계약을 유지하고 초기 조회·명령·집계 구현을 교체할 수 있습니다.

## 시작과 진행

`npm run dev` 실행 후 아래 경로로 시작합니다. `mock=reset`은 이 목 방만 초기화합니다.

`/rooms/registration/status?mock=reset&role=host`

1. 등록 마감하고 투표 시작하기 → 다음 단계로 이동 → 현재 후보로 진행.
2. 등록 마감 화면에서 확인 → 투표 시작 화면에서 투표 시작하기.
3. 직접 투표할 7개 후보에 응답 → 투표 제출 → 투표 현황 보기.
4. 초기 제출자는 지은·유진 2명입니다. 방장 상민 제출 후 3/4명이 됩니다.
5. 방장 투표 마감하기 → 지금 마감하기 → 집계 대기 UI → 개발용 목 결과 확인.
6. 결과 비율 확인, 동률이면 방장 선택, 방문 순서 변경·저장.

같은 탭에서 `/rooms/vote?role=participant`로 열면 일반 참여자 하늘로 전환합니다.
`role=host`로 상민으로 돌아올 수 있으며 역할은 이후 이동·새로고침에도 유지됩니다.
완료 후 SCREEN 10으로 다시 들어가면 기존 단계로 이동하는 링크가 표시됩니다.
일반 URL은 준비되지 않은 단계를 자동으로 완료하거나 결과를 만들어내지 않습니다.

## 목 집계 규칙과 제한

- 공통 카테고리: `restaurant / cafe / pub / culture`.
- 레거시 숫자 ID `0/1/2/3` 및 `bar` 매핑은 `categoryId()`가 담당합니다.
- 현재 후보 8곳 = 식당 3 + 카페 2 + 주점 2 + 문화시설 1.
- 후보가 1개인 카테고리는 응답에서 제외하고 자동 선정합니다. 자동 선정 후보의 투표수는 0입니다.
- 전체 응답을 완료한 제출자만 집계합니다. 과반은 정확히 `완료자 > 전체 / 2`입니다.
- 전원 제출, 방장 조기 마감, 시간 만료 중 하나와 과반 조건을 충족해야 집계할 수 있습니다.
- 개발용 결과 확인 동작 전에는 집계 결과를 생성하지 않습니다.
- 임시 순위 규칙: 좋아요 수 − 싫어요 수. 제출자의 과반이 싫어요인 후보는 제외합니다.
- 동점은 첫 후보로 확정하지 않고 모든 동률 카테고리를 순서대로 방장이 선택합니다.
- 필수 후보 누락, 전체 후보 0개, 과반 미달, 선정 불가는 결과를 임의 생성하지 않습니다.
- 위 순위·제외 규칙은 백엔드 정책이 아닌 명시적인 개발용 시뮬레이션입니다.
- 선정 실패 시 재투표 버튼은 기존처럼 목 횟수 확인만 수행합니다. 실제 재투표 생성·후보 재구성은 연결하지 않았습니다.
- 지도, 필수 후보 보완 등록은 기존 안내를 유지합니다. SCREEN 09를 만들거나 연결하지 않습니다.

## 독립 화면 시나리오

기존 `scenario` 및 `clock=fixed` URL은 공통 세션에 쓰지 않는 독립 fixture 모드입니다.
독립 모드에서 일반 URL로 나가면 저장된 일반 목 흐름으로 복귀합니다.
따라서 시나리오 간 이동으로 일반 세션의 제출·결과가 덮어써지지 않습니다.
새로고침하면 독립 fixture는 해당 시나리오의 초기 상태로 돌아갑니다.

- 10: `partial`, `allCompleted`, `expired`, `waiting`, `insufficient`, `expiringSoon`.
- 11 등록 마감/투표 시작: `empty`, `missingRequired`, `missingOptional`.
- 11 투표 시작: `invalidDeadline`.
- 12: `partial`, `complete`, `submitted`; `clock=fixed`.
- 13: `ongoing`, `allCompleted`, `expired`, `insufficient`; `clock=fixed`.
- 14: `breakdown`, `order`, `tie`, `pending`, `noResult`, `revoteUsed`, `zeroVotes`.
- 역할 확인: 위 URL에 `role=participant` 또는 `role=host` 추가.

## 검증

`node --test tests/mockRoom.test.mjs tests/mockRoom.screens.test.mjs`

상태 전이·집계·저장 복원 테스트와 SSR 컴포넌트 렌더링 테스트입니다.
브라우저 클릭, 네이티브 dialog, 스크롤·반응형 레이아웃 검증을 대체하지 않습니다.
