/**
 * js/ui.js
 * 專門負責畫面渲染
 * 重構版：
 * - 桌機：豪享／樂享／樂購顯示利率比較表
 * - 手機：豪享／樂享／樂購自動改成一個利率一張卡
 * - TOYOTA／LEXUS／1.88%：一律顯示欄位／值卡片
 */

(function (global) {
  "use strict";

  function isModelBasedProject(project) {
    return [
      "toyota_zero_interest",
      "lexus_zero_interest",
      "toyota_low_interest_188"
    ].includes(project?.type);
  }

  function isCompareProject(projectId) {
    return ["haoxiang", "lexiang", "legou"].includes(projectId);
  }

  function renderApp(root, data, projects) {
    root.innerHTML = `
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-title">分期方案試算平台</div>

          <nav class="sidebar-nav">
            <a href="index.html" class="active">專案試算</a>
            <a href="car-loan.html">車貸補貼息試算</a>
            <a href="admin.html">管理後台</a>
          </nav>
        </aside>

        <main class="main-content">
          <div class="wrap">
            <h1 class="title">${escapeHtml(data.appTitle || "分期方案試算平台")}</h1>
            <p class="subtitle">請選擇專案並輸入貸款金額。一般專案金額單位為「萬」。</p>

            <div class="card">
              <div class="grid">
                <div class="field">
                  <label for="projectSelect">選擇專案</label>
                  <select id="projectSelect">
                    ${projects.map(project => `
                      <option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>
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

    if (!box || !hint || !project) return;

    if (isModelBasedProject(project)) {
      renderModelBasedFields(box, hint, project);
      return;
    }

    renderStandardFields(box, hint, project, data);
  }

  function renderStandardFields(box, hint, project, data) {
    const min = project.minLoanWan || data.defaultLoanWanMin || 10;
    const max = project.maxLoanWan || data.defaultLoanWanMax || 500;
    const step = data.defaultLoanWanStep || 5;

    hint.textContent = "輸入貸款金額後，系統會列出該專案所有利率結果。";

    box.innerHTML = `
      <div class="field full-span">
        <label for="loanWan">貸款金額（萬）</label>
        <input
          id="loanWan"
          type="number"
          min="${min}"
          max="${max}"
          step="${step}"
          value="100"
        >
        <small>例如輸入 100 代表 1,000,000 元。此專案上限為 ${max} 萬。</small>
      </div>
    `;
  }

  function renderModelBasedFields(box, hint, project) {
    const modelLabel = project.modelSelectorLabel || "車型";
    const models = project.models || [];

    hint.textContent = `請選擇${modelLabel}，系統會自動帶出目前設定的適用專案。`;

    box.innerHTML = `
      <div class="dynamic-grid full-span">
        <div class="field full-span">
          <label for="modelSelect">${escapeHtml(modelLabel)}</label>
          <select id="modelSelect">
            ${models.map(model => `
              <option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}</option>
            `).join("")}
          </select>
          <small>後台可調整每個${escapeHtml(modelLabel)}對應的金額與期數。</small>
        </div>

        <div class="field full-span">
          <label>適用專案</label>
          <input id="modelProjectDisplay" type="text" disabled>
          <small>此欄位由${escapeHtml(modelLabel)}自動帶入。</small>
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

    syncModelInfo(project);
  }

  function syncModelInfo(project) {
    const modelSelect = document.getElementById("modelSelect");
    const projectDisplay = document.getElementById("modelProjectDisplay");

    if (!modelSelect || !projectDisplay) return;

    const model = (project.models || []).find(item => item.id === modelSelect.value);

    if (!model) {
      projectDisplay.value = "";
      return;
    }

    const amount = Number(model.subsidyAmount);
    const term = Number(model.subsidyTerm);

    projectDisplay.value =
      Number.isFinite(amount) && amount > 0 && Number.isFinite(term) && term > 0
        ? `${formatWanAmount(amount)}萬 / ${term}期`
        : "無適用專案";
  }

  function renderSummary(project, loanWan, term, modelId) {
    const summary = document.getElementById("summary");
    if (!summary || !project) return;

    const loanAmount = Math.round(Number(loanWan) * 10000);

    let html = `
      <div>專案：<strong>${escapeHtml(project.name)}</strong></div>
      <div>輸入金額：<strong>${formatWan(loanWan)} 萬</strong></div>
      <div>實際金額：<strong>${formatMoney(loanAmount)}</strong></div>
    `;

    if (isModelBasedProject(project)) {
      const modelLabel = project.modelSelectorLabel || "車型";
      const model = (project.models || []).find(item => item.id === modelId);
      const subsidyAmount = Number(model?.subsidyAmount);
      const subsidyTerm = Number(model?.subsidyTerm);

      html += `
        <div>${escapeHtml(modelLabel)}：<strong>${escapeHtml(model?.name || "")}</strong></div>
        <div>適用專案：<strong>${
          Number.isFinite(subsidyAmount) && subsidyAmount > 0 && Number.isFinite(subsidyTerm) && subsidyTerm > 0
            ? `${formatWanAmount(subsidyAmount)}萬 / ${subsidyTerm}期`
            : "無適用專案"
        }</strong></div>
        <div>客戶期數：<strong>${term}</strong> 期</div>
      `;
    }

    summary.innerHTML = html;
  }

  function renderResult(result) {
    if (!result || !Array.isArray(result.columns) || !Array.isArray(result.rows) || result.rows.length === 0) {
      renderEmpty("沒有可顯示的結果。");
      return;
    }

    if (isCompareProject(result.projectId) && result.rows.length > 1) {
      renderCompareResult(result);
      return;
    }

    renderResultCards(result);
  }

  function renderCompareResult(result) {
    const resultArea = document.getElementById("resultArea");
    if (!resultArea) return;

    resultArea.innerHTML = `
      <div class="compare-table-wrap">
        ${renderCompareTable(result)}
      </div>

      <div class="compare-card-list">
        ${renderCompareCardsHtml(result)}
      </div>
    `;
  }

  function renderCompareTable(result) {
    const rateColumn = result.columns.find(col => col.key === "customerRate");
    const compareColumns = result.columns.filter(col => col.key !== "customerRate");

    return `
      <table class="compare-table">
        <thead>
          <tr>
            <th>利率</th>
            ${result.rows.map(row => `
              <th>${formatCell(row.customerRate, rateColumn?.type || "ratePercent")}</th>
            `).join("")}
          </tr>
        </thead>

        <tbody>
          ${compareColumns.map(col => `
            <tr>
              <th>${escapeHtml(col.label)}</th>
              ${result.rows.map(row => `
                <td>${formatCell(row[col.key], col.type)}</td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderCompareCardsHtml(result) {
    const rateColumn = result.columns.find(col => col.key === "customerRate");
    const compareColumns = result.columns.filter(col => col.key !== "customerRate");

    return compareColumns.map(col => `
      <div class="mobile-compare-block">
        <div class="mobile-compare-title">${escapeHtml(col.label)}</div>

        ${result.rows.map(row => `
          <div class="mobile-compare-row">
            <div class="mobile-compare-rate">
              ${formatCell(row.customerRate, rateColumn?.type || "ratePercent")}
            </div>
            <div class="mobile-compare-value">
              ${formatCell(row[col.key], col.type)}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `).join("");
  }

  function renderResultCards(result) {
    const resultArea = document.getElementById("resultArea");
    if (!resultArea) return;

    resultArea.innerHTML = `
      <div class="result-card-list">
        ${result.rows.map(row => `
          <div class="result-card">
            ${result.columns.map(col => `
              <div class="result-card-row">
                <div class="result-card-label">${escapeHtml(col.label)}</div>
                <div class="result-card-value">${formatCell(row[col.key], col.type)}</div>
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderEmpty(message) {
    const resultArea = document.getElementById("resultArea");
    if (!resultArea) return;

    resultArea.innerHTML = `
      <div class="empty">${escapeHtml(message)}</div>
    `;
  }

  function showNotice(message) {
    const notice = document.getElementById("notice");
    if (!notice) return;

    notice.textContent = message;
    notice.style.display = "block";
  }

  function clearNotice() {
    const notice = document.getElementById("notice");
    if (!notice) return;

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

  function formatWanAmount(amount) {
    const wan = Number(amount) / 10000;
    if (!Number.isFinite(wan)) return "0";
    return Number.isInteger(wan) ? String(wan) : String(wan).replace(/\.0+$/, "");
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
    syncModelInfo
  };

})(typeof window !== "undefined" ? window : globalThis);