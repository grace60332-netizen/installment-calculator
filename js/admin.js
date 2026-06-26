/**
 * js/admin.js
 * 管理後台第一版
 * 功能：
 * - 讀取 Firestore appConfig/main
 * - 顯示專案
 * - 啟用 / 停用專案
 * - 儲存回 Firestore
 */

(function () {
  "use strict";

  const state = {
    data: null
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
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

    document.getElementById("adminApp").innerHTML = `
      <div class="wrap">
        <div class="admin-header">
          <div>
            <h1 class="title">管理後台</h1>
            <p class="subtitle">
              目前資料來源為 Firestore appConfig/main。修改後按「儲存設定」，前台重新整理後就會生效。
            </p>
          </div>

          <div class="admin-actions">
            <a class="ghost-link" href="index.html">回前台</a>
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
          <h2 class="section-title">目前 JSON 預覽</h2>
          <pre id="jsonPreview" class="json-preview"></pre>
        </div>
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

  function bindEvents() {
    document.querySelectorAll(".project-enabled").forEach(input => {
      input.addEventListener("change", handleEnabledChange);
    });

    document.getElementById("saveBtn").addEventListener("click", save);
  }

  function handleEnabledChange(event) {
    const index = Number(event.target.dataset.index);
    const checked = event.target.checked;

    state.data.projects[index].enabled = checked;

    updateJsonPreview();
  }

  async function save() {
    const btn = document.getElementById("saveBtn");

    try {
      btn.disabled = true;
      btn.textContent = "儲存中...";

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

})();