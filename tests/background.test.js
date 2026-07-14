const { findEmail, findName, findUsage, toMs } = require("../background");

// ---- toMs ----

describe("toMs", () => {
  test("nullはnullを返す", () => {
    expect(toMs(null)).toBeNull();
    expect(toMs(undefined)).toBeNull();
  });

  test("Unix秒（13桁未満）はmsに変換される", () => {
    expect(toMs(1_700_000_000)).toBe(1_700_000_000_000);
  });

  test("Unix ms（13桁以上）はそのまま返る", () => {
    expect(toMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  test("ISO文字列をmsに変換する", () => {
    const iso = "2025-01-01T00:00:00Z";
    expect(toMs(iso)).toBe(new Date(iso).getTime());
  });

  test("無効な文字列はnullを返す", () => {
    expect(toMs("not-a-date")).toBeNull();
  });
});

// ---- findEmail ----

describe("findEmail", () => {
  test("nullやプリミティブはnullを返す", () => {
    expect(findEmail(null)).toBeNull();
    expect(findEmail("string")).toBeNull();
    expect(findEmail(42)).toBeNull();
  });

  test("トップレベルのemailを返す", () => {
    expect(findEmail({ email: "ken@example.com" })).toBe("ken@example.com");
  });

  test("user.emailを返す", () => {
    expect(findEmail({ user: { email: "ken@example.com" } })).toBe("ken@example.com");
  });

  test("account.emailを返す", () => {
    expect(findEmail({ account: { email: "ken@example.com" } })).toBe("ken@example.com");
  });

  test("me.emailを返す", () => {
    expect(findEmail({ me: { email: "ken@example.com" } })).toBe("ken@example.com");
  });

  test("currentUser.emailを返す", () => {
    expect(findEmail({ currentUser: { email: "ken@example.com" } })).toBe("ken@example.com");
  });

  test("@を含まない文字列は無視する", () => {
    expect(findEmail({ email: "not-an-email" })).toBeNull();
  });

  test("メールがなければnullを返す", () => {
    expect(findEmail({ name: "ken", plan: "max" })).toBeNull();
  });
});

// ---- findName ----

describe("findName", () => {
  test("nullはnullを返す", () => {
    expect(findName(null)).toBeNull();
  });

  test("トップレベルのnameを返す", () => {
    expect(findName({ name: "ken imoto" })).toBe("ken imoto");
  });

  test("user.nameを返す", () => {
    expect(findName({ user: { name: "ken imoto" } })).toBe("ken imoto");
  });

  test("full_nameを優先する", () => {
    expect(findName({ full_name: "Full Name", name: "short" })).toBe("Full Name");
  });

  test("名前がなければnullを返す", () => {
    expect(findName({ email: "ken@example.com" })).toBeNull();
  });
});

// ---- findUsage ----

describe("findUsage", () => {
  test("nullはnullを返す", () => {
    expect(findUsage(null)).toBeNull();
  });

  test("limit/usage/reset/remainingを一切含まないデータはnullを返す", () => {
    expect(findUsage({ email: "ken@example.com", name: "ken" })).toBeNull();
  });

  test("usage.five_hour 構造を正しく抽出する", () => {
    const data = {
      usage: {
        five_hour: { used: 30, limit: 100, reset_at: 1_700_000_000 },
      },
    };
    const result = findUsage(data);
    expect(result.five_hour_used).toBe(30);
    expect(result.five_hour_limit).toBe(100);
    expect(result.five_hour_reset_at).toBe(1_700_000_000_000);
  });

  test("rate_limits.five_hour 構造を正しく抽出する", () => {
    const data = {
      rate_limits: {
        five_hour: { used: 10, limit: 50, reset_at: 1_700_000_000 },
      },
    };
    const result = findUsage(data);
    expect(result.five_hour_used).toBe(10);
    expect(result.five_hour_limit).toBe(50);
  });

  test("フラットな tokens_used / tokens_limit を抽出する", () => {
    const data = { tokens_used: 500, tokens_limit: 2000, reset_at: "2025-01-01T05:00:00Z" };
    const result = findUsage(data);
    expect(result.five_hour_used).toBe(500);
    expect(result.five_hour_limit).toBe(2000);
    expect(result.five_hour_reset_at).toBe(new Date("2025-01-01T05:00:00Z").getTime());
  });

  test("usage.weekly 構造を正しく抽出する", () => {
    const data = {
      usage: {
        weekly: { used: 200, limit: 1000, reset_at: 1_700_000_000 },
      },
    };
    const result = findUsage(data);
    expect(result.weekly_used).toBe(200);
    expect(result.weekly_limit).toBe(1000);
    expect(result.weekly_reset_at).toBe(1_700_000_000_000);
  });

  test("plan を文字列として抽出する", () => {
    expect(findUsage({ plan: "max_20x", usage: { five_hour: { limit: 100 } } }).plan).toBe("max_20x");
    expect(findUsage({ subscription: { plan: "pro" }, usage: { five_hour: { limit: 50 } } }).plan).toBe("pro");
  });

  test("数値planはstringに変換される", () => {
    const result = findUsage({ plan: 5, usage: { five_hour: { limit: 100 } } });
    expect(result.plan).toBe("5");
  });

  test("limit/usage/reset/remaining を含まないplanのみのデータはnullを返す（早期リターン）", () => {
    // 実際のAPIではplanはusage/limitと一緒に来るため、単独planの早期リターンは仕様
    expect(findUsage({ plan: "pro" })).toBeNull();
  });

  test("値がnullのフィールドは結果に含まれない", () => {
    const data = { usage: { five_hour: { used: 10, limit: 100 } } };
    const result = findUsage(data);
    expect(result).not.toHaveProperty("five_hour_reset_at");
    expect(result).not.toHaveProperty("weekly_used");
  });

  test("limits.five_hour 構造を正しく抽出する", () => {
    const data = {
      limits: {
        five_hour: { used: 7, limit: 45 },
        weekly: { used: 100, limit: 480 },
      },
    };
    const result = findUsage(data);
    expect(result.five_hour_used).toBe(7);
    expect(result.weekly_limit).toBe(480);
  });
});
