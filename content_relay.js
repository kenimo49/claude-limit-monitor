// isolatedワールド: MAINワールドからのメッセージをbackgroundへ中継
// ページロード後にusageエンドポイントをプロアクティブに取得する

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "claude_monitor") return;

  if (event.data.type === "ALL_URLS") {
    chrome.runtime.sendMessage({ type: "LOG_URL", url: event.data.url });
  } else if (event.data.type === "API_RESPONSE") {
    chrome.runtime.sendMessage({ type: "API_DATA", payload: event.data });
  }
});

// cookieからorg IDを取得
function getOrgIdFromCookie() {
  const m = document.cookie.match(/lastActiveOrg=([a-f0-9-]{36})/);
  return m ? m[1] : null;
}

// usageエンドポイントを直接fetchしてbackgroundへ送る
async function fetchAndSendUsage(orgId) {
  try {
    const url = `/api/organizations/${orgId}/usage`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    chrome.runtime.sendMessage({
      type: "API_DATA",
      payload: { source: "claude_monitor", type: "API_RESPONSE", url, data },
    });
  } catch (e) {}
}

// ページロード後に実行
async function init() {
  const orgId = getOrgIdFromCookie();
  if (orgId) {
    await fetchAndSendUsage(orgId);
  }
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
