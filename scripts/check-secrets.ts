// 커밋 대상 파일에 API 키 같은 비밀값이 있는지 검사한다.
//
// 사용법:
//   npm run check-secrets           이번 커밋에 들어갈 수 있는 파일 (staged + 수정됨 + 새 파일, .gitignore 제외)
//   npm run check-secrets -- --all  추적 중인 모든 파일 + 새 파일
//   node scripts/check-secrets.ts --hook
//     Claude Code PreToolUse hook용. stdin의 tool_input.command가 git commit일 때만 검사하고,
//     걸리면 exit 2로 명령을 막는다. (.claude/settings.json 참고)
//
// 같은 명령 안에서 "git add -A && git commit"을 하는 경우도 막을 수 있도록,
// staged 파일만이 아니라 아직 add되지 않은 변경 파일도 함께 본다.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findSecrets, isGitCommitCommand, type SecretFinding } from "./secret-rules.ts";

const ROOT = join(import.meta.dirname, "..");
const MAX_BYTES = 2 * 1024 * 1024;
const args = process.argv.slice(2);
const hookMode = args.includes("--hook");

function git(...gitArgs: string[]): string[] {
  const r = spawnSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(" ")} 실패: ${r.stderr.trim()}`);
  return r.stdout.split("\0").filter(Boolean);
}

function candidateFiles(all: boolean): string[] {
  const files = all
    ? git("ls-files", "-z", "--cached", "--others", "--exclude-standard")
    : [
        ...git("diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"),
        ...git("ls-files", "-z", "--modified", "--others", "--exclude-standard"),
      ];
  return [...new Set(files)];
}

function scan(all: boolean): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const file of candidateFiles(all)) {
    const abs = join(ROOT, file);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue; // 삭제된 파일
    if (statSync(abs).size > MAX_BYTES) continue;
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8000).includes(0)) continue; // 바이너리
    findings.push(...findSecrets(file, buf.toString("utf8")));
  }
  return findings;
}

function format(findings: SecretFinding[]): string {
  return findings.map((f) => `  - ${f.file}${f.line ? `:${f.line}` : ""}  ${f.rule}`).join("\n");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (hookMode) {
    let command = "";
    try {
      command = JSON.parse(await readStdin())?.tool_input?.command ?? "";
    } catch {
      return; // hook 입력을 못 읽으면 막지 않는다 (git commit이 아닐 가능성이 훨씬 높다)
    }
    if (!isGitCommitCommand(command)) return;

    let findings: SecretFinding[];
    try {
      findings = scan(false);
    } catch (err) {
      console.error(`커밋 전 비밀값 검사를 실행하지 못해서 커밋을 막았습니다: ${(err as Error).message}`);
      process.exit(2);
    }
    if (findings.length > 0) {
      console.error(
        `커밋 전 비밀값 검사에서 걸려서 커밋을 막았습니다. 값은 출력하지 않습니다.\n${format(findings)}\n` +
          "값을 지우거나(.env.example은 비워 두기) 파일을 .gitignore에 넣은 뒤 다시 커밋하세요. 직접 확인하려면 npm run check-secrets.",
      );
      process.exit(2);
    }
    return;
  }

  const all = args.includes("--all");
  const findings = scan(all);
  if (findings.length > 0) {
    console.error(`✗ 비밀값 의심 ${findings.length}건 (값은 출력하지 않습니다)\n${format(findings)}`);
    process.exit(1);
  }
  console.log(`✓ 비밀값 없음 (${all ? "전체 파일" : "커밋 대상 파일"} ${candidateFiles(all).length}개 검사)`);
}

await main();
