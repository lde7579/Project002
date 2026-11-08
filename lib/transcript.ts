import type { ChatMessage } from "./schema";

// 대화 텍스트가 이보다 길면 잘라내지 않고 에러로 알린다 (약 1M 토큰 근처)
export const MAX_CHARS = 2_000_000;

/** Claude에 보낼 대화 기록. 한 줄에 "[date] user: message" 하나. */
export function buildTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `[${m.date}] ${m.user}: ${m.message}`).join("\n");
}
