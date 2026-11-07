"use client";

import { useState } from "react";
import { parseKakaoExport, type ChatStats } from "@/lib/kakao-export";
import type { Analysis, ChatMessage } from "@/lib/schema";

const PRIORITY_LABEL = { high: "높음", medium: "보통", low: "낮음" } as const;
const PRIORITY_STYLE = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-stone-200 text-stone-600",
} as const;

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());

  async function handleFile(file: File) {
    setError(null);
    setAnalysis(null);
    setDone(new Set());
    setFileName(file.name);
    const result = parseKakaoExport(await file.text(), file.name);
    if (!result.ok) {
      setMessages([]);
      setStats(null);
      setError(result.error);
      return;
    }
    setMessages(result.messages);
    setStats(result.stats);
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setDone(new Set());
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석에 실패했어요.");
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  function toggleDone(i: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold">채팅방 분석기</h1>
      <p className="mt-1 text-sm text-stone-500">
        카카오톡 대화 내보내기 파일을 올리면 요약과 방장이 챙길 일을 정리해 드려요.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-stone-800 bg-stone-100" : "border-stone-300 bg-white hover:border-stone-500"
        }`}
      >
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <span className="font-medium">{fileName ?? "대화 파일을 끌어다 놓거나 클릭해서 선택"}</span>
        <span className="mt-1 text-xs text-stone-500">
          카카오톡 대화 내보내기 TXT, 또는 Date,User,Message 형식 CSV
        </span>
      </label>

      {stats && (
        <section className="mt-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              메시지 <b>{stats.total.toLocaleString()}</b>개
            </span>
            <span>
              참여자 <b>{stats.participants.length}</b>명
            </span>
            {stats.firstDate && (
              <span className="text-stone-500">
                {stats.firstDate} ~ {stats.lastDate}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.participants.slice(0, 10).map((p) => (
              <span key={p.user} className="rounded-full bg-stone-100 px-3 py-1 text-xs">
                {p.user} · {p.count}
              </span>
            ))}
            {stats.participants.length > 10 && (
              <span className="px-1 py-1 text-xs text-stone-500">
                외 {stats.participants.length - 10}명
              </span>
            )}
          </div>
          <button
            onClick={analyze}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-stone-900 py-3 font-medium text-white transition hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-400"
          >
            {loading ? "분석 중… (대화 길이에 따라 30초~몇 분 걸려요)" : "분석하기"}
          </button>
        </section>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {analysis && (
        <div className="mt-6 space-y-4">
          <Card title="요약">
            <p className="leading-relaxed whitespace-pre-line">{analysis.summary}</p>
          </Card>

          <Card title={`액션 아이템 (${analysis.actionItems.length})`}>
            {analysis.actionItems.length === 0 ? (
              <Empty>챙길 일이 없어요.</Empty>
            ) : (
              <ul className="space-y-3">
                {analysis.actionItems.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={done.has(i)}
                      onChange={() => toggleDone(i)}
                      className="mt-1 h-4 w-4 shrink-0 accent-stone-900"
                    />
                    <div className={done.has(i) ? "opacity-40 line-through" : ""}>
                      <div className="font-medium">{item.task}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className={`rounded px-1.5 py-0.5 ${PRIORITY_STYLE[item.priority]}`}>
                          {PRIORITY_LABEL[item.priority]}
                        </span>
                        <span>담당: {item.owner}</span>
                        {item.due && <span>기한: {item.due}</span>}
                      </div>
                      <div className="mt-1 text-sm text-stone-600">{item.reason}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="답변 안 된 질문">
            {analysis.unansweredQuestions.length === 0 ? (
              <Empty>모든 질문에 답이 달렸어요.</Empty>
            ) : (
              <ul className="space-y-2">
                {analysis.unansweredQuestions.map((q, i) => (
                  <li key={i}>
                    <span className="font-medium">{q.askedBy}</span>
                    <span className="text-stone-400"> · </span>
                    {q.question}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="결정 사항">
            {analysis.decisions.length === 0 ? (
              <Empty>확정된 결정이 없어요.</Empty>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {analysis.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="주요 주제">
            <ul className="space-y-3">
              {analysis.topics.map((t, i) => (
                <li key={i}>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-sm text-stone-600">{t.summary}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-stone-500">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-400">{children}</p>;
}
