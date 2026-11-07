# 구조

## 데이터 흐름

데이터 흐름은 클라이언트와 서버로 나뉩니다.

1. **클라이언트 파싱** (`app/page.tsx`, `"use client"` 컴포넌트 하나가 `lib/kakao-export.ts`를 호출). 파일을 브라우저에서 읽고 파싱해 `ChatMessage[]`와 `ChatStats`를 만듭니다. 원본 파일은 서버로 올라가지 않습니다.
2. **서버 분석** (`app/api/analyze/route.ts`). 클라이언트가 파싱된 메시지를 POST하면 서버에서 Claude를 호출합니다. API 키는 서버에서만 씁니다. 자세한 내용은 `app/api/CLAUDE.md`를 참고하세요.
3. **구조화된 출력** (`lib/schema.ts`). `AnalysisSchema`(zod v4)는 UI의 응답 타입이면서 Claude에 보내는 출력 형식이기도 합니다. 스키마를 바꾸면 API의 시스템 프롬프트와 `page.tsx`의 화면 표시도 함께 맞춰야 합니다.

상태는 모두 `app/page.tsx`의 React state에만 있습니다. DB나 브라우저 저장소를 쓰지 않으므로 새로고침하면 결과가 사라집니다.

## 파서 (`lib/kakao-export.ts`)

- `parseKakaoExport(text, fileName)`은 파일 확장자를 보거나 `[이름] [오전 9:02]` 형식의 줄이 있는지 확인해서 TXT/CSV를 고릅니다.
- TXT: 날짜 구분선(`--- 2026년 1월 14일 수요일 ---`)으로 현재 날짜를 정합니다. `[이름] [시간]` 접두어가 없는 줄은 앞 메시지에 이어 붙입니다(여러 줄 메시지). 오전/오후는 24시간제로 바꿉니다.
- CSV: papaparse로 읽습니다. 컬럼은 영어/한글 헤더 별칭(`DATE_KEYS` / `USER_KEYS` / `MESSAGE_KEYS`)으로 찾습니다.
- `SYSTEM_LINE_PATTERNS`(입장/퇴장/삭제 알림)와 `NOISE_MESSAGE_PATTERNS`(사진, 이모티콘, 동영상 등)로 내용이 없는 메시지를 걸러냅니다.
- 결과는 `{ ok: true, format, messages, stats }` 또는 `{ ok: false, error }` 형태입니다. 에러 메시지는 화면에 그대로 보여 주므로 한국어로 씁니다.
