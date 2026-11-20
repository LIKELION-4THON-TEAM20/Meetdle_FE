# SCREEN 13 투표 현황

## 구현 파일

- `src/pages/VoteStatus/VoteStatus.tsx`, `VoteStatus.scss`
- `src/pages/VoteStatus/components/VoteParticipantList.tsx`
- `src/pages/VoteStatus/components/VoteCloseModal.tsx`
- `src/pages/VoteStatus/components/VoteResultPending.tsx`
- `src/pages/VoteStatus/types.ts`, `mockData.ts`, `statusUtils.ts`
- `src/router/index.tsx`: `/rooms/vote/status`만 추가
- `scripts/verify-screen13.mjs`, 이 문서

공통 Header·Button·Modal과 `.page`, SCREEN 04의 참여자 목록 SCSS, SCREEN 12의 타이머 포맷 함수를 재사용한다. 기존 페이지와 공통 컴포넌트는 수정하지 않는다. API 호출, 서버 저장, SCREEN 14 연결은 없다.

## 브라우저 테스트

`npm run dev` 후 아래 경로에 직접 진입한다. DEV 쿼리는 프로덕션에서 무시한다.

| 경로                                       | 예상 동작                                                  |
| ------------------------------------------ | ---------------------------------------------------------- |
| `/rooms/vote/status`                       | 3/4명·75%, 실제 현재 시각에 따라 1초마다 타이머 갱신       |
| `/rooms/vote/status?scenario=ongoing`      | 3/4명·75%, 남은 시간 02:15:30 고정                         |
| `/rooms/vote/status?scenario=allCompleted` | 4/4명 투표 완료, 결과 계산 중 카드, CTA 없음               |
| `/rooms/vote/status?scenario=expired`      | 3/4명 투표 완료, 종료·과반 참여 집계 안내, CTA 없음        |
| `/rooms/vote/status?scenario=insufficient` | 1/4명 투표 완료, 집계 중단·후속 정책 미확정 안내, CTA 없음 |

진행 중에 `투표 마감하기`를 누르면 참여 부족 모달이 열린다. `조금 더 기다리기` 또는 Escape·배경 클릭으로 닫으면 기존 상태를 유지한다. `지금 마감하기`는 클라이언트 목 상태만 변경하고, 3/4명은 집계 안내로 전환한다. 서버에 반영되지 않았다는 안내를 함께 표시한다. 새로고침하면 목 상태를 초기화한다.

320·390·440px에서 요약 문장과 모달 버튼 줄바꿈, 원형 프로필·배지 정렬, 가로 넘침을 확인한다. 긴 상태 설명은 Figma의 잘린 예시와 달리 자연스럽게 줄바꿈한다. 상태바·홈 인디케이터와 전역 overflow 제한은 추가하지 않는다.

## 검증 명령

- `node scripts/verify-screen13.mjs`: 인원 0명·1명, 전체 완료, 2/4 및 3/4, 홀수 인원 과반, 마감 직전·정각, 조기 마감, 고정 시나리오 확인
- `npm run lint`
- `npm run build`
- `npx prettier --check src/pages/VoteStatus src/router/index.tsx scripts/verify-screen13.mjs SCREEN13.md`

## 기획 확인 사항

- 과반 미달 후 재투표·기한 연장·방 종료 여부는 미확정이다. 현재는 결과 집계를 진행하지 않고 안내만 표시한다.
- 전원 투표 완료 시 표시하는 계산 중 상태는 목 화면이며, 실제 서버 집계 시작 조건·처리 시점은 API 계약이 필요하다.
- 조기 마감 권한 및 서버 기준 시각·마감 동시성 정책은 후속 연동에서 확인해야 한다.
- SCREEN 12에서의 진입 연결과 SCREEN 14 결과 이동은 이번 범위에 포함하지 않는다.
