// isolatedワールド: MAINワールドからのメッセージをbackgroundへ中継
// ページロード後にusage + accountエンドポイントをプロアクティブに取得する

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

async function sendToBackground(url, data, orgIdHint = null) {
  chrome.runtime.sendMessage({
    type: "API_DATA",
    payload: { source: "claude_monitor", type: "API_RESPONSE", url, data, org_id_hint: orgIdHint },
  });
}

async function init() {
  const orgId = getOrgIdFromCookie();
  if (!orgId) return;

  // usage と account を並行取得
  const [usageData, accountData] = await Promise.all([
    fetchJSON(`/api/organizations/${orgId}/usage`),
    fetchJSON("/api/account"),
  ]);

  // どちらも org_id_hint を付けて「どのアカウントか」を明示する
  if (usageData) await sendToBackground(`/api/organizations/${orgId}/usage`, usageData, orgId);
  if (accountData) await sendToBackground("/api/account", accountData, orgId);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// DOMからのリセット時刻テキスト抽出（フォールバック）
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
      const resetAt = Date.now() + (hours * 60 + minutes) * 60 * 1000;
      chrome.runtime.sendMessage({
        type: "DOM_DATA",
        payload: { reset_at_ms: resetAt, hours_remaining: hours, minutes_remaining: minutes },
      });
      break;
    }
  }
}

const observer = new MutationObserver(extractDOMUsageData);
observer.observe(document.documentElement, { childList: true, subtree: true });
