# #25 로그인·홈 API 연동

`feat/#25-auth-home-api`에서 로그인, 홈 목록, 초대 확인·참여, 로그아웃만 연결한다. #26 일정·이동정보 입력, #27 일시·중간지역 후보, #28 장소 탐색·등록 화면 파일은 수정하지 않았다. 방 생성과 이후 단계 화면의 API 연결도 이 작업 범위에 포함하지 않는다.

## 호출과 화면 상태

- `LoginRoute`는 A03 `GET /api/me`로 세션을 확인한다. 비로그인일 때 카카오 버튼은 A01 `/api/auth/kakao/start`로 최상위 브라우저를 이동시킨다. 초대 링크의 `inviteToken`만 쿼리로 전달한다. 카카오 인가 코드 교환과 A02 콜백은 서버가 담당한다. 프런트에서 `code`를 로그인 자격으로 취급하지 않는다.
- 서버가 홈으로 복귀시키면 세션을 다시 조회한다. 같은 탭의 `sessionStorage`에는 허용된 프런트 복귀 경로만 저장하고 1회 소비한다. 서버 초대 복귀와 `loginError`도 지원한다. CSRF 토큰·가입 증표·사용자 정보를 브라우저 저장소에 저장하지 않는다.
- 세션 상태는 확인 중/인증됨/비로그인/조회 오류로 나눈다. 화면 진입, 보이는 탭으로 복귀, 포커스 복귀, 온라인 복구 시 재조회한다. 401, 성공한 로그아웃, 사용자/CSRF 변경은 이전 화면 상태와 증표를 폐기한다. 늦게 도착한 이전 세션의 결과·오류로 상태를 복원하지 않는다.
- `HomeRoute`는 A24 `GET /api/rooms`에 `scope=ALL|UPCOMING|PAST`, `limit=20`, 필요할 때 이전 응답의 `nextCursor`를 보낸다. 필터마다 서버 분류·정렬을 그대로 사용한다. 빠른 필터 전환 및 페이지 이탈은 조회를 취소하고 오래된 결과를 무시한다. 로딩/오류/빈 목록/더 보기를 제공한다.
- 홈 카드는 `MyRoomSummary`의 `joinedCount`, `phase`, 확정 시각(서울 날짜) 또는 후보 시작일을 표시한다. 응답에 없는 참여자 이름·사진은 만들지 않는다. 제목 null에는 표시용 문구를 사용한다. 서버에 없는 약속 삭제 API를 만들지 않으며 실서버 목록에서는 로컬 삭제 UI를 숨긴다.
- 홈 코드 입력은 A25로 확인하고 초대 미리보기로 이동한다. 가입은 별도의 참여 버튼에서만 A07을 호출한다. 잘못된 코드, 만료, 정원 초과, 참여 마감, 요청 제한, 세션 만료, 연결 실패를 구분한다.
- `invitationFlow`는 `joinProof`를 현재 사용자/CSRF/방에 묶어 메모리에만 보관한다. 같은 참여 작업은 동일한 mutation 핸들을 사용한다. 증표 기한이 지난 경우 같은 코드·토큰으로 재확인한다. 새로고침으로 증표가 사라졌다면 코드를 다시 요구하며 가입된 것으로 추정하지 않는다. 가입 응답의 `roomId`도 요청 대상과 일치해야 한다.
- A04 `POST /api/auth/logout`에는 세션 쿠키와 CSRF 헤더를 보내고 본문은 보내지 않는다. 성공하면 메모리 세션/증표/이전 홈 데이터를 폐기하고 로그인 화면으로 이동한다. 실패를 성공으로 처리하지 않는다.

## 방 화면 담당자와의 연결 지점

홈 및 참여 성공의 진입점은 `/rooms/:roomId`다. 이 경로는 A08을 조회하고 실제 서버의 제목·단계·인원·날짜를 표시한다. 다른 단계 화면은 아직 서버 UUID를 처리하지 못하므로 기존 목 라우터로 보내지 않는다. #26~#28 화면 연동 후 `ServerRoomRoute`에서 `phase`, `allowedActions`, 본인 입력 상태 등에 따라 연결하면 된다. `WAITING_FOR_DEPARTURE`를 정원만으로 모집/입력 화면에 임의 매핑하지 않았다.

초대 진입은 `/rooms/invite?inviteToken=...`(또는 `token=...`), `/invitations/:token`을 지원한다. 홈 코드 확인 후에는 `/rooms/invite?roomId=...`와 메모리 증표를 사용한다. **백엔드의 실제 프런트 초대 복귀 경로와 `inviteUrl` 직렬화는 인증된 응답으로 확인이 필요하다.** 서버가 다른 경로로 복귀하도록 설정돼 있다면 한쪽을 합의해 맞춰야 한다.

## Swagger와 Notion 비교

2026-11-19에 [배포 OpenAPI](https://api.meetdle.co.kr/v3/api-docs)와 [Notion API 명세](https://app.notion.com/p/4199170baf5480c8a32ec5a886bde915)의 A01/A02/A03/A04/A06/A07/A24/A25 본문을 확인했다. 초기 공통 모듈 작성 시 접근하지 못했던 Notion 페이지를 이번에는 연결된 팀 워크스페이스로 읽을 수 있었다.

| 항목           | 차이와 적용                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그아웃 A04   | Notion은 `POST /api/auth/logout`, 세션·CSRF, 204를 정의한다. 배포 OpenAPI에는 operation이 없다. 공통 모듈의 명세 기반 호출을 화면에 연결했으며 인증된 배포 호출은 미검증이다.                                                                                           |
| 콜백 A02       | Notion은 `state` 필수, `code/error` 상호 배타, `error_description` 선택 및 복귀 URL의 `loginError`를 정의한다. OpenAPI는 state/code/error를 모두 선택값으로 표시하고 error_description은 없다. 콜백은 서버가 처리하며 프런트는 `loginError`만 사용자 메시지로 표시한다. |
| 필드·오류 정의 | OpenAPI에 다수 required/nullable 및 실패 응답이 누락돼 있다. Notion의 오류 코드와 기존 공통 DTO를 사용했으며 응답 필드를 임의로 추가하지 않았다.                                                                                                                        |
| 홈 목록        | Notion은 확정 종료 시각·후보 종료일·종료 상태로 PAST를 정의한다. 프런트의 기존 날짜 필터로 재분류하지 않고 A24의 scope를 사용한다. 응답에는 사용자별 사진·이름이 없다.                                                                                                  |
| 삭제·후속 화면 | 홈 약속 삭제 endpoint와 `WAITING_FOR_DEPARTURE`의 화면 분기에 필요한 정책은 #25 계약에 없다. 삭제 요청이나 권한·후속 단계 완료 상태를 만들지 않았다.                                                                                                                    |

Notion 데이터베이스의 ‘구현’ 속성은 모두 ‘미구현’으로 남아 있으나 일부 배포 operation은 확인됐다. 해당 속성을 실제 배포 여부의 근거로 사용하지 않았다.

## 설정 및 실제 서버 관측

`.env.local`에 `VITE_API_BASE_URL=https://api.meetdle.co.kr`을 설정하고 개발 서버를 재시작한다. 기존 `VITE_KAKAO_LOGIN_URL` 대신 공통 클라이언트가 만드는 A01 주소를 사용한다. `.env.example`과 `.env.local`은 이번 작업에서 수정하지 않았다.

2026-11-19에 인증하지 않은 GET/OPTIONS와 로그인 시작 응답까지만 확인했다. 실제 사용자 가입·로그아웃 등의 쓰기는 실행하지 않았다.

| 요청                                            | 결과                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/health`                               | 200, UP                                                                                           |
| Origin 없는 `GET /api/me`                       | 401, UNAUTHENTICATED                                                                              |
| `Origin: http://localhost:5173`의 `GET /api/me` | 403, Invalid CORS request, Allow-Origin 없음                                                      |
| `Origin: https://meetdle.co.kr`의 `GET /api/me` | 401, Allow-Origin 일치 및 Allow-Credentials true                                                  |
| localhost Origin의 로그아웃 POST 사전 요청      | 403                                                                                               |
| 운영 Origin의 로그아웃 POST 사전 요청           | 200, credentials 및 x-csrf-token 허용. 이 결과만으로 실제 로그아웃 구현 여부를 입증하지는 않는다. |
| 로그인 시작 GET                                 | 302, 카카오 인가 호스트로 이동. 계정 로그인은 수행하지 않음.                                      |

백엔드 확인이 필요한 사항:

- 로컬 개발 Origin과 credentials, CSRF 요청 헤더에 대한 CORS 허용.
- 실제 로그인 후 세션 쿠키의 Domain/Path/SameSite/Secure와 브라우저의 쿠키 전송.
- 프런트 홈·초대 복귀 URL, 취소·실패 시 loginError 전달.
- OpenAPI에 없는 로그아웃 operation의 실제 배포 및 세션 무효화.
- 인증된 A24/A25/A07/A08 응답의 직렬화 및 실제 방 정원 경쟁 상황.

## 검증

- `npm run build`, `npm run lint` 통과.
- `node --test tests/*.test.mjs`: 공통 클라이언트와 기존 화면 회귀 테스트 포함 총 73개 통과.
- `tests/authHomeApi.test.mjs`: 세션·로그아웃·지연 응답, 코드 확인/참여 분리, 중복 클릭, 증표 만료 재확인, 다른 사용자 증표 폐기, 정원/마감, DTO 변환, 안전한 1회 복귀 경로.
- 실제 Chrome + 모킹한 API 응답: 서버 목록/더 보기, 서버 scope/오래된 응답 무시, 코드 오류/요청 제한/정원 초과, 초대 확인/가입/방 상태, 로그아웃 데이터 제거, 로그인 취소/OAuth 최상위 이동, 로그인 후 복귀, 세션 만료, 연결 오류 재시도. 브라우저 런타임 오류 없음.

브라우저 테스트는 API 응답 모킹 검증이며 **배포 백엔드·카카오 계정·실제 쿠키를 사용한 종단 검증은 아니다.** 실제 세션이 필요한 부분은 위 설정 확인 후 운영 또는 허용된 개발 Origin에서 검증해야 한다.

## 변경 파일

- 공통 세션 알림: `src/api/client.ts`.
- 인증 서비스: `src/features/auth/session.ts`, `errors.ts`, `loginReturn.ts`, `invitations.ts`.
- 홈 데이터 변환·조회: `src/features/homeApi/model.ts`, `useRoomList.ts`.
- 라우트: `src/router/HomeRoute.tsx`, `LoginRoute.tsx`, `InvitationRoute.tsx`, `ServerRoomRoute.tsx`, `AuthStatus.tsx`, `AuthStatus.scss`, `index.tsx`, `paths.ts`.
- 홈 UI: `src/pages/Home/Home.tsx`, `appointment.types.ts`, `join-code.types.ts`, `components/AppointmentCard.tsx`, `components/JoinByCodeDialog.tsx`.
- 로그인 UI: `src/pages/Login/Login.tsx`, `Login.scss`.
- 검증·문서: `tests/authHomeApi.test.mjs`, `API_INTEGRATION.md`, `AUTH_HOME_API.md`.
