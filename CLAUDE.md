# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

채팅방 분석기 MVP입니다. 사용자가 카카오톡 대화 내보내기 파일(TXT 또는 CSV)을 올리면 Claude가 방장을 위해 요약, 주제, 결정 사항, 액션 아이템(담당자 / 기한 / 우선순위), 답변 안 된 질문을 정리해 줍니다. DB는 없습니다. 결과는 브라우저 상태에만 있고 새로고침하면 사라집니다.

화면에 보이는 문구, 시스템 프롬프트, 스키마 설명은 모두 한국어입니다. 새로 추가하는 UI 문구와 에러 메시지도 한국어로 씁니다.

## 명령어

```bash
npm install
npm run dev        # http://localhost:3000 — samples/sample-kakao.csv / .txt로 테스트
npm run build
npm run check      # typecheck + lint + test. 코드를 고친 뒤에는 build 대신 이것으로 검증
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint 9 flat config (eslint-config-next core-web-vitals + typescript)
npm run test       # Vitest (lib/kakao-export.test.ts, scripts/secret-rules.test.ts)
npm run parse -- <파일>   # 앱과 같은 파서로 읽고 통계만 출력. 내용·이름은 출력하지 않음 (--names로 이름 표시)
npm run smoke      # /api/analyze 실제 호출 → 스키마 검증. 서버가 꺼져 있으면 켰다가 끈다. API 비용 발생
npm run check-secrets     # 커밋 대상 파일의 API 키 / .env.example 값 검사 (--all: 전체 파일)
```

- 파서를 바꾸면 `lib/kakao-export.test.ts`에 케이스를 추가합니다. 임시 스크립트를 scratchpad에 만들어 확인하지 말고 테스트나 `npm run parse`를 씁니다.
- 실제 대화 파일은 `npm run parse`로만 확인합니다. 메시지 내용을 출력하는 명령은 쓰지 않습니다.
- `npm run smoke`는 기본으로 가상 데이터(`samples/sample-kakao.csv`)를 보내고, 항목 수만 출력합니다(`--file`, `--show`, `--no-start`, `--url` 옵션).
- `scripts/*.ts`는 Node의 TypeScript 실행 기능으로 바로 돌립니다(빌드 단계 없음). 그래서 `scripts/`에서 `lib/`를 import할 때는 `../lib/schema.ts`처럼 확장자까지 씁니다(`tsconfig`의 `allowImportingTsExtensions`). `lib/` 파일끼리는 지금 `import type`만 쓰고 있어서 확장자 없이도 Node에서 돕니다. `lib/` 안에서 확장자 없이 값(타입이 아닌 것)을 import하면 Next와 Vitest에서는 되지만 Node 스크립트는 경로를 못 찾습니다. 그런 변경 뒤에는 `npm run parse -- samples/sample-kakao.txt`로 스크립트가 아직 도는지 확인합니다.

## Claude Code hook

`.claude/settings.json`의 PreToolUse hook이 Bash/PowerShell 명령마다 `scripts/check-secrets.ts --hook`을 실행합니다. 명령이 `git commit`일 때만 검사하고, 비밀값이 있으면 exit 2로 커밋을 막습니다. staged 파일뿐 아니라 아직 add하지 않은 변경 파일과 새 파일도 보므로 `git add -A && git commit`도 막힙니다. 막히면 우회하지 말고 원인을 고칩니다.

## 작업 규칙

- 파일 목록은 `git ls-files`로 봅니다. `find .`는 `node_modules`까지 훑어서 출력이 MB 단위로 커집니다.
- 이 폴더에서 Claude 세션을 동시에 여러 개 돌릴 때는 worktree(`claude --worktree`)를 쓰거나 서로 다른 파일만 맡깁니다. 같은 폴더에서 두 세션이 `.gitignore`나 `.env.example`을 동시에 만들다가 충돌한 적이 있습니다.

`.env`에 `ANTHROPIC_API_KEY`가 있어야 합니다(`.env.example`을 복사해서 사용). `.env.example`은 Git에 커밋되는 파일이므로 실제 키를 넣으면 안 됩니다. `.env.example`의 나머지 변수(DB_*, SECRET_KEY, API_KEY)는 일반 템플릿에서 온 것이고 코드에서는 쓰지 않습니다.

## Next.js 버전 주의

이 프로젝트는 **Next.js 16.4 / React 19.3**을 씁니다. API, 규칙, 파일 구조가 학습 데이터와 다를 수 있습니다. Next.js 코드를 작성하기 전에 `node_modules/next/dist/docs/`에서 관련 가이드를 읽고, deprecation 안내를 따르세요. `next.config.ts`에서 `cacheComponents`와 `partialPrefetching`이 켜져 있고, Tailwind v4는 PostCSS가 아니라 Turbopack CSS 로더(`@tailwindcss/turbopack`)로 동작합니다.

`next dev`는 같은 경고가 담긴 `AGENTS.md`를 만들고, 지워도 다시 만듭니다(`node_modules/next/dist/server/lib/generate-agent-files.js` 참고). 파일을 삭제해도 다음에 `next dev`를 실행하면 커밋되지 않은 변경으로 다시 생깁니다. `npm run smoke`는 직접 켠 서버를 끌 때 새로 생긴 `AGENTS.md`를 지웁니다.

## 구조

데이터 흐름(클라이언트 파싱 → 서버 분석 → 구조화된 출력)과 파서 동작은 `architecture.md`에 정리되어 있습니다.

@architecture.md

API 라우트(요청/응답 형식, 프롬프트 구성, Claude 호출 설정, 에러 처리)는 `app/api/CLAUDE.md`에 따로 있습니다. API 라우트를 수정하기 전에 먼저 읽으세요.

## 개인정보

실제 대화 내보내기 파일에는 개인정보가 들어 있습니다. 커밋하지 마세요(`samples/`에는 `sample-kakao.csv`, `sample-kakao.txt` 같은 가상의 데이터만 둡니다).
