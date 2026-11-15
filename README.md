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
- `/`: 내 약속 홈 UI (목데이터, 로그인 없이 독립 확인)
- `/login`: 카카오 로그인 UI (로그인 시작 URL 설정 시 백엔드 OAuth로 이동)
- `/rooms/create/complete`, `/rooms/invite`: 생성 완료·초대 확인 (방별 개발용 목 데이터)
- `/rooms/participation-status`: 참여 현황 독립 목 화면
- `/rooms/confirmed`, `/rooms/info`, `/rooms/registration/setup`: 동일 목 방의 확정·정보·등록 설정
- `/rooms/registration/status`, `/rooms/registration/close`, `/rooms/vote/start`, `/rooms/vote`, `/rooms/vote/status`, `/rooms/vote/result`: 기존 등록·투표 목 흐름
- `/rooms/join`: 기존 초대 링크 호환, 쿼리를 유지하여 `/rooms/invite`로 이동
- 그 외 경로: 페이지 없음 안내

경로는 `src/router/index.tsx`에서 관리합니다.
전체 이동 표, 데이터 전달, 누락 PR, 역할·API 경계와 검증은 [ROUTING_FLOW.md](./ROUTING_FLOW.md)를 참고하세요.
SCREEN 03·05·09는 현재 브랜치에 없으며 관련 PR 반영 전에는 임의로 건너뛰지 않습니다.
배포 시 `/login`, `/rooms/create` 직접 접속 및 새로고침이 동작하려면 호스팅 서버에서
정적 파일 외 경로를 `index.html`로 연결하는 SPA fallback 설정이 필요합니다.

## 로그인·홈 UI 연결 사항

- `.env.local`의 `VITE_KAKAO_LOGIN_URL`에 백엔드 카카오 OAuth 로그인 시작 URL을 설정하면 로그인 버튼이 활성화되어 해당 주소로 이동합니다. `.env.example`을 참고하고 환경변수 변경 후 개발 서버를 재시작하세요.
- 로그인 시작 URL은 아직 제공되지 않았습니다. 미설정 또는 유효한 HTTP(S) 절대 URL이 아니면 버튼을 비활성 상태로 유지합니다.
- OAuth state 검증, 인가 코드 교환과 세션 처리는 백엔드 담당입니다. 프론트는 인증 상태나 임의 토큰을 만들거나 저장하지 않습니다. Client Secret을 VITE_ 환경변수에 넣지 않습니다.
- 도움말과 프로필 이동은 미연결입니다.
- 생성한 목 약속과 기존 등록·투표 목 방 카드는 확인 가능한 단계로 연결합니다. 원래 홈 예시 3개의 서비스 단계는 미정이므로 해당 카드들은 이동하지 않습니다.
- - 버튼 → 약속 추가 시트 → 새 약속 만들기는 `/rooms/create`로 연결됩니다.
- 코드로 참여하기는 시트 위의 초대 코드 모달을 엽니다. 영문·숫자 6자리 형식을 기준으로 입력과 버튼 상태를 처리하며, 실제 코드 검증/입장은 `Home`의 `onJoinByCode(code)` 비동기 콜백으로 연결합니다. 잘못된 코드에 대해서는 콜백에서 `'invalid-code'`를 반환하면 오류 UI를 표시합니다. 정원 마감 시 `{ status: 'room-full', capacity: 정원수 }`를 반환하면 ‘방이 가득 찼어요.’ 모달을 표시하며, 확인 후 입력 화면으로 돌아옵니다. API가 없으면 미연결 안내만 표시하고 방 입장 성공이나 잘못된 코드 여부를 임의로 판단하지 않습니다.
- 약속 추가 시트는 기본 높이 222px이며, safe area는 하단 여백에 포함합니다. 작은 화면/키보드에서는 사용 가능한 높이에 맞춰 스크롤합니다. 중첩 모달을 닫으면 코드 참여 버튼으로 포커스가 돌아오고, 시트를 닫으면 + 버튼과 원래 스크롤 위치가 복원됩니다.
- 목데이터는 `src/pages/Home/appointments.mock.ts`, 타입은 `appointment.types.ts`에 있습니다. `Home`의 `appointments` prop으로 실제 데이터로 교체할 수 있습니다.
- 현재 `HomeRoute`는 코드 입력을 서버 참여 성공으로 처리하지 않고 로컬 목 정보의 초대 확인 화면으로 이동합니다. 실제 코드 조회·참여·로그인 후 복귀는 API 미연결입니다. 생성된 목 코드/링크는 같은 브라우저의 개발용 데이터에만 대응합니다.
- 전체·다가오는·지난 필터는 서울 기준 날짜를 비교합니다. 오늘은 다가오는 약속에 포함합니다.
- 완료 배지는 명시된 `status`만 사용합니다. 진행 중 약속은 날짜에 따라 D-day/D-N/D+N을 표시하며, 과거 날짜라고 완료로 변경하지 않습니다.
- 로그인 로고·소개 문구는 Figma 원본 서체를 유지하기 위해 해당 텍스트 레이어의 투명 SVG 에셋을 사용합니다. 홈 로고와 아이콘·로그인 장식은 Figma SVG입니다. 참여자 사진이 없는 목데이터는 디자인의 회색 플레이스홀더로 표시합니다.
- 공통 `HomeHeader`를 추가했으며 기존 `Header`·`Button`·생성 화면은 유지했습니다. 팀 공유 대상입니다.

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
