# SCREEN 11 구현 및 확인

공통 Header, Button, Modal, .page를 재사용한다. SCREEN 10과 SCREEN 08 동작은 변경하지 않는다. 등록 마감 CTA는 목 후보 상태를 투표 안내로 전달하며 API를 호출하지 않는다. 독립 진입 시 등록 마감은 6곳, 투표 안내는 8곳 예시를 사용한다. 최종 CTA는 미연동 안내만 표시한다.

## 개발 테스트 URL

`npm run dev` 실행 후 아래 경로를 사용한다. 쿼리는 DEV에서만 적용된다.

| 경로                                                 | 기대 동작                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `/rooms/registration/close`                          | 식당 3·카페 2·주점 1·문화시설 0, 주점 자동 선정 표시           |
| `/rooms/vote/start`                                  | 3·2·2·1 합계 8곳, 등록 완료 3/4명                              |
| `/rooms/registration/close?scenario=empty`           | 후보 없음 안내, CTA 비활성화                                   |
| `/rooms/vote/start?scenario=empty`                   | 후보 없음 안내, CTA 비활성화                                   |
| `/rooms/registration/close?scenario=missingRequired` | CTA 클릭 시 식당 누락 차단 모달                                |
| `/rooms/vote/start?scenario=missingRequired`         | CTA 클릭 시 동일 차단 모달                                     |
| `/rooms/registration/close?scenario=missingOptional` | 문화시설 제외 안내, 다음 단계 이동 가능                        |
| `/rooms/vote/start?scenario=missingOptional`         | 문화시설 제외, 합계 7곳, 진행 가능                             |
| `/rooms/registration/close?scenario=invalidDeadline` | 다음 단계로 이동 후 잘못된 시간 상태 확인                      |
| `/rooms/vote/start?scenario=invalidDeadline`         | 30분 미만 마감, CTA 비활성화. 회색 시간 영역 클릭 후 수정 가능 |

시간 영역을 누르면 날짜·시간 입력 모달이 열린다. 현재 +30분 이상, 목 약속 시간(페이지 진입 +12시간)의 3시간 전 이하로 입력하면 확인 가능하다. 최소 시각은 분 단위로 올림한다. 비어 있거나 범위 밖이면 확인이 비활성화된다. 모달은 Escape·배경 클릭으로 닫을 수 있다. 최종 투표 시작은 미연동 안내만 표시한다.

320·390·440px에서 줄바꿈, 가로 넘침, 모달 스크롤, 키보드 포커스를 수동 확인한다. 자동 브라우저 연결이 제공되지 않아 이번 작업에서 렌더링 육안 검증은 완료하지 못했다.

## 검증

- `node scripts/verify-screen11.mjs`: 최소·최대 경계 ±1ms, 자정 통과, 시간 경과, 유효하지 않은 날짜, 가능 범위 없음, 후보 합산·무효 후보 제외, SCREEN 08 최소 1시간 유지.
- `npm run lint`, `npm run build`
- `npx prettier --check src/pages/RegistrationClose src/pages/VoteStart src/router/index.tsx scripts/verify-screen11.mjs SCREEN11.md`

## 기획 확인 사항

- 식당·카페 필수는 기존 SCREEN 10과 Figma 주석에 맞춘 목 설정이다. 실제 방별 필수 카테고리 설정 출처는 API 계약이 필요하다.
- 주점 1곳 자동 선정은 Figma 예시에만 표시한다. 다른 카테고리의 단일 후보 선정 및 자동 선정 후보의 투표 포함 정책은 확정하지 않았다.
- 장소 등록 입력 화면은 현재 라우터에 없어 보완 등록 버튼은 목 안내로 처리한다. 보완 등록 경로·권한·재마감 흐름 확인이 필요하다.
- SCREEN 12, 실제 마감·투표 시작 API, 서버 기준 시각 및 약속 시각 연동은 후속 작업이다.
