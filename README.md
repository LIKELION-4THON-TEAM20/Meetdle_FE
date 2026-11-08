# Meetdle Frontend

멋쟁이사자처럼 4호선톤 팀 프로젝트 **Meetdle**의 Frontend Repository입니다.

Meetdle은 여러 사람의 출발지를 기반으로 중간 지점을 탐색하고, 만날 장소를 결정하는 웹 서비스입니다.

## 🛠 기술 스택

| 구분 | 기술 |
| --- | --- |
| Frontend | React |
| Build Tool | Vite |
| Language | TypeScript |
| Styling | SCSS (Sass) |
| Package Manager | npm |
| Code Quality | ESLint, Prettier |

## 📁 폴더 구조

```text
src/
├── assets/             # 이미지 및 정적 파일
├── styles/             # 공통 SCSS
│   ├── setting/
│   │   └── _reset.scss # 기본 스타일 초기화
│   └── index.scss      # 전역 SCSS 진입점
├── App.tsx
└── main.tsx
```

※ `components/`, `pages/`, `routes/`, `api/` 등은 기능 개발 시 추가 예정입니다.

## 🚀 실행 방법

Repository를 clone한 후 패키지를 설치합니다.

```bash
git clone https://github.com/LIKELION-4THON-TEAM20/Meetdle_FE.git
cd Meetdle_FE
git switch develop
npm install
```

개발 서버 실행:

```bash
npm run dev
```

기본 개발 서버 주소: `http://localhost:5173/`

코드 검사 및 빌드:

```bash
npm run lint
npm run build
npm run format:check
```

코드 자동 포맷팅:

```bash
npm run format
```

## 🌿 브랜치 전략

`main - develop - feat/*` 구조를 사용합니다.

```text
main
 └── develop
      ├── feat/*
      ├── fix/*
      └── refactor/*
```

- `main`: 최종 배포용 브랜치
- `develop`: FE 통합 개발 브랜치
- `feat/*`: 기능 개발 브랜치
- `fix/*`: 오류 수정 브랜치
- `refactor/*`: 코드 구조 개선 브랜치

기능 개발 시 `develop` 브랜치를 최신화한 후 작업 브랜치를 생성합니다.

작업 완료 후 `develop`을 대상으로 Pull Request를 생성하고 리뷰 및 확인 후 병합합니다.

**main / develop 직접 push 금지**

## 📝 커밋 컨벤션

| 태그 | 설명 |
| --- | --- |
| FEAT | 새로운 기능 및 화면 추가 |
| FIX | 버그 수정 |
| STYLE | CSS / UI 스타일 수정 |
| CHORE | 설정 및 기타 코드 수정 |
| REFACTOR | 기능 변화 없는 코드 구조 개선 |

커밋 예시:

```text
CHORE: 프론트엔드 초기 세팅
FEAT: 홈 화면 구현
FIX: 지도 오류 수정
```

## 🤝 협업 규칙

- 기능별 브랜치에서 작업 후 PR 생성
- PR 리뷰 및 확인 후 `develop` 병합
- 서로 작업하는 페이지 파일을 최대한 분리하여 충돌 방지
- 공통 컴포넌트 수정 시 FE 팀원에게 공유
- ESLint 및 Prettier 규칙 준수
- 컴포넌트는 PascalCase, 변수 및 함수는 camelCase 사용
- SCSS 클래스는 kebab-case 및 필요 시 BEM 사용

자세한 규칙은 [CONVENTION.md](CONVENTION.md)를 참고해 주세요.


**초기 세팅 PR:** [#1 CHORE: 프론트엔드 초기 세팅](https://github.com/LIKELION-4THON-TEAM20/Meetdle_FE/pull/1)
