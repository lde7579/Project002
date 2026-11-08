import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKakaoExport, type ParseResult } from "./kakao-export";

const D = "--------------- 2026년 1월 14일 수요일 ---------------\n";

/** 성공 결과만 꺼낸다. 실패하면 에러 문구를 보여 주며 테스트를 깨뜨린다. */
function ok(result: ParseResult) {
  if (!result.ok) throw new Error(`파싱 실패: ${result.error}`);
  return result;
}

function sample(name: string) {
  return readFileSync(new URL(`../samples/${name}`, import.meta.url), "utf8");
}

describe("TXT 내보내기", () => {
  it("날짜 구분선의 날짜와 시간을 합친다", () => {
    const r = ok(parseKakaoExport(D + "[철수] [오전 9:02] 안녕", "a.txt"));
    expect(r.format).toBe("txt");
    expect(r.messages).toEqual([{ date: "2026-01-14 09:02", user: "철수", message: "안녕" }]);
  });

  it("오전/오후 12시를 24시간제로 바꾼다", () => {
    const r = ok(parseKakaoExport(D + "[철수] [오전 12:05] a\n[철수] [오후 12:05] b\n[철수] [오후 11:59] c", "a.txt"));
    expect(r.messages.map((m) => m.date)).toEqual(["2026-01-14 00:05", "2026-01-14 12:05", "2026-01-14 23:59"]);
  });

  it("접두어 없는 줄은 앞 메시지에 이어 붙인다", () => {
    const r = ok(parseKakaoExport(D + "[철수] [오전 9:02] 첫줄\n둘째줄\n셋째줄", "a.txt"));
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].message).toBe("첫줄\n둘째줄\n셋째줄");
  });

  it("시스템 줄 뒤에 오는 줄은 앞 메시지에 붙이지 않는다", () => {
    const r = ok(parseKakaoExport(D + "[철수] [오전 9:02] 첫줄\n영희님이 나갔습니다.\n고아줄", "a.txt"));
    expect(r.messages[0].message).toBe("첫줄");
  });

  it("메시지 형식으로 들어온 삭제 알림을 거른다", () => {
    const r = ok(
      parseKakaoExport(
        D + "[철수] [오후 3:00] 안녕\n[영희] [오후 3:01] 삭제된 메시지입니다.\n[영희] [오후 3:02] 메시지가 삭제되었습니다.",
        "a.txt",
      ),
    );
    expect(r.messages.map((m) => m.message)).toEqual(["안녕"]);
  });

  it("맨 위의 방 이름과 저장 날짜 줄은 무시한다", () => {
    const r = ok(parseKakaoExport("독서 모임 님과 카카오톡 대화\n저장한 날짜 : 2026-11-08 07:57:03\n\n" + D + "[철수] [오전 9:02] a", "a.txt"));
    expect(r.messages).toEqual([{ date: "2026-01-14 09:02", user: "철수", message: "a" }]);
  });

  it("BOM과 CRLF 줄바꿈을 처리한다", () => {
    const r = ok(parseKakaoExport("﻿" + D.replace("\n", "\r\n") + "[철수] [오전 9:02] a\r\n둘째줄\r\n", "a.txt"));
    expect(r.messages).toEqual([{ date: "2026-01-14 09:02", user: "철수", message: "a\n둘째줄" }]);
  });

  it("확장자가 없어도 내용을 보고 TXT로 판단한다", () => {
    expect(ok(parseKakaoExport(D + "[철수] [오전 9:02] a", "")).format).toBe("txt");
  });

  it("형식이 맞지 않으면 한국어 에러를 돌려준다", () => {
    const r = parseKakaoExport("그냥 아무 글", "a.txt");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("카카오톡 대화 형식을 찾지 못했어요");
  });
});

describe("CSV 내보내기", () => {
  it("영어 헤더를 읽는다", () => {
    const r = ok(parseKakaoExport("Date,User,Message\n2026-01-14 09:00,철수,안녕\n", "a.csv"));
    expect(r.format).toBe("csv");
    expect(r.messages).toEqual([{ date: "2026-01-14 09:00", user: "철수", message: "안녕" }]);
  });

  it("한글 헤더를 읽는다", () => {
    const r = ok(parseKakaoExport("날짜,사용자,메시지\n2026-01-14 09:00,철수,안녕\n", "a.csv"));
    expect(r.messages[0]).toEqual({ date: "2026-01-14 09:00", user: "철수", message: "안녕" });
  });

  it("따옴표 안의 줄바꿈을 한 메시지로 읽는다", () => {
    const r = ok(parseKakaoExport('Date,User,Message\n2026-01-14 09:00,철수,"a\nb"\n', "a.csv"));
    expect(r.messages[0].message).toBe("a\nb");
  });

  it("시스템 메시지를 거른다", () => {
    const r = ok(
      parseKakaoExport("Date,User,Message\n2026-01-14 09:00,철수,안녕\n2026-01-14 09:01,영희,삭제된 메시지입니다.\n", "a.csv"),
    );
    expect(r.messages.map((m) => m.message)).toEqual(["안녕"]);
  });

  it("사용자/메시지 컬럼이 없으면 찾은 컬럼을 알려 준다", () => {
    const r = parseKakaoExport("x,y,z\n1,2,3", "a.csv");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("(찾은 컬럼: x, y, z)");
  });
});

describe("공통", () => {
  it("사진/이모티콘 같은 노이즈만 있으면 에러를 돌려준다", () => {
    const r = parseKakaoExport(D + "[철수] [오전 9:02] 사진 3장\n[철수] [오전 9:03] 이모티콘", "a.txt");
    expect(r).toEqual({ ok: false, error: "파일에 분석할 메시지가 없어요." });
  });

  it("참여자를 메시지 수 내림차순으로 정렬하고 첫/마지막 날짜를 구한다", () => {
    const r = ok(parseKakaoExport(D + "[철수] [오전 9:02] a\n[영희] [오전 9:03] b\n[영희] [오전 9:04] c", "a.txt"));
    expect(r.stats).toEqual({
      total: 3,
      participants: [
        { user: "영희", count: 2 },
        { user: "철수", count: 1 },
      ],
      firstDate: "2026-01-14 09:02",
      lastDate: "2026-01-14 09:04",
    });
  });
});

describe("샘플 파일 회귀", () => {
  it("samples/sample-kakao.txt", () => {
    const r = ok(parseKakaoExport(sample("sample-kakao.txt"), "sample-kakao.txt"));
    expect(r.format).toBe("txt");
    expect(r.stats.total).toBe(12);
    expect(r.stats.participants).toHaveLength(7);
    expect(r.stats.firstDate).toBe("2026-11-01 09:02");
    expect(r.stats.lastDate).toBe("2026-11-02 23:59");
    // 여러 줄 메시지
    expect(r.messages[4].message).toBe("그럼 11월 21일 토요일 오후 2시로 할게요\n장소는 지난번 그 카페입니다\n늦으시는 분은 미리 말씀해 주세요");
    // 노이즈와 시스템 메시지가 남아 있지 않다
    const bodies = r.messages.map((m) => m.message);
    for (const removed of ["사진 3장", "이모티콘", "삭제된 메시지입니다.", "메시지가 삭제되었습니다."]) {
      expect(bodies).not.toContain(removed);
    }
  });

  it("samples/sample-kakao.csv", () => {
    const r = ok(parseKakaoExport(sample("sample-kakao.csv"), "sample-kakao.csv"));
    expect(r.format).toBe("csv");
    // 입장 알림 행은 사용자 칸과 메시지 칸 모두 "오세훈님이 들어왔습니다"다
    expect(r.messages.some((m) => m.user.includes("님이 들어왔습니다"))).toBe(false);
    expect(r.stats.total).toBe(30);
    expect(r.stats.participants).toHaveLength(7);
    expect(r.stats.firstDate).toBe("2026-11-01 09:02:11");
    expect(r.stats.lastDate).toBe("2026-11-01 21:05:33");
  });
});
