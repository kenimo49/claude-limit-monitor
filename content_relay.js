// isolatedワールド: MAINワールドからのメッセージをbackgroundへ中継
// 起動時: account → usage の順で取得し、user_id_hint を揃えて送る

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "claude_monitor") return;
  if (event.data.type === "ALL_URLS") {
    chrome.runtime.sendMessage({ type: "LOG_URL", url: event.data.url });
  } else if (event.data.type === "API_RESPONSE") {
    chrome.runtime.sendMessage({ type: "API_DATA", payload: event.data });
  }
});

function getOrgIdFromCookie() {
  const m = document.cookie.match(/lastActiveOrg=([a-f0-9-]{36})/);
  return m ? m[1] : null;
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// UUIDをデータから取り出す（background.js の findUserId と同じロジック）
function extractUserId(data) {
  if (!data || typeof data !== "object") return null;
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  const candidates = [
    data.id, data.uuid, data.user_id, data.account_id,
    data.userId, data.user?.id, data.me?.id, data.account?.id,
  ];
  return candidates.find((v) => typeof v === "string" && UUID.test(v)) || null;
}

function send(url, data, orgId, userId = null) {
  chrome.runtime.sendMessage({
    type: "API_DATA",
    payload: {
      source: "claude_monitor",
      type: "API_RESPONSE",
      url,
      data,
      org_id_hint: orgId,
      user_id_hint: userId,
    },
  });
}

async function init() {
  const orgId = getOrgIdFromCookie();
  if (!orgId) return;

  // ① account を先に取得してユーザーIDを確定する
  const accountData = await fetchJSON("/api/account");
  const userId = accountData ? extractUserId(accountData) : null;
  if (accountData) send("/api/account", accountData, orgId, userId);

  // ② usage を取得するとき user_id_hint も添える → 複合キーに直接書き込まれる
  const usageData = await fetchJSON(`/api/organizations/${orgId}/usage`);
  if (usageData) send(`/api/organizations/${orgId}/usage`, usageData, orgId, userId);
}

// DOMContentLoaded 後に少し待ってから実行（lastActiveOrg cookie 確定を待つ）
function scheduleInit() {
  setTimeout(init, 800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleInit);
} else {
  scheduleInit();
}

// DOMフォールバック（テキストからリセット時刻を取る）
function extractDOMUsageData() {
  const text = document.body?.innerText || "";
  const patterns = [
    /(?:resets?|refreshes?|available\s+again|renews?)\s+in\s+(\d+)\s*h(?:our)?s?/i,
    /(\d+)\s*h(?:our)?s?\s+until\s+(?:reset|refresh)/i,
    /usage\s+resets?\s+in\s+(\d+)h\s*(\d+)?m?/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const hours = parseInt(m[1], 10);
      const minutes = parseInt(m[2] || "0", 10);
      chrome.runtime.sendMessage({
        type: "DOM_DATA",
        payload: {
          reset_at_ms: Date.now() + (hours * 60 + minutes) * 60 * 1000,
          hours_remaining: hours,
        },
      });
      break;
    }
  }
}

const observer = new MutationObserver(extractDOMUsageData);
observer.observe(document.documentElement, { childList: true, subtree: true });
