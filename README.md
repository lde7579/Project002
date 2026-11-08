# 채팅방 분석기 (MVP)

카카오톡 대화 내보내기 CSV를 올리면 Claude가 대화를 분석해서 방장에게 필요한 것을 정리해 줍니다.

- 전체 요약
- 액션 아이템 (담당자 / 기한 / 우선순위, 체크 가능)
- 답변 안 된 질문
- 결정 사항
- 주요 주제

DB는 없습니다. 결과는 브라우저에만 있고 새로고침하면 사라집니다.

## 실행

```bash
npm install
cp .env.example .env   # 이미 .env가 있으면 생략
# .env 에 ANTHROPIC_API_KEY=sk-ant-... 입력
npm run dev
```

http://localhost:3000 을 열고 `samples/sample-kakao.csv` 또는 `samples/sample-kakao.txt`로 테스트해 보세요.

## 개발용 명령

| 명령 | 하는 일 |
|---|---|
| `npm run check` | 타입 검사 + lint + 테스트 |
| `npm run test` | Vitest 테스트 (파서, 비밀값 검사 규칙) |
| `npm run parse -- <파일>` | 파일을 앱과 같은 파서로 읽고 통계만 출력 (메시지 내용·이름은 출력하지 않음) |
| `npm run smoke` | 샘플로 `/api/analyze`를 실제 호출해 결과 스키마까지 확인 (API 비용 발생) |
| `npm run check-secrets` | 커밋 대상 파일에 API 키가 있는지, `.env.example`에 값이 들어갔는지 검사 |

> API 키는 반드시 `.env`에 넣으세요. `.env.example`은 Git에 커밋되는 파일입니다.

## 지원하는 파일 형식

### 1. 카카오톡 대화 내보내기 TXT (권장)

카카오톡 채팅방 → 메뉴 → 대화 내보내기로 받은 `.txt` 파일 그대로 올리면 됩니다.

```text
--------------- 2026년 1월 14일 수요일 ---------------
[김민지] [오전 9:02] 다들 좋은 아침이에요!
[박서준] [오후 1:15] 여러 줄 메시지도
이어서 인식합니다
```

### 2. CSV

```csv
Date,User,Message
2026-11-01 09:02:11,김민지,다들 좋은 아침이에요!
```

한글 헤더(`날짜,사용자,메시지`)도 인식합니다.

### 공통

- "메시지가 삭제되었습니다", "~님이 나갔습니다", "사진", "이모티콘" 같은 줄은 자동으로 뺍니다.
- 실제 대화 파일은 개인정보이므로 저장소(`samples/` 등)에 넣지 마세요.

## 구조

| 파일 | 역할 |
|---|---|
| `app/page.tsx` | 업로드, 미리보기, 결과 화면 |
| `app/api/analyze/route.ts` | Claude API 호출 (서버에서만 키 사용) |
| `lib/kakao-export.ts` | TXT/CSV 파싱과 참여자 통계 |
| `lib/schema.ts` | 분석 결과 스키마 (zod, structured outputs) |
| `lib/transcript.ts` | Claude에 보낼 대화 기록 만들기, 길이 한도 |
| `scripts/` | 개발용 스크립트 (`parse`, `smoke`, `check-secrets`) |

모델은 `claude-opus-5-5`이고, 거절 응답이 오면 서버 측 fallback(`fallbacks: "default"`)으로 다른 모델이 다시 시도합니다.
