/**
 * js/admin.js
 * 管理後台：登入驗證 + 專案啟用停用 + TOYOTA子專案管理 + TOYOTA車型管理
 */

(function () {
  "use strict";

  const state = {
    data: null,
    user: null,
    adminProfile: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    renderCheckingAuth();

    AuthService.onAuthStateChanged(async (user) => {
      try {
        const checked = await AuthService.requireAdmin(user);

        if (!checked.ok) {
          if (user && checked.reason === "not_admin") {
            await AuthService.signOut();
            renderLogin("此帳號沒有後台權限。");
            return;
          }

          renderLogin();
          return;
        }

        state.user = checked.user;
        state.adminProfile = checked.profile;

        await loadAdminData();

      } catch (err) {
        console.error(err);
        renderLogin(err.message);
      }
    });
  }

  function renderCheckingAuth() {
    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <h1 class="title">管理後台</h1>
        <div class="card">
          <div class="empty">權限檢查中...</div>
        </div>
      </div>
    `;
  }

  function renderLogin(message = "") {
    document.getElementById("adminApp").innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <h1 class="title">管理後台登入</h1>
          <p class="subtitle">請使用部門管理員帳號登入。</p>

          ${message ? `<div class="notice login-notice">${escapeHtml(message)}</div>` : ""}

          <div class="field">
            <label for="loginEmail">Email</label>
            <input id="loginEmail" type="email" placeholder="例如：admin@department.com">
          </div>

          <div class="field">
            <label for="loginPassword">密碼</label>
            <input id="loginPassword" type="password" placeholder="請輸入密碼">
          </div>

          <div class="actions login-actions">
            <button id="loginBtn" type="button">登入</button>
            <a class="ghost-link" href="index.html">回前台</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById("loginBtn").addEventListener("click", handleLogin);

    document.getElementById("loginPassword").addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleLogin();
    });
  }

  async function handleLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      renderLogin("請輸入 Email 與密碼。");
      return;
    }

    try {
      await AuthService.signIn(email, password);
    } catch (err) {
      console.error(err);
      renderLogin("登入失敗，請確認帳號或密碼。");
    }
  }

  async function loadAdminData() {
    renderLoading();

    try {
      state.data = await StorageService.loadProjectData();
      renderAdmin();
    } catch (err) {
      renderError(err.message);
      console.error(err);
    }
  }

  function renderLoading() {
    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <h1 class="title">管理後台</h1>
        <div class="card">
          <div class="empty">資料載入中...</div>
        </div>
      </div>
    `;
  }

  function renderAdmin() {
    const projects = state.data.projects || [];
    const toyotaProject = getToyotaProject();
    const toyotaPlans = toyotaProject?.plans || [];
    const toyotaModels = toyotaProject?.models || [];

    document.getElementById("adminApp").innerHTML = `
      <div class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-title">分期試算工具</div>

          <nav class="sidebar-nav">
            <a href="index.html">專案試算</a>
            <a href="car-loan.html">車貸補貼息試算</a>
            <a href="admin.html" class="active">管理後台</a>
          </nav>
        </aside>

        <main class="main-content">
          <div class="wrap">
            <div class="admin-header">
              <div>
                <h1 class="title">管理後台</h1>
                <p class="subtitle">
                  已登入：<strong>${escapeHtml(state.adminProfile?.name || state.user?.email || "")}</strong><br>
                  修改後按「儲存設定」，前台重新整理後會套用最新設定。
                </p>
              </div>

              <div class="admin-actions">
                <button id="logoutBtn" type="button" class="ghost">登出</button>
                <button id="saveBtn" type="button">儲存設定</button>
              </div>
            </div>

            <div id="notice" class="notice"></div>

            <div class="card">
              <h2 class="section-title">專案啟用狀態</h2>
              <div class="admin-project-list">
                ${projects.map((project, index) => renderProjectRow(project, index)).join("")}
              </div>
            </div>

            <div class="card">
              <h2 class="section-title">TOYOTA 零利率子專案管理</h2>

              <div class="toyota-add-box">
                <div class="field">
                  <label for="newToyotaName">專案名稱</label>
                  <input id="newToyotaName" type="text" placeholder="例如：120萬36期">
                </div>

                <div class="field">
                  <label for="newToyotaAmount">金額</label>
                  <input id="newToyotaAmount" type="number" placeholder="例如：1200000">
                  <small>請輸入元，不是萬。</small>
                </div>

                <div class="field">
                  <label for="newToyotaTerm">期數</label>
                  <input id="newToyotaTerm" type="number" placeholder="例如：36">
                </div>

                <div class="field add-button-field">
                  <button id="addToyotaPlanBtn" type="button">新增 TOYOTA 子專案</button>
                </div>
              </div>

              <div class="toyota-plan-list">
                ${toyotaPlans.map((plan, index) => renderToyotaPlanRow(plan, index)).join("")}
              </div>
            </div>

            <div class="card">
              <h2 class="section-title">TOYOTA 車型管理</h2>
              <p class="subtitle">
                每個車型只能對應一個零利率專案。前台使用者選車型後，系統會自動帶入這裡設定的專案。
              </p>

              <div class="toyota-add-box">
                <div class="field">
                  <label for="newToyotaModelName">車型名稱</label>
                  <input id="newToyotaModelName" type="text" placeholder="例如：COROLLA CROSS 汽油">
                </div>

                <div class="field">
                  <label for="newToyotaModelPlan">對應專案</label>
                  <select id="newToyotaModelPlan">
                    <option value="">不適用</option>
                    ${toyotaPlans.map(plan => `
                      <option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>
                    `).join("")}
                  </select>
                </div>

                <div class="field add-button-field">
                  <button id="addToyotaModelBtn" type="button">新增車型</button>
                </div>
              </div>

              <div class="toyota-plan-list">
                ${toyotaModels.map((model, index) => renderToyotaModelRow(model, index, toyotaPlans)).join("")}
              </div>
            </div>

            <div class="card">
              <h2 class="section-title">目前 JSON 預覽</h2>
              <pre id="jsonPreview" class="json-preview"></pre>
            </div>
          </div>
        </main>
      </div>
    `;

    bindEvents();
    updateJsonPreview();
  }

  function renderProjectRow(project, index) {
    const checked = project.enabled !== false ? "checked" : "";
    const typeLabel = project.type === "toyota_zero_interest" ? "TOYOTA零利率" : "一般專案";

    return `
      <div class="admin-project-row">
        <div>
          <div class="admin-project-name">
            ${escapeHtml(project.name)}
            <span class="badge">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="admin-project-id">${escapeHtml(project.id)}</div>
        </div>

        <label class="switch-row">
          <input type="checkbox" class="project-enabled" data-index="${index}" ${checked}>
          <span>啟用</span>
        </label>
      </div>
    `;
  }

  function renderToyotaPlanRow(plan, index) {
    return `
      <div class="toyota-plan-row">
        <div class="field">
          <label>專案名稱</label>
          <input type="text" class="toyota-plan-name" data-index="${index}" value="${escapeAttr(plan.name)}">
        </div>

        <div class="field">
          <label>金額</label>
          <input type="number" class="toyota-plan-amount" data-index="${index}" value="${Number(plan.subsidyAmount)}">
        </div>

        <div class="field">
          <label>期數</label>
          <input type="number" class="toyota-plan-term" data-index="${index}" value="${Number(plan.subsidyTerm)}">
        </div>

        <div class="toyota-plan-actions">
          <button type="button" class="ghost delete-toyota-plan" data-index="${index}">
            刪除
          </button>
        </div>
      </div>
    `;
  }

  function renderToyotaModelRow(model, index, plans) {
    return `
      <div class="toyota-plan-row">
        <div class="field">
          <label>車型名稱</label>
          <input
            type="text"
            class="toyota-model-name"
            data-index="${index}"
            value="${escapeAttr(model.name)}"
          >
        </div>

        <div class="field">
          <label>對應專案</label>
          <select class="toyota-model-plan" data-index="${index}">
            <option value="">不適用</option>
            ${plans.map(plan => `
              <option value="${escapeHtml(plan.id)}" ${model.planId === plan.id ? "selected" : ""}>
                ${escapeHtml(plan.name)}
              </option>
            `).join("")}
          </select>
        </div>

        <label class="switch-row">
          <input
            type="checkbox"
            class="toyota-model-enabled"
            data-index="${index}"
            ${model.enabled !== false ? "checked" : ""}
          >
          <span>啟用</span>
        </label>

        <div class="toyota-plan-actions">
          <button type="button" class="ghost delete-toyota-model" data-index="${index}">
            刪除
          </button>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.querySelectorAll(".project-enabled").forEach(input => {
      input.addEventListener("change", handleEnabledChange);
    });

    document.querySelectorAll(".toyota-plan-name").forEach(input => {
      input.addEventListener("input", handleToyotaPlanChange);
    });

    document.querySelectorAll(".toyota-plan-amount").forEach(input => {
      input.addEventListener("input", handleToyotaPlanChange);
    });

    document.querySelectorAll(".toyota-plan-term").forEach(input => {
      input.addEventListener("input", handleToyotaPlanChange);
    });

    document.querySelectorAll(".delete-toyota-plan").forEach(button => {
      button.addEventListener("click", deleteToyotaPlan);
    });

    document.querySelectorAll(".toyota-model-name").forEach(input => {
      input.addEventListener("input", handleToyotaModelChange);
    });

    document.querySelectorAll(".toyota-model-plan").forEach(select => {
      select.addEventListener("change", handleToyotaModelChange);
    });

    document.querySelectorAll(".toyota-model-enabled").forEach(input => {
      input.addEventListener("change", handleToyotaModelChange);
    });

    document.querySelectorAll(".delete-toyota-model").forEach(button => {
      button.addEventListener("click", deleteToyotaModel);
    });

    document.getElementById("addToyotaPlanBtn")?.addEventListener("click", addToyotaPlan);
    document.getElementById("addToyotaModelBtn")?.addEventListener("click", addToyotaModel);
    document.getElementById("saveBtn")?.addEventListener("click", save);
    document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
  }

  async function handleLogout() {
    await AuthService.signOut();
    renderLogin("已登出。");
  }

  function handleEnabledChange(event) {
    const index = Number(event.target.dataset.index);
    state.data.projects[index].enabled = event.target.checked;
    updateJsonPreview();
  }

  function handleToyotaPlanChange(event) {
    const index = Number(event.target.dataset.index);
    const toyotaProject = getToyotaProject();
    if (!toyotaProject || !toyotaProject.plans[index]) return;

    const plan = toyotaProject.plans[index];

    if (event.target.classList.contains("toyota-plan-name")) {
      plan.name = event.target.value.trim();
    }

    if (event.target.classList.contains("toyota-plan-amount")) {
      plan.subsidyAmount = Number(event.target.value);
    }

    if (event.target.classList.contains("toyota-plan-term")) {
      plan.subsidyTerm = Number(event.target.value);
    }

    plan.id = generateToyotaPlanId(plan.name, plan.subsidyAmount, plan.subsidyTerm);

    updateJsonPreview();
  }

  function handleToyotaModelChange(event) {
    const index = Number(event.target.dataset.index);
    const toyotaProject = getToyotaProject();

    if (!toyotaProject || !toyotaProject.models[index]) return;

    const model = toyotaProject.models[index];

    if (event.target.classList.contains("toyota-model-name")) {
      model.name = event.target.value.trim();
      model.id = generateToyotaModelId(model.name);
    }

    if (event.target.classList.contains("toyota-model-plan")) {
      model.planId = event.target.value || null;
    }

    if (event.target.classList.contains("toyota-model-enabled")) {
      model.enabled = event.target.checked;
    }

    updateJsonPreview();
  }

  function addToyotaPlan() {
    const toyotaProject = getToyotaProject();

    if (!toyotaProject) {
      showNotice("找不到 TOYOTA 零利率專案。");
      return;
    }

    if (!Array.isArray(toyotaProject.plans)) {
      toyotaProject.plans = [];
    }

    const name = document.getElementById("newToyotaName").value.trim();
    const amount = Number(document.getElementById("newToyotaAmount").value);
    const term = Number(document.getElementById("newToyotaTerm").value);

    if (!name) {
      showNotice("請輸入 TOYOTA 子專案名稱。");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showNotice("請輸入正確的金額。");
      return;
    }

    if (!Number.isFinite(term) || term <= 0) {
      showNotice("請輸入正確的期數。");
      return;
    }

    toyotaProject.plans.push({
      id: generateToyotaPlanId(name, amount, term),
      name,
      subsidyAmount: amount,
      subsidyTerm: term
    });

    renderAdmin();
    showNotice("已新增 TOYOTA 子專案，記得按「儲存設定」。");
  }

  function addToyotaModel() {
    const toyotaProject = getToyotaProject();

    if (!toyotaProject) {
      showNotice("找不到 TOYOTA 零利率專案。");
      return;
    }

    if (!Array.isArray(toyotaProject.models)) {
      toyotaProject.models = [];
    }

    const name = document.getElementById("newToyotaModelName").value.trim();
    const planId = document.getElementById("newToyotaModelPlan").value || null;

    if (!name) {
      showNotice("請輸入車型名稱。");
      return;
    }

    toyotaProject.models.push({
      id: generateToyotaModelId(name),
      name,
      planId,
      enabled: true
    });

    renderAdmin();
    showNotice("已新增 TOYOTA 車型，記得按「儲存設定」。");
  }

  function deleteToyotaPlan(event) {
    const index = Number(event.target.dataset.index);
    const toyotaProject = getToyotaProject();

    if (!toyotaProject || !Array.isArray(toyotaProject.plans)) return;

    const plan = toyotaProject.plans[index];
    const ok = confirm(`確定要刪除「${plan.name}」嗎？`);

    if (!ok) return;

    toyotaProject.plans.splice(index, 1);

    if (Array.isArray(toyotaProject.models)) {
      toyotaProject.models = toyotaProject.models.map(model => {
        if (model.planId === plan.id) {
          return { ...model, planId: null };
        }
        return model;
      });
    }

    renderAdmin();
    showNotice("已刪除 TOYOTA 子專案，相關車型已改為不適用，記得按「儲存設定」。");
  }

  function deleteToyotaModel(event) {
    const index = Number(event.target.dataset.index);
    const toyotaProject = getToyotaProject();

    if (!toyotaProject || !Array.isArray(toyotaProject.models)) return;

    const model = toyotaProject.models[index];
    const ok = confirm(`確定要刪除「${model.name}」嗎？`);

    if (!ok) return;

    toyotaProject.models.splice(index, 1);

    renderAdmin();
    showNotice("已刪除 TOYOTA 車型，記得按「儲存設定」。");
  }

  async function save() {
    const btn = document.getElementById("saveBtn");

    try {
      btn.disabled = true;
      btn.textContent = "儲存中...";

      cleanDataBeforeSave();

      await StorageService.saveProjectData(state.data);

      showNotice("設定已儲存。前台重新整理後會套用最新設定。");

    } catch (err) {
      showNotice("儲存失敗：" + err.message);
      console.error(err);

    } finally {
      btn.disabled = false;
      btn.textContent = "儲存設定";
    }
  }

  function cleanDataBeforeSave() {
    const toyotaProject = getToyotaProject();

    if (!toyotaProject) return;

    if (Array.isArray(toyotaProject.plans)) {
      toyotaProject.plans = toyotaProject.plans
        .filter(plan =>
          plan.name &&
          Number.isFinite(Number(plan.subsidyAmount)) &&
          Number.isFinite(Number(plan.subsidyTerm))
        )
        .map(plan => ({
          id: generateToyotaPlanId(plan.name, Number(plan.subsidyAmount), Number(plan.subsidyTerm)),
          name: String(plan.name).trim(),
          subsidyAmount: Number(plan.subsidyAmount),
          subsidyTerm: Number(plan.subsidyTerm)
        }));
    }

    const validPlanIds = new Set((toyotaProject.plans || []).map(plan => plan.id));

    if (Array.isArray(toyotaProject.models)) {
      toyotaProject.models = toyotaProject.models
        .filter(model => model.name)
        .map(model => ({
          id: generateToyotaModelId(model.name),
          name: String(model.name).trim(),
          planId: model.planId && validPlanIds.has(model.planId) ? model.planId : null,
          enabled: model.enabled !== false
        }));
    }
  }

  function getToyotaProject() {
    return (state.data.projects || []).find(project => project.type === "toyota_zero_interest");
  }

  function generateToyotaPlanId(name, amount, term) {
    const amountWan = Number(amount) / 10000;
    const safeAmount = String(amountWan).replace(".", "_");
    const safeTerm = String(term);
    return `toyota_${safeAmount}wan_${safeTerm}`;
  }

  function generateToyotaModelId(name) {
    return String(name)
      .trim()
      .toLowerCase()
      .replaceAll(" ", "_")
      .replaceAll("/", "_")
      .replaceAll("-", "_")
      .replace(/[^\w\u4e00-\u9fa5]/g, "");
  }

  function updateJsonPreview() {
    const box = document.getElementById("jsonPreview");
    if (!box) return;
    box.textContent = JSON.stringify(state.data, null, 2);
  }

  function showNotice(message) {
    const notice = document.getElementById("notice");
    notice.textContent = message;
    notice.style.display = "block";
  }

  function renderError(message) {
    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <h1 class="title">管理後台</h1>
        <div class="card error-card">
          <h2>載入失敗</h2>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(text) {
    return escapeHtml(text);
  }

})();