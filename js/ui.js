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
      hint.textContent = "請選擇車型，系統會自動帶出該車型目前設定的補助金額與期數。";

      const models = project.models || [];

      box.innerHTML = `
        <div class="dynamic-grid full-span">
          <div class="field full-span">
            <label for="toyotaModel">車型</label>
            <select id="toyotaModel">
              ${models.map(model => `
                <option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}</option>
              `).join("")}
            </select>
            <small>後台可調整每個車型對應的補助金額與期數。</small>
          </div>

          <div class="field">
            <label>目前設定補助金額</label>
            <input id="toyotaSubsidyAmountDisplay" type="text" disabled>
            <small>此欄位由車型自動帶入。</small>
          </div>

          <div class="field">
            <label>目前設定補助期數</label>
            <input id="toyotaSubsidyTermDisplay" type="text" disabled>
            <small>此欄位由車型自動帶入。</small>
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

      syncToyotaModelInfo(project);
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

  function syncToyotaModelInfo(project) {
    const modelSelect = document.getElementById("toyotaModel");
    const amountDisplay = document.getElementById("toyotaSubsidyAmountDisplay");
    const termDisplay = document.getElementById("toyotaSubsidyTermDisplay");

    if (!modelSelect) return;

    const model = (project.models || []).find(item => item.id === modelSelect.value);

    if (!model) {
      if (amountDisplay) amountDisplay.value = "";
      if (termDisplay) termDisplay.value = "";
      return;
    }

    const amount = Number(model.subsidyAmount);
    const term = Number(model.subsidyTerm);

    if (amountDisplay) {
      amountDisplay.value = Number.isFinite(amount) && amount > 0
        ? `${formatMoney(amount)}`
        : "不適用";
    }

    if (termDisplay) {
      termDisplay.value = Number.isFinite(term) && term > 0
        ? `${term} 期`
        : "不適用";
    }
  }

  function renderSummary(project, loanWan, term, modelId) {
    const summary = document.getElementById("summary");
    const loanAmount = Math.round(Number(loanWan) * 10000);

    let html = `
      <div>專案：<strong>${escapeHtml(project.name)}</strong></div>
      <div>輸入金額：<strong>${formatWan(loanWan)} 萬</strong></div>
      <div>實際金額：<strong>${formatMoney(loanAmount)}</strong></div>
    `;

    if (project.type === "toyota_zero_interest") {
      const model = (project.models || []).find(p => p.id === modelId);
      const subsidyAmount = Number(model?.subsidyAmount);
      const subsidyTerm = Number(model?.subsidyTerm);

      html += `
        <div>車型：<strong>${escapeHtml(model?.name || "")}</strong></div>
        <div>補助設定：<strong>${
          Number.isFinite(subsidyAmount) && subsidyAmount > 0 && Number.isFinite(subsidyTerm) && subsidyTerm > 0
            ? `${formatMoney(subsidyAmount)} / ${subsidyTerm} 期`
            : "不適用"
        }</strong></div>
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

    if (result.projectId !== "zhonggu") {
      document.getElementById("resultArea").innerHTML = `
        <div class="result-card-list">
          ${result.rows.map(row => `
            <div class="result-card">
              ${result.columns.map(col => `
                <div class="result-card-row">
                  <span>${escapeHtml(col.label)}</span>
                  <strong>${formatCell(row[col.key], col.type)}</strong>
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
      `;
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
    clearNotice,
    syncToyotaModelInfo
  };

})(typeof window !== "undefined" ? window : globalThis);