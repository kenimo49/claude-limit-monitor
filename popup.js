const STORAGE_KEY = "claude_accounts";

// ---- 時間フォーマット ----

function formatCountdown(ms) {
  if (!ms) return null;
  const diff = ms - Date.now();
  if (diff <= 0) return "リセット済み";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}日 ${h % 24}時間後`; }
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

// スナップショット取得時刻を実時刻で返す
// 同日: "15:23"、昨日: "昨日 15:23"、それ以前: "7/14 15:23"
function formatSnapshotTime(ms) {
  if (!ms) return "不明";
  const d = new Date(ms);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `昨日 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

// ---- バー ----

function renderBar(pct, isReset = false) {
  if (pct == null) return "";
  const c = Math.min(100, Math.max(0, Math.round(pct)));
  const cls = isReset ? "stale-bar" : c >= 85 ? "danger" : c >= 55 ? "warning" : "";
  const label = isReset ? `前回 ${c}%` : `${c}% 使用中`;
  return `
    <div class="bar-wrap">
      <div class="bar-fill ${cls}" style="width:${c}%"></div>
    </div>
    <div class="bar-label${isReset ? " stale-label" : ""}">${label}</div>`;
}

function renderBarAbsolute(used, limit, isReset = false) {
  if (used == null || !limit) return "";
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const cls = isReset ? "stale-bar" : pct >= 85 ? "danger" : pct >= 55 ? "warning" : "";
  const label = isReset
    ? `前回 ${used.toLocaleString()} / ${limit.toLocaleString()}`
    : `${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)`;
  return `
    <div class="bar-wrap">
      <div class="bar-fill ${cls}" style="width:${pct}%"></div>
    </div>
    <div class="bar-label${isReset ? " stale-label" : ""}">${label}</div>`;
}

function renderLimit(label, utilization, used, limit, resetAt, hoursRemaining) {
  // リセット済み判定（reset_at が過去）
  const isReset = resetAt != null && resetAt - Date.now() <= 0;

  const barHtml = utilization != null ? renderBar(utilization, isReset) : renderBarAbsolute(used, limit, isReset);
  const countdown = formatCountdown(resetAt);
  const countdownText = countdown || (hoursRemaining != null ? `約${hoursRemaining}時間後` : null);

  const isUnused = !isReset && (utilization === 0 || utilization === null) && !resetAt && !hoursRemaining;

  let resetDisplay;
  if (isReset) {
    resetDisplay = '<span class="reset-done">✓ リセット済み</span>';
  } else if (isUnused) {
    resetDisplay = '<span class="unused">未使用</span>';
  } else if (countdownText) {
    // 「〜」でスナップショット時点の予測値であることを明示
    resetDisplay = `〜 ${countdownText}`;
  } else {
    resetDisplay = '<span class="unknown">取得中…</span>';
  }

  return `
    <div class="limit-block${isReset ? " stale" : ""}">
      <div class="limit-row">
        <span class="limit-title">${label}</span>
        <span class="limit-reset">${resetDisplay}</span>
      </div>
      ${barHtml}
    </div>`;
}

// ---- アカウントカード ----

function getDisplayLabel(key, acc) {
  return acc.display_name || acc.email || acc.name || key;
}

function renderAccount(key, acc) {
  const label = getDisplayLabel(key, acc);
  const shortLabel = label.length > 26 ? label.substring(0, 24) + "…" : label;

  const div = document.createElement("div");
  div.className = "card";
  div.dataset.key = key;

  div.innerHTML = `
    <div class="card-header">
      <span class="account-label" title="クリックで名前を編集">${shortLabel}</span>
      <div class="card-meta">
        ${acc.plan ? `<span class="badge">${acc.plan}</span>` : ""}
        <button class="del-btn" title="このアカウントを削除">×</button>
      </div>
    </div>
    <div class="snapshot-time">
      <span class="snapshot-icon">◷</span>
      取得: ${formatSnapshotTime(acc.last_seen)}
      <span class="snapshot-ago">(${formatLastSeen(acc.last_seen)})</span>
    </div>
    ${renderLimit("5時間",
      acc.five_hour_utilization ?? null, acc.five_hour_used ?? null,
      acc.five_hour_limit ?? null, acc.five_hour_reset_at ?? null,
      acc.five_hour_hours_remaining ?? null)}
    ${acc.weekly_reset_at || acc.weekly_utilization != null
      ? renderLimit("7日間",
          acc.weekly_utilization ?? null, acc.weekly_used ?? null,
          acc.weekly_limit ?? null, acc.weekly_reset_at ?? null, null)
      : ""}
  `;

  // ラベルをクリック → インライン編集
  const labelEl = div.querySelector(".account-label");
  labelEl.addEventListener("click", () => {
    const input = document.createElement("input");
    input.className = "label-input";
    input.value = acc.display_name || "";
    input.placeholder = "例: 会社A、個人";
    input.maxLength = 30;
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let saved = false;
    const save = async () => {
      if (saved) return;
      saved = true;
      await chrome.runtime.sendMessage({ type: "SET_LABEL", key, label: input.value });
      render();
    };
    const cancel = () => { if (!saved) { saved = true; render(); } };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") cancel();
    });
    input.addEventListener("blur", save);
  });

  // 削除ボタン
  div.querySelector(".del-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!confirm(`「${label}」を削除しますか？`)) return;
    await chrome.runtime.sendMessage({ type: "DELETE_ACCOUNT", key });
    render();
  });

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

  const countEl = document.getElementById("account-count");
  if (countEl) countEl.textContent = entries.length > 0 ? `${entries.length}` : "";

  if (entries.length === 0) {
    list.innerHTML = '<p class="empty">claude.ai を開いてログインすると<br />アカウント情報が表示されます</p>';
    return;
  }

  for (const [key, acc] of entries) {
    list.appendChild(renderAccount(key, acc));
  }
}

// ---- イベント ----

if (typeof document !== "undefined" && document.getElementById) {
  document.getElementById("clear-btn").addEventListener("click", async () => {
    if (!confirm("すべてのアカウントデータを削除しますか？")) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    render();
  });

  document.getElementById("debug-btn").addEventListener("click", async () => {
    const panel = document.getElementById("debug-panel");
    const output = document.getElementById("debug-output");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      const r = await chrome.storage.local.get(null);
      output.textContent = JSON.stringify(r, null, 2);
    }
  });

  // storageが変わったら即リフレッシュ（別タブからのログインも反映）
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) render();
  });

  render();
  setInterval(render, 30000);
}

if (typeof module !== "undefined") {
  module.exports = { formatCountdown, formatLastSeen, formatSnapshotTime, renderBar };
}
