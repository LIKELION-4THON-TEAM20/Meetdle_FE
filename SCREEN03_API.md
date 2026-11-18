# #26 일정·이동정보 입력 API 연동

작업 브랜치: `feat/#26-schedule-transit-api`. #25 인증·홈 코드, #27 후보 계산/확정 화면, #28 장소 화면과 `src/api/` 공통 모듈은 변경하지 않았다. 기존 공통 `getRoomState`, `searchStations`, `roomMutations.saveInput`을 사용한다.

## 진입 경로

- 실제 서버: `/rooms/schedule-transit?roomId=<서버 UUID v4>`.
- 저장 후 서버 참여 현황: `/rooms/participation-status?roomId=<동일 UUID>`.
- 기존 목 화면: `/rooms/schedule-transit?roomId=mock-created-preview` 유지. 목 방/역/저장 후 화면 연결은 기존 구현을 사용하며 서버에 목 ID를 보내지 않는다.
- 잘못된 ID는 기존 복구 화면에서 차단한다. 실제 UUID 요청의 실패를 목 화면으로 대체하지 않는다.

`CreatedRoomLayout`은 위 두 화면의 실제 UUID만 로컬 방 복구를 건너뛰게 한다. `ScheduleApiRoutes`가 실제/목 화면을 분기한다. 실제 UUID를 기존 `ParticipationStatus` 목 화면에 보내지 않도록 서버 현황을 조회하는 별도 분기를 추가했다. 다른 단계 라우트의 의미나 #25 로그인 복귀 정책은 바꾸지 않았다.

## 조회·복원

세션은 기존 A03 함수로 조회하고, A08 `GET /api/rooms/{roomId}/state`에서 해당 방을 복원한다. 방 ID 일치를 확인하고 `dates`, `myInput`, `allowedActions`, `me`를 읽는다. 후보 기간은 서울 LocalDate인 `dates.from`부터 `dates.through`까지 양 끝을 포함한다. 실제 날짜와 최대 7일 범위를 검증하며 임의 날짜나 기본 revision을 만들지 않는다.

컴포넌트 언마운트/방 변경 시 조회를 취소하고 이전 방의 응답을 무시한다. 직접 URL 접근과 새로고침도 같은 조회를 수행한다. 로딩·재시도·401 로그인 안내·403·404·네트워크 오류 상태를 제공한다. #25를 합치기 전 로그인 경로 자체는 원래 구현이며 이 브랜치에서 OAuth를 다시 구현하지 않았다.

## 정확한 매핑

| UI                       | 서버 DTO                                               | 처리                                                                                                            |
| ------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 후보 날짜 배열           | `dates.from`, `dates.through`                          | UTC 산술로 날짜 문자열만 생성. 서울 날짜를 브라우저 시간대로 이동시키지 않음                                    |
| `date/23:00` 칸          | `{ date, hour: 23 }`                                   | `23:00~24:00`인 1시간 칸. hour는 10~23 정수                                                                     |
| 출발역 `Station.id`      | `originStationId`                                      | 검색 응답의 실제 `stationId` 그대로                                                                             |
| 이후 목적지 `Station.id` | `destinationStationId`                                 | 검색 응답의 실제 `stationId` 그대로. 출발역과 같은 ID 허용                                                      |
| UI 노선 `{ id, name }[]` | `Station.lines: string[]`                              | `7`/`7호선`은 UI id `7`, 이름 `7호선`. 기타 노선 문자열은 원문 보존. 지원 노선이 하나라도 있는 환승역 선택 가능 |
| 기존 선택·역             | `myInput.slots`, `originStation`, `destinationStation` | null 역은 미선택, 빈 slots는 빈 선택. 잘못된 시간은 조용히 누락하지 않고 응답 오류                              |
| 저장 버전                | `myInput.inputRevision`                                | 서버 값을 그대로 제출. 최초 서버 값이 0이면 0 사용. 누락을 임의의 0으로 대체하지 않음                           |
| 입력 완료 버튼           | `complete: true`                                       | 이 화면은 완료 제출만 제공. 임의의 부분 저장이나 자동 저장은 추가하지 않음                                      |

`completedAt`이 있거나 `COMPLETE_INPUT` 권한이 없으면 변경/제출을 차단하고 저장된 내용을 읽기 전용으로 표시한다. 완료된 입력에서 현황으로 이동할 때 PUT을 다시 보내지 않는다. URL `role`로 권한을 만들지 않는다.

## 역 검색

`GET /api/stations?q=...&limit=10`을 출발/목적지에서 각각 사용한다. 250ms 디바운스, 40자 제한, 요청 취소, 검색어별 결과 구분으로 지연된 이전 결과가 새 검색을 덮지 않게 한다. 로딩·빈 결과·오류·검색 재시도를 표시한다. 복원/선택된 역은 해당 서버 역을 유지하며, 다른 검색어로 변경하면 기존 선택을 해제한다. API 실패 시 부분 목 역 목록을 사용하지 않는다.

## 저장·재시도

- `PUT /api/rooms/{roomId}/inputs/me`에 두 역 ID, 전체 slots, 현재 inputRevision, complete를 보낸다. 공통 클라이언트가 쿠키와 CSRF를 첨부한다.
- UI의 동기 ref와 저장 핸들로 중복 제출을 합치고 저장 중 입력을 잠근다. 일반 입력 오류는 선택값을 유지한 채 수정·재시도할 수 있다.
- PUT 성공 응답의 새 revision/완료 값/선택을 확인한 뒤 A08을 다시 조회한다. 조회에서도 해당 입력의 완료와 revision을 확인한 후 같은 방의 참여 현황으로 이동한다.
- PUT 성공 후 A08만 실패하면 재시도는 GET만 수행한다. 서버가 성공했다고 응답했는데 다시 PUT을 보내지 않는다.
- PUT 응답 유실/5xx처럼 결과가 불확실하면 입력 변경을 잠그고 재시도 시 A08부터 확인한다. 이미 동일 입력이 완료됐으면 재전송 없이 복구한다. 아직 이전 버전이면 같은 버전으로 명시적 재시도가 가능하다. 상태가 달라졌으면 자동 덮어쓰지 않는다.
- `STALE_INPUT`/`INPUT_LOCKED` 등 409는 A08로 확인하고 ‘서버 입력 다시 불러오기’로 최신 상태를 검토하도록 한다. 새 revision으로 자동 재제출하지 않는다. 재조회도 실패한 경우 다음 시도에서 조회부터 수행한다.
- 완료 후 참여 현황은 서버 `inputProgress`, 가입 인원, `members`가 있을 때의 이름/완료 상태를 표시한다. 미공개 회원 정보를 만들지 않고 #27의 후보 계산 호출/동작을 추가하지 않는다.

## 명세 확인 및 실제 서버 제약

2026-11-19 배포 [OpenAPI](https://api.meetdle.co.kr/v3/api-docs), [Notion A08](https://app.notion.com/p/fd89170baf54821e8b0c81cb4b61ae8d), [A09](https://app.notion.com/p/2c29170baf548303b0f9817aaecc075d), [A10](https://app.notion.com/p/e4c9170baf54832f887e01dcbad5316d)을 확인했다.

- #26의 method·경로·필드에는 충돌이 없다. OpenAPI에는 hour가 서울 시간 10~23이고 최초 inputRevision이 0임이 명시돼 있다.
- OpenAPI는 `MyInput`의 required/nullable 및 A10 오류 응답을 충분히 명시하지 않는다. Notion은 null 역·null completedAt과 `STALE_INPUT`, `INPUT_LOCKED`, `UNSUPPORTED_STATION`, `INVALID_SLOT`, `INPUT_INCOMPLETE`를 명시하므로 이를 사용했다.
- `Station.lines`는 두 문서 모두 string[]이며 실제 문자열 형식 enum은 없다. 숫자/‘호선’ 형식은 지원하고 다른 문자열은 보존한다. 인증된 실제 응답으로 형식을 최종 확인해야 한다.
- 비인증 `GET /api/stations?q=노원`은 401 UNAUTHENTICATED였다.
- localhost Origin의 A03 GET과 A10 PUT 사전 요청은 403/Allow-Origin 없음이었다. 운영 Origin `https://meetdle.co.kr`의 PUT 사전 요청은 200이며 credentials, Content-Type, X-CSRF-TOKEN을 허용했다.
- 실제 인증 세션에서 A08/A09/A10 실행, 세션 쿠키 전송, 배포 데이터 직렬화는 미검증이다. 이를 위해 localhost Origin CORS 허용과 정상 로그인 세션 또는 운영 Origin 환경이 필요하다. 실제 서버에 입력 PUT을 보내지는 않았다.

## 검증

- `npm run build`, `npm run lint` 통과.
- `node --test tests/*.test.mjs`: 전체 75개 통과.
- `node --test tests/scheduleTransit.test.mjs tests/scheduleTransitApi.test.mjs tests/apiRooms.test.mjs tests/apiClient.test.mjs tests/routingFlow.test.mjs`.
- `tests/scheduleTransitApi.test.mjs`: 날짜 경계/윤일, 시간·역 매핑, 초기 revision/빈 입력, 읽기 전용, 중복 저장, PUT 성공 후 GET 재시도, 응답 유실 복구, 충돌 재조회 실패, 세션 변경, 잘못된 성공 응답 등 11개.
- 실제 Chrome + 모킹 API: 직접 URL/새로고침 복원, 비동기 역 검색 경합, 중복 제출, 저장 실패 값 유지·재시도, 상태 재조회 실패 후 GET만 재시도, 참여 현황 복원, 버전 충돌, 완료 입력, 빈/미지원/실패 검색, 401, 기존 목 경로와 잘못된 ID의 호출 차단.

브라우저 검증은 모킹 기반이며 실제 카카오 로그인·세션 쿠키를 사용하는 종단 검증은 아니다. 커밋·PR은 생성하지 않는다.

## 변경 파일

- UI 복원/저장 상태 및 비동기 검색: `src/pages/ScheduleTransit/ScheduleTransit.tsx`, `ScheduleTransit.scss`, `components/StationSearch.tsx`, `components/AvailabilityGrid.tsx`.
- #26 전용 어댑터·검색·조회·저장/재조회 정책: `src/pages/ScheduleTransit/api/`.
- 실제/목 입력·참여 현황 분기: `src/router/ScheduleApiRoutes.tsx`, `index.tsx`, `FlowLayout.tsx`.
- 테스트·문서: `tests/scheduleTransitApi.test.mjs`, `SCREEN03.md`, `SCREEN03_API.md`, `API_INTEGRATION.md`.
