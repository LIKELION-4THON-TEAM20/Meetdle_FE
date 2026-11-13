# SCREEN 14 최종 투표 결과

## 변경 파일

- `src/pages/VoteResult/VoteResult.tsx`, `VoteResult.scss`
- `src/pages/VoteResult/components/ResultPlaceCard.tsx`
- `src/pages/VoteResult/components/VoteBreakdown.tsx`
- `src/pages/VoteResult/components/VisitOrderSheet.tsx`
- `src/pages/VoteResult/components/TieBreakModal.tsx`
- `src/pages/VoteResult/components/ResultPending.tsx`
- `src/pages/VoteResult/components/RevoteNotice.tsx`
- `src/pages/VoteResult/types.ts`, `mockData.ts`, `resultUtils.ts`
- `src/router/index.tsx`: `/rooms/vote/result` 신규 경로만 추가
- `scripts/verify-screen14.mjs`, 이 문서

공통 Header·Button·Modal·`.page`를 재사용하며 기존 SCREEN 01~13은 수정하지 않는다. 공통 Modal의 포커스 제한·Escape 닫기·스크롤 잠금을 재사용한다. SCREEN 14 시트에만 적용되는 CSS 선택자로 하단 정렬한다. 새 의존성 및 API 호출은 없다.

## 개발 테스트 URL

`npm run dev` 실행 후 아래 경로를 연다. 모든 쿼리는 `import.meta.env.DEV`에서만 처리된다. 기본 목 역할은 host이다.

| URL                                                  | 예상 동작                                          |
| ---------------------------------------------------- | -------------------------------------------------- |
| `/rooms/vote/result`                                 | A 식당·C 카페·D 주점 최종 결과                     |
| `/rooms/vote/result?scenario=breakdown`              | 익명 투표 비율 영역이 펼쳐진 상태                  |
| `/rooms/vote/result?scenario=order`                  | 방장 방문 순서 변경 시트                           |
| `/rooms/vote/result?role=participant`                | 참여자 결과 확인, 비율 확인, 방문 순서 조회만 가능 |
| `/rooms/vote/result?scenario=order&role=participant` | 순서 조회 시트, 드래그·이동·저장 컨트롤 없음       |
| `/rooms/vote/result?scenario=tie&role=host`          | 카페 동률 후보 선택 가능                           |
| `/rooms/vote/result?scenario=tie&role=participant`   | 동률 후보와 선택 버튼 없이 결과 대기               |
| `/rooms/vote/result?scenario=pending`                | 결과 정리 대기                                     |
| `/rooms/vote/result?scenario=noResult`               | 선정 실패·재투표 안내, 목 1회 사용 후 비활성화     |
| `/rooms/vote/result?scenario=revoteUsed`             | 재투표 횟수 소진 상태                              |
| `/rooms/vote/result?scenario=zeroVotes`              | 비율 영역에서 0명 응답·모두 0% 경계값              |

## 기능별 확인

1. `투표 결과 펼쳐보기`로 카테고리별 응답 수에서 계산한 비율을 확인한다. 기본 좋아요 비율은 75·50·25%이며 개인별 선택은 표시하지 않는다. 정수 반올림 시 합계가 100%가 되도록 배분한다. 0명 응답은 모두 0%이다.
2. 방문 순서 시트에서 ≡ 핸들을 마우스 또는 터치로 드래그한다. 터치 스크롤 차단은 핸들에만 적용한다. 나머지 영역은 스크롤할 수 있다. 위로·아래로 버튼이나 핸들에 포커스를 두고 방향키로도 이동할 수 있다.
3. 순서 번호가 변경되는지 확인하고 `순서 저장하기` 후 다시 시트를 연다. 저장된 순서가 유지되어야 한다. 저장 전 닫기·배경 클릭·Escape는 초안을 버린다. 취소된 포인터 드래그도 드래그 시작 전 순서로 되돌린다. 저장은 현재 마운트된 페이지의 React state에만 반영되며 새로고침하면 초기화된다.
4. host 동률 화면에서 E 카페를 선택하면 정상 결과의 카페가 E 카페로 바뀐다. 펼친 비율에도 E 카페의 응답 수가 적용된다. 방문 순서의 카테고리 위치는 유지된다.
5. 참여자는 순서를 변경하거나 동률 후보를 선택할 수 없다. UI뿐 아니라 상태 변경 유틸리티에서도 역할을 검증한다. 실제 인증·인가를 대체하지 않는다.
6. `다시 투표하기`는 목 횟수만 1회 차감하고 실제 재투표가 시작되지 않았다는 안내를 표시한다. 실제 후보 재구성이나 API 요청은 없다.
7. 현재 라우터에 지도 경로가 없으므로 `지도 보기`는 미연동 안내를 표시한다.

320·390·440px에서 카드 주소·선택 버튼·비율 범례 줄바꿈과 마지막 CTA, 시트 내부 스크롤을 확인한다. 좁은 화면의 동률 선택 버튼은 카드 안에서 다음 행에 배치한다. 브라우저 연결 도구가 unavailable을 반환해 이번 작업에서 실제 브라우저 렌더링 및 터치 드래그 검증은 완료하지 못했다.

## 검증 명령

- `node scripts/verify-screen14.mjs`: 비율 합계·0명·반올림, 순서 이동·저장·불변성, 역할 권한, 동률 반영, 재투표 1회 제한
- `npm run lint`
- `npm run build`
- `npx prettier --check src/pages/VoteResult src/router/index.tsx scripts/verify-screen14.mjs SCREEN14.md`

## 기획 확인 사항

- 강한 비선호의 제외 기준·동률 산정 기준은 구현하지 않았다. 명시적인 목 상태로만 표현한다.
- 재투표 후보 구성, 재투표 요청 권한과 횟수 차감 시점은 서버 연동 전 확인해야 한다. 현재는 요청된 안내 시뮬레이션에만 목 횟수를 사용한다.
- 실제 역할·서버 결과·저장 권한, 여러 방장의 동시 편집 및 참여자 화면 갱신 방식은 API 계약이 필요하다.
- 지도 경로가 확정되면 지도 팀과 연결해야 한다. 기존 지도 컴포넌트는 변경하지 않았다.
- 동률 결과 선택 및 방문 순서는 서버 저장 없이 현재 화면에만 반영한다. 기존 SCREEN 12·13에서의 연결은 추가하지 않았다.
