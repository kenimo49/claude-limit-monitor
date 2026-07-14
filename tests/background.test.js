const { findEmail, findName, findUsage, findOrgId, findUserId, toMs } = require("../background");

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

  test("タイムゾーンオフセット付きISO文字列を変換する", () => {
    const iso = "2026-07-14T18:20:00.012186+00:00";
    expect(toMs(iso)).toBe(new Date(iso).getTime());
  });

  test("無効な文字列はnullを返す", () => {
    expect(toMs("not-a-date")).toBeNull();
  });
});

// ---- findOrgId ----

describe("findOrgId", () => {
  test("標準的なURLからorg IDを抽出する", () => {
    const url = "https://claude.ai/api/organizations/453ec18a-f95c-4fb7-a18c-c84b681a50df/usage";
    expect(findOrgId(url)).toBe("453ec18a-f95c-4fb7-a18c-c84b681a50df");
  });

  test("organizationsを含まないURLはnullを返す", () => {
    expect(findOrgId("https://claude.ai/api/account")).toBeNull();
  });

  test("nullはnullを返す", () => {
    expect(findOrgId(null)).toBeNull();
  });
});

// ---- findUserId ----

describe("findUserId", () => {
  const UUID = "dca91ac9-601d-43cf-9e09-42a82f34cc1d";

  test("nullはnullを返す", () => {
    expect(findUserId(null)).toBeNull();
  });

  test("トップレベルのidを返す", () => {
    expect(findUserId({ id: UUID })).toBe(UUID);
  });

  test("user.idを返す", () => {
    expect(findUserId({ user: { id: UUID } })).toBe(UUID);
  });

  test("account_idを返す", () => {
    expect(findUserId({ account_id: UUID })).toBe(UUID);
  });

  test("UUID形式でない文字列は無視する", () => {
    expect(findUserId({ id: "not-a-uuid" })).toBeNull();
    expect(findUserId({ id: "12345" })).toBeNull();
  });

  test("IDがなければnullを返す", () => {
    expect(findUserId({ name: "ken", email: "ken@example.com" })).toBeNull();
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

// ---- findUsage（実際のclaude.ai構造）----

describe("findUsage — claude.ai /api/organizations/{id}/usage", () => {
  const ACTUAL_RESPONSE = {
    five_hour: {
      utilization: 18,
      resets_at: "2026-07-14T18:20:00.012186+00:00",
      limit_dollars: null,
      used_dollars: null,
      remaining_dollars: null,
    },
    seven_day: {
      utilization: 27,
      resets_at: "2026-07-19T21:00:00.012208+00:00",
      limit_dollars: null,
      used_dollars: null,
      remaining_dollars: null,
    },
    limits: [
      { kind: "session", group: "session", percent: 18, severity: "normal",
        resets_at: "2026-07-14T18:20:00.012186+00:00", is_active: false },
      { kind: "weekly_all", group: "weekly", percent: 27, severity: "normal",
        resets_at: "2026-07-19T21:00:00.012208+00:00", is_active: true },
    ],
  };

  test("five_hour.utilization を正しく抽出する", () => {
    const r = findUsage(ACTUAL_RESPONSE);
    expect(r.five_hour_utilization).toBe(18);
  });

  test("five_hour.resets_at をmsに変換して返す", () => {
    const r = findUsage(ACTUAL_RESPONSE);
    expect(r.five_hour_reset_at).toBe(
      new Date("2026-07-14T18:20:00.012186+00:00").getTime()
    );
  });

  test("seven_day.utilization を weekly_utilization として返す", () => {
    const r = findUsage(ACTUAL_RESPONSE);
    expect(r.weekly_utilization).toBe(27);
  });

  test("seven_day.resets_at を weekly_reset_at として返す", () => {
    const r = findUsage(ACTUAL_RESPONSE);
    expect(r.weekly_reset_at).toBe(
      new Date("2026-07-19T21:00:00.012208+00:00").getTime()
    );
  });

  test("nullはnullを返す", () => {
    expect(findUsage(null)).toBeNull();
  });

  test("five_hour/seven_dayを含まない無関係なデータはnullを返す", () => {
    expect(findUsage({ name: "ken", org: "propel" })).toBeNull();
  });

  test("five_hour のみのデータも抽出できる", () => {
    const r = findUsage({ five_hour: { utilization: 50, resets_at: "2026-07-14T18:20:00Z" } });
    expect(r.five_hour_utilization).toBe(50);
    expect(r.weekly_utilization).toBeNull();
  });
});

// ---- findUsage（フォールバック構造）----

describe("findUsage — フォールバック構造", () => {
  test("rate_limits.five_hour 構造でresets_atを返す", () => {
    const data = {
      rate_limits: { five_hour: { reset_at: 1_700_000_000 } },
    };
    const r = findUsage(data);
    expect(r.five_hour_reset_at).toBe(1_700_000_000_000);
  });

  test("limit/usage/reset/remainingを含まないデータはnullを返す", () => {
    expect(findUsage({ email: "ken@example.com", name: "ken" })).toBeNull();
  });

  test("数値planはstringに変換される", () => {
    const data = { plan: 5, reset_at: 1_700_000_000 };
    expect(findUsage(data).plan).toBe("5");
  });
});
