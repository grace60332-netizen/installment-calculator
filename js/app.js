/**
 * js/app.js
 * 前台控制器
 */

(function () {
  "use strict";

  const DATA_PATH = "data/projects.json";

  const state = {
    data: null,
    projects: [],
    currentProject: null
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      const res = await fetch(DATA_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`讀取 ${DATA_PATH} 失敗`);

      state.data = await res.json();
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
    const toyotaPlan = document.getElementById("toyotaPlan");

    if (loanWan) loanWan.addEventListener("input", calculate);
    if (loanTerm) loanTerm.addEventListener("input", calculate);
    if (toyotaPlan) toyotaPlan.addEventListener("change", calculate);
  }

  function calculate() {
    UI.clearNotice();

    try {
      const project = state.currentProject;
      if (!project) return;

      const loanWan = Number(document.getElementById("loanWan")?.value);
      const term = Number(document.getElementById("loanTerm")?.value);
      const planId = document.getElementById("toyotaPlan")?.value || null;

      if (!Number.isFinite(loanWan)) {
        UI.renderEmpty("請輸入貸款金額。");
        return;
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

      if (project.type === "toyota_zero_interest") {
        if (!Number.isFinite(term) || term <= 0) {
          UI.renderEmpty("請輸入期數。");
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

    document.getElementById("loanWan").value = 100;

    if (project.type === "toyota_zero_interest") {
      const term = document.getElementById("loanTerm");
      const plan = document.getElementById("toyotaPlan");

      if (term) term.value = 30;
      if (plan) plan.selectedIndex = 0;
    }

    calculate();
  }

})();