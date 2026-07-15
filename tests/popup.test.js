// popup.jsはdocument依存のコードを含むため、chrome APIをスタブする
global.chrome = { storage: { local: { get: jest.fn(), remove: jest.fn() } } };
// document.getElementById が呼ばれないよう render() はexport後にguardされているので問題なし

const { formatCountdown, formatLastSeen, formatSnapshotTime, renderBar } = require("../popup");

// ---- formatCountdown ----

describe("formatCountdown", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("nullはnullを返す", () => {
    expect(formatCountdown(null)).toBeNull();
    expect(formatCountdown(0)).toBeNull();
  });

  test("過去のタイムスタンプは「リセット済み」を返す", () => {
    expect(formatCountdown(NOW - 1000)).toBe("リセット済み");
    expect(formatCountdown(NOW)).toBe("リセット済み");
  });

  test("リセット済みはリセット済みと表示する（renderLimit側でstale判定）", () => {
    // formatCountdown 自体は "リセット済み" を返すだけ
    expect(formatCountdown(NOW - 3600000)).toBe("リセット済み");
  });

  test("1時間後を正しくフォーマットする", () => {
    expect(formatCountdown(NOW + 3_600_000)).toBe("1時間 0分後");
  });

  test("1時間30分後を正しくフォーマットする", () => {
    expect(formatCountdown(NOW + 5_400_000)).toBe("1時間 30分後");
  });

  test("30分後を正しくフォーマットする", () => {
    expect(formatCountdown(NOW + 1_800_000)).toBe("30分後");
  });

  test("24時間以上は日数表示になる", () => {
    expect(formatCountdown(NOW + 25 * 3_600_000)).toBe("1日 1時間後");
  });

  test("ちょうど24時間後", () => {
    expect(formatCountdown(NOW + 24 * 3_600_000)).toBe("1日 0時間後");
  });

  test("48時間後は2日表示", () => {
    expect(formatCountdown(NOW + 48 * 3_600_000)).toBe("2日 0時間後");
  });
});

// ---- formatLastSeen ----

describe("formatLastSeen", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("nullは「不明」を返す", () => {
    expect(formatLastSeen(null)).toBe("不明");
    expect(formatLastSeen(undefined)).toBe("不明");
  });

  test("30秒前は「たった今」を返す", () => {
    expect(formatLastSeen(NOW - 30_000)).toBe("たった今");
  });

  test("ちょうど1分前", () => {
    expect(formatLastSeen(NOW - 60_000)).toBe("1分前");
  });

  test("45分前", () => {
    expect(formatLastSeen(NOW - 45 * 60_000)).toBe("45分前");
  });

  test("3時間前", () => {
    expect(formatLastSeen(NOW - 3 * 3_600_000)).toBe("3時間前");
  });

  test("25時間前は「1日前」", () => {
    expect(formatLastSeen(NOW - 25 * 3_600_000)).toBe("1日前");
  });
});

// ---- formatSnapshotTime ----

describe("formatSnapshotTime", () => {
  const NOW = new Date("2026-07-15T15:23:00+09:00").getTime();

  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  test("同日は HH:MM のみ", () => {
    const t = new Date("2026-07-15T09:00:00+09:00").getTime();
    expect(formatSnapshotTime(t)).toBe("09:00");
  });

  test("null は「不明」", () => {
    expect(formatSnapshotTime(null)).toBe("不明");
  });
});

// ---- renderBar（utilization % を受け取る新API）----

describe("renderBar", () => {
  test("nullは空文字を返す", () => {
    expect(renderBar(null)).toBe("");
    expect(renderBar(undefined)).toBe("");
  });

  test("0%でclassなし", () => {
    const html = renderBar(0);
    expect(html).toContain('style="width:0%"');
    expect(html).not.toContain("warning");
    expect(html).not.toContain("danger");
  });

  test("54%でclassなし", () => {
    const html = renderBar(54);
    expect(html).toContain('style="width:54%"');
    expect(html).not.toContain("warning");
    expect(html).not.toContain("danger");
  });

  test("55%でwarning", () => {
    const html = renderBar(55);
    expect(html).toContain("warning");
    expect(html).not.toContain("danger");
  });

  test("85%でdanger", () => {
    const html = renderBar(85);
    expect(html).toContain("danger");
  });

  test("100%超えは100%にクランプされる", () => {
    const html = renderBar(120);
    expect(html).toContain('style="width:100%"');
  });

  test("パーセント表示がラベルに含まれる", () => {
    const html = renderBar(18); // 実際のutilization値
    expect(html).toContain("18%");
  });
});
