# Meetdle

멋쟁이사자처럼 4호선톤 팀 프로젝트

## 프로젝트 소개

Meetdle은 여러 사람의 출발지를 기반으로 중간 지점을 탐색하고, 만날 장소를 결정하는 웹 서비스입니다.

React + Vite + TypeScript + SCSS 기반으로 실제 백엔드 API에 연결합니다. 앱의 목데이터·목 전용 화면·임시 방 저장소는 제거했습니다.

## 기술 스택

- React
- Vite
- TypeScript
- SCSS
- npm
- ESLint
- Prettier

## 기본 폴더 구조

아래는 주요 구성 일부이며, 상세 구조는 실제 소스 코드를 참고하세요.

```text
Meetdle_FE/
├─ .github/
│  ├─ ISSUE_TEMPLATE/
│  │  └─ feature.md
│  └─ PULL_REQUEST_TEMPLATE.md
├─ public/
├─ src/
│  ├─ assets/
│  ├─ components/
│  ├─ features/
│  ├─ pages/
│  ├─ router/
│  ├─ styles/
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ ...
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
git clone https://github.com/LIKELION-4THON-TEAM20/Meetdle_FE.git
cd Meetdle_FE
npm install
npm run dev
```

프로덕션 빌드 및 정적 검증은 아래 명령으로 실행할 수 있습니다.

```bash
npm run build
npm run lint
```

환경변수는 `.env.example`을 참고하여 `.env.local`에 설정합니다.
환경변수를 변경한 후에는 개발 서버를 재시작하세요.
`.env.local`은 커밋하지 않습니다.

## 페이지 경로와 데이터

- `/`: 실제 로그인 세션의 내 약속 목록. 비로그인은 로그인 화면으로 이동합니다.
- `/login`: 백엔드 A01을 통한 카카오 로그인. API Origin은 VITE_API_BASE_URL을 사용합니다.
- `/rooms/create`: A05로 실제 약속방을 생성하고 서버 응답의 UUID·초대를 사용합니다.
- `/rooms/{roomId}`: A08의 단계·역할·허용 동작에 따라 현재 방 화면을 표시합니다.
- `/rooms/create/complete`, `/rooms/schedule-transit`, `/rooms/participation-status`, `/rooms/candidates`, `/rooms/confirmed`, `/rooms/info`, `/rooms/registration/setup`, `/rooms/places`, `/rooms/registration/status`, `/rooms/registration/close`, `/rooms/vote/start`, `/rooms/vote`, `/rooms/vote/status`, `/rooms/vote/result`: 실제 UUID의 roomId 쿼리가 필요합니다. 없거나 잘못된 ID면 방 선택 안내를 표시합니다.
- `/invite/{token}`, `/invitations/{token}`, `/rooms/invite`: 실제 초대 조회·코드 확인·참여 경로입니다.
- `/dev/preview`, `?preview=mock`, 예전 목 방 ID로 화면을 확인하는 기능은 제공하지 않습니다.

실제 API 실패를 예시 약속·역·장소·투표 결과로 대체하지 않습니다. 홈은 실제 목록이 비어 있을 때 빈 상태를 표시합니다. 지도 중심·반경·후보 및 완료 상태는 서버 응답을 사용합니다.

테스트 전용 입력·응답 데이터는 tests/fixtures에 있으며 앱에서는 참조하지 않습니다. 목 저장소·목 전용 시나리오 테스트는 제거하고 API·UI·지도 검증은 유지합니다. 기존 SCREEN 문서의 과거 목 화면 설명은 현재 동작을 나타내지 않습니다.

배포 시 하위 경로 직접 접속·새로고침이 동작하도록 index.html SPA fallback 설정이 필요합니다. 실제 인증 세션의 서버 쓰기와 종단 QA는 별도 검증이 필요합니다.

## 브랜치 전략

- `main`: 최종 배포용
- `develop`: FE 통합 개발
- `feat/*`: 기능 개발
- `fix/*`: 오류 수정
- `refactor/*`: 코드 개선
- `test/integration-flow`: 여러 작업 브랜치를 모아 전체 흐름을 점검하는 통합 브랜치

현재 통합 작업은 각 기능 PR을 `test/integration-flow`로 병합하여 확인한 뒤, 팀 리뷰를 거쳐 `test/integration-flow` → `develop` PR로 반영하는 방식으로 진행합니다.

## 커밋 컨벤션

- `FEAT`: 기능 및 화면 추가
- `FIX`: 버그 수정
- `STYLE`: CSS/UI 수정
- `CHORE`: 설정 및 기타 작업
- `REFACTOR`: 코드 구조 개선

예시:

```text
FEAT: 홈 화면 구현
CHORE: 프론트엔드 초기 세팅
```

## 협업 규칙

프로젝트의 브랜치 전략, 커밋 규칙, 코드 컨벤션은 [CONVENTION.md](CONVENTION.md)에 정리되어 있습니다.

협업 시에는 다음 원칙을 준수합니다.

- `main` / `develop` 직접 push 금지
- `develop` 최신화 후 기능 브랜치 생성
- PR 리뷰 후 병합
- 통합 작업 중에는 PR의 대상 브랜치를 확인
- 공통 컴포넌트 수정 시 팀원 공유
- ESLint + Prettier 적용
