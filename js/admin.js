/**
 * js/admin.js
 * 管理後台第三版
 * 功能：
 * - Email/Password 登入
 * - 檢查 Firestore admin/{uid}
 * - 啟用 / 停用專案
 * - 管理 TOYOTA 零利率子專案
 * - 儲存回 Firestore
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
    if (!window.FirebaseApp || !FirebaseApp.auth || !FirebaseApp.db) {
      renderError("Firebase 尚未正確初始化，請確認 firebase.js 與 Firebase SDK 載入順序。");
      return;
    }

    renderLoading("確認登入狀態中...");

    FirebaseApp.auth.onAuthStateChanged(async user => {
      try {
        if (!user) {
          state.user = null;
          state.adminProfile = null;
          renderLogin();
          return;
        }

        state.user = user;

        const adminDoc = await FirebaseApp.db
          .collection("admin")
          .doc(user.uid)
          .get();

        if (!adminDoc.exists || adminDoc.data().enabled !== true) {
          renderNoPermission(user.email);
          return;
        }

        state.adminProfile = adminDoc.data();
        state.data = await StorageService.loadProjectData();

        renderAdmin();

      } catch (err) {
        renderError(err.message);
        console.error(err);
      }
    });
  }

  function renderLoading(message = "資料載入中...") {
    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <h1 class="title">管理後台</h1>
        <div class="card">
          <div class="empty">${escapeHtml(message)}</div>
        </div>
      </div>
    `;
  }

  function renderLogin() {
    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <div class="login-card card">
          <h1 class="title">管理後台登入</h1>
          <p class="subtitle">請使用已授權的管理員帳號登入。</p>

          <div id="notice" class="notice"></div>

          <div class="field">
            <label for="loginEmail">Email</label>
            <input id="loginEmail" type="email" autocomplete="username" placeholder="請輸入管理員 Email">
          </div>

          <div class="field">
            <label for="loginPassword">密碼</label>
            <input id="loginPassword" type="password" autocomplete="current-password" placeholder="請輸入密碼">
          </div>

          <div class="actions">
            <button id="loginBtn" type="button">登入</button>
            <a class="ghost-link" href="index.html">回前台</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById("loginBtn").addEventListener("click", login);

    document.getElementById("loginPassword").addEventListener("keydown", event => {
      if (event.key === "Enter") login();
    });
  }

  async function login() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showNotice("請輸入 Email 與密碼。");
      return;
    }

    const btn = document.getElementById("loginBtn");

    try {
      btn.disabled = true;
      btn.textContent = "登入中...";

      await FirebaseApp.auth.signInWithEmailAndPassword(email, password);

    } catch (err) {
      showNotice("登入失敗：" + getAuthErrorMessage(err));
      console.error(err);

    } finally {
      btn.disabled = false;
      btn.textContent = "登入";
    }
  }

  async function logout() {
    await FirebaseApp.auth.signOut();
  }

  function renderNoPermission(email) {
    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <div class="card error-card">
          <h1 class="title">沒有後台權限</h1>
          <p>目前登入帳號：<strong>${escapeHtml(email || "")}</strong></p>
          <p>此帳號尚未被加入 Firestore 的 <strong>admin</strong> 權限名單，或已被停用。</p>

          <div class="actions">
            <button id="logoutBtn" type="button">登出</button>
            <a class="ghost-link" href="index.html">回前台</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById("logoutBtn").addEventListener("click", logout);
  }

  function renderAdmin() {
    const projects = state.data.projects || [];
    const adminName = state.adminProfile?.name || state.user?.email || "管理員";

    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <div class="admin-header">
          <div>
            <h1 class="title">管理後台</h1>
            <p class="subtitle">
              已登入：<strong>${escapeHtml(adminName)}</strong>。
              修改後按「儲存設定」，前台重新整理後會套用最新設定。
            </p>
          </div>

          <div class="admin-actions">
            <a class="ghost-link" href="index.html">回前台</a>
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
              <label for="newToyotaAmount">補貼金額</label>
              <input id="newToyotaAmount" type="number" placeholder="例如：1200000">
              <small>請輸入元，不是萬。</small>
            </div>

            <div class="field">
              <label for="newToyotaTerm">補貼期數</label>
              <input id="newToyotaTerm" type="number" placeholder="例如：36">
            </div>

            <div class="field add-button-field">
              <button id="addToyotaPlanBtn" type="button">新增 TOYOTA 子專案</button>
            </div>
          </div>

          <div class="toyota-plan-list">
            ${(getToyotaProject()?.plans || []).map((plan, index) => renderToyotaPlanRow(plan, index)).join("")}
          </div>
        </div>

        <div class="card">
          <h2 class="section-title">目前 JSON 預覽</h2>
          <pre id="jsonPreview" class="json-preview"></pre>
        </div>
      </div>
    `;

    bindAdminEvents();
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
          <input
            type="checkbox"
            class="project-enabled"
            data-index="${index}"
            ${checked}
          >
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
          <input
            type="text"
            class="toyota-plan-name"
            data-index="${index}"
            value="${escapeAttr(plan.name)}"
          >
        </div>

        <div class="field">
          <label>補貼金額</label>
          <input
            type="number"
            class="toyota-plan-amount"
            data-index="${index}"
            value="${Number(plan.subsidyAmount)}"
          >
        </div>

        <div class="field">
          <label>補貼期數</label>
          <input
            type="number"
            class="toyota-plan-term"
            data-index="${index}"
            value="${Number(plan.subsidyTerm)}"
          >
        </div>

        <div class="toyota-plan-actions">
          <button
            type="button"
            class="ghost delete-toyota-plan"
            data-index="${index}"
          >
            刪除
          </button>
        </div>
      </div>
    `;
  }

  function bindAdminEvents() {
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

    document.getElementById("addToyotaPlanBtn").addEventListener("click", addToyotaPlan);
    document.getElementById("saveBtn").addEventListener("click", save);
    document.getElementById("logoutBtn").addEventListener("click", logout);
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
      showNotice("請輸入正確的補貼金額。");
      return;
    }

    if (!Number.isFinite(term) || term <= 0) {
      showNotice("請輸入正確的補貼期數。");
      return;
    }

    const newPlan = {
      id: generateToyotaPlanId(name, amount, term),
      name,
      subsidyAmount: amount,
      subsidyTerm: term
    };

    toyotaProject.plans.push(newPlan);

    renderAdmin();
    showNotice("已新增 TOYOTA 子專案，記得按「儲存設定」。");
  }

  function deleteToyotaPlan(event) {
    const index = Number(event.target.dataset.index);
    const toyotaProject = getToyotaProject();

    if (!toyotaProject || !Array.isArray(toyotaProject.plans)) return;

    const plan = toyotaProject.plans[index];
    const ok = confirm(`確定要刪除「${plan.name}」嗎？`);
    if (!ok) return;

    toyotaProject.plans.splice(index, 1);

    renderAdmin();
    showNotice("已刪除 TOYOTA 子專案，記得按「儲存設定」。");
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

    if (!toyotaProject || !Array.isArray(toyotaProject.plans)) return;

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

  function getToyotaProject() {
    return (state.data?.projects || []).find(project => project.type === "toyota_zero_interest");
  }

  function generateToyotaPlanId(name, amount, term) {
    const amountWan = Number(amount) / 10000;
    const safeAmount = String(amountWan).replace(".", "_");
    const safeTerm = String(term);
    return `toyota_${safeAmount}wan_${safeTerm}`;
  }

  function updateJsonPreview() {
    const box = document.getElementById("jsonPreview");
    if (!box) return;
    box.textContent = JSON.stringify(state.data, null, 2);
  }

  function showNotice(message) {
    const notice = document.getElementById("notice");
    if (!notice) return;
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

  function getAuthErrorMessage(err) {
    const code = err?.code || "";

    if (code === "auth/invalid-email") return "Email 格式不正確。";
    if (code === "auth/user-not-found") return "找不到此帳號。";
    if (code === "auth/wrong-password") return "密碼錯誤。";
    if (code === "auth/invalid-credential") return "帳號或密碼錯誤。";
    if (code === "auth/too-many-requests") return "嘗試次數過多，請稍後再試。";

    return err?.message || "未知錯誤";
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