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

    // APIコールのみ対象
    if (url.includes("/api/") || url.match(/^\/[a-z]/)) {
      try {
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            const str = JSON.stringify(data).toLowerCase();
            if (
              str.includes("limit") ||
              str.includes("usage") ||
              str.includes("rate") ||
              str.includes("quota") ||
              str.includes("reset") ||
              str.includes("remaining") ||
              str.includes("email") ||
              str.includes("account")
            ) {
              window.postMessage(
                {
                  source: "claude_monitor",
                  type: "API_RESPONSE",
                  url,
                  data,
                },
                "*"
              );
            }
          })
          .catch(() => {});
      } catch (e) {}
    }

    return response;
  };
})();
