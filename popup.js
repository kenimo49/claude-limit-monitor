const STORAGE_KEY = "claude_accounts";

// ---- 時間フォーマット ----

function formatCountdown(ms) {
  if (!ms) return null;
  const diff = ms - Date.now();
  if (diff <= 0) return "✅ リセット済み";

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}日 ${h % 24}時間後`;
  }
  if (h > 0) return `${h}時間 ${m}分後`;
  return `${m}分後`;
}

function formatLastSeen(ms) {
  if (!ms) return "不明";
  const ago = Date.now() - ms;
  const m = Math.floor(ago / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

// ---- レンダリング ----

function renderBar(used, limit) {
  if (used == null || !limit) return "";
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const cls = pct >= 85 ? "danger" : pct >= 55 ? "warning" : "";
  return `
    <div class="bar-wrap">
      <div class="bar-fill ${cls}" style="width:${pct}%"></div>
    </div>
    <div class="bar-label">${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)</div>
  `;
}

function renderLimit(label, used, limit, resetAt, hoursRemaining) {
  const countdown = formatCountdown(resetAt);
  const countdownText =
    countdown ||
    (hoursRemaining != null ? `約${hoursRemaining}時間後にリセット` : null);

  return `
    <div class="limit-block">
      <div class="limit-title">${label}</div>
      ${renderBar(used, limit)}
      <div class="reset-row">
        ${countdownText ? `🔄 <span class="reset-time">${countdownText}にリセット</span>` : '<span class="unknown">リセット時刻取得中…</span>'}
      </div>
    </div>
  `;
}

function renderAccount(key, acc) {
  const div = document.createElement("div");
  div.className = "card";

  const label = acc.email || key;
  const shortLabel =
    label.length > 30 ? label.substring(0, 28) + "…" : label;

  div.innerHTML = `
    <div class="card-header">
      <span class="email" title="${label}">${shortLabel}</span>
      ${acc.plan ? `<span class="badge">${acc.plan}</span>` : ""}
    </div>
    <div class="last-seen">最終確認: ${formatLastSeen(acc.last_seen)}</div>

    ${renderLimit(
      "5時間リミット",
      acc.five_hour_used,
      acc.five_hour_limit,
      acc.five_hour_reset_at,
      acc.five_hour_hours_remaining
    )}

    ${
      acc.weekly_limit || acc.weekly_reset_at
        ? renderLimit(
            "週次リミット",
            acc.weekly_used,
            acc.weekly_limit,
            acc.weekly_reset_at,
            null
          )
        : ""
    }
  `;

  return div;
}

// ---- メイン ----

async function render() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const accounts = result[STORAGE_KEY] || {};

  const list = document.getElementById("accounts-list");
  list.innerHTML = "";

  const entries = Object.entries(accounts).sort(
    (a, b) => (b[1].last_seen || 0) - (a[1].last_seen || 0)
  );

  if (entries.length === 0) {
    list.innerHTML =
      '<p class="empty">claude.ai を開いてログインすると<br />アカウント情報が表示されます</p>';
    return;
  }

  for (const [key, acc] of entries) {
    list.appendChild(renderAccount(key, acc));
  }
}

// ---- イベント・初期化（ブラウザ環境のみ） ----

if (typeof document !== "undefined" && document.getElementById) {
  document.getElementById("clear-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    render();
  });

  document.getElementById("debug-btn").addEventListener("click", async () => {
    const panel = document.getElementById("debug-panel");
    const output = document.getElementById("debug-output");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      output.textContent = JSON.stringify(result[STORAGE_KEY] || {}, null, 2);
    }
  });

  render();
  setInterval(render, 30000);
}

if (typeof module !== "undefined") {
  module.exports = { formatCountdown, formatLastSeen, renderBar };
}
