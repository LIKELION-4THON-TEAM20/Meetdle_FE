# Meetdle API 연동 계획

첫 단계는 공통 API 모듈과 계약 정의까지다. 현재 화면과 라우터는 기존 목 모드로 동작한다. 화면 번호는 Figma 1118 기준이며 1115 API 명세의 SC 번호와 별개다.

## 계약 근거

- [배포 OpenAPI](https://api.meetdle.co.kr/v3/api-docs)와 [Swagger UI](https://api.meetdle.co.kr/swagger-ui/index.html)는 HTTP 200이었다. OpenAPI 상세에는 28개 operation이 있으며, 1115 PDF의 A01–A28 중 A04만 빠져 있고 PDF 목록에 없는 `GET /api/health`가 추가돼 있다. 배포 문서에서 method, URI, 헤더, path/query/body, 응답 스키마, 상태 코드와 enum을 확인했다.
- A04는 백엔드 설명과 PDF에 따라 `POST /api/auth/logout`, 세션·CSRF 필요, 본문 없음, 204로 정의했다. A02의 OpenAPI에는 `state`, `code`, `error`가 선택값으로 표시된다. PDF는 `state` 필수, `code`와 `error` 상호 배타, `error_description` 선택을 명시한다. 콜백은 서버가 처리한다.
- OpenAPI에 응답 필드의 required·nullable 표시와 다수 오류 응답 정의가 빠져 있어 1115 PDF의 필드 표와 오류 설명으로 보완했다. 특히 `RoomState`의 단계별 섹션과 역할별 필드는 null 가능하며, `allowedActions` 문자열은 PDF의 Action 집합으로 정의했다. 인증 응답과 보호된 DTO의 실제 직렬화는 로그인 세션 확보 후 확인한다.
- [Figma 1118 UI](https://www.figma.com/design/j0vB2agrqNcfIBuaqVHTEJ/4호선톤?node-id=443-14429)와 [1118 Flow](https://www.figma.com/design/j0vB2agrqNcfIBuaqVHTEJ/4호선톤?node-id=443-8338)의 프레임과 텍스트 메타데이터를 확인했다. [Notion API 명세](https://app.notion.com/p/4199170baf5480c8a32ec5a886bde915), [11월 16일 회의록](https://app.notion.com/p/16-41a9170baf548057966fead60fb0bf68), [통합 UI 점검](https://app.notion.com/p/UI-41a9170baf5480318e07d4db997c5d39)은 연결된 계정에서 404로 반환돼 개별 API 페이지에 접근할 수 없었다.

## 프로젝트에서 달라지는 부분

- 기존 React·TypeScript·Vite·SCSS 구성과 설치 의존성을 사용한다. 예전 `src/api/auth.ts`의 로그인 URL 검증은 기존 화면에서 계속 사용한다.
- `src/api/client.ts`는 공통 fetch, 세션 조회/무효화, CSRF, 오류, 요청 핸들을 제공한다. `auth.ts`는 세션·로그아웃과 카카오 최상위 브라우저 이동, `rooms.ts`는 방·초대·검색·단계별 요청 함수를 제공한다. `types.ts`는 wire DTO, `mappers.ts`는 UI 카테고리·역할·선택값 변환이다.
- 기존 `FlowLayout`의 로컬 방 복구, `useRoomNavigation`의 방 ID·목 역할 전달, `createdRoom` 및 `mockRoom` 저장소·시나리오는 계속 목 흐름을 처리한다. Header·Modal·Button·Toast와 기존 화면 UI에 손대지 않았다.

## 공통 모듈 사용

`.env.local`에 `VITE_API_BASE_URL=https://api.meetdle.co.kr`을 설정하고 Vite를 재시작한다. `.env.example`에 동일한 공개 Origin을 예시로 넣었으며 `.env.local`은 Git에서 무시된다. Origin 뒤에 `/api`를 붙인 설정도 같은 URL로 정규화된다. Vite 환경변수는 공개 값만 사용한다.

- 앱 진입·OAuth 복귀 후 `getSession({ refresh: true })`로 A03을 조회한다. 세션 쿠키는 브라우저가 관리하고, 쓰기에는 현재 세션의 `X-CSRF-TOKEN`을 보낸다. `401` 또는 성공한 로그아웃에서 메모리 세션을 비운다. 주체나 토큰 변경이 감지되면 이전 사용자 작업 핸들을 무효화한다. 다음 화면에서 세션·방 데이터와 증표를 함께 폐기한다.
- 카카오 로그인은 `startKakaoLogin(inviteToken?)`으로 최상위 이동한다. 초대 링크의 토큰만 A01에 넘긴다. 일반 홈 복귀와 초대 복귀 URL은 A02가 결정한다.
- 등록·투표 등 변경 요청은 사용자 의도마다 `roomMutations`에서 핸들을 한 번 만든다. 예를 들어 `roomMutations.calculateOptions(roomId, { inputVersion })`을 CTA의 요청 상태에 보관하고 `execute()`를 호출한다. 같은 핸들의 동시 호출은 한 Promise를 공유하며, 성공 후 다시 호출해도 결과를 재사용한다. UI에서는 실행 중 버튼을 비활성화하고 로딩을 표시한다.
- A05·A11·A13·A17·A20·A23과 A27의 EXTEND에는 UUID를 발급한다. 타임아웃 등 같은 논리 요청의 재시도에는 같은 핸들을 사용한다. 입력이 바뀌거나 새 작업이면 새 핸들을 만든다. 키 없는 쓰기의 응답을 받지 못했으면 서버 상태부터 확인한다. 화면에서 핸들을 새로 만드는 중복 클릭을 방지해야 한다.
- `ApiRequestError`의 `status`, `code`, `details`로 분기한다. 400은 입력, 401은 재인증, 403은 접근 거절, 404/410은 방·초대 복구, 409는 상태·버전 재조회, 429는 재시도 제한, 503은 일시 장애로 처리한다. `KEY_REUSED`는 이전 키를 다른 본문에 사용한 경우다. `STALE_*`와 `WRONG_PHASE`에서는 A08을 다시 조회하고 새 상태로 UI를 갱신한다. 요청이 실패하면 해당 화면의 기존 Toast 또는 폼 오류를 사용한다. 브라우저가 차단한 CORS와 연결 장애는 JS에서 `NETWORK_ERROR`로 관측되므로 콘솔·Network에서 원인을 구분한다.

## RoomState 조회 전략

서버 화면용 데이터 진입점은 `getRoomState(roomId, signal)`다. 실제 UUID v4만 받으며, 응답 `roomId`가 다르면 오류를 낸다. 인증 화면 연결 시 loader에서 URL의 방 ID로 조회하고, 라우트 이동·언마운트에서 이전 요청을 취소한다. 화면·권한은 `phase`, `me.role`, `allowedActions` 및 단계별 상태로 판단한다. `joinedCount`, `inputProgress`, `members`, `registration`·`voting`의 진행률·완료 목록과 본인 상태, `meeting`, `result`는 서버 스냅샷에서 표시한다.

최초 진입과 새로고침, 변경 성공 직후, 포커스 복귀에 재조회한다. 모집·등록·투표 진행 중에는 보이는 탭에서 간격을 둔 재조회를 적용하고 겹치는 조회는 하나만 유지한다. 응답을 해당 세션·방에 귀속시키고 오래된 응답으로 최신 화면을 덮지 않는다. `revision`, `inputVersion`, `round`, `selectionId`, `draftRevision`, `resultRevision`은 서버 값 그대로 보존한다. 카운트다운은 `serverNow` 기준으로 계산하고 0이 되면 재조회한다. 브라우저에서 단계를 임의로 전환하지 않는다.

현재 목 라우터와 실제 UUID 라우트의 분기는 화면 연동 단계에서 명시적으로 적용한다. 목 ID와 scenario는 기존 저장소에서만 사용한다. 서버 오류를 목 데이터로 대체하지 않으며 서버 호출에 URL `role`을 권한 값으로 넘기지 않는다.

## 화면별 호출 순서

| 화면                     | 호출 시점 및 전달 데이터                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCREEN 02 생성 완료      | SCREEN 01의 A05 `POST /api/rooms`(201) 성공 후 반환된 `roomId`로 이동. 공유는 응답의 `invite.code`와 `invite.inviteUrl` 사용. 직접 진입·새로고침은 A08(200)으로 복원. 최근 ROOM-02 UI와 복사 완료 모달 유지.                                                                                                                                                                                          |
| SCREEN 02 초대 입장      | 링크 토큰으로 공개 A06 `GET /api/invitations/{token}`(200), 로그인 여부는 A03. 로그인 CTA에서 A01 → 서버 A02(302). 로그인 후 코드와 링크 진입 시 토큰을 A25 `POST /api/invitations/resolve`(200)로 전달. 같은 세션에서 발급된 `joinProof`로 A07 `POST /api/rooms/{roomId}/join`(201/200) 실행 후 A08. 홈에서 확인한 코드는 증표를 재사용하고 재발급은 만료 또는 세션 변경 시 처리.                    |
| SCREEN 04 모집·입력 현황 | A08로 가입·입력 완료 상태와 가능 동작 복원. 추천 CTA의 A11 `POST /api/rooms/{roomId}/planning-options`(201/200)에 `inputVersion` 전달. 제안은 SCREEN 04에서 한 번 실행하고 SCREEN 05에서 결과 조회. 호출 소유권은 SCREEN 05 담당자와 합의.                                                                                                                                                            |
| SCREEN 06·07 확정·정보   | SCREEN 05 담당자가 A12 `PUT /api/rooms/{roomId}/meeting-selection`(200)을 소유. `optionsId`, `slotId`, `candidateId`, 최초 null 또는 기존 `expectedSelectionId` 전달. 06·07은 A08의 meeting 사용. 재선택은 서버 허용 상태에서만 제공.                                                                                                                                                                 |
| SCREEN 08 등록 설정      | A08로 현재 selection 확인 후 A28 `GET /api/rooms/{roomId}/place-submission/categories`(200). `available`, `radiusMeters` 사용. 시작 CTA에서 A13 `POST /api/rooms/{roomId}/place-submission`(201)에 최신 `selectionId`, `requiredCategories`, 선택 `closesAt` 전달. 문화시설 필수 이동 제한과 기존 DnD 유지, 성공 후 A08.                                                                              |
| SCREEN 10 등록 현황      | A08로 진행률·본인 상태 조회. A23 `POST /api/rooms/{roomId}/place-submission/extension`(200)에 현재 round, MINI_TIMER/EXTEND, 해당 마감 전달. 조기 마감 CTA에서 A26 `PUT /api/rooms/{roomId}/place-submission/closure`(204)에 round 전달. A08 재조회 후 자동 확정 또는 11로 이동.                                                                                                                      |
| SCREEN 11 마감·투표 시작 | 이전 화면에서 닫은 방은 A08로 복원. 아직 열려 있고 해당 화면에서 닫기 버튼을 제공하는 흐름에 한해 A26 실행. 투표 시작 CTA에만 A17 `POST /api/rooms/{roomId}/voting`(204), `registration.round`와 `closesAt` 전달. 두 요청을 따로 처리하고 각 성공 후 A08.                                                                                                                                             |
| SCREEN 12 투표           | A08의 후보·`myDraft` 조회. A18 `PUT /api/rooms/{roomId}/preferences/me`(200)에 `round`, 현재 `draftRevision`(최초 0), VOTE 후보 선호 전체를 전달. 제출 전 마지막 저장을 완료하고 반환된 최신 `draftRevision`으로 A19 `PUT /api/rooms/{roomId}/vote-submissions/me`(204), 이후 A08 조회. 기존 하단 32px CTA와 제출 완료 UI 유지.                                                                       |
| SCREEN 13 투표 현황      | A08의 `voting`·`voteReview`와 `allowedActions` 사용. 만료 후 A27 `POST /api/rooms/{roomId}/voting/decision`(204)에 `voteReview.round`, EXTEND이면 새 `closesAt`, PROCEED이면 마감 필드 생략. A08 결과에 따라 다음 화면 결정.                                                                                                                                                                          |
| SCREEN 14 최종 결과      | A08에 `tieDecision`이 있을 때만 A21 `PUT /api/rooms/{roomId}/result/selections`(204)에 회차·결과 버전·동률별 선택 제출. A08로 확정 결과를 조회하고 `REORDER_VISIT` 허용 시 A22 `PUT /api/rooms/{roomId}/result/visit-order`(204)에 최신 결과 버전 및 전체 선정 후보 ID 순서를 전달. 복구 가능 시 A20 `POST /api/rooms/{roomId}/recovery`(201)에 회차와 새 마감 전달. 별도 최종확정 API는 문서에 없다. |

### 담당자 간 전달 계약

- **로그인·홈**은 A03/A04 및 A01/A02, A24 `GET /api/rooms`(200, scope/limit/cursor), 초대 코드의 A25를 사용한다. 현재 홈의 새 방 카드는 ROOM-02로 돌아간다. ROOM-05 모집 진입은 새 방 UUID와 A08의 단계·역할을 기준으로 홈 담당자와 합의한다. `WAITING_FOR_DEPARTURE`의 모집/일정 입력 분기에 필요한 서버 신호와 뒤로가기 규칙을 함께 정한다.
- **SCREEN 01**은 A05에서 제목, 서울 날짜 `dates.from/through`(양 끝 포함 최대 7일), 정원 2–6명을 전달하고 방 UUID·초대 응답을 SCREEN 02와 연결한다.
- **SCREEN 03**은 A09 `GET /api/stations`(200, q/limit)의 역 ID와 A10 `PUT /api/rooms/{roomId}/inputs/me`(200)의 슬롯, `inputRevision`, 완료 여부를 사용한다. 완료 후 A08을 다시 읽어 SCREEN 04의 상태에 반영한다.
- **SCREEN 09**는 A14 `GET /api/rooms/{roomId}/places/search`(200, category/q/page/bounds), A15 `PUT /api/rooms/{roomId}/place-submission/me/{category}`(204, round/pickToken), A16 `PUT /api/rooms/{roomId}/place-submission/me/completion`(204, round)을 사용한다. `pickToken: null`은 후보 철회다. 동일 방 ID의 A08로 SCREEN 10이 회복·갱신된다.

## 정책 차이와 확인 사항

- 등록 시작은 약속까지 6시간 이상이면 최소·기본 60분, 그보다 짧으면 30분, 마감 상한은 약속 3시간 30분 전이다. 등록 진행 중 미니 타이머와 마감 후 연장은 각각 회차당 한 번이며 기존 등록을 유지한다. 조기 마감은 정원 기준 `ceil(capacity/2)` 이상 완료와 필수 후보 충족, 자동 마감은 가입자 전원 완료 기준이다.
- 필수 후보 1곳은 자동 선정, 선택 후보 1곳은 투표 대상이다. 유효 후보가 모두 자동 선정이면 등록 마감에 결과가 확정된다는 것이 PDF 계약이다.
- 투표 중 과반 조기 마감은 기존 목 정책이다. 1115 기준 자동 마감은 제출 수가 정원에 도달할 때이며 만료 후 PROCEED는 1표 이상이면 가능하다. EXTEND는 1회이고 기존 표·초안을 보존하며 약속 시작 3시간 전이 상한이다. 자동 마감·집계와 무동률 즉시 공개 시점, 미결정·0표 종료 조건은 백엔드 추가 답변으로 확정한다.
- 동률이 있으면 A21이 동률 선택·결과를 함께 확정하며 A22는 공개된 결과를 재정렬하는 것이 1115 정책이다. 방문 순서 변경 허용 시점과 Figma의 최종 확정 CTA를 어떤 서버 전이에 매핑할지 추가 확인한다. 재등록은 결과 선정 실패 시 1회이며 이전 등록과 표를 복제하지 않는다.
- 다른 참여자의 등록·투표 완료 여부만 표시한다. 개인 장소·선호를 다른 사용자에게 보여주거나 로컬 상태로 추정하지 않는다.

## 배포 연결 확인

| 확인                                      | 관측 결과                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Swagger UI / OpenAPI / health             | 모두 200, health는 `UP`.                                                                                                                    |
| Origin 없는 비로그인 A03                  | 401 `UNAUTHENTICATED`.                                                                                                                      |
| Chrome localhost에서 credentials 포함 GET | health와 A03 모두 `MissingAllowOriginHeader` / `net::ERR_FAILED`. 클라이언트에서 `NETWORK_ERROR`.                                           |
| localhost 사전 요청                       | A05의 POST 사전 요청에 `content-type,x-csrf-token,idempotency-key` 요청 시 403 `Invalid CORS request`. 공개 health의 Origin 포함 GET도 403. |
| 운영 프런트 Origin 사전 요청              | `https://meetdle.co.kr`에 대해 200, credentials true, Content-Type/X-CSRF-TOKEN/Idempotency-Key 허용.                                       |
| 카카오 로그인 시작                        | 302, 목적지 호스트 `kauth.kakao.com`. 로그인 완료·세션 발급·로그아웃·콜백 복귀 URL은 미검증.                                                |

백엔드에 `http://localhost:5173` Origin 허용, credentialed GET·POST·PUT·OPTIONS와 요청 헤더 허용, 로그인·초대 복귀 허용 URL을 확인한다. localhost와 API는 교차 사이트이므로 세션 쿠키의 SameSite/Secure 및 브라우저의 타사 쿠키 설정으로 실제 전송이 되는지도 확인해야 한다. 이 단계의 서버 검증은 GET과 OPTIONS로 수행했다.

## #27 구현 경계 (2026-11-19)

참여 현황 CTA가 A11을 소유하고 후보 화면은 A08 조회만 수행한다. A12 후 서버 meeting을 A08로 확인해 서버용 확정 화면에 전달한다. `features/planning/`에 요청 작업·표시 어댑터·UUID 전용 라우트를 추가했으며 기존 공통 클라이언트/DTO, #25·#26 미병합 작업, #28 화면은 변경하지 않았다. 목 미리보기는 기존 경로로 유지한다. 매핑·재시도·검증 및 후속 등록 화면 연결 경계는 [SCREEN05.md](./SCREEN05.md)를 따른다.

Notion 개별 A11/A12 페이지는 이번 작업에서 연결된 계정으로 조회할 수 있었다. 배포 Swagger와 필드는 일치하며, required/nullable와 일부 오류 정의 누락은 기존 계약을 따른다. 실서버에는 GET·OPTIONS만 보냈다. localhost는 A03 및 A11/A12 사전 요청에서 403을 반환해 실제 인증 세션과 POST/PUT 성공 검증은 남아 있다.
