// 카카오톡 내보내기 파일을 앱과 같은 파서로 읽고 통계만 출력한다.
// 메시지 내용은 출력하지 않으므로 개인정보가 담긴 실제 파일에도 쓸 수 있다.
//
// 사용법: npm run parse -- <파일 경로> [--names]
//   --names  참여자 이름도 출력한다 (기본은 "참여자 1"처럼 가린다)

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseKakaoExport } from "../lib/kakao-export.ts";
import { buildTranscript, MAX_CHARS } from "../lib/transcript.ts";

const args = process.argv.slice(2);
const showNames = args.includes("--names");
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error("사용법: npm run parse -- <파일 경로> [--names]");
  process.exit(1);
}

let text: string;
try {
  text = readFileSync(filePath, "utf8");
} catch (err) {
  console.error(`파일을 읽지 못했어요: ${(err as Error).message}`);
  process.exit(1);
}

const result = parseKakaoExport(text, basename(filePath));
if (!result.ok) {
  console.error(`파싱 실패: ${result.error}`);
  process.exit(1);
}

const { format, messages, stats } = result;
const transcriptChars = buildTranscript(messages).length;
const multiLine = messages.filter((m) => m.message.includes("\n")).length;
const noDate = messages.filter((m) => !/^\d{4}-\d{2}-\d{2}/.test(m.date)).length;
const pct = ((transcriptChars / MAX_CHARS) * 100).toFixed(1);

console.log(`파일        ${basename(filePath)} (${text.length.toLocaleString()}자, ${text.split(/\r?\n/).length.toLocaleString()}줄)`);
console.log(`형식        ${format}`);
console.log(`메시지      ${stats.total.toLocaleString()}개 (여러 줄 ${multiLine.toLocaleString()}개, 날짜 없음 ${noDate.toLocaleString()}개)`);
console.log(`기간        ${stats.firstDate ?? "-"} ~ ${stats.lastDate ?? "-"}`);
console.log(`대화 기록   ${transcriptChars.toLocaleString()}자 / 한도 ${MAX_CHARS.toLocaleString()}자 (${pct}%)${transcriptChars > MAX_CHARS ? "  ← 한도 초과: API가 413을 돌려줍니다" : ""}`);
console.log(`참여자      ${stats.participants.length}명`);
stats.participants.slice(0, 10).forEach((p, i) => {
  const name = showNames ? p.user : `참여자 ${i + 1}`;
  console.log(`  ${String(i + 1).padStart(2)}. ${name}  ${p.count.toLocaleString()}개`);
});
if (stats.participants.length > 10) console.log(`  … 외 ${stats.participants.length - 10}명`);
