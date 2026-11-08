import Papa from "papaparse";
import type { ChatMessage } from "./schema";

// 카카오톡이 대화 중간에 넣는 시스템 메시지 (한 줄 전체가 이 패턴이면 뺀다)
const SYSTEM_LINE_PATTERNS = [
  /^메시지가 삭제되었습니다\.?$/,
  /^삭제된 메시지입니다\.?$/,
  /님(이|을) .*(들어왔습니다|나갔습니다|초대했습니다|내보냈습니다|추가했습니다|제거했습니다)\.$/,
  /님이 (들어왔습니다|나갔습니다)\.?$/,
];

// 분석에 도움이 안 되는 메시지 본문
const NOISE_MESSAGE_PATTERNS = [/^사진( \d+장)?$/, /^이모티콘$/, /^동영상$/, /^음성메시지$/];

export type ChatStats = {
  total: number;
  participants: { user: string; count: number }[];
  firstDate: string | null;
  lastDate: string | null;
};

export type ParseResult =
  | { ok: true; format: "csv" | "txt"; messages: ChatMessage[]; stats: ChatStats }
  | { ok: false; error: string };

/** 파일 이름과 내용을 보고 CSV / TXT 내보내기 형식을 골라 읽는다. */
export function parseKakaoExport(text: string, fileName = ""): ParseResult {
  const clean = text.replace(/^﻿/, "");
  const isTxt =
    fileName.toLowerCase().endsWith(".txt") || /^\[[^\]]+\] \[(오전|오후) \d{1,2}:\d{2}\] /m.test(clean);
  const parsed = isTxt ? parseTxt(clean) : parseCsv(clean);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // 시스템 알림은 TXT/CSV 공통으로 여기서 거른다. (TXT에서는 "[영희] [오후 3:01] 삭제된 메시지입니다."처럼
  // 일반 메시지 형식으로 들어오기도 해서, 접두어 없는 줄만 거르면 빠진다.)
  const messages = parsed.messages.filter(
    (m) =>
      m.user &&
      m.message &&
      !SYSTEM_LINE_PATTERNS.some((p) => p.test(m.message)) &&
      !NOISE_MESSAGE_PATTERNS.some((p) => p.test(m.message)),
  );
  if (messages.length === 0) {
    return { ok: false, error: "파일에 분석할 메시지가 없어요." };
  }
  return { ok: true, format: isTxt ? "txt" : "csv", messages, stats: computeStats(messages) };
}

// ---------- TXT (카카오톡 PC 내보내기) ----------
// 2026년 1월 14일 수요일 구분선 아래에 "[이름] [오전 5:17] 내용" 줄이 이어지고,
// 접두어가 없는 줄은 바로 앞 메시지의 다음 줄이다.

const TXT_DATE_LINE = /^-+ (\d{4})년 (\d{1,2})월 (\d{1,2})일 .*-+$/;
const TXT_MESSAGE_LINE = /^\[([^\]]+)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ?(.*)$/;

function pad(n: number | string) {
  return String(n).padStart(2, "0");
}

function parseTxt(text: string): { messages: ChatMessage[] } | { error: string } {
  const messages: ChatMessage[] = [];
  let currentDate = "";
  let last: ChatMessage | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    const dateMatch = line.match(TXT_DATE_LINE);
    if (dateMatch) {
      const [, y, mo, d] = dateMatch;
      currentDate = `${y}-${pad(mo)}-${pad(d)}`;
      last = null;
      continue;
    }

    const msgMatch = line.match(TXT_MESSAGE_LINE);
    if (msgMatch) {
      const [, user, ampm, h, min, body] = msgMatch;
      let hour = Number(h) % 12;
      if (ampm === "오후") hour += 12;
      last = { date: `${currentDate} ${pad(hour)}:${min}`.trim(), user: user.trim(), message: body };
      messages.push(last);
      continue;
    }

    if (!line.trim()) continue;
    if (SYSTEM_LINE_PATTERNS.some((p) => p.test(line.trim()))) {
      last = null;
      continue;
    }
    // 여러 줄 메시지의 다음 줄 (맨 위의 방 이름/저장 날짜 줄은 last가 없어서 무시됨)
    if (last) last.message += "\n" + line;
  }

  if (messages.length === 0) {
    return {
      error: '카카오톡 대화 형식을 찾지 못했어요. "[이름] [오전 5:17] 내용" 형식의 TXT 파일인지 확인해 주세요.',
    };
  }
  for (const m of messages) m.message = m.message.trim();
  return { messages };
}

// ---------- CSV (Date,User,Message) ----------

const DATE_KEYS = ["date", "날짜", "일시", "time", "timestamp"];
const USER_KEYS = ["user", "사용자", "이름", "name", "sender", "보낸사람"];
const MESSAGE_KEYS = ["message", "메시지", "내용", "text", "content"];

function findColumn(headers: string[], candidates: string[]): string | undefined {
  return headers.find((h) => candidates.includes(h.trim().toLowerCase()));
}

function parseCsv(text: string): { messages: ChatMessage[] } | { error: string } {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  const dateCol = findColumn(headers, DATE_KEYS);
  const userCol = findColumn(headers, USER_KEYS);
  const messageCol = findColumn(headers, MESSAGE_KEYS);

  if (!userCol || !messageCol) {
    return {
      error: `CSV에서 사용자/메시지 컬럼을 찾지 못했어요. 첫 줄이 "Date,User,Message" 형식인지 확인해 주세요. (찾은 컬럼: ${headers.join(", ") || "없음"})`,
    };
  }

  const messages = result.data.map((row) => ({
    date: dateCol ? (row[dateCol] ?? "").trim() : "",
    user: (row[userCol] ?? "").trim(),
    message: (row[messageCol] ?? "").trim(),
  }));
  return { messages };
}

// ---------- 통계 ----------

function computeStats(messages: ChatMessage[]): ChatStats {
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.user, (counts.get(m.user) ?? 0) + 1);
  const participants = [...counts.entries()]
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count);
  const dates = messages.map((m) => m.date).filter(Boolean);
  return {
    total: messages.length,
    participants,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}
