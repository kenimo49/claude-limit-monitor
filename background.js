const STORAGE_KEY = "claude_accounts";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "API_DATA") {
    handleAPIData(message.payload);
  } else if (message.type === "DOM_DATA") {
    handleDOMData(message.payload);
  } else if (message.type === "GET_ACCOUNTS") {
    getAccounts().then(sendResponse);
    return true;
  }
});

async function handleAPIData({ url, data }) {
  const email = findEmail(data);
  const usage = findUsage(data);

  if (!email && !usage) return;

  const accounts = await getAccounts();

  // メールがあればそれをキーに。なければ直近アカウントを更新
  const key =
    email ||
    Object.keys(accounts).sort(
      (a, b) => (accounts[b].last_seen || 0) - (accounts[a].last_seen || 0)
    )[0] ||
    "account_1";

  accounts[key] = {
    ...accounts[key],
    ...(email ? { email } : {}),
    ...(findName(data) ? { name: findName(data) } : {}),
    ...(usage || {}),
    last_seen: Date.now(),
    // デバッグ用: 最後に取れたURLを残す
    _debug_url: url,
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
}

async function handleDOMData(payload) {
  const accounts = await getAccounts();
  const entries = Object.entries(accounts).sort(
    (a, b) => (b[1].last_seen || 0) - (a[1].last_seen || 0)
  );

  if (entries.length === 0) return;

  const [key, existing] = entries[0];
  accounts[key] = {
    ...existing,
    five_hour_reset_at: payload.reset_at_ms,
    five_hour_hours_remaining: payload.hours_remaining,
    last_seen: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
}

// ---- データ抽出ヘルパー ----

function findEmail(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.email,
    data.user?.email,
    data.account?.email,
    data.profile?.email,
    data.me?.email,
    data.viewer?.email,
    data.currentUser?.email,
  ];
  return candidates.find((v) => typeof v === "string" && v.includes("@")) || null;
}

function findName(data) {
  if (!data || typeof data !== "object") return null;
  return (
    data.full_name ||
    data.name ||
    data.user?.name ||
    data.user?.full_name ||
    data.me?.name ||
    data.profile?.name ||
    null
  );
}

function findUsage(data) {
  if (!data || typeof data !== "object") return null;

  const str = JSON.stringify(data).toLowerCase();
  if (
    !str.includes("limit") &&
    !str.includes("usage") &&
    !str.includes("reset") &&
    !str.includes("remaining")
  ) {
    return null;
  }

  // claude.aiが返す可能性のある様々な構造に対応
  const fiveHourUsed =
    data.usage?.five_hour?.used ??
    data.rate_limits?.five_hour?.used ??
    data.limits?.five_hour?.used ??
    data.tokens_used ??
    data.usage_count;

  const fiveHourLimit =
    data.usage?.five_hour?.limit ??
    data.rate_limits?.five_hour?.limit ??
    data.limits?.five_hour?.limit ??
    data.tokens_limit ??
    data.usage_limit;

  const fiveHourResetAt = toMs(
    data.usage?.five_hour?.reset_at ??
    data.rate_limits?.five_hour?.reset_at ??
    data.limits?.five_hour?.reset_at ??
    data.reset_at ??
    data.rate_limit_reset_at
  );

  const weeklyUsed =
    data.usage?.weekly?.used ??
    data.weekly_usage?.used ??
    data.limits?.weekly?.used;

  const weeklyLimit =
    data.usage?.weekly?.limit ??
    data.weekly_usage?.limit ??
    data.limits?.weekly?.limit;

  const weeklyResetAt = toMs(
    data.usage?.weekly?.reset_at ??
    data.weekly_usage?.reset_at ??
    data.limits?.weekly?.reset_at
  );

  const plan =
    data.plan ??
    data.subscription?.plan ??
    data.tier ??
    data.account?.plan ??
    data.user?.plan;

  const hasAnything =
    fiveHourUsed != null ||
    fiveHourLimit != null ||
    fiveHourResetAt != null ||
    weeklyUsed != null ||
    weeklyLimit != null ||
    weeklyResetAt != null ||
    plan != null;

  if (!hasAnything) return null;

  return {
    ...(fiveHourUsed != null ? { five_hour_used: fiveHourUsed } : {}),
    ...(fiveHourLimit != null ? { five_hour_limit: fiveHourLimit } : {}),
    ...(fiveHourResetAt != null ? { five_hour_reset_at: fiveHourResetAt } : {}),
    ...(weeklyUsed != null ? { weekly_used: weeklyUsed } : {}),
    ...(weeklyLimit != null ? { weekly_limit: weeklyLimit } : {}),
    ...(weeklyResetAt != null ? { weekly_reset_at: weeklyResetAt } : {}),
    ...(plan != null ? { plan: String(plan) } : {}),
  };
}

function toMs(val) {
  if (val == null) return null;
  if (typeof val === "number") return val > 1e12 ? val : val * 1000;
  if (typeof val === "string") {
    const t = new Date(val).getTime();
    return isNaN(t) ? null : t;
  }
  return null;
}

async function getAccounts() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}
