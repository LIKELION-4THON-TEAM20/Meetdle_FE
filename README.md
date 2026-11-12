# Meetdle

멋쟁이사자처럼 4호선톤 팀 프로젝트

## 프로젝트 소개

Meetdle은 여러 사람의 출발지를 기반으로 중간 지점을 탐색하고, 만날 장소를 결정하는 웹 서비스입니다.

현재 프로젝트는 React + Vite + TypeScript + SCSS 기반의 초기 설정 단계로 구성되어 있으며, 협업을 위해 브랜치 전략과 커밋 컨벤션을 정리해두었습니다.

## 기술 스택

- React
- Vite
- TypeScript
- SCSS
- npm
- ESLint
- Prettier

## 현재 폴더 구조

```bash
Meetdle_FE/
├─ .github/
│  ├─ ISSUE_TEMPLATE/
│  │  └─ feature.md
│  └─ PULL_REQUEST_TEMPLATE.md
├─ public/
├─ src/
│  ├─ assets/
│  ├─ styles/
│  │  ├─ index.scss
│  │  └─ setting/
│  │     └─ _reset.scss
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ ...
├─ .gitignore
├─ .prettierignore
├─ .prettierrc
├─ CONVENTION.md
├─ eslint.config.js
├─ index.html
├─ package-lock.json
├─ package.json
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ README.md
└─ ...
```

## 실행 방법

```bash
git clone <repository-url>
cd Meetdle_FE
npm install
npm run dev
```

프로덕션 빌드 및 정적 검증은 아래 명령으로 실행할 수 있습니다.

```bash
npm run build
npm run lint
```

## 페이지 경로

- `/rooms/create`: 약속방 생성 UI (API 미연결)
- `/`: 홈 화면 구현 전까지 `/rooms/create`로 리다이렉트
- 그 외 경로: 페이지 없음 안내

경로는 `src/router/index.tsx`에서 관리합니다.
배포 시 `/rooms/create` 직접 접속 및 새로고침이 동작하려면 호스팅 서버에서
정적 파일 외 경로를 `index.html`로 연결하는 SPA fallback 설정이 필요합니다.

## 브랜치 전략

- main: 최종 배포용
- develop: FE 통합 개발
- feat/*: 기능 개발
- fix/*: 오류 수정
- refactor/*: 코드 개선

## 커밋 컨벤션

- FEAT: 기능 및 화면 추가
- FIX: 버그 수정
- STYLE: CSS/UI 수정
- CHORE: 설정 및 기타 작업
- REFACTOR: 코드 구조 개선

예시:

```bash
FEAT: 홈 화면 구현
CHORE: 프론트엔드 초기 세팅
```

## 협업 규칙

프로젝트의 브랜치 전략, 커밋 규칙, 코드 컨벤션은 [CONVENTION.md](CONVENTION.md)에 정리되어 있습니다.

협업 시에는 다음 원칙을 준수합니다.

- main / develop 직접 push 금지
- develop 최신화 후 브랜치 생성
- PR 리뷰 후 develop 병합
- 공통 컴포넌트 수정 시 팀원 공유
- ESLint + Prettier 적용
