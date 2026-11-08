import { describe, expect, it } from "vitest";
import { findSecrets, isGitCommitCommand, isRealEnvFile } from "./secret-rules";

// 이 테스트 파일 자체가 검사에 걸리지 않도록 가짜 키를 실행 중에 만든다
const FAKE_KEY = "sk-ant-" + "api03-" + "x".repeat(40);

describe("findSecrets", () => {
  it("Anthropic 키를 찾고 줄 번호를 알려 준다", () => {
    expect(findSecrets("a.ts", `const a = 1;\nconst k = "${FAKE_KEY}";`)).toEqual([
      { file: "a.ts", line: 2, rule: "Anthropic API 키(sk-ant-...)" },
    ]);
  });

  it("문서의 sk-ant-... 같은 자리표시는 무시한다", () => {
    expect(findSecrets("README.md", "ANTHROPIC_API_KEY=sk-ant-...")).toEqual([]);
  });

  it(".env.example에서 비밀 키에 값이 있으면 잡는다", () => {
    const f = findSecrets(".env.example", "APP_PORT=3000\nANTHROPIC_API_KEY=abc\nDB_PASSWORD=\nSECRET_KEY= # 비워 두기");
    expect(f.map((x) => [x.line, x.rule.startsWith(".env.example의 ANTHROPIC_API_KEY")])).toEqual([[2, true]]);
  });

  it("실제 .env 파일은 내용과 상관없이 잡는다", () => {
    expect(findSecrets(".env", "")).toHaveLength(1);
    expect(isRealEnvFile("sub/.env.local")).toBe(true);
    expect(isRealEnvFile(".env.example")).toBe(false);
  });
});

describe("isGitCommitCommand", () => {
  it.each([
    "git commit -m x",
    "git add -A && git commit -q -F - <<'EOF'",
    "git -C C:\\repo commit -m x",
    "git -c user.name=a commit -m x",
    "git add .; git commit -m @'\nmsg\n'@",
  ])("커밋 명령: %s", (cmd) => expect(isGitCommitCommand(cmd)).toBe(true));

  it.each(["git status", "git log --grep commit", "echo commit", "npm run lint", "git show HEAD:commit.txt"])(
    "커밋 아님: %s",
    (cmd) => expect(isGitCommitCommand(cmd)).toBe(false),
  );
});
