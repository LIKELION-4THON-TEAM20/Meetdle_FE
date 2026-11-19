# SCREEN 05 — 가능한 일시 + 중간지역 후보 · HOST

## 진입 경로와 호출 소유권 (#27, 최신 develop 반영)

- 실제 서버: `/rooms/participation-status?mode=api&roomId=<UUID>` → A11 → `/rooms/candidates?mode=api&roomId=<동일 UUID>` → A12 → `/rooms/confirmed?mode=api&roomId=<동일 UUID>`. 기존 mode 없는 UUID 주소도 지원한다.
- `/rooms/{roomId}` 공통 진입은 A08의 phase·role·allowedActions로 분기한다. FlowLayout은 실제 UUID의 참여 현황·후보·확정 주소를 공통 ServerRoomHandoff에 연결한다. 목 흐름은 기존 경로를 유지한다.
- A11의 UI 호출 소유자는 develop의 ServerParticipation 계산 CTA다. 기존 #27 임시 참여 현황을 제거하고 공통 createParticipationCommands의 동일 요청 핸들·키 재사용을 사용한다. 입력 일부 완료 시 기존 확인 모달도 유지한다.
- 후보는 공통 useRoomState가 읽은 A08 options로 표시하며 진입·새로고침은 POST를 보내지 않는다. HOST만 후보 확정이 가능하며 일반 회원은 서버 진행 현황으로 연결된다. URL role/scenario와 navigation state를 권한으로 사용하지 않는다.
- A12 뒤 A08의 실제 selectionId·역·일시가 요청/성공 응답과 일치하는지 확인한 후 서버 확정 화면으로 이동한다. navigation state로 meeting을 전달하더라도 다음 화면은 A08에서 복원한다.
- 확정 후에는 develop의 ServerMeeting을 사용한다. #25·#26·#28의 미병합 작업은 가져오지 않으며 해당 화면 기능을 수정하지 않는다.

## 서버와 UI 매핑

- `features/planning/model.ts`가 wire DTO를 기존 카드 표시 모델로 변환한다. 공통 `src/api/rooms.ts`, `types.ts`, 클라이언트 변경은 없다.
- 시간 ID는 slotId, 지역 ID는 candidateId다. 시간은 meetingAt/endsAt을 Asia/Seoul 기준으로 표시하며 자정 종료 시 다음 날짜를 함께 표시한다. 서버가 반환한 1시간 슬롯을 프런트에서 합치거나 연장하지 않는다.
- A11이 정렬해 반환한 슬롯 순서를 유지하고 첫 슬롯을 추천으로 표시한다. 지역도 서버 순서를 유지하며 이유 배지는 reasons의 BALANCED/LOW_TRANSFER로 표시한다. 첫 시간·지역을 기본 선택한다.
- 인원 분모는 슬롯의 availableCount + unavailableParticipantIds.length다. 최초 계산 스냅샷 이후 가입자/입력자가 늘어도 현재 capacity나 completedCount를 후보의 분모로 섞지 않는다.
- 불참자 이름과 travel 참여자 이름은 members의 participantId로 연결한다. 조회되지 않은 이름은 ‘참여자’로 표시한다. 평균·최대 이동시간, 평균 환승, 참여자별 minutes/transfers는 서버 값을 그대로 사용한다.
- 서버가 제공하지 않는 평균 대기시간·교통수단을 만들지 않는다. 지하철 노선은 숫자 또는 ‘2호선’, ‘수인분당선’ 같은 문자열을 지원한다.
- A12 본문은 optionsId, slotId, candidateId, expectedSelectionId뿐이다. 최초 null, 재선택은 현재 state.meeting.selectionId를 전달한다. options.inputVersion은 계산 당시 버전으로 보존하며, A11 요청은 조회한 state.inputVersion을 사용한다.

## 요청·실패 처리

- 계산 작업은 하나의 roomMutations.calculateOptions 핸들을 유지한다. 중복 클릭은 하나의 Promise로 합치고 실패 재시도는 같은 본문·Idempotency-Key를 사용한다. POST 성공 후 A08만 실패하면 조회만 재시도한다.
- 확정 작업은 PUT을 한 번 시도한 후 다시 전송하지 않는다. 응답을 잃거나 성공 후 조회에 실패하면 ‘서버 확정 결과 다시 확인’으로 GET을 수행한다. 5xx 응답도 처리 결과가 불확실하므로 조회로 확인한다. 서버 meeting이 선택한 일시·역과 일치해야 이동한다. 성공 응답을 받은 경우 selectionId도 일치해야 한다. 명시적인 4xx 거절은 다른 사용자 확정과 우연히 일치해도 해당 요청의 성공으로 처리하지 않는다.
- 실패 뒤 다른 후보를 선택하려면 ‘최신 상태 다시 조회’로 최신 버전과 기대 selectionId를 읽는다. 진행 중 제출·재조회 버튼과 선택 칸을 비활성화한다. 언마운트한 화면의 늦은 변경 응답으로 이동하지 않는다.
- 로딩·빈 후보·401/403/404/410/409/429/503·네트워크 오류를 표시한다. STALE_INPUT/STALE_SELECTION/WRONG_PHASE 등은 최신 상태 재조회로 복구한다. 서버 실패를 목 후보·로컬 성공으로 대체하지 않는다.

## 목 미리보기 유지

- `/rooms/candidates` 또는 `?roomId=mock-created-preview`는 기존 목 예시다. 참여 현황의 기존 최소 인원/확인 모달과 로컬 확정 미리보기 흐름을 유지한다.
- 목 시간/지역 추천 정렬, 네이티브 라디오, 이동정보 상세 펼침 동작과 기존 테스트를 유지한다. 서버 경로에서는 상세 펼침 버튼을 표시한다.

## 검증 (2026-11-20)

- `npm run build`, `npm run lint` 통과. 기존 500 kB 청크 경고는 남아 있다.
- `node --test --test-concurrency=1 tests/*.test.mjs`: 전체 104개 통과. 새 회귀 검증은 A12의 503 후 실제 결과 조회 복구와 명시적 409 거절의 성공 오인 방지다.
- 모바일 크기 Chrome + 모의 API: 공통 참여 현황의 일부 완료 확인 모달 → 후보 → 서버 확정, 새로고침 GET 전용, 동일 키 재시도, PUT 성공/GET 실패 뒤 GET만 재시도, MEMBER 권한, 후보 없음, 401, 기존 목 경로, 409 후 최신 후보를 읽고 명시적 재확정을 검증했다.
- 실제 배포 서버: GET OpenAPI 200, localhost:5173 Origin의 비인증 A03·A08 GET은 401이며 Allow-Origin·Allow-Credentials를 반환했다. A11 POST와 A12 PUT의 OPTIONS는 200이다. 과거 로컬 CORS 403은 재현되지 않았다. 실제 인증된 POST/PUT은 전송하지 않았다.
- 최신 [Notion A11](https://app.notion.com/p/b449170baf5482778bdb01b41a8a627c)·[A12](https://app.notion.com/p/d009170baf5482f8b0c501a57032d9f9)와 [배포 OpenAPI](https://api.meetdle.co.kr/v3/api-docs)의 method·경로·요청/응답 필드는 일치한다. Swagger에는 required/nullable와 오류 응답 정의가 일부 빠져 있어 Notion의 최초 expectedSelectionId null·409/503 정책을 함께 사용했다. 평균 대기시간·교통수단은 만들지 않았다.
- 실제 카카오 세션으로 두 역할의 계산·확정·재선택 성공과 쿠키 전송은 미검증이다. CORS 사전 요청 성공을 실제 저장 성공으로 보고하지 않는다.

## 이번 develop 병합 수정

- API_INTEGRATION.md와 router/index.tsx의 양쪽 변경을 보존하고 중복 import·구형 화면 분기를 정리했다.
- 공통 RoomStatus가 후보 단계를 실제 ServerCandidates로 연결하며, 최신 조회 후 이전 오류·요청 핸들을 폐기한다.
- 공통 API DTO·클라이언트는 현재 develop 그대로 사용한다. 세션 변경 시 공통 RoomState가 이전 화면과 진행 중 요청의 영향을 폐기한다.
