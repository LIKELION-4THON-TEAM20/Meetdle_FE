# Meetdle API 연동 계획

## SCREEN 08 서버 연동

- SCREEN 06·07에서 `serverScreenUrl(PATHS.setup, roomId, selectionId)`로 진입한다. A08의 HOST, REGION_CONFIRMED, 현재 selectionId와 OPEN_COLLECTION을 기준으로 시작 권한을 확인한다. URL의 selectionId는 전달 힌트다. 이미 등록이 시작됐으면 최신 A08 권한에 따라 SCREEN 09 또는 10 경로로 이동한다.
- A28에서 카테고리의 기본 필수 여부, 가용성, 검색 반경을 읽는다. 응답의 selectionId가 현재 A08과 다르면 설정을 사용하지 않는다. A13에는 사용 가능한 FOOD·CAFE·BAR 중 한 개 이상의 필수 카테고리만 전송한다. CULTURE는 선택으로 유지하고 가용한 선택 카테고리의 활성 여부는 서버가 관리한다. SCREEN 08에서 A14를 호출하지 않는다.
- 마감 설정은 A08의 serverNow와 deadlinePolicy를 사용한다. 정책 필드가 없으면 6시간 경계의 60분·30분 최소값과 약속 시작 3시간 30분 전 상한을 적용한다. 기본 마감 요청은 closesAt을 생략하며 직접 선택 및 프리셋은 서울 시각에서 변환한 Instant를 전송한다. 시간 부족 시 SELECT_MEETING이 허용되면 SCREEN 05에서 재선택할 수 있다. A30은 별도 설정 초기화 동선에서 사용자 확인 후 연결할 대상이다.
- A13은 동일 본문의 재시도에 같은 Idempotency-Key를 사용한다. 성공 또는 409 후 A08을 재조회한다. 쓰기 성공 뒤 읽기가 실패하면 상태 조회를 재시도한다. SCREEN 09는 같은 roomId의 최신 A08에서 meeting.station·selectionId, registration.round·categories·radiusMeters·closesAt과 allowedActions를 읽고 A14·A34·A35·A16을 연결한다. 본인 후보 한 곳이면 완료 가능하며 필수 충족은 방 전체 기준이다.
- SCREEN 10·11은 같은 A08의 round·마감·등록 상태와 방장 허용 동작으로 연동한다. SCREEN 09·10의 서버 URL은 현재 공통 상태 화면까지 제공한다.

## SCREEN 06·07 서버 연동

- SCREEN 05가 A08의 options를 읽고 A12를 실행한다. 성공 후 `serverRoomUrl(roomId)`로 이동하면 A08을 재조회해 확정 전후 상태를 복원한다. REGION_CONFIRMED에서는 HOST가 SCREEN 06, MEMBER가 SCREEN 07을 본다. 직접 접근은 `serverScreenUrl(PATHS.confirmed, roomId)` 또는 `serverScreenUrl(PATHS.info, roomId)`를 사용한다.
- 카드의 시각과 역은 A08의 meeting, 참여자는 members와 joinedCount를 사용한다. 매칭되는 options의 역·시간 후보가 있을 때 그 요약을 표시한다. 날짜·시간은 Asia/Seoul로 변환한다.
- HOST는 REGION_CONFIRMED의 SELECT_MEETING일 때 SCREEN 05로 돌아가 재선택한다. 기존 A12 호출 소유권은 SCREEN 05에 있으며 최신 A08 meeting.selectionId를 expectedSelectionId로 전달한다. A30은 방 초기화 전용이다.
- OPEN_COLLECTION을 받은 HOST는 SCREEN 08 경로로 이동한다. SCREEN 08이 최신 A08과 A28을 확인한 후 A13에 현재 selectionId를 사용한다. SCREEN 07에서 등록 가능한 회차 회원은 SCREEN 09로 이동한다. SCREEN 09가 최신 A08 round·allowedActions로 A14·A34·A35·A16을 처리한다. 이동 URL의 selectionId는 전달 힌트이며 쓰기의 기준 값은 최신 A08이다.
- SCREEN 07은 마감·카테고리·본인 등록 상태를 A08에서 표시한다. 완료 또는 마감 후에는 진행 현황으로 유도한다. SCREEN 08·09의 서버 URL에 현재 브랜치에서는 공통 상태 화면을 표시한다.
- A33에는 일시·지역 확정 공유 전용 purpose가 없다. SCREEN 06은 A08 shareUrl과 확정 제목·시각·역으로 카카오 공유를 열며 A33 RESULT는 최종 결과 확정 이후에만 사용한다.

## SCREEN 04 서버 연동

- 홈은 `serverRoomUrl(roomId)`로 이동한다. A08의 `WAITING_FOR_DEPARTURE`와 시작 전 상태에서 모집 화면을 렌더링한다. 모집 수치는 `joinedCount / capacity`, 입력 수치는 `inputProgress.completedCount / inputProgress.capacity`다. 두 화면은 같은 A08 스토어를 사용한다.
- 방장이 `START_ROOM`을 가지고 가입자가 2명 이상이면 모달 확인 후 A31에 최신 `expectedRevision`을 보낸다. A08 재조회 후 `EDIT_INPUT`이 있으면 `serverScreenUrl(PATHS.schedule, roomId)`로 이동하고, 입력을 완료했으면 입력 현황을 표시한다. A31의 Phase 자체는 유지된다.
- SCREEN 03은 A10 성공 후 `serverScreenUrl(PATHS.participation, roomId)`로 이동한다. 이 경로가 A08을 다시 읽는다. URL의 role이나 화면 전환 state에서 입력 완료 여부를 복원하지 않는다.
- SCREEN 04만 A11을 실행한다. 방장과 `CALCULATE_OPTIONS`, 입력 완료 2명 이상을 확인하고 미완료자가 있을 때 기존 모달을 표시한다. 서버가 계산 시점 완료자 스냅샷을 고정한다. 동일 roomId·inputVersion 재시도에는 같은 요청 핸들과 키를 사용한다. A08이 `OPTIONS_READY`를 반환하면 `serverScreenUrl(PATHS.candidates, roomId)`로 이동한다.
- SCREEN 05는 URL의 서버 UUID로 A08의 `options`를 읽고 기존 결과를 재사용한다. A11을 다시 호출하지 않는다. A12 성공 후에도 같은 roomId를 유지하고 A08의 `meeting`과 `selectionId`를 SCREEN 06·07에서 사용한다. SCREEN 03·05는 이번 브랜치에서 실제 URL의 공통 상태 화면까지 제공하며 각 담당 화면은 팀원 브랜치에서 연결한다.
- 모집 초대는 방장에게 내려온 A08 `invite`를 SCREEN 02에서 공유한다. 입력 재촉은 A33 `INPUT`, 일반 회원의 방장 진행 요청은 A33 `HOST`로 요청한다. 서버 문구·링크·수신 대상을 모달에서 확인한 뒤 별도로 카카오 공유를 연다. SDK 구성 누락 또는 실패는 오류로 표시한다. A30은 방 설정 담당 화면에서 별도로 연결한다.

## SCREEN 02 서버 연동과 화면 간 계약

- SCREEN 01의 A05 성공 처리에서 `createdRoomDestination(response)`를 사용한다. 반환하는 `{ to, state }`를 `navigate(to, { state })`에 전달한다. 주소는 `/rooms/create/complete?mode=api&roomId=<서버 UUID>`이고 state는 `{ createdRoom: A05 응답 }`이다. 02는 A08에서 인증·방 ID·방장 권한과 현재 초대를 확인한 다음 일치하는 A05 초대 데이터를 사용한다. 새로고침과 직접 진입은 A08만으로 복원한다.
- 공개 초대는 `/invite/:inviteToken`이다. A03으로 세션을 확인하고 A06 미리보기를 조회한다. 비로그인 CTA는 A01에 `inviteToken`과 현재 `returnOrigin`을 전달한다. A02 복귀 후 A03을 다시 조회한다. 로그인 사용자는 A25로 코드를 검증한 뒤 별도 버튼에서 A07을 호출한다. 증표는 메모리에서만 보관한다.
- A06·A25가 `MEMBER`를 반환하거나 A07이 성공하면 `/rooms/<서버 UUID>`에서 A08을 읽는다. 홈의 코드 입력은 홈 담당자가 A25·A07을 완료한 후 `serverRoomUrl(roomId)`로 이동한다. `joinProof`·CSRF·역할은 URL에 넣지 않는다.
- `useRoomState(roomId)`는 방별 외부 스토어로 A08, 현재 역할·허용 동작·버전, 서버 시각 보정을 제공한다. `mutate(action, execute)`는 허용된 동작만 시작하고, 성공 또는 409 뒤 A08을 다시 조회한다. 읽기 교체·이탈 시 AbortSignal을 정리하며 세션 무효화 알림에서 방 데이터를 즉시 제거한다.
- 서버 진입은 `/rooms/:roomId`와 명시적 `mode=api`로 구분한다. 기존 목 라우트와 scenario는 기존 경로에서 유지한다. 서버 진입에서는 phase·me.role·allowedActions로 목적 화면을 결정하고, 이번 범위 밖 화면은 공통 서버 상태를 표시한다. 진행 현황만 가시 상태에서 15초마다 다시 읽고, 화면 복귀 시에는 별도 재조회한다.
- SCREEN 04의 모집 화면은 같은 스토어에서 `START_ROOM`·`CALCULATE_OPTIONS`를 각각 A31·A11에 매핑한다. SCREEN 03·05로 이동할 때 동일한 서버 roomId를 유지한다.

### localhost에서 실제 인증 확인

`.env.local`에 `VITE_API_BASE_URL=https://api.meetdle.co.kr`을 설정한 뒤 `npm run dev -- --port 5173 --strictPort`로 실행한다.

- 로그인만 확인하려면 [localhost 복귀용 A01](https://api.meetdle.co.kr/api/auth/kakao/start?returnOrigin=http%3A%2F%2Flocalhost%3A5173)에서 직접 카카오 인증한다. 기본 콜백 경로 `/rooms`는 기존 홈으로 이동한다. 돌아온 localhost의 DevTools에서 아래 GET의 상태를 확인한다. 200이면 세션이 전달됐으며, 쿠키와 CSRF 값은 출력하지 않는다.
- HOST는 본인이 만든 테스트 방 UUID로 `http://localhost:5173/rooms/create/complete?mode=api&roomId=<UUID>`에서 새로고침, 서버 초대 코드·링크 복사 및 카카오 공유를 확인한다. 공유에는 `VITE_KAKAO_SHARE_APP_KEY`와 카카오 앱의 Web 도메인·제품 링크 도메인 등록이 필요하다.
- MEMBER는 별도 Chrome 프로필에서 테스트 방의 토큰으로 `http://localhost:5173/invite/<TOKEN>`에 접속한다. 로그인 복귀, 틀린 코드, 올바른 코드 확인, 가입을 순서대로 검증한다. 같은 링크를 다시 열었을 때 A08로 이동하고 A07이 재호출되지 않는지 확인한다.
- 인증된 A03·A08 payload 및 실제 A25·A07은 테스트 계정과 테스트 방에서 확인해야 한다. A08의 상세 명세와 Swagger 차이 및 쓰기 성공 코드 차이는 아래 배포 비교에 정리되어 있다.

```js
fetch('https://api.meetdle.co.kr/api/me', { credentials: 'include' }).then((r) =>
  console.log(r.status),
);
```

공통 API 모듈과 SCREEN 02·04·06·07 서버 연동을 적용했다. 화면 번호는 Figma 1118 기준이며 1115 API 명세의 SC 번호와 별개다.

## 11월 19일 계약과 배포 차이

- [Notion 1118 명세](https://app.notion.com/p/41d9170baf5480e694ddc7758f0b0411?v=2fb9170baf548262a28708f8a9f604e3&source=copy_link)에서 내보낸 상세 Markdown 36개와 CSV 2개를 확인했다. 상세 명세의 소스 기준은 2026년 11월 19일 백엔드 main 커밋 `0d15e7b57c3c7a707b7178c4f798f0e54857f674`이다.
- 이전에 확보한 [배포 OpenAPI](https://api.meetdle.co.kr/v3/api-docs)에는 34개 경로, 35개 operation이 있다. 내보내기와 method·URI가 모두 일치하며 A04 로그아웃만 Swagger 목록에 없다. 아래 차이는 문서 간 비교이며 인증된 배포 응답 확인은 별도다.

| API                | 상세 Markdown                                                                                       | 배포 Swagger 및 공통 처리                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A04                | 세션·CSRF, POST /api/auth/logout, 빈 204                                                            | Swagger 미표기. 기존 logout 유지.                                                                                        |
| A02                | state 필수. code 또는 error 중 하나. 성공 시 세션 ID 교체, 취소·오류는 loginError 쿼리              | state·code·error 모두 선택으로 표현. 브라우저 OAuth 콜백은 서버가 처리.                                                  |
| A30·31·32·35·36    | 모두 빈 204                                                                                         | 모두 200으로 표기. A30은 string 스키마도 노출. 기존 void 핸들이 양쪽 성공 응답을 처리한다.                               |
| A30                | capacity와 Idempotency-Key 필수, title 생략 또는 null                                               | capacity 및 헤더는 스키마상 선택. 새 화면은 capacity를 전달하고 기존 공개 타입의 선택 필드는 유지한다.                   |
| A08                | allowedActions에 Action 23개, myCandidates는 candidateId·place 목록                                 | 문자열 배열과 요청용 Nomination(round·pickToken) 참조. 상세 DTO를 반영하고, 인증 후 배포 payload 확인을 남긴다.          |
| A13·23·25·27       | 일부 선택 필드에 명시적 null 허용                                                                   | Swagger는 생략 또는 문자열로 표현한다. 공통 호출은 기존 생략 방식 유지.                                                  |
| A03·08·14·33 등    | 프로필·장소·검색 총건수·공유 제목 등에 null 정의. A08은 members 배열과 회차 없는 구역의 null을 정의 | Swagger에 일반적으로 null·응답 필수 여부가 생략됨. 기존 선택 및 null 대응을 보존하며 실제 가능한 null을 타입에 추가했다. |
| A30·31·32·34·35·36 | 세션과 CSRF 필요                                                                                    | 신규 매핑의 헤더 선언은 일부 생략. 공통 클라이언트는 모든 쓰기에 CSRF를 유지한다.                                        |
| A22·36             | 순서 변경은 동률 대기·확정 대기·확정 완료에 가능. A36 확정 완료 단계의 동일 버전 재요청은 204       | Swagger 요약은 확정 장소 순서 변경과 RESULT_READY 확정만 설명한다.                                                       |
| 오류 응답          | API별 400·401·403·404·409·410·429·503 조건 정의                                                     | Swagger는 대부분 성공만 나열. 공통 ApiRequestError가 HTTP 상태·서버 code·details를 전달한다.                             |

## 프로젝트에서 달라지는 부분

- 기존 React·TypeScript·Vite·SCSS 구성과 설치 의존성을 사용한다. 예전 `src/api/auth.ts`의 로그인 URL 검증은 기존 화면에서 계속 사용한다.
- `src/api/client.ts`는 공통 fetch, 세션 조회/무효화, CSRF, 오류, 요청 핸들을 제공한다. `auth.ts`는 세션·로그아웃과 카카오 최상위 브라우저 이동, `rooms.ts`는 방·초대·검색·단계별 요청 함수를 제공한다. `types.ts`는 wire DTO, `mappers.ts`는 UI 카테고리·역할·선택값 변환이다.
- 기존 `FlowLayout`의 로컬 방 복구, `useRoomNavigation`의 방 ID·목 역할 전달, `createdRoom` 및 `mockRoom` 저장소·시나리오는 계속 목 흐름을 처리한다. Header·Modal·Button·Toast와 기존 화면 UI에 손대지 않았다.

## 공통 모듈 사용

`.env.local`에 `VITE_API_BASE_URL=https://api.meetdle.co.kr`을 설정하고 Vite를 재시작한다. `.env.example`에 동일한 공개 Origin을 예시로 넣었으며 `.env.local`은 Git에서 무시된다. Origin 뒤에 `/api`를 붙인 설정도 같은 URL로 정규화된다. Vite 환경변수는 공개 값만 사용한다.

- 앱 진입·OAuth 복귀 후 `getSession({ refresh: true })`로 A03을 조회한다. 세션 쿠키는 브라우저가 관리하고, 쓰기에는 현재 세션의 `X-CSRF-TOKEN`을 보낸다. `401` 또는 성공한 로그아웃에서 메모리 세션을 비운다. 주체나 토큰 변경이 감지되면 이전 사용자 작업 핸들을 무효화한다. 다음 화면에서 세션·방 데이터와 증표를 함께 폐기한다.
- 카카오 로그인은 `startKakaoLogin(inviteToken?)`으로 최상위 이동한다. 초대 링크의 토큰만 A01에 넘긴다. 기존 회원 복귀에는 `startKakaoLogin({ returnTo, returnOrigin })`을 쓸 수 있다. 복귀 경로와 Origin은 A01에서 검증하고 A02에서 적용한다.
- 등록·투표 등 변경 요청은 사용자 의도마다 `roomMutations`에서 핸들을 한 번 만든다. 예를 들어 `roomMutations.calculateOptions(roomId, { inputVersion })`을 CTA의 요청 상태에 보관하고 `execute()`를 호출한다. 같은 핸들의 동시 호출은 한 Promise를 공유하며, 성공 후 다시 호출해도 결과를 재사용한다. UI에서는 실행 중 버튼을 비활성화하고 로딩을 표시한다.
- A05·A11·A13·A17·A20·A23·A30과 A27의 EXTEND에는 UUID를 발급한다. 타임아웃 등 같은 논리 요청의 재시도에는 같은 핸들을 사용한다. 입력이 바뀌거나 새 작업이면 새 핸들을 만든다. 키 없는 쓰기의 응답을 받지 못했으면 서버 상태부터 확인한다. 화면에서 핸들을 새로 만드는 중복 클릭을 방지해야 한다.
- `ApiRequestError`의 `status`, `code`, `details`로 분기한다. 400은 입력, 401은 재인증, 403은 접근 거절, 404/410은 방·초대 복구, 409는 상태·버전 재조회, 429는 재시도 제한, 503은 일시 장애로 처리한다. `KEY_REUSED`는 이전 키를 다른 본문에 사용한 경우다. `STALE_*`와 `WRONG_PHASE`에서는 A08을 다시 조회하고 새 상태로 UI를 갱신한다. 요청이 실패하면 해당 화면의 기존 Toast 또는 폼 오류를 사용한다. 브라우저가 차단한 CORS와 연결 장애는 JS에서 `NETWORK_ERROR`로 관측되므로 콘솔·Network에서 원인을 구분한다.

## RoomState 조회 전략

서버 화면용 데이터 진입점은 `getRoomState(roomId, signal)`다. 실제 UUID v4만 받으며, 응답 `roomId`가 다르면 오류를 낸다. 인증 화면 연결 시 loader에서 URL의 방 ID로 조회하고, 라우트 이동·언마운트에서 이전 요청을 취소한다. 화면·권한은 `phase`, `me.role`, `allowedActions` 및 단계별 상태로 판단한다. `joinedCount`, `inputProgress`, `members`, `registration`·`voting`의 진행률·완료 목록과 본인 상태, `meeting`, `result`는 서버 스냅샷에서 표시한다.

최초 진입과 새로고침, 변경 성공 직후, 포커스 복귀에 재조회한다. 모집·등록·투표 진행 중에는 보이는 탭에서 간격을 둔 재조회를 적용하고 겹치는 조회는 하나만 유지한다. 응답을 해당 세션·방에 귀속시키고 오래된 응답으로 최신 화면을 덮지 않는다. `revision`, `inputVersion`, `round`, `selectionId`, `draftRevision`, `resultRevision`은 서버 값 그대로 보존한다. 카운트다운은 `serverNow` 기준으로 계산하고 0이 되면 재조회한다. 브라우저에서 단계를 임의로 전환하지 않는다.

현재 목 라우터와 실제 UUID 라우트의 분기는 화면 연동 단계에서 명시적으로 적용한다. 목 ID와 scenario는 기존 저장소에서만 사용한다. 서버 오류를 목 데이터로 대체하지 않으며 서버 호출에 URL `role`을 권한 값으로 넘기지 않는다.

## 화면별 최종 연동 계획

| 화면              | 연결 순서와 상태 기준                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02 생성·초대      | 01의 A05(201) 응답에서 roomId·invite 공유. A06 공개 미리보기 → 필요 시 A01/A02 → A03 → A25 6자리 코드 검증 → 동일 세션 joinProof로 A07 → A08. 토큰·증표 만료와 FULL/CLOSED 처리.                                                                                                                                      |
| 04 모집·입력      | A08의 inputStatus와 allowedActions 표시. START_ROOM이면 A31에 최신 revision을 보내 현재 정원으로 가입 마감. CALCULATE_OPTIONS이면 A11에 최신 inputVersion을 보내 완료자 스냅샷으로 추천. A33 INPUT/HOST로 재촉.                                                                                                       |
| 06·07 확정 정보   | 05의 A12 이후 A08 meeting 사용. 장소 등록 전 SELECT_MEETING 재선택에서 최신 selectionId 사용. EDIT_ROOM을 노출하는 화면은 A30 성공 후 입력·추천·확정 캐시를 무효화하고 A08로 복귀.                                                                                                                                    |
| 08 등록 설정      | REGION_CONFIRMED 방장이 A28로 반경·가용성 조회. A08 deadlinePolicy/serverNow, OPEN_COLLECTION과 최신 selectionId로 A13. 필수 목록은 FOOD·CAFE·BAR 중 하나 이상.                                                                                                                                                       |
| 10 등록 현황      | A08의 회차 완료 인원·상태와 categoryCounts 사용. CLOSE_COLLECTION은 A26, START_MINI_TIMER/EXTEND_COLLECTION은 A23, 재촉은 A33 REGISTRATION. 성공·마감 후 A08 재조회.                                                                                                                                                  |
| 11 마감·투표 시작 | PLACE_SUBMISSION_CLOSED에서 방 전체 필수 후보를 확인하고 START_VOTING일 때 A17에 round·closesAt 전달. 자동 선정으로 RESULT_READY면 14로 이동.                                                                                                                                                                         |
| 12 투표           | A08 voting.myDraft에서 복원. A18에 VOTE 후보의 전체 초안을 저장하고 반환된 draftRevision으로 A19 제출. AUTO_SELECTED는 표에서 제외.                                                                                                                                                                                   |
| 13 투표 현황      | A08의 완료 상태·voteReview를 표시. 마감 후 EXTEND_VOTE/PROCEED_WITH_VOTES에서 A27, 제출 재촉은 A33 VOTING. 정원 투표 제출과 장치 타이머 이후 서버 전이를 재조회.                                                                                                                                                      |
| 14 결과           | 동률 대기에는 방장만 그룹·부분 결과 조회, A21 → A08. RESULT_READY부터 양 역할에 결과 표시, MEMBER에게는 확정 대기 상태로 안내. REORDER_VISIT는 A22로 현재 선택 ID 전체 전송 → 최신 resultRevision 재조회. CONFIRM_RESULT는 A36으로 별도 실행. FINAL_PLACE_CONFIRMED에서 A33 RESULT. RECOLLECT는 A20으로 새 등록 회차. |

세진님 공유 사항은 SCREEN 01의 A05 생성 응답 연결, SCREEN 03의 A09·A10 잠금/버전과 상태 표시, SCREEN 05의 A11 결과 재사용 및 A12 소유권이다. SCREEN 09는 A14 검색 토큰, A34 추가, A35 단건 삭제, A08 myCandidates로 ID 복원, A16 완료 순서를 사용한다. A15는 한 카테고리의 본인 후보 전체를 교체·삭제하므로 단건 삭제 동작에는 A35를 사용한다. 홈·로그인은 A01의 /rooms·/rooms/{UUID}·/invite/{token} 복귀, A02 오류 쿼리, A24 목록·A32 숨김, RESULT_READY 상태를 연결 시 함께 조율한다.

## 1115 및 목 동작과 비교한 상세 정책

| 항목                | 11월 19일 상세 명세                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 가입 마감·추천      | A31은 WAITING_FOR_DEPARTURE 방장, 가입자 2명 이상, 최신 revision이 필요하다. 현재 인원으로 정원을 바꾸고 startedAt·revision을 갱신하며 단계는 유지한다. 기준 커밋은 startedAt이 없는 방에 START_ROOM을 제공한다. A11은 완료자 2명 이상, 종료된 가입과 저장된 추천을 재사용하며 후발 완료자로 재계산하지 않는다.                                                                                                                                                                                                                             |
| 등록 최소·상한      | A13·20 및 A08. 약속까지 6시간 이상이면 최소 60분, 그 미만은 30분. 약속 시작 3시간 30분 전 상한. A13 생략 시 최소 마감. 기존 1115 기준과 일치하고 Figma의 1시간·3시간 안내와 차이가 있다.                                                                                                                                                                                                                                                                                                                                                    |
| 등록 완료·조기 마감 | A16 개인 후보 1개 이상으로 완료. A26은 마감 전 방장이 완료 인원 ceil(capacity/2) 이상이고 필수 카테고리마다 방 전체 후보가 1개 이상일 때 호출한다.                                                                                                                                                                                                                                                                                                                                                                                          |
| 등록 자동 마감·연장 | 회차 회원 전원 완료 또는 마감 도달로 마감. A23 MINI_TIMER는 미완료자가 남고 완료 인원이 정원의 엄격한 과반일 때 1회. 생략 시 기존 마감+1시간과 상한 중 이른 시각. EXTEND는 마감 등록을 같은 회차로 1회 재개한다. 전원 완료 후 필수 후보가 없어서 재개하면 전원 완료 표시 해제.                                                                                                                                                                                                                                                              |
| 자동 선정           | 필수·선택 모두 후보가 1곳이면 AUTO_SELECTED. 기존 1115의 선택 1곳 투표와 달라졌다. 필수 충족 및 모든 카테고리 후보가 1곳 이하면 등록 마감에서 RESULT_READY로 직행한다.                                                                                                                                                                                                                                                                                                                                                                      |
| 투표 종료·연장      | A17 투표 최소 30분, 약속 3시간 전 상한. A19 정원 수 제출에서 자동 집계하며 목의 과반 조기 종료와 다르다. A27은 만료 검토 단계에서 방장이 제출 1건 이상이면 PROCEED, EXTEND는 회차당 1회. 새 마감은 현재·기존 마감보다 늦고 상한 이내. 연장은 기존 초안·제출을 유지한다. 최종 상한 도달 시 ENDED이며 0표면 NO_SUBMITTED_VOTES, 표가 있으면 DECISION_EXPIRED다. 연장 뒤 상한 전에 재만료해도 0표면 ENDED다.                                                                                                                                   |
| 집계·결과 공개      | LIKE +2, NEUTRAL +1, DISLIKE -3. 음수 또는 비선호가 제출 수의 절반을 초과하면 제외. 점수 내림차순 → 비선호 적은 순 → 선호 많은 순으로 비교한다. 동률은 방장이 A21로 선택하며 resultRevision을 올려 RESULT_READY. 자동 선정·무동률·동률 해결 후 모두 A36의 명시적 확정이 필요하다. 기준 커밋에서 방장만 동률 대기의 그룹·부분 결과를 받고, RESULT_READY부터 HOST·MEMBER 모두 result를 받는다. 이때 confirmed=false, 최종 확정 후 true다. RESULT 공유는 FINAL_PLACE_CONFIRMED부터 가능하다.                                                   |
| 방문 순서           | 기본 FOOD → CAFE → CULTURE → BAR. 방장은 동률 대기·RESULT_READY·최종 확정 후 A22로 변경 가능. 미확정 상태는 약속 시작 전까지만. A21은 기본 순서로 재정렬하며 A22 변경 시 버전을 올리고 A36 자체는 버전을 유지한다.                                                                                                                                                                                                                                                                                                                          |
| 재등록·만료         | A20은 NO_ELIGIBLE_RESULT에서 충분한 시간이 있을 때 같은 selectionId로 1회. 카테고리 설정을 복사한 새 등록 회차를 만든다. 새 일시·역 선택 시 재등록 횟수도 새로 센다. 독립 재투표 요청은 목록에 없고 새 회차에서 A17을 다시 사용한다. 등록·투표·동률 선택·최종 확정 만료는 A08의 recovery.reason으로 표시한다.                                                                                                                                                                                                                               |
| 공유·알림           | A33 INPUT은 입력 미완료, REGISTRATION은 등록 미완료, VOTING은 투표 미제출, HOST는 일반 회원이 방장에게 요청, RESULT는 최종 확정 뒤 다른 회원 전원. 발신자 제외. DEFAULT·FRIENDLY 문구와 복귀 링크로 클라이언트에서 카카오를 호출한다. A19·27의 VoteClosed 발행은 구현됐고 사용자 알림 리스너는 미구현이다.                                                                                                                                                                                                                                  |
| 방 설정             | A30은 방장이 최신 revision·요청 키를 사용한다. 정원은 현재 회원 수 이상. 입력·완료 표시·추천·확정 일시/역을 초기화하고 WAITING_FOR_DEPARTURE로 복귀. startedAt·입력 잠금 해제, 방 revision·inputVersion·개인 inputRevision을 증가시킨다. 회원·가입 마감 여부·과거 회차 이력을 보존하고 숨김 표시를 해제한다. 상세 페이지에 Phase 제한이 없고 기준 커밋의 RoomStateService는 방장에게 EDIT_ROOM을 제공한다. RoomLifecycleService도 별도 Phase 제한 없이 방장과 revision을 검사한다. 이전 요청 핸들은 폐기하고 변경된 버전으로 다시 조회한다. |

[기준 커밋의 A08 상태 조립](https://github.com/LIKELION-4THON-TEAM20/Meetdle_BE/blob/0d15e7b57c3c7a707b7178c4f798f0e54857f674/src/main/java/com/likelion4thon/Meetdle/room/service/RoomStateService.java), [장소·결과 공개 범위](https://github.com/LIKELION-4THON-TEAM20/Meetdle_BE/blob/0d15e7b57c3c7a707b7178c4f798f0e54857f674/src/main/java/com/likelion4thon/Meetdle/venue/RegistrationStateReader.java), [방 설정 초기화](https://github.com/LIKELION-4THON-TEAM20/Meetdle_BE/blob/0d15e7b57c3c7a707b7178c4f798f0e54857f674/src/main/java/com/likelion4thon/Meetdle/room/service/RoomLifecycleService.java)를 함께 대조했다.

마감 시점에는 수정·제출이 즉시 `DEADLINE_PASSED`로 실패할 수 있고, 단계 갱신 스케줄러 기본 간격은 15초다. UI는 타이머 0에서 서버 상태를 다시 읽고 Phase를 직접 바꾸지 않는다. `STALE_ROOM`, `STALE_INPUT`, `STALE_SELECTION`, `STALE_ROUND`, `STALE_DRAFT`, `STALE_RESULT`, `WRONG_PHASE`는 재조회 흐름으로 연결한다.

### A08 Phase와 Action

Phase 12개는 `WAITING_FOR_DEPARTURE`, `OPTIONS_READY`, `REGION_CONFIRMED`, `PLACE_SUBMISSION_OPEN`, `PLACE_SUBMISSION_CLOSED`, `VOTING_OPEN`, `VOTE_REVIEW_REQUIRED`, `WAITING_FOR_HOST_DECISION`, `RESULT_READY`, `FINAL_PLACE_CONFIRMED`, `RECOVERY_REQUIRED`, `ENDED`다.

| Action                                                    | API                       |
| --------------------------------------------------------- | ------------------------- |
| EDIT_INPUT / COMPLETE_INPUT                               | A10 complete=false / true |
| CALCULATE_OPTIONS / SELECT_MEETING                        | A11 / A12                 |
| EDIT_ROOM / START_ROOM / DELETE_ROOM                      | A30 / A31 / A32           |
| OPEN_COLLECTION / SEARCH_PLACES                           | A13 / A14                 |
| EDIT_NOMINATION                                           | A15 / A34 / A35           |
| COMPLETE_COLLECTION / CLOSE_COLLECTION                    | A16 / A26                 |
| START_MINI_TIMER / EXTEND_COLLECTION                      | A23 MINI_TIMER / EXTEND   |
| START_VOTING / EDIT_PREFERENCES / SUBMIT_VOTE             | A17 / A18 / A19           |
| EXTEND_VOTE / PROCEED_WITH_VOTES                          | A27 EXTEND / PROCEED      |
| RECOLLECT / RESOLVE_TIES / REORDER_VISIT / CONFIRM_RESULT | A20 / A21 / A22 / A36     |

A08의 `myInput`, `registration.myCandidates`, `voting.myDraft`는 본인 데이터다. 일반 회원의 추천 travel은 빈 배열이다. invite는 가입 마감 전 방장만 받는다. `myNominations`에는 장소만 있고 `myCandidates`에는 삭제용 candidateId와 place가 함께 있다. 새로고침 후 A08의 최신 round와 해당 candidateId를 A35에 전달한다.

## localhost 연결 검증

| 항목                                       | 11월 19일 관측                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chrome localhost:5173                      | 실제 Chrome 헤드리스에서 공통 클라이언트의 credentials: include 요청이 401 UNAUTHENTICATED로 처리됐다.                                                       |
| GET /api/me, Origin: http://localhost:5173 | 401 UNAUTHENTICATED, Access-Control-Allow-Origin: http://localhost:5173, Access-Control-Allow-Credentials: true.                                             |
| OPTIONS /api/rooms, 요청 메서드 POST       | 200, 동일 Origin 및 credentials true, Content-Type·X-CSRF-TOKEN·Idempotency-Key 모두 허용. 실제 POST는 전송하지 않았다.                                      |
| 카카오 로그인 시작                         | 기본 요청과 localhost returnOrigin 요청은 302. 기본 요청의 목적지는 kauth.kakao.com, OAuth redirect_uri는 https://api.meetdle.co.kr/api/auth/kakao/callback. |
| 로그인 완료·쿠키                           | 사용자 인증 후 검증 필요. localhost 복귀 성공과 실제 세션 쿠키 전송은 로그인 시작 응답만으로 확인할 수 없다.                                                 |

Chrome에서 직접 검증할 때는 먼저 http://localhost:5173 을 연다. 새 탭에서 [localhost 복귀용 로그인 시작 URL](https://api.meetdle.co.kr/api/auth/kakao/start?returnOrigin=http%3A%2F%2Flocalhost%3A5173)을 열고 카카오 인증을 완료한다. 반환된 프런트 Origin과 경로를 확인한 뒤 localhost 탭의 DevTools Console에서 아래 읽기 전용 요청을 실행한다. Network의 요청 Cookies와 차단 사유를 확인하며 쿠키 값과 CSRF 값은 공유하지 않는다.

```js
fetch('https://api.meetdle.co.kr/api/me', { credentials: 'include' }).then(({ status }) =>
  console.log(status),
);
```

200은 해당 브라우저의 세션 요청 성공이고 401은 세션 미확인이다. fetch가 거절되면 DevTools에서 CORS 또는 연결 원인을 확인한다. 이 검증에는 약속방 생성이나 변경이 필요 없다.

## 확인한 명세 파일 및 API별 응답

상세 Markdown 36개를 아래에 매핑했다. 두 CSV에서 같은 36건의 method·URI·기능을 확인했다. HTTP 상태와 오류는 상세 Markdown 기준이다.

- `API 명세_1118 41d9170baf5480e694ddc7758f0b0411_all.csv`
- `API 명세_1118 41d9170baf5480e694ddc7758f0b0411.csv`

| API | 상세 Markdown 파일                                                      | Method / URI                                                            | 권한                                                                     | 성공    |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| A01 | 카카오 로그인 시작 a5f9170baf54829894a201106c2eaa24.md                  | GET /api/auth/kakao/start                                               | 공개                                                                     | 302     |
| A02 | 카카오 로그인 콜백 2d69170baf548378882381282bc97a46.md                  | GET /api/auth/kakao/callback                                            | 공개                                                                     | 302     |
| A03 | 내 로그인 정보·CSRF 토큰 조회 9fb9170baf54828fbf0c0161a02dea0f.md       | GET /api/me                                                             | 로그인 세션                                                              | 200     |
| A04 | 로그아웃 6e69170baf54823fa740817aa3344ba5.md                            | POST /api/auth/logout                                                   | 로그인 세션                                                              | 204     |
| A05 | 약속방 생성 d669170baf5482f7888701ff091a42df.md                         | POST /api/rooms                                                         | 로그인 세션                                                              | 201     |
| A06 | 초대 링크의 약속방 정보 조회 5bd9170baf548357a62e011fda0d8643.md        | GET /api/invitations/{token}                                            | 공개                                                                     | 200     |
| A07 | 초대받은 약속방 참여 5319170baf5483509193814db61c3a1c.md                | POST /api/rooms/{roomId}/join                                           | 로그인 세션                                                              | 200/201 |
| A08 | 약속방 단계·진행 현황 조회 6109170baf5482f4971d811e71cf88ef.md          | GET /api/rooms/{roomId}/state                                           | 방 회원                                                                  | 200     |
| A09 | 지하철역 이름 검색 34f9170baf548372bfc2811998552964.md                  | GET /api/stations                                                       | 로그인 세션                                                              | 200     |
| A10 | 내 출발역·목적지역·가능 시간 저장 8bc9170baf5483fd81c601df0af8232d.md   | PUT /api/rooms/{roomId}/inputs/me                                       | 방 회원                                                                  | 200     |
| A11 | 약속 시각·만날 역 추천 b449170baf5482778bdb01b41a8a627c.md              | POST /api/rooms/{roomId}/planning-options                               | 방장                                                                     | 200/201 |
| A12 | 약속 시각·만날 역 선택 d009170baf5482f8b0c501a57032d9f9.md              | PUT /api/rooms/{roomId}/meeting-selection                               | 방장                                                                     | 200     |
| A13 | 장소 등록 시작 13d9170baf5482e7b3220166800eee4d.md                      | POST /api/rooms/{roomId}/place-submission                               | REGION_CONFIRMED 단계의 방장                                             | 201     |
| A14 | 만날 역 주변 장소 검색 56b9170baf5483d0a60e81e828504afe.md              | GET /api/rooms/{roomId}/places/search                                   | REGION_CONFIRMED 단계의 방장 또는 등록 진행 중 회차 회원                 | 200     |
| A15 | 내 카테고리별 후보 전체 교체·삭제 2ab9170baf54833bb96701fa6fc7fe76.md   | PUT /api/rooms/{roomId}/place-submission/me/{category}                  | 등록 마감 전 미완료 회차 회원                                            | 204     |
| A16 | 내 장소 등록 완료 b5f9170baf5483979ce00173f85cc12b.md                   | PUT /api/rooms/{roomId}/place-submission/me/completion                  | 회차 회원                                                                | 204     |
| A17 | 장소 투표 시작 ca19170baf54820abe6c81e860fe83bd.md                      | POST /api/rooms/{roomId}/voting                                         | PLACE_SUBMISSION_CLOSED 단계의 방장                                      | 204     |
| A18 | 내 장소별 선호도 임시 저장 1599170baf5482539e8e01ee39ce767d.md          | PUT /api/rooms/{roomId}/preferences/me                                  | 마감 전 VOTING_OPEN 단계의 미제출 회차 회원                              | 200     |
| A19 | 내 투표 제출 9e49170baf54824e9a6301fc36a2a1fc.md                        | PUT /api/rooms/{roomId}/vote-submissions/me                             | 회차 회원                                                                | 204     |
| A20 | 장소 재등록 시작 7bd9170baf5483dc91c58195bdae809e.md                    | POST /api/rooms/{roomId}/recovery                                       | RECOVERY_REQUIRED 단계의 방장                                            | 201     |
| A21 | 동점 장소 중 방문할 장소 선택 df29170baf5482018ec50161629c117f.md       | PUT /api/rooms/{roomId}/result/selections                               | 약속 시작 전 WAITING_FOR_HOST_DECISION 단계의 방장                       | 204     |
| A22 | 방문 순서 변경 9769170baf54820d95c501b0aa3c10e4.md                      | PUT /api/rooms/{roomId}/result/visit-order                              | RESULT_READY·WAITING_FOR_HOST_DECISION·FINAL_PLACE_CONFIRMED 단계의 방장 | 204     |
| A23 | 등록 마감 연장·마감된 등록 재개 39b9170baf54836e90c781b3f075e41f.md     | POST /api/rooms/{roomId}/place-submission/extension                     | 방장                                                                     | 200     |
| A24 | 내 예정·지난 약속 목록 조회 08e9170baf5483c9859b8112ed886b97.md         | GET /api/rooms                                                          | 로그인 세션                                                              | 200     |
| A25 | 초대 코드 확인 db69170baf548221968b81c4e1ce7e23.md                      | POST /api/invitations/resolve                                           | 로그인 세션                                                              | 200     |
| A26 | 장소 등록 조기 마감 3d79170baf548384a9d701330fcd3cfd.md                 | PUT /api/rooms/{roomId}/place-submission/closure                        | 등록 진행 중 마감 전 방장                                                | 204     |
| A27 | 투표 마감 연장·제출된 표 집계 e629170baf548371ae1e81ab23dd8ab0.md       | POST /api/rooms/{roomId}/voting/decision                                | VOTE_REVIEW_REQUIRED 단계의 방장                                         | 204     |
| A28 | 카테고리별 검색 가능 여부·반경 조회 4bf9170baf548274b5c3019e867ecf60.md | GET /api/rooms/{roomId}/place-submission/categories                     | REGION_CONFIRMED 단계의 방장                                             | 200     |
| A29 | 서버 상태 확인 28e9170baf5483d18cba01a6e39264bb.md                      | GET /api/health                                                         | 공개                                                                     | 200     |
| A30 | 방 정보 변경·입력과 추천 초기화 1e99170baf548344b6e701dcab7005b6.md     | PUT /api/rooms/{roomId}/settings                                        | 방장                                                                     | 204     |
| A31 | 현재 참가 인원으로 가입 마감 63a9170baf5483dd87d081c7d8e4e681.md        | POST /api/rooms/{roomId}/start                                          | WAITING_FOR_DEPARTURE 단계의 방장                                        | 204     |
| A32 | 내 지난 약속방 숨기기 9969170baf54839f8c4481e9f6afc0cf.md               | DELETE /api/rooms/{roomId}                                              | 방 회원                                                                  | 204     |
| A33 | 공유 링크·문구·수신 대상 조회 9bd9170baf5483a8afef011759362302.md       | GET /api/rooms/{roomId}/share                                           | 방 회원                                                                  | 200     |
| A34 | 내 장소 후보 추가 0a19170baf5482a285c981b38059d3ad.md                   | POST /api/rooms/{roomId}/place-submission/me/candidates                 | 등록 마감 전 미완료 회차 회원                                            | 200     |
| A35 | 내 장소 후보 한 곳 삭제 7149170baf5483708a4d01b89a9844fb.md             | DELETE /api/rooms/{roomId}/place-submission/me/candidates/{candidateId} | 등록 마감 전 미완료 회차 회원                                            | 204     |
| A36 | 방문 장소·순서 최종 확정 3da9170baf548315baae0104535bc8ec.md            | PUT /api/rooms/{roomId}/result/confirmation                             | RESULT_READY 또는 FINAL_PLACE_CONFIRMED 단계의 방장                      | 204     |

### API별 요청·응답 요약

세션 대상 읽기는 MEETDLE_SESSION, 세션 대상 쓰기는 같은 세션과 X-CSRF-TOKEN을 사용한다. A05·11·13·17·20·23·30 및 A27 EXTEND는 Idempotency-Key UUID가 필요하다. A27 PROCEED에서 키는 선택이다.

| API          | 요청과 응답                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01·02       | A01은 inviteToken 또는 returnTo 및 선택 returnOrigin으로 OAuth state를 5분 저장하고 카카오로 302. A02는 state와 code/error를 받아 프런트로 302, 성공 시 새 세션 ID.                                                             |
| A03·04       | A03 Session(user, csrfToken), no-store. A04는 빈 POST로 세션 무효화 및 쿠키 삭제.                                                                                                                                               |
| A05·06·07    | A05 title·dates·capacity → RoomRef와 Invite, Location은 상태 URI. A06은 43자 토큰 → InvitePreview. A07 joinProof → RoomRef, 기존 회원은 200.                                                                                    |
| A08·09       | A08 roomId → RoomState. A09 q(1~40자), limit(1~20, 기본 10) → Station 목록.                                                                                                                                                     |
| A10·11·12    | A10 두 역·시간 슬롯·inputRevision·complete → MyInput. 서울 10~23시 시작 슬롯 최대 98개. A11 inputVersion → PlanningOptions(시각 최대 3개, 지역 최대 2개). A12 optionsId·slotId·candidateId·expectedSelectionId → 1시간 Meeting. |
| A13·14       | A13 selectionId·requiredCategories·closesAt → 회차·카테고리·마감. A14 category, 선택 q(1~60)·page(1~3)·bounds(서·남·동·북) → Search, 등록 가능 토큰은 15분.                                                                     |
| A15·16       | A15 round·pickToken(삭제는 null) → 빈 응답, 내 카테고리 전체 대체/삭제. A16 round → 빈 응답, 개인 후보 1곳 이상이면 완료.                                                                                                       |
| A17·18·19    | A17 round·closesAt → 빈 응답. A18 round·draftRevision·selections → 새 Draft, 일부/빈 목록 저장 가능. A19 round·최신 draftRevision → 빈 응답, VOTE 후보 전체 선택 필요.                                                          |
| A20·21·22    | A20 round·closesAt → 새 round와 closesAt. A21 round·resultRevision·choices → 빈 응답. A22 round·resultRevision·candidateIds → 빈 응답.                                                                                          |
| A23·24       | A23 round·mode·closesAt → 같은 round 및 새 closesAt. A24 scope(ALL/UPCOMING/PAST)·limit(1~50, 기본 20)·cursor → MyRoomsPage.                                                                                                    |
| A25·26·27    | A25 6자리 code·선택 inviteToken → preview·joinProof·만료. 증표는 발급 후 최대 10분이며 같은 세션에 묶인다. 코드 불일치 5회/10분 뒤 429. A26 round → 빈 응답. A27 round·action·closesAt → 빈 응답.                               |
| A28·29       | A28 roomId → selectionId와 카테고리 반경·가용성, 기본 2500m에서 필요 시 3000m. A29 공개 헬스 → status=UP.                                                                                                                       |
| A30·31·32    | A30 title·dates·capacity·expectedRevision, A31 expectedRevision, A32 본문 없음. 모두 빈 응답. A32는 요청자의 지난 약속 목록에서만 숨김.                                                                                         |
| A33·34·35·36 | A33 purpose → Share. A34 round·category·pickToken → candidateId. A35 path candidateId·query round → 빈 응답. A36 round·resultRevision → 빈 응답.                                                                                |

### API별 오류 코드

- A01 400 INVALID_REQUEST, 503 PROVIDER_UNAVAILABLE
- A02 400 OAUTH_STATE_INVALID, 400 INVALID_REQUEST
- A03 401 UNAUTHENTICATED
- A04 401 UNAUTHENTICATED, 403 FORBIDDEN
- A05 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 409 KEY_REUSED, 409 REQUEST_IN_PROGRESS
- A06 404 INVITATION_NOT_FOUND, 410 INVITATION_EXPIRED
- A07 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 INVALID_INVITATION, 409 JOIN_CLOSED, 409 ROOM_FULL, 410 INVITATION_EXPIRED
- A08 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND
- A09 400 INVALID_REQUEST, 401 UNAUTHENTICATED
- A10 400 INVALID_SLOT, 400 UNSUPPORTED_STATION, 400 INPUT_INCOMPLETE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 INPUT_LOCKED, 409 STALE_INPUT
- A11 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE, 409 STALE_INPUT, 409 NOT_ENOUGH_INPUTS, 409 NO_FEASIBLE_OPTION, 503 MATRIX_UNAVAILABLE
- A12 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE, 409 STALE_SELECTION, 409 INVALID_OPTION
- A13 400 INVALID_REQUIRED_CATEGORIES, 400 INVALID_DEADLINE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE, 409 STALE_SELECTION, 409 INSUFFICIENT_TIME, 409 KEY_REUSED, 503 LOCAL_UNAVAILABLE
- A14 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED, 409 CATEGORY_DISABLED, 503 LOCAL_UNAVAILABLE
- A15 400 INVALID_PICK, 400 CATEGORY_MISMATCH, 400 OUT_OF_RADIUS, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_ROUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED, 409 CATEGORY_DISABLED, 409 ALREADY_COMPLETED, 409 PICK_EXPIRED
- A16 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 NOMINATION_REQUIRED, 409 STALE_ROUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED
- A17 400 INVALID_DEADLINE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 REQUIRED_CATEGORY_EMPTY, 409 INSUFFICIENT_TIME, 409 STALE_ROUND, 409 WRONG_PHASE, 409 KEY_REUSED
- A18 400 INVALID_CANDIDATE, 400 DUPLICATE_CANDIDATE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 ALREADY_SUBMITTED, 409 STALE_DRAFT, 409 STALE_ROUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED
- A19 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 VOTE_INCOMPLETE, 409 STALE_DRAFT, 409 STALE_ROUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED
- A20 400 INVALID_DEADLINE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 RETRY_EXHAUSTED, 409 INSUFFICIENT_TIME, 409 STALE_ROUND, 409 WRONG_PHASE, 409 KEY_REUSED
- A21 400 INVALID_TIE_CHOICE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_RESULT, 409 WRONG_PHASE, 409 DEADLINE_PASSED
- A22 400 INVALID_VISIT_ORDER, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_RESULT, 409 WRONG_PHASE, 409 DEADLINE_PASSED
- A23 400 INVALID_DEADLINE, 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 EXTENSION_EXHAUSTED, 409 NOT_ALLOWED, 409 INSUFFICIENT_TIME, 409 STALE_ROUND, 409 WRONG_PHASE, 409 KEY_REUSED
- A24 400 INVALID_REQUEST, 400 INVALID_CURSOR, 401 UNAUTHENTICATED
- A25 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 INVALID_INVITATION, 410 INVITATION_EXPIRED, 429 RATE_LIMITED
- A26 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 NOT_ENOUGH_COMPLETIONS, 409 REQUIRED_CATEGORY_EMPTY, 409 STALE_ROUND, 409 WRONG_PHASE
- A27 400 INVALID_REQUEST, 400 INVALID_DEADLINE, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 EXTENSION_EXHAUSTED, 409 NO_SUBMITTED_VOTES, 409 INSUFFICIENT_TIME, 409 STALE_ROUND, 409 WRONG_PHASE, 409 KEY_REUSED
- A28 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE, 503 LOCAL_UNAVAILABLE
- A30 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_ROOM, 409 KEY_REUSED, 409 REQUEST_IN_PROGRESS
- A31 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE, 409 STALE_ROOM, 409 NOT_ENOUGH_MEMBERS
- A32 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 UPCOMING_ROOM
- A33 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 WRONG_PHASE
- A34 400 INVALID_REQUEST, 400 INVALID_PICK, 400 CATEGORY_MISMATCH, 400 OUT_OF_RADIUS, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_ROUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED, 409 CATEGORY_DISABLED, 409 ALREADY_COMPLETED, 409 PICK_EXPIRED
- A35 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_ROUND, 409 WRONG_PHASE, 409 DEADLINE_PASSED, 409 ALREADY_COMPLETED
- A36 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 STALE_RESULT, 409 WRONG_PHASE, 409 DEADLINE_PASSED
