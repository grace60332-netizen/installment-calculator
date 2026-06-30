/**
 * js/ui.js
 * 專門負責畫面渲染
 */

(function (global) {
  "use strict";

function renderApp(root, data, projects) {
  root.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-title">分期試算工具</div>

        <nav class="sidebar-nav">
          <a href="index.html" class="active">專案試算</a>
          <a href="car-loan.html">車貸補貼息試算</a>
          <a href="admin.html">管理後台</a>
        </nav>
      </aside>

      <main class="main-content">
        <div class="wrap">
          <h1 class="title">${escapeHtml(data.appTitle || "分期試算工具")}</h1>
          <p class="subtitle">
            請選擇專案並輸入貸款金額。一般專案金額單位為「萬」。
          </p>

          <div class="card">
            <div class="grid">
              <div class="field">
                <label for="projectSelect">選擇專案</label>
                <select id="projectSelect">
                  ${projects.map(p => `
                    <option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>
                  `).join("")}
                </select>
                <small id="projectHint"></small>
              </div>

              <div id="dynamicFields" class="full-span"></div>
            </div>

            <div class="actions">
              <button id="calcBtn" type="button">立即試算</button>
              <button id="resetBtn" type="button" class="ghost">重設</button>
            </div>

            <div id="notice" class="notice"></div>
            <div id="summary" class="meta"></div>
          </div>

          <div class="card">
            <div id="resultArea" class="table-wrap">
              <div class="empty">請先輸入資料。</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
}

  function renderDynamicFields(project, data) {
    const box = document.getElementById("dynamicFields");
    const hint = document.getElementById("projectHint");

    if (project.type === "toyota_zero_interest") {
      hint.textContent = "請先選擇車型，系統會自動帶出適用的零利率專案，避免選錯。";

      const enabledModels = (project.models || []).filter(model => model.enabled !== false);
      const plans = project.plans || [];

      box.innerHTML = `
        <div class="dynamic-grid full-span">
          <div class="field full-span">
            <label for="toyotaModel">車型</label>
            <select id="toyotaModel">
              ${enabledModels.map(model => `
                <option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}</option>
              `).join("")}
            </select>
            <small>每個車型會自動對應目前設定的適用專案。</small>
          </div>

          <div class="field full-span">
            <label for="toyotaPlan">適用專案</label>
            <select id="toyotaPlan" disabled>
              ${plans.map(plan => `
                <option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>
              `).join("")}
            </select>
            <small id="toyotaPlanHint">此欄位由車型自動帶入，不需手動選擇。</small>
          </div>

          <div class="field">
            <label for="loanWan">客戶貸款金額（萬）</label>
            <input id="loanWan" type="number" min="10" max="500" step="0.1" value="100">
            <small>例如輸入 63.5 代表 635,000 元。</small>
          </div>

          <div class="field">
            <label for="loanTerm">客戶期數</label>
            <input id="loanTerm" type="number" min="1" max="84" step="1" value="30">
          </div>
        </div>
      `;

      global.UI = {
        renderApp,
        renderDynamicFields,
        renderSummary,
        renderResult,
        renderEmpty,
        showNotice,
        clearNotice,
        syncToyotaPlanFromModel
      };
      return;
    }

    hint.textContent = "輸入貸款金額後，系統會列出該專案所有利率結果。";

    box.innerHTML = `
      <div class="field full-span">
        <label for="loanWan">貸款金額（萬）</label>
        <input
          id="loanWan"
          type="number"
          min="${data.defaultLoanWanMin || 100}"
          max="${data.defaultLoanWanMax || 500}"
          step="${data.defaultLoanWanStep || 5}"
          value="100"
        >
        <small>例如輸入 100 代表 1,000,000 元。</small>
      </div>
    `;
  }

  function syncToyotaPlanFromModel(project) {
    const modelSelect = document.getElementById("toyotaModel");
    const planSelect = document.getElementById("toyotaPlan");
    const hint = document.getElementById("toyotaPlanHint");

    if (!modelSelect || !planSelect) return;

    const model = (project.models || []).find(item => item.id === modelSelect.value);
    const plan = (project.plans || []).find(item => item.id === model?.planId);

    if (plan) {
      planSelect.value = plan.id;
      if (hint) hint.textContent = `目前車型適用：${plan.name}`;
    } else {
      planSelect.value = "";
      if (hint) hint.textContent = "此車型目前未設定適用零利率專案。";
    }
}
  
  function renderSummary(project, loanWan, term, planId) {
    const summary = document.getElementById("summary");
    const loanAmount = Math.round(Number(loanWan) * 10000);

    let html = `
      <div>專案：<strong>${escapeHtml(project.name)}</strong></div>
      <div>輸入金額：<strong>${formatWan(loanWan)} 萬</strong></div>
      <div>實際金額：<strong>${formatMoney(loanAmount)}</strong></div>
    `;

    if (project.type === "toyota_zero_interest") {
      const modelId = document.getElementById("toyotaModel")?.value;
      const model = (project.models || []).find(p => p.id === modelId);
      const plan = (project.plans || []).find(p => p.id === planId);

      html += `
        <div>車型：<strong>${escapeHtml(model?.name || "")}</strong></div>
        <div>適用專案：<strong>${escapeHtml(plan?.name || "")}</strong></div>
        <div>客戶期數：<strong>${term}</strong> 期</div>
      `;
    }

  summary.innerHTML = html;
  }

  function renderResult(result) {
    if (!result || !result.columns || !result.rows) {
      renderEmpty("沒有可顯示的結果。");
      return;
    }

    document.getElementById("resultArea").innerHTML = `
      <table>
        <thead>
          <tr>
            ${result.columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${result.rows.map(row => `
            <tr>
              ${result.columns.map(col => `<td>${formatCell(row[col.key], col.type)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderEmpty(message) {
    document.getElementById("resultArea").innerHTML = `
      <div class="empty">${escapeHtml(message)}</div>
    `;
  }

  function showNotice(message) {
    const notice = document.getElementById("notice");
    notice.textContent = message;
    notice.style.display = "block";
  }

  function clearNotice() {
    const notice = document.getElementById("notice");
    notice.textContent = "";
    notice.style.display = "none";
  }

  function formatCell(value, type) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";

    if (type === "money") return formatMoney(value);
    if (type === "integer") return Math.round(Number(value)).toLocaleString("zh-TW");
    if (type === "ratePercent") return Number(value).toFixed(2) + "%";
    if (type === "ratePercent3") return Number(value).toFixed(3) + "%";

    return escapeHtml(String(value));
  }

  function formatMoney(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return "$" + Math.round(Number(value)).toLocaleString("zh-TW");
  }

  function formatWan(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  global.UI = {
    renderApp,
    renderDynamicFields,
    renderSummary,
    renderResult,
    renderEmpty,
    showNotice,
    clearNotice
  };

})(typeof window !== "undefined" ? window : globalThis);