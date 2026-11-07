import { z } from "zod";

export const AnalysisSchema = z.object({
  summary: z.string().describe("대화 전체 요약 (3~5문장)"),
  topics: z
    .array(
      z.object({
        title: z.string().describe("주제 이름"),
        summary: z.string().describe("이 주제에서 오간 이야기 한두 문장"),
      }),
    )
    .describe("대화에서 다뤄진 주요 주제"),
  decisions: z.array(z.string()).describe("대화에서 확정된 결정 사항"),
  actionItems: z
    .array(
      z.object({
        task: z.string().describe("해야 할 일"),
        owner: z.string().describe("담당자 이름. 분명하지 않으면 '방장'"),
        due: z
          .string()
          .nullable()
          .describe("대화에 나온 기한. 언급이 없으면 null"),
        priority: z.enum(["high", "medium", "low"]),
        reason: z.string().describe("이 일이 필요한 이유나 근거가 된 대화"),
      }),
    )
    .describe("방장이 처리하거나 챙겨야 할 일"),
  unansweredQuestions: z
    .array(
      z.object({
        question: z.string(),
        askedBy: z.string(),
      }),
    )
    .describe("아직 아무도 답하지 않은 질문"),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

export type ChatMessage = {
  date: string;
  user: string;
  message: string;
};
