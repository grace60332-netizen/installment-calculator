/**
 * js/admin.js
 * 管理後台：登入驗證 + 專案啟用停用 + 車型/車款金額期數管理
 */

(function () {
  "use strict";

  const state = {
    data: null,
    user: null,
    adminProfile: null,
    editingProjectId: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function isModelBasedProject(project) {
    return [
      "toyota_zero_interest",
      "lexus_zero_interest",
      "toyota_low_interest_188"
    ].includes(project?.type);
  }

  function getModelBasedProjects() {
    return (state.data.projects || []).filter(project => isModelBasedProject(project));
  }

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
    document.getElementById("loginPassword").addEventListener("keydown", event => {
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

      getModelBasedProjects().forEach(project => {
        if (!Array.isArray(project.models)) project.models = [];
      });

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
    const editingProject = state.editingProjectId
      ? getProjectById(state.editingProjectId)
      : null;

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
                <h1 class="title">${editingProject ? escapeHtml(editingProject.name) + "設定" : "管理後台"}</h1>
                <p class="subtitle">
                  已登入：<strong>${escapeHtml(state.adminProfile?.name || state.user?.email || "")}</strong><br>
                  修改後按「儲存設定」，前台重新整理後會套用最新設定。
                </p>
              </div>

              <div class="admin-actions">
                ${editingProject ? `<button id="logoutBtn" type="button" class="ghost">登出</button>` : ""}
                <button id="backToListBtn" type="button" class="ghost">回專案列表</button>
                <button id="saveBtn" type="button">儲存設定</button>
              </div>
            </div>

            <div id="notice" class="notice"></div>

            ${
              editingProject
                ? renderModelBasedProjectEditor(editingProject)
                : renderProjectList()
            }

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

  function renderProjectList() {
    const projects = state.data.projects || [];

    return `
      <div class="card">
        <h2 class="section-title">專案啟用狀態</h2>
        <div class="admin-project-list">
          ${projects.map((project, index) => renderProjectRow(project, index)).join("")}
        </div>
      </div>
    `;
  }

  function renderProjectRow(project, index) {
    const checked = project.enabled !== false ? "checked" : "";
    const typeLabel = isModelBasedProject(project) ? "車型/車款專案" : "一般專案";

    return `
      <div class="admin-project-row">
        <div>
          <div class="admin-project-name">
            ${escapeHtml(project.name)}
            <span class="badge">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="admin-project-id">${escapeHtml(project.id)}</div>
        </div>

        <div class="admin-actions">
          <label class="switch-row">
            <input type="checkbox" class="project-enabled" data-index="${index}" ${checked}>
            <span>啟用</span>
          </label>

          ${
            isModelBasedProject(project)
              ? `<button type="button" class="ghost edit-project-btn" data-project-id="${escapeAttr(project.id)}">編輯設定</button>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderModelBasedProjectEditor(project) {
    const label = project.modelSelectorLabel || "車型";

    return `
      <div class="card">
        <h2 class="section-title">${escapeHtml(project.name)} 補助管理</h2>
        <p class="subtitle">
          請直接在每個${escapeHtml(label)}後方填寫金額與期數。若本月不適用，金額與期數填 0 即可。
        </p>

        <div class="toyota-model-add-box">
          <div class="field">
            <label>新增${escapeHtml(label)}名稱</label>
            <input
              type="text"
              class="zero-model-new-name"
              data-project-id="${escapeAttr(project.id)}"
              placeholder="例如：RX / NX / COROLLA SPORT"
            >
          </div>

          <div class="field">
            <label>金額</label>
            <input
              type="number"
              class="zero-model-new-amount"
              data-project-id="${escapeAttr(project.id)}"
              placeholder="例如：1000000"
            >
            <small>請輸入元，不是萬。不適用請填 0。</small>
          </div>

          <div class="field">
            <label>期數</label>
            <input
              type="number"
              class="zero-model-new-term"
              data-project-id="${escapeAttr(project.id)}"
              placeholder="例如：40"
            >
            <small>不適用請填 0。</small>
          </div>

          <div class="field add-button-field">
            <button
              type="button"
              class="add-zero-model-btn"
              data-project-id="${escapeAttr(project.id)}"
            >
              新增${escapeHtml(label)}
            </button>
          </div>
        </div>

        <div class="toyota-model-list">
          ${(project.models || []).map((model, index) => renderModelRow(project, model, index)).join("")}
        </div>
      </div>
    `;
  }

  function renderModelRow(project, model, index) {
    const amount = Number(model.subsidyAmount || 0);
    const term = Number(model.subsidyTerm || 0);
    const isActive = amount > 0 && term > 0;
    const projectName = isActive ? `${formatWanAmount(amount)}萬/${term}期` : "-";
    const label = project.modelSelectorLabel || "車型";

    return `
      <div class="toyota-model-row">
        <div class="field">
          <label>${escapeHtml(label)}</label>
          <input
            type="text"
            class="zero-model-name"
            data-project-id="${escapeAttr(project.id)}"
            data-index="${index}"
            value="${escapeAttr(model.name || "")}"
          >
        </div>

        <div class="field">
          <label>適用專案</label>
          <input
            type="text"
            class="zero-model-project"
            data-project-id="${escapeAttr(project.id)}"
            data-index="${index}"
            value="${escapeAttr(projectName)}"
            disabled
          >
        </div>

        <div class="field">
          <label>金額</label>
          <input
            type="number"
            class="zero-model-amount"
            data-project-id="${escapeAttr(project.id)}"
            data-index="${index}"
            value="${amount}"
          >
        </div>

        <div class="field">
          <label>期數</label>
          <input
            type="number"
            class="zero-model-term"
            data-project-id="${escapeAttr(project.id)}"
            data-index="${index}"
            value="${term}"
          >
        </div>

        <div class="toyota-model-status zero-model-status"
          data-project-id="${escapeAttr(project.id)}"
          data-index="${index}">
          ${
            isActive
              ? `<span class="status-pill active">啟用</span>`
              : `<span class="status-pill inactive">無適用專案</span>`
          }
        </div>

        <div class="toyota-model-actions">
          <button
            type="button"
            class="ghost delete-zero-model"
            data-project-id="${escapeAttr(project.id)}"
            data-index="${index}"
          >
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

    document.querySelectorAll(".edit-project-btn").forEach(button => {
      button.addEventListener("click", () => {
        state.editingProjectId = button.dataset.projectId;
        renderAdmin();
      });
    });

    document.querySelectorAll(".zero-model-name").forEach(input => {
      input.addEventListener("input", handleZeroModelChange);
    });

    document.querySelectorAll(".zero-model-amount").forEach(input => {
      input.addEventListener("input", handleZeroModelChange);
    });

    document.querySelectorAll(".zero-model-term").forEach(input => {
      input.addEventListener("input", handleZeroModelChange);
    });

    document.querySelectorAll(".delete-zero-model").forEach(button => {
      button.addEventListener("click", deleteZeroModel);
    });

    document.querySelectorAll(".add-zero-model-btn").forEach(button => {
      button.addEventListener("click", addZeroModel);
    });

    document.getElementById("backBtn")?.addEventListener("click", () => {
      state.editingProjectId = null;
      renderAdmin();
    });

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

  function handleZeroModelChange(event) {
    const projectId = event.target.dataset.projectId;
    const index = Number(event.target.dataset.index);
    const project = getProjectById(projectId);

    if (!project || !project.models?.[index]) return;

    const model = project.models[index];

    if (event.target.classList.contains("zero-model-name")) {
      model.name = event.target.value.trim();
      model.id = generateModelId(model.name);
    }

    if (event.target.classList.contains("zero-model-amount")) {
      model.subsidyAmount = Number(event.target.value);
    }

    if (event.target.classList.contains("zero-model-term")) {
      model.subsidyTerm = Number(event.target.value);
    }

    refreshZeroModelRow(projectId, index);
    updateJsonPreview();
  }

  function refreshZeroModelRow(projectId, index) {
    const project = getProjectById(projectId);
    const model = project?.models?.[index];
    if (!model) return;

    const amount = Number(model.subsidyAmount || 0);
    const term = Number(model.subsidyTerm || 0);
    const isActive = amount > 0 && term > 0;
    const projectName = isActive ? `${formatWanAmount(amount)}萬/${term}期` : "-";

    const projectInput = document.querySelector(`.zero-model-project[data-project-id="${cssEscape(projectId)}"][data-index="${index}"]`);
    const statusBox = document.querySelector(`.zero-model-status[data-project-id="${cssEscape(projectId)}"][data-index="${index}"]`);

    if (projectInput) projectInput.value = projectName;

    if (statusBox) {
      statusBox.innerHTML = isActive
        ? `<span class="status-pill active">啟用</span>`
        : `<span class="status-pill inactive">無適用專案</span>`;
    }
  }

  function addZeroModel(event) {
    const projectId = event.target.dataset.projectId;
    const project = getProjectById(projectId);

    if (!project) {
      showNotice("找不到專案。");
      return;
    }

    if (!Array.isArray(project.models)) {
      project.models = [];
    }

    const nameInput = document.querySelector(`.zero-model-new-name[data-project-id="${cssEscape(projectId)}"]`);
    const amountInput = document.querySelector(`.zero-model-new-amount[data-project-id="${cssEscape(projectId)}"]`);
    const termInput = document.querySelector(`.zero-model-new-term[data-project-id="${cssEscape(projectId)}"]`);

    const name = nameInput?.value.trim() || "";
    const amount = Number(amountInput?.value || 0);
    const term = Number(termInput?.value || 0);

    if (!name) {
      showNotice("請輸入名稱。");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      showNotice("請輸入正確的金額。");
      return;
    }

    if (!Number.isFinite(term) || term < 0) {
      showNotice("請輸入正確的期數。");
      return;
    }

    project.models.push({
      id: generateModelId(name),
      name,
      subsidyAmount: amount,
      subsidyTerm: term
    });

    renderAdmin();
    showNotice("已新增，記得按「儲存設定」。");
  }

  function deleteZeroModel(event) {
    const projectId = event.target.dataset.projectId;
    const index = Number(event.target.dataset.index);
    const project = getProjectById(projectId);

    if (!project || !Array.isArray(project.models)) return;

    const model = project.models[index];
    const ok = confirm(`確定要刪除「${model.name}」嗎？`);

    if (!ok) return;

    project.models.splice(index, 1);

    renderAdmin();
    showNotice("已刪除，記得按「儲存設定」。");
  }

  async function save() {
    const btn = document.getElementById("saveBtn");

    try {
      btn.disabled = true;
      btn.textContent = "儲存中...";

      cleanDataBeforeSave();

      await StorageService.saveProjectData(state.data);

      state.editingProjectId = null;
      renderAdmin();
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
    getModelBasedProjects().forEach(project => {
      delete project.plans;
      delete project.planSelectorLabel;

      if (Array.isArray(project.models)) {
        project.models = project.models
          .filter(model => model.name)
          .map(model => ({
            id: generateModelId(model.name),
            name: String(model.name).trim(),
            subsidyAmount: Number(model.subsidyAmount || 0),
            subsidyTerm: Number(model.subsidyTerm || 0)
          }));
      }
    });
  }

  function getProjectById(projectId) {
    return (state.data.projects || []).find(project => project.id === projectId);
  }

  function generateModelId(name) {
    return String(name)
      .trim()
      .toLowerCase()
      .replaceAll(" ", "_")
      .replaceAll("/", "_")
      .replaceAll("-", "_")
      .replace(/[^\w\u4e00-\u9fa5]/g, "");
  }

  function formatWanAmount(amount) {
    const wan = Number(amount) / 10000;
    if (!Number.isFinite(wan)) return "0";
    return Number.isInteger(wan) ? String(wan) : String(wan).replace(/\.0+$/, "");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/"/g, '\\"');
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