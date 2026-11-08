// /api/analyze를 실제로 호출해서 파싱 → Claude 분석 → 스키마 검증 경로가 끝까지 도는지 확인한다.
// 서버가 꺼져 있으면 next dev를 직접 켜고, 끝나면 다시 끈다.
// 실제 Claude API를 호출하므로 비용이 든다. 기본 입력은 가상 데이터 samples/sample-kakao.csv.
//
// 사용법: npm run smoke -- [--file <경로>] [--url http://localhost:3000] [--no-start] [--show]
//   --file      분석할 파일 (기본 samples/sample-kakao.csv)
//   --url       서버 주소 (기본 http://localhost:3000)
//   --no-start  서버가 꺼져 있어도 켜지 않고 실패로 끝낸다
//   --show      분석 결과 JSON 전체를 출력한다 (기본은 항목 수만 출력. 실제 파일이면 개인정보가 나올 수 있다)

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { parseKakaoExport } from "../lib/kakao-export.ts";
import { AnalysisSchema } from "../lib/schema.ts";

const ROOT = join(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const filePath = option("--file") ?? join(ROOT, "samples", "sample-kakao.csv");
const baseUrl = (option("--url") ?? "http://localhost:3000").replace(/\/$/, "");
const allowStart = !args.includes("--no-start");
const show = args.includes("--show");

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

/** .env 또는 현재 환경에 ANTHROPIC_API_KEY 값이 있는지 (값은 출력하지 않는다) */
function hasApiKey(): boolean {
  if (process.env.ANTHROPIC_API_KEY) return true;
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return false;
  return /^\s*ANTHROPIC_API_KEY\s*=\s*\S+/m.test(readFileSync(envPath, "utf8"));
}

async function isUp(): Promise<boolean> {
  try {
    // GET은 405를 돌려주지만, 응답이 오면 서버와 라우트가 준비된 것이다 (첫 컴파일도 여기서 끝난다)
    await fetch(`${baseUrl}/api/analyze`, { signal: AbortSignal.timeout(60_000) });
    return true;
  } catch {
    return false;
  }
}

function startServer(): ChildProcess {
  const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const port = new URL(baseUrl).port || "3000";
  const child = spawn(process.execPath, [nextBin, "dev", "--port", port], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout?.on("data", (d) => (log += d));
  child.stderr?.on("data", (d) => (log += d));
  child.on("exit", (code) => {
    // stopServer로 끈 경우는 정상 종료다
    if (code && !stopping) console.error(`next dev가 예기치 않게 종료됐어요 (코드 ${code}).\n${log.slice(-2000)}`);
  });
  return child;
}

let stopping = false;

function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return;
  stopping = true;
  // Windows에서는 next dev가 띄운 하위 프로세스까지 함께 끝내야 포트가 풀린다
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

async function waitUntilUp(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  // 1. 키 확인 (없으면 서버를 켜 봐야 500만 돌아온다)
  if (!hasApiKey()) fail("ANTHROPIC_API_KEY가 .env에 없어요. .env.example이 아니라 .env에 넣어 주세요.");

  // 2. 파싱
  const parsed = parseKakaoExport(readFileSync(filePath, "utf8"), basename(filePath));
  if (!parsed.ok) fail(`파싱 실패: ${parsed.error}`);
  console.log(`✓ 파싱: ${basename(filePath)} → ${parsed.format}, 메시지 ${parsed.stats.total}개, 참여자 ${parsed.stats.participants.length}명`);

  // 3. 서버
  let server: ChildProcess | null = null;
  const agentsMdPath = join(ROOT, "AGENTS.md");
  const agentsMdExisted = existsSync(agentsMdPath);
  try {
    if (await isUp()) {
      console.log(`✓ 서버: ${baseUrl} (이미 실행 중)`);
    } else {
      if (!allowStart) fail(`${baseUrl}에 서버가 없어요. npm run dev로 켜거나 --no-start를 빼 주세요.`);
      console.log(`… 서버: ${baseUrl}에 next dev를 켜는 중`);
      server = startServer();
      if (!(await waitUntilUp(120_000))) fail("120초 안에 서버가 준비되지 않았어요.");
      console.log("✓ 서버: 준비됨");
    }

    // 4. 분석 호출
    const started = Date.now();
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: parsed.messages }),
      signal: AbortSignal.timeout(600_000),
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const body = (await res.json().catch(() => null)) as { analysis?: unknown; error?: string } | null;
    if (!res.ok) fail(`분석: HTTP ${res.status} (${seconds}초) ${body?.error ?? "(본문 없음)"}`);

    // 5. 스키마 검증
    const check = AnalysisSchema.safeParse(body?.analysis);
    if (!check.success) fail(`스키마 불일치 (${seconds}초):\n${JSON.stringify(check.error.issues, null, 2)}`);
    const a = check.data;
    console.log(`✓ 분석: HTTP ${res.status}, ${seconds}초, 스키마 통과`);
    console.log(
      `  요약 ${a.summary.length}자 / 주제 ${a.topics.length} / 결정 ${a.decisions.length} / 액션 아이템 ${a.actionItems.length} / 답변 안 된 질문 ${a.unansweredQuestions.length}`,
    );
    if (show) console.log(JSON.stringify(a, null, 2));
  } finally {
    if (server) {
      stopServer(server);
      // next dev가 새로 만든 AGENTS.md는 커밋 대상이 아니므로 지운다
      if (!agentsMdExisted && existsSync(agentsMdPath)) rmSync(agentsMdPath);
      console.log("✓ 서버: 종료");
    }
  }
}

main().catch((err) => {
  if (process.exitCode !== 1) {
    console.error(err);
    process.exitCode = 1;
  }
});
