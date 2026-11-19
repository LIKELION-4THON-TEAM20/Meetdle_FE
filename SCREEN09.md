# SCREEN 09 — 장소 탐색 및 등록

## #28 서버 API 연동 (2026-11-20)

현재 브랜치는 `feat/#28-place-exploration-api`다. 서버 경로와 독립 목 미리보기를 분리한다. 이 절 아래의 #11 설명은 기존 목 구현 기록이다.

### 진입·조회·현황 연결

- `/rooms/places?mode=api&roomId=<실제 UUID>` 및 기존 mode 없는 UUID 주소를 공통 ServerRoomHandoff로 연결한다. A08 phase·role·allowedActions가 장소 탐색을 허용하면 ServerPlaceExploration을 표시한다.
- 최초 진입·새로고침·포커스 복귀·최신 상태 다시 조회에서 세션과 A08을 사용한다. meeting.station의 좌표·이름·약속 시각, registration의 round·closesAt·categories·myCompleted·progress를 표시한다.
- 본인 후보는 반드시 `registration.myCandidates`의 candidateId·place로 복원한다. ID가 없으면 장소 키나 목 ID를 대신 만들지 않고 응답 오류로 표시한다. 다른 참가자의 개별 등록 장소를 추정하지 않는다.
- 완료 후 A08의 myCompleted를 확인하고 같은 UUID의 `serverScreenUrl(PATHS.registration, roomId)`로 이동한다. 기존 임시 현황 라우트 대신 develop의 서버 등록 현황을 사용하며 후속 마감·투표 기능 자체는 수정하지 않는다.
- `/rooms/places` 및 `roomId=exploration-preview`의 독립 목 미리보기는 유지한다. 실제 UUID 요청 실패를 목 응답으로 대체하지 않는다. #25~#27 미병합 작업은 가져오지 않았다.

### 검색·지도·표시

- A14에 카테고리, trim한 검색어(빈 값은 q 생략), page 1~3을 전달한다. 250ms 디바운스·요청 취소·응답 세대로 이전 결과를 폐기한다. 로딩·검색 실패·재시도·빈 결과·nextPage 추가 검색을 제공한다.
- 지도 중심은 서버 확정 역의 lat/lng다. 반경은 registration.categories 및 검색 응답 radiusMeters를 사용하고 expanded만 서버 확장으로 표시한다. available·registrable·pickToken 및 카테고리 정책을 모두 확인한다.
- 지도는 기존 Kakao UI·Subtract·핀 모션을 재사용한다. 등록한 후보의 장소 키를 registeredIds로 전달해 보라색 핀 상태를 표시한다. 현재 카테고리의 본인 후보와 검색 결과를 합치며 지도 아래에 선택 장소·검색 결과 카드를 둔다.
- 서버 제공 imageUrl만 사용하고 없으면 기존 카테고리별 기본 이미지를 사용한다. 상세 링크는 서버 detailUrl만 사용한다. 카카오 ID·URL·사진을 만들어내지 않는다. 등록 장소에 distanceMeters가 없으면 거리 행을 숨긴다.
- UI 장소 키는 카테고리·이름·주소·좌표로 구성하되 서버 candidateId나 pickToken 대신 전송하지 않는다.

### 복수 추가·단건 삭제·완료

- A34 `POST /api/rooms/{roomId}/place-submission/me/candidates`에 현재 round·category와 검색 응답의 pickToken을 보낸다. 같은 카테고리의 후보를 여러 곳 추가하며 기존 후보를 교체하지 않는다. 응답 candidateId와 재조회한 A08의 후보를 대조한다.
- A35 `DELETE .../candidates/{candidateId}?round=...`는 A08에서 복원한 본인 후보 ID 한 곳만 삭제한다. 본문은 없고 쿠키·CSRF를 보낸다. 다른 본인 후보와 다른 참가자의 후보는 건드리지 않는다. A15 전체 교체·카테고리 일괄 삭제를 사용하지 않는다.
- A16 완료 조건은 본인 myCandidates가 한 곳 이상인 것이다. 필수 카테고리 충족은 방 전체 정책이며 개인 완료 조건과 구분한다. 완료 요청 본문은 현재 round만 보낸다.
- 서버 phase·마감·자격·myCompleted·allowedActions를 확인한다. 중복 클릭을 합치고 변경 후 같은 회차의 A08을 다시 읽어 실제 결과와 일치해야 성공으로 처리한다.
- 쓰기 성공 후 GET 실패나 응답 유실·5xx는 쓰기를 반복하지 않고 결과 확인 버튼에서 GET으로 복구한다. 명시적 4xx 거절은 성공으로 바꾸지 않는다. 최신 조회를 검토한 뒤에만 새 작업을 시작한다. 세션 변경 시 이전 입력·증표·쓰기 결과의 영향을 폐기한다.

### 명세와 검증

2026-11-20 [Notion A14](https://app.notion.com/p/56b9170baf5483d0a60e81e828504afe), [A16](https://app.notion.com/p/b5f9170baf5483979ce00173f85cc12b), [A34](https://app.notion.com/p/0a19170baf5482a285c981b38059d3ad), [A35](https://app.notion.com/p/7149170baf5483708a4d01b89a9844fb)와 [배포 OpenAPI](https://api.meetdle.co.kr/v3/api-docs)를 확인했다. A08의 최신 myCandidates 계약은 현재 develop의 공통 DTO를 사용한다. src/api의 공통 계약 파일은 이번 보완에서 변경하지 않았다.

- A35는 Notion에 204, Swagger에 빈 200이다. 기존 공통 removeCandidate가 discardResponse로 둘 다 처리하며 회귀 테스트를 추가했다.
- Swagger의 required/nullable·실패 응답 표기는 일부 빠져 있어 Notion의 15분 증표·회차·권한·오류 계약을 함께 사용한다.
- `npm run build`, `npm run lint`, `node --test --test-concurrency=1 tests/*.test.mjs`로 검증했으며 전체 111개 테스트가 통과했다. 빌드의 기존 500 kB 청크 경고는 남아 있다.
- 모의 API Chrome 검증: mode=api/기존 UUID 진입, 같은 카테고리 두 곳 추가, 새로고침 뒤 ID 복원·한 곳 삭제, 필수 FOOD를 비워도 후보 한 곳으로 완료, 같은 방 서버 현황·새로고침, 쓰기 성공/GET 실패 뒤 조회만 재시도, 명시적 409 후 최신 상태 재제출, 검색 실패·빈 결과·401·독립 목 경로를 확인했다.
- 실제 배포 서버: localhost:5173 Origin의 비인증 A03·A08·A14 GET은 401이며 Allow-Origin·Allow-Credentials가 있다. A34 POST·A35 DELETE·A16 PUT의 OPTIONS는 200이다. 이전 CORS 403은 이번 확인에서 재현되지 않았다.
- 실제 인증된 POST·DELETE·PUT, 실제 pickToken 발급·검증·자동 마감 전이, 카카오 지도 타일·도메인 인증·실기기 앱 전환은 미검증이다. OPTIONS와 모의 검증을 실제 저장 성공으로 보고하지 않는다.

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

## 지도 UI 보정 (Figma 1118)

- `Meetdle Flow - 1118 화면ID 수정`의 SCREEN 09 — 수정1 (`443:11804`) 및 `컴포넌트 모음`의 Category Pick을 확인했다.
- ‘처음 위치로’는 사용자 요청에 따라 지도 왼쪽 위 12px로 이동했다. 반경 밖 안내는 버튼 아래에 표시한다.
- Subtract (`443:11860`) 원본을 투명 SVG로 내보내 원 밖만 `#EEEEF0` 75%로 덮는다. 원 안은 색을 입히지 않는다. 지도 projection으로 확정 중심과 반경의 화면 좌표를 계산해 이동·확대·리사이즈에 맞춰 음영도 움직인다. 이 표시는 등록 가능 판정이나 서버 반경을 변경하지 않는다.
- 카테고리별 기본/등록 핀은 Figma 원본 투명 SVG를 사용한다. 기본은 회색 `#ABA9B2` 20px, 클릭 시 회색 30px, 본인 등록 성공 후 보라색 `#7C5CFF`이다. 등록 색과 선택 크기는 독립적이며 선택 해제하면 20px로 돌아간다. 실패 시 보라색으로 바꾸지 않는다. 지도에 다른 사용자의 등록 장소를 추측해서 표시하지 않는다.
- 기존 배경 포함 PNG는 지도 핀에서 사용하지 않는다. 새 SVG는 배경을 따로 제거하거나 도형을 다시 그리지 않고 원본 컴포넌트를 내보냈다.
- 처음 위치 복원은 원 경계에 맞추되 SDK의 이산 배율 때문에 원이 절반 크기로 보일 때 한 단계 확대한다. 기본 화면의 핀이 클러스터에 가려지지 않도록 먼 배율(level 10)부터 클러스터를 사용한다.
- 실제 localhost:5173의 카카오 지도에서 초기 회색 핀, 클릭 확대, 목 등록 성공 후 보라색 전환, 왼쪽 상단 버튼 및 반경 밖 음영을 브라우저로 확인했다. 등록은 목 저장소만 사용했으며 서버 변경 요청은 보내지 않았다.

### Subtract 고정 표시

Subtract 음영은 사용자 요청에 따라 지도 영역 중앙에 고정한다. 지도 이동·확대에는 연동하지 않고 컨테이너 크기 변경에만 맞춘다. 지리 좌표와 실제 등록 가능 판정은 변경하지 않는다. 지도 draggable 설정과 음영의 pointer-events:none을 유지한다.

### Frontend States & Assets 기본 이미지

`198:17068` 섹션의 08 PLACE IMAGE PLACEHOLDER를 기준으로 식당·카페·주점·문화시설 기본 이미지를 새 원본 SVG로 교체했다 (`198:17245/17248/17251/17254`). 원본 72×72 에셋은 그대로 보관하고 카드의 56×56 프레임 안에 축소 표시한다. 실제 사진도 같은 프레임을 사용하며, 사진이 없거나 로딩에 실패하면 해당 카테고리 기본 이미지를 표시한다. 새 배경은 #F7F5FF다.

### 장소 카드 컴포넌트 기준 최종 보정

이전 Frontend States & Assets 기본 이미지 적용은 사용자 요청으로 컴포넌트 모음의 식당·카페·주점·문화시설 카드 기준으로 대체했다 (`431:44743/44757/44771/44791`). 썸네일은 해당 카드에 포함된 회색 배경의 64×64 원본 SVG를 사용한다. 버튼은 상단 16px·오른쪽 14px, 카카오맵 링크는 하단 10px·오른쪽 14px로 통일했다. 원본에서 식당 선택 버튼과 링크가 다른 카드보다 4px 안쪽으로 들어간 차이는 앞선 사용자 요청에 따라 통일한다. 등록하기 보라색·선택 회색 및 카드 회색 테두리는 유지한다.
