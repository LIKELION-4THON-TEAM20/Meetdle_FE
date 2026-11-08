# GitHub 협업 규칙

## 브랜치 전략
- main: 최종 배포용
- develop: FE 통합 개발
- feat/*: 기능 개발
- fix/*: 오류 수정
- refactor/*: 코드 개선
- main/develop 직접 push 금지
- develop 최신화 후 브랜치 생성
- PR 리뷰 후 develop 병합
- 공통 컴포넌트 수정 시 팀원에게 공유

## 커밋 컨벤션 (대문자)
- FEAT: 기능 및 화면 추가
- FIX: 버그 수정
- STYLE: CSS/UI 수정
- CHORE: 설정 및 기타 작업
- REFACTOR: 코드 구조 개선

## 커밋 예시
- CHORE: 프론트엔드 초기 세팅
- FEAT: 홈 화면 구현

## 코드 컨벤션
- 컴포넌트: PascalCase
- 변수/함수: camelCase
- 상수: UPPER_SNAKE_CASE
- SCSS 클래스: kebab-case, 필요 시 BEM
- 공통 컴포넌트: src/components/
- 페이지별 코드: src/pages/
- 공통 스타일: src/styles/
- TypeScript 타입 사용
- ESLint + Prettier 적용
