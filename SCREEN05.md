# SCREEN 05 — 가능한 일시 + 중간지역 후보 · HOST

## 진입 경로와 호출 소유권 (#27)

- 실제 서버: `/rooms/participation-status?roomId=<UUID v4>` → 계산 CTA의 A11 → `/rooms/candidates?roomId=<동일 UUID>` → 확정 CTA의 A12 → `/rooms/confirmed?roomId=<동일 UUID>`.
- `features/planning/PlanningRoutes.tsx`에서 위 세 화면만 서버/목 경로를 분기한다. 참여 현황·후보는 기존 CreatedRoomLayout의 로컬 저장소 검사를 UUID에 한해 우회한다. 확정만 기존 MockRoomLayout을 우회한다. 다른 화면은 기존 경로를 유지한다.
- 서버 화면은 최초 진입·새로고침·‘최신 상태 다시 조회’에서 세션과 A08을 읽는다. URL의 role/scenario와 navigation state를 서버 권한·데이터로 사용하지 않는다.
- A11 호출 소유자는 **참여 현황 계산 CTA 하나**다. 후보 화면은 A08의 options만 읽으며 진입·새로고침 시 POST하지 않는다. 이미 options가 있으면 참여 현황에서도 재계산 대신 후보 조회로 이동한다.
- A12 후 A08을 다시 읽어 반환된 selectionId·일시·역이 실제 meeting과 일치하는지 확인한다. 그 meeting을 다음 화면의 navigation state에 전달하되, 확정 화면도 A08로 복원한다. 로컬 확정값·저장소를 서버 성공으로 사용하지 않는다.
- #28의 장소 등록 설정/장소 화면은 수정하지 않았다. 서버 확정 화면에서 기존 목 장소 등록 화면으로 넘어가는 CTA도 제공하지 않는다. 해당 연결은 후속 담당 범위다.

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
- 확정 작업은 PUT을 한 번 시도한 후 다시 전송하지 않는다. 응답을 잃거나 성공 후 조회에 실패하면 ‘서버 확정 결과 다시 확인’으로 GET을 수행한다. 서버 meeting이 선택한 일시·역과 일치해야 이동한다. 성공 응답을 받은 경우 selectionId도 일치해야 한다. 명시적 HTTP 거절은 다른 사용자 확정과 우연히 일치해도 해당 요청의 성공으로 처리하지 않는다.
- 실패 뒤 다른 후보를 선택하려면 ‘최신 상태 다시 조회’로 최신 버전과 기대 selectionId를 읽는다. 진행 중 제출·재조회 버튼과 선택 칸을 비활성화한다. 언마운트한 화면의 늦은 변경 응답으로 이동하지 않는다.
- 로딩·빈 후보·401/403/404/410/409/429/503·네트워크 오류를 표시한다. STALE_INPUT/STALE_SELECTION/WRONG_PHASE 등은 최신 상태 재조회로 복구한다. 서버 실패를 목 후보·로컬 성공으로 대체하지 않는다.

## 목 미리보기 유지

- `/rooms/candidates` 또는 `?roomId=mock-created-preview`는 기존 목 예시다. 참여 현황의 기존 최소 인원/확인 모달과 로컬 확정 미리보기 흐름을 유지한다.
- 목 시간/지역 추천 정렬, 네이티브 라디오, 이동정보 상세 펼침 동작과 기존 테스트를 유지한다. 서버 경로에서는 상세 펼침 버튼을 표시한다.

## 검증 (2026-11-19)

- `node --test tests/*.test.mjs`: 기존 64개와 #27의 서버 매핑·권한·중복 요청·재시도·선택 경합 테스트.
- `npm run build`, `npm run lint` 실행. 빌드의 500 kB 청크 경고는 남아 있다.
- 모바일 크기 Chrome에서 **API 응답을 가로챈 테스트**로 참여 현황 → 후보 → 확정, 새로고침 GET 전용, 동일 키 재시도, PUT 성공/GET 실패 후 조회만 재시도, 서버 MEMBER 권한, 후보 없음, 401, 기존 목 경로를 확인했다. 실제 인증 성공을 검증한 것이 아니다.
- **실제 배포 서버에 전송**: GET `/v3/api-docs` 200; 인증 없는 더미 UUID의 GET state 401; localhost Origin GET `/api/me` 403; A11 POST와 A12 PUT의 localhost OPTIONS 403. 운영 Origin `https://meetdle.co.kr`의 OPTIONS는 200이며 credentials 및 각 요청 헤더를 허용했다. 실제 POST/PUT은 전송하지 않았다.
- Swagger와 Notion A11/A12의 요청 필드·응답 구조는 일치했다. Swagger에는 required/nullable와 오류 응답 정의가 일부 빠져 있어 Notion의 최초 expectedSelectionId null·409/503 정책을 함께 사용했다. 평균 대기시간·교통수단은 두 응답 계약에 없다.
- localhost CORS 허용 및 실제 카카오 세션이 없어 실제 사용자 A08 응답, 인증된 A11/A12 성공, 서버의 추천 품질·경로 계산·경합 처리는 아직 검증하지 못했다.
