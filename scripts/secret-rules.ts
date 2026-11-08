// 커밋하면 안 되는 비밀값을 찾는 규칙. scripts/check-secrets.ts가 쓴다.
// 찾은 값 자체는 결과에 담지 않는다 (화면이나 로그에 키가 찍히지 않게).

export type SecretFinding = { file: string; line: number | null; rule: string };

const CONTENT_RULES: { rule: string; pattern: RegExp }[] = [
  { rule: "Anthropic API 키(sk-ant-...)", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { rule: "개인 키(PRIVATE KEY 블록)", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

// .env.example에서 값이 비어 있어야 하는 키 이름
const SECRET_KEY_NAME = /^[A-Z0-9_]*(KEY|SECRET|PASSWORD|TOKEN)[A-Z0-9_]*$/;

/** 실제 환경변수 파일인지 (.env, .env.local 등. .env.example은 템플릿이라 제외) */
export function isRealEnvFile(file: string): boolean {
  const name = file.split(/[\\/]/).pop() ?? "";
  return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
}

export function findSecrets(file: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  if (isRealEnvFile(file)) {
    findings.push({ file, line: null, rule: "실제 환경변수 파일(.env)은 커밋하면 안 됩니다" });
  }

  const name = file.split(/[\\/]/).pop() ?? "";
  const lines = content.split(/\r?\n/);
  lines.forEach((text, i) => {
    for (const { rule, pattern } of CONTENT_RULES) {
      if (pattern.test(text)) findings.push({ file, line: i + 1, rule });
    }
    if (name === ".env.example") {
      const m = text.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m && SECRET_KEY_NAME.test(m[1]) && m[2].replace(/#.*$/, "").trim() !== "") {
        findings.push({ file, line: i + 1, rule: `.env.example의 ${m[1]}에 값이 들어 있음 (템플릿은 비워 두고 실제 값은 .env에)` });
      }
    }
  });
  return findings;
}

/** hook으로 받은 셸 명령이 git commit을 실행하는지 */
export function isGitCommitCommand(command: string): boolean {
  return /\bgit\b(\s+-[cC]\s+\S+|\s+--?[\w-]+(=\S+)?)*\s+commit\b/.test(command);
}
