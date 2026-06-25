const appRoot = document.getElementById("app");

const state = {
  data: null,
  selectedProjectId: null,
  selectedToyotaPlanId: null,
  elements: {}
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const response = await fetch("data/projects.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`無法讀取 data/projects.json，HTTP ${response.status}`);
    }

    state.data = await response.json();

    renderShell();
    cacheElements();
    populateProjectSelect();

    bindStaticEvents();
    handleProjectChange();

  } catch (error) {
    console.error(error);
    appRoot.innerHTML = `
      <div class="wrap">
        <div class="card error-card">
          <h1 class="title">載入失敗</h1>
          <p>請確認 <strong>data/projects.json</strong>、<strong>index.html</strong>、<strong>app.js</strong> 是否都已正確存檔，然後重新整理頁面。</p>
          <p>${escapeHtml(String(error.message || error))}</p>
        </div>
      </div>
    `;
  }
}

function renderShell() {
  const title = state.data?.appTitle || "分期試算工具";

  appRoot.innerHTML = `
    <div class="wrap">
      <h1 class="title">${escapeHtml(title)}</h1>
      <p class="subtitle">
        先選擇專案，再輸入金額。<br />
        一般專案請輸入「萬」為單位；TOYOTA 零利率專案則會再多一個「適用專案」與「期數」欄位。
      </p>

      <div class="card">
        <div class="grid">
          <div class="field">
            <label for="projectSelect">選擇專案</label>
            <select id="projectSelect"></select>
            <small id="projectHint"></small>
          </div>

          <div id="projectFields" class="full-span"></div>
        </div>

        <div class="actions">
          <button id="calcBtn" type="button">立即試算</button>
          <button id="resetBtn" type="button" class="ghost">重設</button>
        </div>

        <div class="meta" id="summary"></div>
        <div class="notice" id="notice"></div>
      </div>

      <div class="card">
        <div class="table-wrap" id="resultArea">
          <div class="empty">請先選擇專案並輸入金額。</div>
        </div>
      </div>
    </div>
  `;
}

function cacheElements() {
  state.elements = {
    projectSelect: document.getElementById("projectSelect"),
    projectFields: document.getElementById("projectFields"),
    projectHint: document.getElementById("projectHint"),
    calcBtn: document.getElementById("calcBtn"),
    resetBtn: document.getElementById("resetBtn"),
    summary: document.getElementById("summary"),
    notice: document.getElementById("notice"),
    resultArea: document.getElementById("resultArea")
  };
}

function bindStaticEvents() {
  state.elements.projectSelect.addEventListener("change", handleProjectChange);
  state.elements.calcBtn.addEventListener("click", calculateAndRender);
  state.elements.resetBtn.addEventListener("click", resetForm);
}

function populateProjectSelect() {
  const projects = getEnabledProjects();
  state.elements.projectSelect.innerHTML = projects
    .map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`)
    .join("");

  state.selectedProjectId = projects[0]?.id || null;
  if (state.selectedProjectId) {
    state.elements.projectSelect.value = state.selectedProjectId;
  }
}

function getEnabledProjects() {
  return (state.data?.projects || []).filter(project => project.enabled !== false);
}

function getSelectedProject() {
  return getEnabledProjects().find(project => project.id === state.elements.projectSelect.value) || null;
}

function handleProjectChange() {
  state.selectedProjectId = state.elements.projectSelect.value;
  renderProjectFields();
  calculateAndRender();
}

function renderProjectFields() {
  const project = getSelectedProject();
  if (!project) {
    state.elements.projectFields.innerHTML = "";
    state.elements.projectHint.textContent = "";
    return;
  }

  state.elements.projectHint.textContent =
    project.type === "toyota_zero_interest"
      ? "請先選擇 TOYOTA 適用專案，再輸入客戶實際貸款金額與期數。"
      : "輸入貸款金額後，系統會自動列出該專案所有利率的試算結果。";

  if (project.type === "toyota_zero_interest") {
    const plans = project.plans || [];
    if (!state.selectedToyotaPlanId || !plans.some(plan => plan.id === state.selectedToyotaPlanId)) {
      state.selectedToyotaPlanId = plans[0]?.id || null;
    }

    state.elements.projectFields.innerHTML = `
      <div class="dynamic-grid full-span">
        <div class="field full-span">
          <label for="toyotaPlanSelect">${escapeHtml(project.planSelectorLabel || "適用專案")}</label>
          <select id="toyotaPlanSelect">
            ${plans.map(plan => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`).join("")}
          </select>
          <small id="toyotaPlanMeta"></small>
        </div>

        <div class="field">
          <label for="loanWan">${escapeHtml(project.loanInputLabel || "貸款金額")}（萬）</label>
          <input id="loanWan" type="number" min="10" max="100" step="0.1" value="10" placeholder="例如 63.5 = 63.5萬" />
          <small>可輸入 10～100，允許小數，例如 63.5。</small>
        </div>

        <div class="field">
          <label for="loanTerm">${escapeHtml(project.termInputLabel || "期數")}</label>
          <input id="loanTerm" type="number" min="1" max="60" step="1" value="30" placeholder="例如 30" />
          <small>請輸入客戶實際期數，1～60 之間。</small>
        </div>
      </div>
    `;

    const toyotaPlanSelect = document.getElementById("toyotaPlanSelect");
    const loanWanInput = document.getElementById("loanWan");
    const loanTermInput = document.getElementById("loanTerm");

    toyotaPlanSelect.value = state.selectedToyotaPlanId;
    loanWanInput.value = 10;
    loanTermInput.value = 30;

    toyotaPlanSelect.addEventListener("change", () => {
      state.selectedToyotaPlanId = toyotaPlanSelect.value;
      updateToyotaPlanMeta();
      calculateAndRender();
    });

    loanWanInput.addEventListener("input", calculateAndRender);
    loanTermInput.addEventListener("input", calculateAndRender);

    updateToyotaPlanMeta();
    return;
  }

  state.elements.projectFields.innerHTML = `
    <div class="field full-span">
      <label for="loanWan">貸款金額（萬）</label>
      <input id="loanWan" type="number" min="${state.data?.defaultLoanWanMin ?? 100}" max="${state.data?.defaultLoanWanMax ?? 500}" step="${state.data?.defaultLoanWanStep ?? 5}" value="100" placeholder="例如 100 = 100萬" />
      <small>可輸入 ${state.data?.defaultLoanWanMin ?? 100}～${state.data?.defaultLoanWanMax ?? 500}，系統會自動換算成元後計算。</small>
    </div>
  `;

  const loanWanInput = document.getElementById("loanWan");
  loanWanInput.addEventListener("input", calculateAndRender);
}

function updateToyotaPlanMeta() {
  const project = getSelectedProject();
  if (!project || project.type !== "toyota_zero_interest") return;

  const plan = getSelectedToyotaPlan(project);
  const metaEl = document.getElementById("toyotaPlanMeta");
  if (!plan || !metaEl) return;

  const metrics = getToyotaPlanMetrics(plan);
  metaEl.innerHTML = `
    基準方案：<strong>${escapeHtml(plan.name)}</strong>，
    基準金額：<strong>${formatWan(plan.subsidyAmount / 10000)} 萬</strong>，
    基準期數：<strong>${plan.subsidyTerm}</strong> 期，
    基準利率：<strong>${formatRatePercent(metrics.nominalRate)}</strong>，
    系統IRR：<strong>${formatRateDecimal(metrics.systemIrr)}</strong>，
    DLR補貼上限：<strong>${formatCurrency(metrics.dlrCap)}</strong>，
    和泰補貼上限：<strong>${formatCurrency(metrics.htCap)}</strong>
  `;
}

function getSelectedToyotaPlan(project) {
  if (!project || project.type !== "toyota_zero_interest") return null;
  const plans = project.plans || [];
  const selectedId = document.getElementById("toyotaPlanSelect")?.value || state.selectedToyotaPlanId;
  return plans.find(plan => plan.id === selectedId) || plans[0] || null;
}

function calculateAndRender() {
  const project = getSelectedProject();
  if (!project) return;

  clearNotice();

  if (project.type === "toyota_zero_interest") {
    calculateToyotaProject(project);
    return;
  }

  calculateStandardProject(project);
}

function calculateStandardProject(project) {
  const loanWanInput = document.getElementById("loanWan");
  const loanWan = Number(loanWanInput?.value);

  if (!isFinite(loanWan)) {
    showNotice("請輸入數字。");
    renderEmpty("請輸入數字後再試算。");
    return;
  }

  const minWan = state.data?.defaultLoanWanMin ?? 100;
  const maxWan = state.data?.defaultLoanWanMax ?? 500;

  if (loanWan < minWan || loanWan > maxWan) {
    showNotice(`貸款金額請輸入 ${minWan}～${maxWan}（萬元）之間。`);
    renderEmpty(`貸款金額請輸入 ${minWan}～${maxWan}（萬元）之間。`);
    return;
  }

  const loan = Math.round(loanWan * 10000);
  const rows = buildStandardRows(project, loan);

  state.elements.summary.innerHTML = `
    <div>專案：<strong>${escapeHtml(project.name)}</strong></div>
    <div>輸入金額：<strong>${formatWan(loanWan)} 萬</strong></div>
    <div>實際貸款金額：<strong>${formatCurrency(loan)}</strong></div>
  `;

  renderTable(project.summaryColumns || [], rows);
}

function buildStandardRows(project, loan) {
  const rows = [];
  const rateList = project.customerRates || [];

  if (project.id === "zhonggu") {
    const base1 = basePayment1to12Zhonggu(loan);
    const base2 = loan / 100 + 888;
    const tail = loan * 0.5;

    for (const rate of rateList) {
      const r = rate / 100 / 12;
      const balance12 = remainBalance(loan, r, 12, base1);
      const balance24 = remainBalance(balance12, r, 12, base2);
      const payment25to59 = roundUp(PMT(r, 35, -balance24, tail / (1 + r)), -1);
      const commission = getZhongguCommission(loan, rate);

      rows.push([
        formatRatePercent(rate),
        formatCurrency(loan),
        formatCurrency(base1),
        formatCurrency(base2),
        formatCurrency(payment25to59),
        formatCurrency(tail),
        formatCurrency(commission)
      ]);
    }

    return rows;
  }

  const base1 = basePayment1to12Standard(loan);
  const base2 = loan / 100 + 888;
  const tail = loan * 0.5;

  for (const rate of rateList) {
    const r = rate / 100 / 12;
    const balance12 = remainBalance(loan, r, 12, base1);

    if (project.id === "haoxiang") {
      const balance24 = remainBalance(balance12, r, 12, base2);
      const payment25to59 = roundUp(PMT(r, 35, -balance24, tail / (1 + r)), 0);
      const commission = getSharedCommission(loan, rate);

      rows.push([
        formatCurrency(loan),
        "60",
        formatCurrency(base1),
        formatCurrency(base2),
        formatCurrency(payment25to59),
        formatCurrency(tail),
        formatCurrency(commission),
        formatRatePercent(rate)
      ]);
      continue;
    }

    if (project.id === "lexiang") {
      const balance59 = remainBalance(balance12, r, 47, base2);
      const payment60 = roundUp(balance59 * (1 + r), 0);
      const commission = getSharedCommission(loan, rate);

      rows.push([
        formatCurrency(loan),
        "60",
        formatCurrency(base1),
        formatCurrency(base2),
        formatCurrency(payment60),
        formatCurrency(commission),
        formatRatePercent(rate)
      ]);
      continue;
    }

    if (project.id === "legou") {
      const balance59 = remainBalance(loan, r, 59, loan / 100);
      const payment60 = roundUp(balance59 * (1 + r), 0);
      const commission = getSharedCommission(loan, rate);

      rows.push([
        formatCurrency(loan),
        "60",
        formatCurrency(loan / 100),
        formatCurrency(payment60),
        formatCurrency(commission),
        formatRatePercent(rate)
      ]);
      continue;
    }
  }

  return rows;
}

function calculateToyotaProject(project) {
  const plan = getSelectedToyotaPlan(project);
  if (!plan) {
    showNotice("請先選擇 TOYOTA 適用專案。");
    renderEmpty("請先選擇 TOYOTA 適用專案。");
    return;
  }

  const loanWan = Number(document.getElementById("loanWan")?.value);
  const term = Number(document.getElementById("loanTerm")?.value);

  if (!isFinite(loanWan)) {
    showNotice("請輸入數字。");
    renderEmpty("請輸入數字後再試算。");
    return;
  }

  if (!isFinite(term)) {
    showNotice("請輸入期數。");
    renderEmpty("請輸入期數後再試算。");
    return;
  }

  if (loanWan < 10 || loanWan > 100) {
    showNotice("TOYOTA 零利率專案的金額請輸入 10～100（萬元）之間。");
    renderEmpty("TOYOTA 零利率專案的金額請輸入 10～100（萬元）之間。");
    return;
  }

  if (term < 1 || term > 60) {
    showNotice("TOYOTA 零利率專案的期數請輸入 1～60 之間。");
    renderEmpty("TOYOTA 零利率專案的期數請輸入 1～60 之間。");
    return;
  }

  const loan = Math.round(loanWan * 10000);
  const planMetrics = getToyotaPlanMetrics(plan);
  const result = calculateToyotaResult(loan, term, planMetrics);

  state.elements.summary.innerHTML = `
    <div>專案：<strong>${escapeHtml(project.name)}</strong></div>
    <div>適用專案：<strong>${escapeHtml(plan.name)}</strong></div>
    <div>輸入金額：<strong>${formatWan(loanWan)} 萬</strong></div>
    <div>期數：<strong>${term}</strong> 期</div>
    <div>基準系統IRR：<strong>${formatRateDecimal(planMetrics.systemIrr)}</strong></div>
  `;

  renderTable(project.summaryColumns || [], [[
    formatCurrency(result.loan),
    formatCurrency(result.monthlyPayment),
    formatCurrency(result.dlrBurden),
    formatCurrency(result.maxMonthlyPayment),
    formatRateDecimal(result.customerRate),
    formatCurrency(result.minDlrSubsidy)
  ]]);
}

function getToyotaPlanMetrics(plan) {
  const nominalRate = getToyotaNominalRate(plan.subsidyAmount, plan.subsidyTerm);
  const monthly = plan.subsidyAmount / plan.subsidyTerm;

  const totalSubsidy = roundUp(
    (PMT(nominalRate / 12, plan.subsidyTerm, -plan.subsidyAmount) - monthly) * plan.subsidyTerm,
    -2
  );

  const dlrCap = roundUp(totalSubsidy * 0.6, -2);
  const htCap = roundUp(totalSubsidy * 0.4, -2);
  const systemIrr = solveAnnualRate(plan.subsidyTerm, monthly, plan.subsidyAmount - totalSubsidy);

  return {
    nominalRate,
    monthly,
    totalSubsidy,
    dlrCap,
    htCap,
    systemIrr
  };
}

function calculateToyotaResult(loan, term, planMetrics) {
  const monthlyPayment = loan / term;

  const totalSubsidy = roundUp(
    loan - PV(planMetrics.systemIrr / 12, term, -monthlyPayment),
    -2
  );

  const htSubsidy = Math.min(roundUp(totalSubsidy * 0.4, -2), planMetrics.htCap);
  const dlrBurden = totalSubsidy - htSubsidy;
  const minDlrSubsidy = Math.min(dlrBurden, planMetrics.dlrCap);

  const rateForMaxMonthly = solveAnnualRate(term, monthlyPayment, loan - dlrBurden);
  const maxMonthlyPayment =
    dlrBurden <= planMetrics.dlrCap
      ? monthlyPayment
      : PMT(rateForMaxMonthly / 12, term, -(loan - minDlrSubsidy));

  const customerRate = solveAnnualRate(term, maxMonthlyPayment, loan);

  return {
    loan,
    monthlyPayment,
    dlrBurden,
    maxMonthlyPayment,
    customerRate,
    minDlrSubsidy
  };
}

function getToyotaNominalRate(loan, term) {
  if (term < 30) return 0.045;
  if (term >= 40 && loan >= 1000000) return 0.0395;
  if (term >= 30 && term < 40) return 0.0425;
  return 0.0425;
}

function solveAnnualRate(nper, payment, pv, fv = 0, type = 0) {
  if (!isFinite(nper) || !isFinite(payment) || !isFinite(pv)) return 0;
  if (payment === 0) return 0;

  const target = payment;
  const f = (monthlyRate) => PMT(monthlyRate, nper, -pv, fv, type) - target;

  let low = 0;
  let high = 0.05;
  let fLow = f(low);
  let fHigh = f(high);

  let attempts = 0;
  while (fLow * fHigh > 0 && attempts < 30) {
    high *= 2;
    fHigh = f(high);
    attempts += 1;
  }

  if (fLow * fHigh > 0) {
    return 0;
  }

  let mid = low;
  for (let i = 0; i < 120; i++) {
    mid = (low + high) / 2;
    const fMid = f(mid);

    if (Math.abs(fMid) < 1e-12) {
      return mid * 12;
    }

    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return mid * 12;
}

function basePayment1to12Standard(loan) {
  if (loan < 1000000 || loan > 5000000) return null;

  if (loan >= 5000000) return 31888;
  if (loan >= 4500000) return 28888;
  if (loan >= 4000000) return 25888;
  if (loan >= 3500000) return 22888;
  if (loan >= 3000000) return 19888;
  if (loan >= 2500000) return 16888;
  if (loan >= 2000000) return 14888;
  if (loan >= 1500000) return 12888;
  return 8888;
}

function basePayment1to12Zhonggu(loan) {
  if (loan < 1000000 || loan > 5000000) return null;

  if (loan >= 4600000) return 36888;
  if (loan >= 4100000) return 32888;
  if (loan >= 3600000) return 28888;
  if (loan >= 3100000) return 24888;
  if (loan >= 2600000) return 20888;
  if (loan >= 2100000) return 16888;
  if (loan >= 1600000) return 12888;
  return 8888;
}

function getSharedCommission(loan, rate) {
  if (rate === 3.99) {
    return loan >= 1500000 ? 10000 : 8000;
  }
  if (rate === 4.25) {
    return 15000;
  }
  return 0;
}

function getZhongguCommission(loan, rate) {
  if (loan < 1000000 || rate < 4.5) return 0;
  if (rate >= 4.75) return 15000;
  if (loan >= 1500000 && rate >= 4.5) return 10000;
  return 8000;
}

function renderTable(headers, rows) {
  if (!headers.length || !rows.length) {
    renderEmpty("目前沒有可顯示的結果。");
    return;
  }

  state.elements.resultArea.innerHTML = `
    <table>
      <thead>
        <tr>
          ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map(cell => `<td>${cell}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderEmpty(message) {
  state.elements.resultArea.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

function resetForm() {
  const project = getSelectedProject();
  if (!project) return;

  if (project.type === "toyota_zero_interest") {
    const loanWanInput = document.getElementById("loanWan");
    const loanTermInput = document.getElementById("loanTerm");
    const toyotaPlanSelect = document.getElementById("toyotaPlanSelect");

    if (toyotaPlanSelect) {
      toyotaPlanSelect.value = state.selectedToyotaPlanId || toyotaPlanSelect.options[0]?.value || "";
      state.selectedToyotaPlanId = toyotaPlanSelect.value;
    }
    if (loanWanInput) loanWanInput.value = 10;
    if (loanTermInput) loanTermInput.value = 30;

    updateToyotaPlanMeta();
    calculateAndRender();
    return;
  }

  const loanWanInput = document.getElementById("loanWan");
  if (loanWanInput) loanWanInput.value = 100;
  calculateAndRender();
}

function showNotice(message) {
  state.elements.notice.textContent = message;
  state.elements.notice.style.display = "block";
}

function clearNotice() {
  state.elements.notice.textContent = "";
  state.elements.notice.style.display = "none";
}

function formatCurrency(value) {
  if (!isFinite(value)) return "—";
  return "$" + Math.round(value).toLocaleString("zh-TW");
}

function formatWan(value) {
  if (!isFinite(value)) return "—";
  return Number(value).toLocaleString("zh-TW", { maximumFractionDigits: 1 });
}

function formatRatePercent(ratePercent) {
  if (!isFinite(ratePercent)) return "—";
  return Number(ratePercent).toFixed(2) + "%";
}

function formatRateDecimal(rateDecimal) {
  if (!isFinite(rateDecimal)) return "—";
  return (Number(rateDecimal) * 100).toFixed(5) + "%";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
