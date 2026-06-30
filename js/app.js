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
            <p>${err.message}</p>
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
    const toyotaModel = document.getElementById("toyotaModel");

    if (loanWan) loanWan.addEventListener("input", calculate);
    if (loanTerm) loanTerm.addEventListener("input", calculate);

    if (toyotaModel) {
      toyotaModel.addEventListener("change", () => {
        UI.syncToyotaPlanFromModel(state.currentProject);
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
      let planId = document.getElementById("toyotaPlan")?.value || null;

      if (!Number.isFinite(loanWan)) {
        UI.renderEmpty("請輸入貸款金額。");
        return;
      }

      if (project.type === "toyota_zero_interest") {
        const modelId = document.getElementById("toyotaModel")?.value || null;
        const model = (project.models || []).find(item => item.id === modelId);

        if (!model) {
          UI.renderEmpty("請選擇車型。");
          return;
        }

        if (!model.planId) {
          UI.showNotice("此車型目前未設定適用零利率專案。");
          UI.renderEmpty("此車型目前未設定適用零利率專案。");
          return;
        }

        planId = model.planId;
        document.getElementById("toyotaPlan").value = planId;

        if (!Number.isFinite(term) || term <= 0) {
          UI.renderEmpty("請輸入期數。");
          return;
        }
      }

      if (project.type !== "toyota_zero_interest") {
        const min = state.data.defaultLoanWanMin || 100;
        const max = state.data.defaultLoanWanMax || 500;

        if (loanWan < min || loanWan > max) {
          UI.showNotice(`貸款金額請輸入 ${min}～${max} 萬。`);
          UI.renderEmpty(`貸款金額請輸入 ${min}～${max} 萬。`);
          return;
        }
      }

      const result = LoanEngine.calculate(project, {
        projectId: project.id,
        loanWan,
        term,
        planId
      });

      UI.renderSummary(project, loanWan, term, planId);
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

    if (project.type === "toyota_zero_interest") {
      const term = document.getElementById("loanTerm");
      const model = document.getElementById("toyotaModel");

      if (term) term.value = 30;
      if (model) model.selectedIndex = 0;

      UI.syncToyotaPlanFromModel(project);
    }

    calculate();
  }

})();