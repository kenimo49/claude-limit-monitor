// MAINワールドで動作: fetchを傍受してusage/limit情報を取得する
// ※ usage と account は content_relay.js のプロアクティブfetchが処理するためスキップ
(function () {
  // content_relay.js のプロアクティブfetchが担当するエンドポイントはスキップ
  const SKIP_PATTERNS = [
    /\/api\/organizations\//,
    /\/api\/account\b/,
    /\/api\/bootstrap\//,  // bootstrap は content_relay.js が直接 fetch する
  ];

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    const url =
      typeof args[0] === "string"
        ? args[0]
        : args[0] instanceof Request
        ? args[0].url
        : "";

    // proactive fetch が担当するエンドポイントはスキップ
    if (SKIP_PATTERNS.some((p) => p.test(url))) return response;

    // JSON以外もスキップ
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("json") && !ct.includes("text")) return response;

    try {
      const clone = response.clone();
      clone
        .text()
        .then((text) => {
          if (!text || text.length > 200_000) return;
          let data;
          try { data = JSON.parse(text); } catch { return; }

          const str = JSON.stringify(data).toLowerCase();
          const isRelevant =
            str.includes("limit") || str.includes("usage") ||
            str.includes("rate") || str.includes("quota") ||
            str.includes("reset") || str.includes("remaining") ||
            str.includes("plan") || str.includes("tier") ||
            str.includes("subscription");

          if (!isRelevant) return;

          // cookie から現在ログイン中の org ID をヒントとして添付
          const orgHint =
            document.cookie.match(/lastActiveOrg=([a-f0-9-]{36})/)?.[1] || null;

          window.postMessage(
            {
              source: "claude_monitor",
              type: "API_RESPONSE",
              url,
              data,
              org_id_hint: orgHint,
            },
            "*"
          );
        })
        .catch(() => {});
    } catch (e) {}

    return response;
  };
})();
