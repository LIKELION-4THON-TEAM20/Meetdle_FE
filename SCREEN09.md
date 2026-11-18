# SCREEN 09 — 장소 탐색 및 등록

## #28 서버 API 연동 (2026-11-19)

현재 브랜치는 `feat/#28-place-exploration-api`다. 아래 서버 경로와 기존 독립 목 미리보기를 분리한다. 이 절 아래의 #11 설명은 기존 목 구현 기록이다.

### 진입·조회·현황 연결

- `/rooms/places?roomId=<실제 UUID v4>`는 ServerPlaceExploration과 apiRepository를 사용한다. 최초 진입, 새로고침, 포커스 복귀, ‘최신 상태 다시 조회’에서 세션과 A08을 조회한다. URL의 role/scenario나 route state로 서버 권한과 방 데이터를 대체하지 않는다.
- A08의 meeting.station 이름·좌표와 meetingAt, registration.round/closesAt/categories/myNominations/myCompleted, uniqueCandidateCount와 progress를 그대로 표시한다. 타 참여자는 completion의 이름별 완료 여부만 표시한다. 진행률 분모는 서버 capacity다.
- 완료 후 A08의 myCompleted를 확인하고 `/rooms/registration/status?roomId=<같은 UUID>`로 이동한다. 이 UUID 경로만 목 레이아웃을 우회하는 조회 전용 현황 화면을 제공한다. 직접 접근·새로고침도 A08을 사용하며, 마감·연장·투표 같은 후속 변경 API는 연결하지 않는다.
- 서버에 등록 섹션 또는 확정 meeting이 없으면 안내만 표시한다. 실패를 목 장소나 로컬 저장 성공으로 대체하지 않는다. 독립 `/rooms/places`와 `roomId=exploration-preview`, 기존 목 현황 경로는 유지한다.

### 검색·지도·표시 데이터

- A14에 카테고리(FOOD/CAFE/BAR/CULTURE), trim한 검색어(공백만 있으면 q 생략), page를 전달한다. 250ms 입력 지연·AbortController·응답 세대로 이전 결과를 폐기한다. 검색 중·없음·오류·다시 시도와 nextPage 기반 추가 검색을 제공한다.
- 검색어가 없을 때도 카테고리 검색으로 지도 마커를 조회한다. 별도 추천 장소 목록은 추가하지 않는다. 핀 선택 시 선택한 장소 카드, 검색어 입력 시 검색 결과 카드를 표시한다.
- 지도 컴포넌트와 SDK 제어는 기존 것을 재사용한다. 중심은 항상 서버 확정 역의 lat/lng다. 최초 반경은 해당 registration.categories의 radiusMeters, 검색 후에는 검색 응답 radiusMeters를 사용한다. expanded만 서버 확장 안내로 표시한다. 지도 이동으로 반경이나 등록 가능 여부를 계산하지 않는다.
- 등록은 카테고리 available, 검색 available, 개별 registrable과 non-null pickToken을 모두 확인한다. 반경 밖 결과는 지도·검색에 표시할 수 있지만 등록 버튼은 비활성화한다.
- 이미지·카카오 장소 ID는 DTO에 없어 추가하지 않았다. 카테고리별 기존 기본 이미지를 사용하고 카카오 장소 ID는 null로 유지한다. 상세 링크는 응답 detailUrl을 기존 안전한 카카오 URL 검사에 통과한 경우에만 사용한다. 없는 URL을 좌표/이름으로 만들어 넣지 않는다.
- 저장된 내 장소에는 distanceMeters가 없으므로 거리 행을 숨긴다. 검색 카드만 응답의 거리를 표시한다. UI 식별 키는 이름/카테고리/주소/좌표 조합이며 서버 장소 ID나 등록 증표로 보내지 않는다.

### 등록·변경·철회·완료

- A15는 현재 registration.round와 **선택한 검색 응답의 pickToken**만 전송한다. 같은 카테고리의 새 장소는 교체하며, 철회는 pickToken:null이다. 새로운 검색·방 상태 조회 시 이전 검색 증표를 폐기한다. 증표를 로컬 저장소에 보관하지 않는다.
- PLACE_SUBMISSION_OPEN, closedAt, 서버 시각 기준 마감, me.canRegister, myCompleted와 allowedActions를 함께 확인한다. 완료 전 본인 등록만 변경·철회할 수 있고 완료 후에는 검색과 조회만 가능하다.
- A16은 모든 필수 카테고리의 본인 장소가 있을 때 현재 round로 호출한다. 버튼의 동기 잠금과 요청 핸들로 중복 실행을 합친다.
- 각 PUT 후 A08을 조회하고 같은 round의 실제 myNominations/myCompleted가 요청 결과와 일치해야 성공을 표시한다. PUT 성공 후 GET만 실패하면 결과 확인 버튼은 GET만 재시도한다. 응답을 잃은 PUT도 다시 전송하지 않고 GET으로 저장 결과를 확인한다. 명시적 400/409 거절은 우연히 서버 결과가 같아도 성공으로 바꾸지 않는다.
- 상태 불일치, STALE_ROUND, ALREADY_COMPLETED, DEADLINE_PASSED, WRONG_PHASE, 잘못된 증표 등은 오류와 최신 상태 재조회로 복구한다. 확인 전에는 추가 변경을 막는다. 401에는 로그인 링크, 403/404/429/503 및 네트워크 오류에는 해당 안내를 표시한다. 페이지를 떠난 뒤 늦은 응답으로 화면을 이동하지 않는다.

### 계약 확인 및 범위

배포 Swagger와 [Notion A14](https://app.notion.com/7979170baf5483d5b51981cca8b4bca6), [A15](https://app.notion.com/b6f9170baf548387b5fb014e2a86a1d0), [A16](https://app.notion.com/92f9170baf5482c88dfa813016e80fd4), [A08](https://app.notion.com/fd89170baf54821e8b0c81cb4b61ae8d)을 확인했다. 요청/응답 필드는 일치한다. Swagger의 required/nullable·오류 정의 누락은 Notion의 pickToken:null 및 400/409/503 정책으로 보완했다. 공통 src/api의 클라이언트·DTO·함수는 변경하지 않았으며 #25~#27 브랜치를 가져오지 않았다.

### 검증 결과

- `node --test tests/*.test.mjs`: **76개 통과**. 기존 64개 + #28의 DTO 표시·증표·회차·교체·철회·완료·권한·실패/재시도 테스트 12개.
- `npm run build`, `npm run lint`: 통과. 번들의 500 kB 청크 경고는 남아 있다.
- **모의 API 브라우저 검증**: 390×844 Chrome에서 서버 UUID 진입, 검색, 등록→교체→철회→완료, 새로고침 복원, 같은 roomId의 현황 화면과 현황 새로고침, PUT 성공/GET 실패 후 조회만 재시도, 검색 실패/재시도/빈 결과, 완료 후 수정 차단과 검색 허용, 401 안내, 독립 목 미리보기를 확인했다. 실제 서버 PUT 성공 검증이 아니다.
- **실제 서버 전송**: GET `/v3/api-docs` 200. 인증 없는 더미 UUID의 GET state와 GET places/search는 401. localhost Origin GET `/api/me`는 403. A15/A16 PUT의 localhost OPTIONS는 403, 운영 `https://meetdle.co.kr` Origin의 OPTIONS는 200이며 credentials를 허용했다. **실제 PUT은 전송하지 않았다.**
- localhost CORS 허용과 실제 로그인 세션이 없어 실제 보호된 DTO 직렬화, pickToken 발급/검증, PUT 저장 성공, 자동 마감·결과 전이의 실제 동작은 미검증이다. 기존 지도 계약 테스트는 통과했지만 실제 카카오 지도 타일·도메인 인증·실기기 지도/앱 전환은 이번 검증에 포함하지 않았다.

이슈 #11. `/rooms/places`에서 연다. Figma UI → Meetdle UI — Flow의 `198:9658`(현재 이름 `SCREEN 09 — 수정1`)과 STATE 09-A~F를 확인했다.

## 구현 및 기존 화면 연결

- 통합 브랜치: 등록 설정의 ‘장소 등록 시작하기’에서 `/rooms/places?roomId=exploration-preview`로 독립 목 미리보기를 연다. 등록 시작 API 호출·성공 처리나 SCREEN 10–14 상태 변경은 하지 않으며, 설정한 카테고리·마감은 아직 전달하지 않는다. 이 한계는 이동 전후 화면에도 표시한다.
- 원래 등록 설정 주소를 `returnTo`로 보존하므로 새로고침 후에도 헤더로 해당 설정에 돌아갈 수 있다. 외부 복귀 주소는 허용하지 않으며, 다른 방 ID로 이 독립 목 장소를 조회하면 복구 안내를 표시한다.

- `src/pages/PlaceExploration/`: 화면, 지도 패널, 선택 장소 카드, 추천 목록, 임시 타입·목 저장소.
- `src/lib/kakaoMaps/`: SDK 단일 로더, Circle·Marker·Clusterer 제어와 해제, 카카오맵 링크/fallback.
- 공통 Header·Button·`.page`, SCREEN 08 카테고리 타입/목 설정을 재사용한다. 공통 컴포넌트 자체는 수정하지 않는다.
- `/rooms/info?status=registrationOpen`의 기존 ‘가고 싶은 장소 등록하기’ 버튼을 `/rooms/places`로 연결했다. 해당 query는 기존대로 개발 모드에서만 유효하다.
- ‘등록 현황 보기’는 기존 `/rooms/registration/status`에 SCREEN 09 목 현황을 route state로 전달한다. 기존 현황 화면의 참여자 목록·집계 UI를 재사용한다.
- SCREEN 10–14 공통 목 방과는 독립이다. SCREEN 09 미리보기 현황으로 진입하면 관리 버튼은 비활성화되고 기존 목 방을 마감·변경하지 않는다. 기존 일반 경로의 동작은 유지한다.

## 실제 지도 설정

`.env.local`에 발급받은 **JavaScript 키**를 설정한다. `.env.example`에는 변수명만 있다.

```dotenv
VITE_KAKAO_MAP_APP_KEY=
```

1. 카카오 개발자 콘솔에서 앱의 카카오맵 사용 설정을 ON으로 설정한다.
2. 해당 JavaScript 키의 JavaScript SDK 도메인에 실제 origin을 등록한다. 예: `http://localhost:5173`, `http://127.0.0.1:5173`, 배포 서비스의 HTTPS 도메인. 사용하는 호스트·포트가 바뀌면 그 origin도 등록해야 한다.
3. 환경변수 변경 후 개발 서버를 재시작한다. Vite 환경변수는 클라이언트 빌드 시 반영된다. REST API 키·Admin 키·Client Secret을 넣지 않는다.

현재 저장소에는 실제 지도 키가 없다. 실제 카카오 지도 타일, 도메인 인증, 실제 기기의 지도 터치 동작은 **미확인**이다.

지도는 `https://dapi.kakao.com/v2/maps/sdk.js`를 `autoload=false&libraries=clusterer`로 한 번 로드하고 `kakao.maps.load()` 후 생성한다. 같은 키의 동시 호출은 하나의 Promise를 공유한다. 오류/15초 로딩 시간 초과 시 실패한 자체 스크립트를 정리하고 재시도할 수 있다. React StrictMode의 취소된 effect는 지도 인스턴스를 만들지 않는다.

중심과 반경은 전달받은 좌표·미터 단위 그대로 Circle에 적용한다. ‘원래 범위로 돌아가기’는 `circle.getBounds()`와 `map.setBounds()`로 중심 및 확대 수준을 함께 복원한다. 화면 크기 변화는 ResizeObserver → relayout 후 기존 뷰포트 중심을 유지한다. 마커 선택·검색·지도 이동·확대는 원 좌표/반경과 추천 응답을 변경하지 않는다. 클러스터 클릭은 지도 범위만 확대한다. 별도 장소 검색 라이브러리나 추천 알고리즘은 호출하지 않는다.

마커 이벤트·클러스터 이벤트·마커/원·컨트롤·ResizeObserver·예약된 frame을 해제한다. SDK에 공개된 Map destroy API가 없어 컨트롤/오버레이/이벤트 및 컨테이너를 정리하는 방식이다. 지도 영역에서 직접 조작하고, 페이지 스크롤은 지도 바깥에서 할 수 있다. 상태바·홈 인디케이터·정적 지도 대체 이미지는 없다.

공식 근거: [Web SDK 설정](https://apis.map.kakao.com/web/guide/), [Circle.getBounds·Map.setBounds·relayout·load 문서](https://apis.map.kakao.com/web/documentation/), [카카오맵 사용 설정](https://developers.kakao.com/docs/en/kakaomap/common).

## 데이터·API 경계 (임시, 백엔드 명세 미확정)

실제 추천/등록 API 계층은 현재 없다. URL이나 요청 필드를 추측해 네트워크 요청을 추가하지 않았다. `ExplorationRepository` 구현을 실제 API 어댑터로 교체한다.

- `load(signal)` → `ExplorationSnapshot`.
- `register({ roomId, placeId }, signal)` → 갱신된 전체 `ExplorationSnapshot`.
- 스냅샷: `roomId`, `currentUserId`, `areaLabel`, `meetingAt`, `deadline`, `registrationOpen`, `area { center { latitude, longitude }, radiusMeters, expansionMessage? }`, `categories`, `recommendations`, `registrations`, `participants`, `registeredPlaceCount`.
- 장소: 내부 `id`, 이름, 카테고리 ID, 위·경도, 표시 거리/주소/이미지, `kakaoPlaceId`, `kakaoMapUrl`, 서버의 등록 가능 판정 `eligible`.
- 내 등록 수는 현재 사용자 등록 기록 수, 방 장소 수는 `registeredPlaceCount`, 완료 인원은 응답의 참여자 상태에서 구한다. 서로 대체하지 않는다.
- 반경 밖 판정·추천 장소 집계·반경 확장은 서버가 제공한다. 프론트는 eligible과 expansionMessage를 표시하며 자동으로 반경을 3km로 확장하지 않는다.

선택과 등록은 분리된다. 지도 핀/검색 결과는 선택만 하고 ‘등록하기’에서 내부 placeId를 제출한다. 추천 장소 카드는 카드 전체를 누르면 카카오맵으로 이동하며 선택/등록을 실행하지 않는다. 지도 핀과 검색 결과는 후보 선택에 사용한다. 선택한 장소 카드도 이미지·정보 영역은 카카오맵으로 이동하고, 등록 버튼은 독립된 동작이다. 요청 중 버튼 및 동기 ref 잠금으로 중복 제출을 막는다. 실패하면 선택을 보존하고 다시 등록할 수 있다. 성공 시 응답 전체를 적용한다.

### 확인된 규칙과 미확정 항목

- 카테고리별 1인 최대 1곳은 SCREEN 08에 명시돼 있어 적용했다. 이미 등록한 카테고리를 덮어쓰지 않는다.
- 다른 사람과의 동일 장소 중복 금지, 등록 후 변경/취소 정책은 확인되지 않았다. 해당 제한이나 수정·취소 기능은 추가하지 않았다.
- SCREEN 08 소개 문구는 최소 1곳이지만 기존 `REGISTRATION_RULES.minimumPlacesPerPerson`은 2로 불일치한다. 이 화면은 1곳씩 추가하는 단계이므로 임의로 ‘최종 제출 최소 수’를 적용하거나 기존 코드를 바꾸지 않는다. 완료 인원은 서버 상태값을 표시한다.
- 목 fixture에서는 나머지 3명이 완료이고 현재 사용자는 식당을 등록한 상태다. 필수로 설정된 식당·카페를 채우면 해당 fixture의 현재 사용자만 완료로 바꾼다. 서비스 전체의 새로운 완료 규칙이 아니다.
- 목 장소 수는 기존 fixture의 8곳에 추가 후보를 반영한다. 같은 후보 기록이 있을 때 장소 수를 재가산하지 않는 계산은 목 저장소의 임시 정의다. 실제 집계 방식은 서버 계약 확정이 필요하다.
- 목 저장소는 현재 앱 메모리에서만 유지한다. 새로고침·다른 탭·서버와 동기화되지 않는다. 등록 안내에 서버 미저장을 명시한다.

## 카카오맵 상세 연결

응답의 `kakaoMapUrl`을 그대로 사용한다. 데스크톱 또는 카카오 장소 ID가 없을 때는 이 웹 URL을 연다. 목 장소는 실제 카카오 업체 ID가 없어 ID를 만들지 않았고, 공식 좌표 링크만 들어 있다. 실제 업체 상세 페이지 검증에는 백엔드의 ID/URL이 필요하다.

모바일에서 카카오 장소 ID가 있으면 사용자 클릭 안에서 `kakaomap://place?id=...`를 실행한다. 내부 id를 사용하지 않는다. 약 1.5초 뒤에도 문서가 보이는 경우 웹 URL로 이동한다. visibilitychange(hidden)·pagehide·컴포넌트 해제·다음 클릭 때 이전 fallback을 취소한다. 설치 감지 API나 설치 강제 흐름은 없다. 타이머는 앱 실행 성공을 완벽하게 판별하지 못한다.

공식 근거: [Android scheme](https://apis.map.kakao.com/android_v2/docs/api-guide/urlscheme/), [iOS scheme](https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/), [Chrome 외부 앱 실행과 사용자 제스처](https://developer.chrome.com/docs/android/intents).

iOS Safari·Android Chrome·카카오톡 등 인앱 브라우저의 실제 앱 전환, 설치/미설치, OS 확인창, 복귀 시 동작은 실기기 **미확인**이다. 호스트 웹뷰가 외부 scheme을 허용해야 하며, 브라우저 설정/확인창에 따라 전환이나 타이머가 다르게 동작할 수 있다. 직접 상세 보기 링크는 계속 제공한다.

## 개발 시나리오와 검증

개발 서버에서 다음 query는 독립 fixture를 만든다.

| 경로 query                | 확인 상태                                         |
| ------------------------- | ------------------------------------------------- |
| 없음                      | 정상 목 데이터, 내 등록 1/4, 장소 8곳, 완료 3/4명 |
| `?scenario=expanded`      | 서버 응답을 흉내 낸 3km 반경 및 확장 설명         |
| `?scenario=outside`       | 카페 탭의 C 카페 선택 시 범위 밖 등록 비활성화    |
| `?scenario=empty`         | 추천 없음                                         |
| `?scenario=emptyCulture`  | 문화시설 없음                                     |
| `?scenario=loadError`     | 최초 조회 실패, 재시도 성공                       |
| `?scenario=registerError` | 최초 등록 실패, 선택 보존 후 재시도 성공          |
| `?scenario=closed`        | 마감되어 등록 불가                                |

```bash
node --test tests/placeExploration.test.mjs
node --test tests/mockRoom.test.mjs tests/mockRoom.screens.test.mjs
npm run build
npm run lint
```

단위 테스트는 등록 조건·목 실패/재시도/취소·장소 수와 완료 인원 분리·SDK 원/범위/선택/정리 계약·scheme fallback 취소를 검증한다.

데스크톱 Chrome의 320/390/440px 및 1024px 레이아웃, 선택과 상세 링크 분리, 등록 실패/재시도/중복 제출 방지, 현황 화면 연결, SDK 로딩 실패/재시도 및 ResizeObserver를 검증했다. SDK contract double 검증은 실제 지도 타일 검증이 아니며 테스트 코드에서만 SDK 요청을 가로챈다. 키 없는 실제 프로덕션 빌드의 오류·재시도 UI도 별도로 확인한다.
