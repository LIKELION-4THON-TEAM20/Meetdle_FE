# #25 로그인·홈 API 연동

`feat/#25-auth-home-api`에서 최신 공통 API에 맞춰 로그인·홈·초대·로그아웃을 연결했다. #26~#28 화면과 공통 API 계약 파일, 환경변수 파일은 이번 변경에서 수정하지 않았다.

## 적용한 흐름

- A03 `GET /api/me`로 세션을 복원하고 확인 중·비로그인·오류·재시도를 구분한다. 세션 만료, 사용자/CSRF 변경, 로그아웃 시 이전 목록과 가입 증표를 폐기한다.
- A01 카카오 로그인은 최상위 브라우저 이동이다. `returnOrigin`은 현재 프런트 Origin이며 서버 허용 목록에 등록돼야 한다. `inviteToken`과 `returnTo`는 동시에 보내지 않는다. 서버 `returnTo`는 `/rooms/{UUID}`만 허용하므로 나머지 안전한 내부 경로는 같은 탭의 sessionStorage에서 한 번 복원한다.
- 서버 복귀 경로 `/rooms`, `/rooms/{UUID}`, `/invite/{token}`을 지원하며 기존 `/invitations/{token}`, `/rooms/invite`도 유지한다. 직접 방·초대로 복귀하면 일치하는 보관 경로를 소비한다. `CANCELLED`, `PROVIDER_UNAVAILABLE`을 표시한다. OAuth 콜백·인가 코드 교환은 백엔드 담당이다.
- A24 `GET /api/rooms`의 scope·cursor·정렬을 사용한다. 필터 전환과 오래된 요청을 구분하며 목록 로딩·빈 상태·오류·더 보기·재시도를 제공한다. INVALID_CURSOR는 첫 페이지부터 다시 조회한다. `RESULT_READY`를 표시하며 참여자 개인정보를 만들어내지 않는다. 프로필 이미지는 A03 URL을 사용하고 로드 실패 시 기본 이미지로 돌아간다.
- A32 `DELETE /api/rooms/{roomId}`는 요청자의 지난 약속 목록에서만 숨긴다. 방 자체나 다른 사람의 목록은 삭제하지 않는다. ENDED, 확정 종료 시각 경과, 미확정 후보 종료일 경과를 반영한다. 서버 UPCOMING_ROOM 거절 시 카드를 남기고 오류·재시도를 제공한다. 중복 제출을 막고 성공 후 서버 목록을 다시 조회한다. 요청 본문은 없으며 CSRF를 보낸다.
- A25 초대 코드 확인과 A07 가입을 분리한다. joinProof는 사용자·CSRF·방에 묶어 메모리에 보관하며 만료 시 재확인한다. 잘못된 코드·만료·정원·마감·요청 제한·세션 만료를 처리한다. A06의 MEMBER는 추가 코드나 가입 POST 없이 해당 방으로 이동한다.
- A04 로그아웃은 본문 없는 POST와 CSRF를 사용한다. 성공 후 세션·증표·목록을 제거하고 실패를 성공으로 처리하지 않는다.

## 범위와 연결 지점

홈 카드 및 참여 성공은 실제 UUID의 `/rooms/:roomId`로 이동해 A08 상태를 조회한다. develop 병합 후 이 경로는 공통 ServerRoomStatus의 phase·역할·allowedActions 분기로 연결한다. #26~#28의 미병합 화면 연결을 임의로 가져오지 않는다. 목 미리보기 경로와 실서버 경로를 구분하고 API 실패를 목 성공으로 대체하지 않는다.

## 명세 확인과 차이

2026-11-19에 [기존 Notion 명세](https://app.notion.com/p/4199170baf5480c8a32ec5a886bde915), 공통 API 문서가 참조하는 [최신 API 명세_1118](https://app.notion.com/p/41d9170baf5480e694ddc7758f0b0411), [배포 OpenAPI](https://api.meetdle.co.kr/v3/api-docs)의 #25 관련 내용을 비교했다. 기존 링크의 28개 문서에만 의존하지 않고 최신 36개 API 중 A01~04·A06~08·A24~25·A32 계약을 사용했다.

| 항목 | 차이와 처리 |
| --- | --- |
| A04 로그아웃 | 최신 Notion에는 세션·CSRF를 사용하는 POST/204가 있으나 Swagger에는 operation이 없다. 명세 기반 호출을 유지하며 인증된 배포 성공은 미검증이다. |
| A32 숨김 | Notion은 204, Swagger는 빈 200이다. 기존 공통 mutation이 두 응답을 처리하므로 별도 응답 필드를 만들지 않았다. |
| A02 콜백 | Swagger의 필수 표기와 Notion의 state 필수·code/error 배타 조건에 차이가 있다. 백엔드 콜백을 프런트에서 재구현하지 않고 복귀 loginError를 표시한다. |
| A01 복귀 | 서버 returnTo는 임의 내부 경로가 아니라 `/rooms/{UUID}`만 허용한다. 초대 토큰과 배타적으로 전달한다. |

## 검증

- `npm run build`, `npm run lint`, `node --test tests/*.test.mjs`: 통과, develop 병합 후 전체 107개 테스트.
- 단위·모의 HTTP: 세션 전환, 지연 응답, 코드 확인과 가입 분리, 중복 제출, 증표 만료, 서버 DTO, 안전한 OAuth 복귀, RESULT_READY, 지난 약속 판정, 숨김 200/204·409·재시도·소유 세션 변경을 확인했다.
- 실제 Chrome + 모의 API: 홈 복원, 숨김 실패·재시도·목록 재조회·새로고침, 로그아웃, OAuth 방/초대 복귀 쿼리, 로그인 취소, 기존 회원 바로 입장, 코드 확인 후 가입, 목록 실패·재시도·서버 scope를 확인했다.
- 실제 배포 서버: 인증 없이 GET `/api/me`, GET `/api/rooms`는 401이며 localhost:5173의 Allow-Origin과 Allow-Credentials가 있다. 로그아웃 POST·초대 확인 POST·방 DELETE에 대한 OPTIONS는 200이다. 과거 로컬 CORS 403 관측은 현재 재현되지 않았다.

실제 인증된 POST·DELETE, 카카오 계정 로그인, 실제 세션 쿠키의 발급·복귀·전송은 검증하지 않았다. OPTIONS 성공은 해당 쓰기 operation의 성공을 입증하지 않는다. `VITE_API_BASE_URL=https://api.meetdle.co.kr` 설정과 프런트 returnOrigin의 백엔드 허용, 카카오 리다이렉트 및 세션 쿠키 설정이 필요하다. 모의 테스트를 실제 서버 가입·로그아웃·숨김 성공으로 보고하지 않는다.

## 이번 변경 파일

- 인증·홈 서비스: `src/features/auth/{errors,loginReturn}.ts`, `src/features/homeApi/{model,hideRoom}.ts`.
- 라우터: `HomeRoute`, `LoginRoute`, `InvitationRoute`, `ServerRoomRoute`, `index`, `paths`.
- 홈 UI: `Home`, `appointment.types`, `AppointmentDeleteModal`, 공통 `HomeHeader`의 프로필 이미지 표시.
- 검증·문서: `tests/authHomeApi.test.mjs`, `AUTH_HOME_API.md`, `API_INTEGRATION.md`.
