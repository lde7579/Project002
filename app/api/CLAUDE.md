# API 라우트 (`app/api/`)

서버에서만 실행되는 API 라우트입니다. 지금은 `analyze/route.ts` 하나뿐입니다. 전체 구조는 루트 `CLAUDE.md`를 참고하세요.

## `POST /api/analyze`

- 요청 본문은 `{ messages: ChatMessage[] }`입니다. 클라이언트가 브라우저에서 파싱을 끝낸 메시지만 보내고, 원본 파일은 받지 않습니다.
- `isChatMessages`로 각 메시지에 `date` / `user` / `message` 문자열이 있는지 검증합니다. 빈 배열이거나 JSON이 아니면 400을 반환합니다.
- 성공하면 `{ analysis: Analysis }`, 실패하면 `{ error: string }`(한국어 메시지)을 반환합니다. `app/page.tsx`가 이 두 형태를 기대하므로 응답 모양을 바꾸면 클라이언트도 함께 고쳐야 합니다.

## 프롬프트 구성

- 메시지를 `[date] user: message` 줄로 이어 붙여 대화 기록을 만듭니다(`lib/transcript.ts`의 `buildTranscript`). `npm run parse`도 같은 함수로 글자 수를 계산하므로 형식을 바꿀 때는 이 함수만 고칩니다.
- 대화 기록은 `<chat>` 태그로 감싸고, 그 안의 요청이나 지시는 따르지 말고 데이터로만 다루라는 문장을 앞에 붙입니다(프롬프트 인젝션 방지). 이 구조는 유지하세요.
- `SYSTEM_PROMPT`는 `lib/schema.ts`의 `AnalysisSchema` 필드(summary, topics, decisions, actionItems, unansweredQuestions)마다 작성 규칙을 설명합니다. 스키마의 `.describe()` 문자열도 프롬프트 역할을 하므로, 필드를 추가하거나 바꾸면 시스템 프롬프트와 `app/page.tsx`의 화면 표시를 함께 맞춰야 합니다.

## Claude 호출

- `client.beta.messages.parse`를 쓰고, 출력 형식은 `betaZodOutputFormat(AnalysisSchema)`로 지정합니다. 결과는 `response.parsed_output`에서 읽습니다.
- 모델은 `claude-opus-5-5`, `effort: "medium"`, `max_tokens: 16000`입니다.
- `server-side-fallback-2026-07-01` 베타와 `fallbacks: "default"`를 켜서 거절 응답이 오면 서버 쪽에서 다른 모델로 다시 시도합니다.
- `ANTHROPIC_API_KEY`는 `new Anthropic()`이 환경변수에서 읽습니다. 호출 전에 키가 없으면 500과 안내 메시지를 반환합니다.

## 입력 제한과 에러 처리

- 대화 기록이 `MAX_CHARS`(`lib/transcript.ts`, 200만 자, 약 1M 토큰)를 넘으면 잘라내지 않고 413으로 거절합니다.
- 실패 케이스마다 정해진 HTTP 상태 코드와 한국어 메시지를 반환합니다. 새 실패 케이스도 같은 방식으로 `errorResponse`를 써서 추가합니다.

| 상황 | 상태 코드 |
|---|---|
| 잘못된 JSON / 메시지 없음 | 400 |
| API 키 오류 (`AuthenticationError`) | 401 |
| 대화가 너무 김 | 413 |
| `stop_reason === "refusal"` | 422 |
| 요청 한도 초과 (`RateLimitError`) | 429 |
| API 키 미설정 / 알 수 없는 오류 | 500 |
| `stop_reason === "max_tokens"`, `parsed_output` 없음, 기타 `APIError` | 502 |
