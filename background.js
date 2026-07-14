const STORAGE_KEY = "claude_accounts";

// ---- データ抽出ヘルパー（純粋関数 — chrome不要）----

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

// /api/organizations/{id}/usage のURLからorg IDを抽出
function findOrgId(url) {
  if (!url) return null;
  const m = url.match(/\/organizations\/([a-f0-9-]{36})\//);
  return m ? m[1] : null;
}

function findUsage(data) {
  if (!data || typeof data !== "object") return null;

  // claude.ai の実際のレスポンス構造:
  // { five_hour: { utilization, resets_at }, seven_day: { utilization, resets_at } }
  if (data.five_hour != null || data.seven_day != null) {
    return {
      five_hour_utilization: data.five_hour?.utilization ?? null,
      five_hour_reset_at: toMs(data.five_hour?.resets_at),
      weekly_utilization: data.seven_day?.utilization ?? null,
      weekly_reset_at: toMs(data.seven_day?.resets_at),
    };
  }

  // フォールバック: 旧来の構造（rate_limits, usage, tokensなど）
  const str = JSON.stringify(data).toLowerCase();
  if (
    !str.includes("limit") &&
    !str.includes("usage") &&
    !str.includes("reset") &&
    !str.includes("remaining")
  ) {
    return null;
  }

  const fiveHourResetAt = toMs(
    data.usage?.five_hour?.reset_at ??
    data.rate_limits?.five_hour?.reset_at ??
    data.reset_at ??
    data.rate_limit_reset_at
  );

  const weeklyResetAt = toMs(
    data.usage?.weekly?.reset_at ??
    data.weekly_usage?.reset_at
  );

  const plan =
    data.plan ??
    data.subscription?.plan ??
    data.tier ??
    data.account?.plan ??
    data.user?.plan;

  const hasAnything = fiveHourResetAt != null || weeklyResetAt != null || plan != null;
  if (!hasAnything) return null;

  return {
    ...(fiveHourResetAt != null ? { five_hour_reset_at: fiveHourResetAt } : {}),
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

// ---- Chrome拡張ランタイム（ブラウザ環境のみ）----

if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "API_DATA") {
      handleAPIData(message.payload);
    } else if (message.type === "DOM_DATA") {
      handleDOMData(message.payload);
    } else if (message.type === "LOG_URL") {
      logUrl(message.url);
    } else if (message.type === "GET_ACCOUNTS") {
      getAccounts().then(sendResponse);
      return true;
    } else if (message.type === "SET_LABEL") {
      setLabel(message.key, message.label).then(sendResponse);
      return true;
    } else if (message.type === "DELETE_ACCOUNT") {
      deleteAccount(message.key).then(sendResponse);
      return true;
    }
  });

  async function handleAPIData({ url, data, org_id_hint }) {
    const email = findEmail(data);
    const usage = findUsage(data);
    // URLから取れなければhintを使う（/api/account などorg IDが入らないURL用）
    const orgId = findOrgId(url) || org_id_hint || null;

    if (!email && !usage && !orgId) return;

    const accounts = await getAccounts();

    // キー決定: org ID > email
    // フォールバックで既存アカウントを上書きしない — 特定できない場合はスキップ
    let key;
    if (orgId) {
      key = `org:${orgId.slice(0, 8)}`;
    } else if (email) {
      key = email;
    } else {
      return;
    }

    accounts[key] = {
      ...accounts[key],
      ...(email ? { email } : {}),
      ...(orgId ? { org_id: orgId } : {}),
      ...(findName(data) ? { name: findName(data) } : {}),
      ...(usage || {}),
      last_seen: Date.now(),
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

  async function logUrl(url) {
    const result = await chrome.storage.local.get("_debug_urls");
    const urls = result._debug_urls || [];
    urls.unshift(url);
    await chrome.storage.local.set({ _debug_urls: urls.slice(0, 30) });
  }

  async function setLabel(key, label) {
    const accounts = await getAccounts();
    if (!accounts[key]) return;
    accounts[key].display_name = label.trim() || null;
    await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
  }

  async function deleteAccount(key) {
    const accounts = await getAccounts();
    delete accounts[key];
    await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
  }

  async function getAccounts() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  }
}

if (typeof module !== "undefined") {
  module.exports = { findEmail, findName, findUsage, findOrgId, toMs };
}
