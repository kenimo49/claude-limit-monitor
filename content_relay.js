// isolatedワールド: MAINワールドからのメッセージをbackgroundへ中継
// DOMからのリセット時刻テキスト抽出も担当

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "claude_monitor") return;

  if (event.data.type === "ALL_URLS") {
    chrome.runtime.sendMessage({ type: "LOG_URL", url: event.data.url });
  } else if (event.data.type === "API_RESPONSE") {
    chrome.runtime.sendMessage({ type: "API_DATA", payload: event.data });
  }
});

// DOMに「X時間後にリセット」などのテキストが出たときに取得
function extractDOMUsageData() {
  const text = document.body?.innerText || "";

  const patterns = [
    // "resets in 2 hours", "refreshes in 1 hour"
    /(?:resets?|refreshes?|available\s+again|renews?)\s+in\s+(\d+)\s*h(?:our)?s?/i,
    // "2 hours until reset"
    /(\d+)\s*h(?:our)?s?\s+until\s+(?:reset|refresh)/i,
    // "Usage resets in 3h 20m"
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
        payload: {
          reset_at_ms: resetAt,
          hours_remaining: hours,
          minutes_remaining: minutes,
        },
      });
      break;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", extractDOMUsageData);
} else {
  extractDOMUsageData();
}

const observer = new MutationObserver(extractDOMUsageData);
observer.observe(document.documentElement, { childList: true, subtree: true });
