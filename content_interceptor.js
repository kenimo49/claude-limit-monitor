// MAINワールドで動作: fetchを傍受してusage/limit情報を取得する
(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    const url =
      typeof args[0] === "string"
        ? args[0]
        : args[0] instanceof Request
        ? args[0].url
        : "";

    // JSONレスポンスを返すリクエストをすべて試みる（画像・ストリームは除外）
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("json") && !ct.includes("text")) return response;

    try {
      const clone = response.clone();
      clone
        .text()
        .then((text) => {
          if (!text || text.length > 500_000) return; // 大きすぎるレスポンスはスキップ
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            return; // JSONでなければスキップ
          }

          const str = JSON.stringify(data).toLowerCase();

          // すべてのAPIレスポンスURLを記録（デバッグ用）
          window.postMessage(
            { source: "claude_monitor", type: "ALL_URLS", url },
            "*"
          );

          // usage/limit情報またはアカウント情報を含む場合のみ転送
          const isRelevant =
            str.includes("limit") ||
            str.includes("usage") ||
            str.includes("rate") ||
            str.includes("quota") ||
            str.includes("reset") ||
            str.includes("remaining") ||
            str.includes("email") ||
            str.includes("account") ||
            str.includes("plan") ||
            str.includes("tier") ||
            str.includes("subscription");

          if (isRelevant) {
            window.postMessage(
              { source: "claude_monitor", type: "API_RESPONSE", url, data },
              "*"
            );
          }
        })
        .catch(() => {});
    } catch (e) {}

    return response;
  };
})();
