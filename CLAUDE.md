# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

채팅방 분석기 MVP입니다. 사용자가 카카오톡 대화 내보내기 파일(TXT 또는 CSV)을 올리면 Claude가 방장을 위해 요약, 주제, 결정 사항, 액션 아이템(담당자 / 기한 / 우선순위), 답변 안 된 질문을 정리해 줍니다. DB는 없습니다. 결과는 브라우저 상태에만 있고 새로고침하면 사라집니다.

화면에 보이는 문구, 시스템 프롬프트, 스키마 설명은 모두 한국어입니다. 새로 추가하는 UI 문구와 에러 메시지도 한국어로 씁니다.

## 명령어

```bash
npm install
npm run dev      # http://localhost:3000 — samples/sample-kakao.csv로 테스트
npm run build
npm run lint     # ESLint 9 flat config (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # 타입 검사 (별도 스크립트 없음)
```

테스트 프레임워크와 테스트 코드는 없습니다.

`.env`에 `ANTHROPIC_API_KEY`가 있어야 합니다(`.env.example`을 복사해서 사용). `.env.example`은 Git에 커밋되는 파일이므로 실제 키를 넣으면 안 됩니다. `.env.example`의 나머지 변수(DB_*, SECRET_KEY, API_KEY)는 일반 템플릿에서 온 것이고 코드에서는 쓰지 않습니다.

## Next.js 버전 주의

이 프로젝트는 **Next.js 16.4 / React 19.3**을 씁니다. API, 규칙, 파일 구조가 학습 데이터와 다를 수 있습니다. Next.js 코드를 작성하기 전에 `node_modules/next/dist/docs/`에서 관련 가이드를 읽고, deprecation 안내를 따르세요. `next.config.ts`에서 `cacheComponents`와 `partialPrefetching`이 켜져 있고, Tailwind v4는 PostCSS가 아니라 Turbopack CSS 로더(`@tailwindcss/turbopack`)로 동작합니다.

`next dev`는 같은 경고가 담긴 `AGENTS.md`를 만들고, 지워도 다시 만듭니다(`node_modules/next/dist/server/lib/generate-agent-files.js` 참고). 파일을 삭제해도 다음에 `next dev`를 실행하면 커밋되지 않은 변경으로 다시 생깁니다.

## 구조

데이터 흐름(클라이언트 파싱 → 서버 분석 → 구조화된 출력)과 파서 동작은 `architecture.md`에 정리되어 있습니다.

@architecture.md

API 라우트(요청/응답 형식, 프롬프트 구성, Claude 호출 설정, 에러 처리)는 `app/api/CLAUDE.md`에 따로 있습니다. API 라우트를 수정하기 전에 먼저 읽으세요.

## 개인정보

실제 대화 내보내기 파일에는 개인정보가 들어 있습니다. 커밋하지 마세요(`samples/`에는 `sample-kakao.csv` 같은 가상의 데이터만 둡니다).
