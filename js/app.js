/**
 * js/app.js
 * 前台控制器
 */

(function () {
  "use strict";

  const state = {
    data: null,
    projects: [],
    currentProject: null
  };

  function isModelBasedProject(project) {
    return [
      "toyota_zero_interest",
      "lexus_zero_interest",
      "toyota_low_interest_188"
    ].includes(project?.type);
  }

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      state.data = await StorageService.loadProjectData();
      state.projects = (state.data.projects || []).filter(p => p.enabled !== false);

      UI.renderApp(document.getElementById("app"), state.data, state.projects);
      bindEvents();
      handleProjectChange();

    } catch (err) {
      document.body.innerHTML = `
        <div class="wrap">
          <div class="card">
            <h1>載入失敗</h1>
            <p>${escapeHtml(err.message)}</p>
          </div>
        </div>
      `;
      console.error(err);
    }
  }

  function bindEvents() {
    document.getElementById("projectSelect").addEventListener("change", handleProjectChange);
    document.getElementById("calcBtn").addEventListener("click", calculate);
    document.getElementById("resetBtn").addEventListener("click", resetForm);
  }

  function handleProjectChange() {
    const projectId = document.getElementById("projectSelect").value;
    state.currentProject = state.projects.find(p => p.id === projectId);

    UI.renderDynamicFields(state.currentProject, state.data);
    bindDynamicEvents();
    calculate();
  }

  function bindDynamicEvents() {
    const loanWan = document.getElementById("loanWan");
    const loanTerm = document.getElementById("loanTerm");
    const modelSelect = document.getElementById("modelSelect");

    if (loanWan) {
      loanWan.addEventListener("input", calculate);
    }

    if (loanTerm) {
      loanTerm.addEventListener("input", calculate);
    }

    if (modelSelect) {
      modelSelect.addEventListener("change", () => {
        UI.syncModelInfo(state.currentProject);
        calculate();
      });
    }
  }

  function calculate() {
    UI.clearNotice();

    try {
      const project = state.currentProject;
      if (!project) return;

      const loanWan = Number(document.getElementById("loanWan")?.value);
      const term = Number(document.getElementById("loanTerm")?.value);
      let modelId = null;

      if (!Number.isFinite(loanWan)) {
        UI.renderEmpty("請輸入貸款金額。");
        return;
      }

      if (!isModelBasedProject(project)) {
        const max = project.maxLoanWan || state.data.defaultLoanWanMax || 500;


        if (loanWan > max) {
          UI.showNotice(`${project.name} 的貸款金額上限為 ${max} 萬。`);
          UI.renderEmpty(`${project.name} 的貸款金額上限為 ${max} 萬。`);
          return;
        }
      }

      if (isModelBasedProject(project)) {
        modelId = document.getElementById("modelSelect")?.value || null;
        const modelLabel = project.modelSelectorLabel || "車型";
        const model = (project.models || []).find(item => item.id === modelId);

        if (!model) {
          UI.renderEmpty(`請選擇${modelLabel}。`);
          return;
        }

        if (
          !Number.isFinite(Number(model.subsidyAmount)) ||
          Number(model.subsidyAmount) <= 0 ||
          !Number.isFinite(Number(model.subsidyTerm)) ||
          Number(model.subsidyTerm) <= 0
        ) {
          UI.showNotice(`此${modelLabel}目前未設定適用專案。`);
          UI.renderEmpty(`此${modelLabel}目前未設定適用專案。`);
          UI.renderSummary(project, loanWan, term, modelId);
          return;
        }

        if (!Number.isFinite(term) || term <= 0) {
          UI.renderEmpty("請輸入客戶期數。");
          return;
        }

        const maxTerm = Number(project.maxTerm);

        if (Number.isFinite(maxTerm) && maxTerm > 0 && term > maxTerm) {
          UI.showNotice(`${project.name} 的客戶期數上限為 ${maxTerm} 期。`);
          UI.renderEmpty(`${project.name} 的客戶期數上限為 ${maxTerm} 期。`);
          return;
        }
      }

      const result = LoanEngine.calculate(project, {
        projectId: project.id,
        loanWan,
        term,
        modelId
      });

      UI.renderSummary(project, loanWan, term, modelId);
      UI.renderResult(result);

    } catch (err) {
      UI.showNotice(err.message);
      UI.renderEmpty("試算失敗，請檢查輸入資料或公式設定。");
      console.error(err);
    }
  }

  function resetForm() {
    const project = state.currentProject;
    if (!project) return;

    const loanWan = document.getElementById("loanWan");
    if (loanWan) loanWan.value = 100;

    if (isModelBasedProject(project)) {
      const term = document.getElementById("loanTerm");
      const modelSelect = document.getElementById("modelSelect");

      if (term) term.value = 30;
      if (modelSelect) modelSelect.selectedIndex = 0;

      UI.syncModelInfo(project);
    }

    calculate();
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