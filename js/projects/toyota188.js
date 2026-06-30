/**
 * js/projects/toyota188.js
 * TOYOTA 1.88%低利率專案公式
 * 結果只顯示：
 * - 月付款
 * - 客戶利率
 * - DLR補貼款
 */

(function (global) {
  "use strict";

  const Finance = global.Finance || global;

  const CUSTOMER_ANNUAL_RATE = 0.0188;
  const HOTAI_RATIO = 0.3;

  const PLAN_TABLE = {
    "300000_30": { systemIrr: 0.03778, hotaiCap: 2140, dlrCap: 5020, totalCap: 7160 },
    "400000_40": { systemIrr: 0.03912, hotaiCap: 4010, dlrCap: 9380, totalCap: 13390 },
    "500000_50": { systemIrr: 0.03898, hotaiCap: 6150, dlrCap: 14370, totalCap: 20520 },
    "600000_30": { systemIrr: 0.03778, hotaiCap: 4290, dlrCap: 10030, totalCap: 14320 },
    "700000_70": { systemIrr: 0.03897, hotaiCap: 11790, dlrCap: 27530, totalCap: 39320 },
    "1200000_36": { systemIrr: 0.04132, hotaiCap: 12070, dlrCap: 28170, totalCap: 40240 },
    "1500000_36": { systemIrr: 0.04210, hotaiCap: 15600, dlrCap: 36410, totalCap: 52010 }
  };

  function calculate(project, request) {
    const loan = toLoanAmount(request);
    const term = Number(request.term);
    const modelId = request.modelId;

    const model = (project.models || []).find(item => item.id === modelId);

    if (!model) throw new Error("請選擇車型。");
    if (!Number.isFinite(loan)) throw new Error("TOYOTA 1.88%：貸款金額格式錯誤。");
    if (!Number.isFinite(term) || term <= 0) throw new Error("TOYOTA 1.88%：期數格式錯誤。");

    const subsidyAmount = Number(model.subsidyAmount);
    const subsidyTerm = Number(model.subsidyTerm);

    if (!Number.isFinite(subsidyAmount) || subsidyAmount <= 0 || !Number.isFinite(subsidyTerm) || subsidyTerm <= 0) {
      throw new Error("此車型目前未設定 1.88% 低利率專案。");
    }

    const planMeta = calculatePlanMeta({
      subsidyAmount,
      subsidyTerm
    });

    const result = calculateResultByLoanAndTerm(loan, term, planMeta);

    return {
      projectId: project.id,
      projectName: project.name,
      selectedModel: model,
      planMeta,
      columns: [
        { key: "monthlyPayment", label: "月付款", type: "money" },
        { key: "customerRate", label: "客戶利率", type: "ratePercent3" },
        { key: "dlrSubsidy", label: "DLR補貼款", type: "money" }
      ],
      rows: [result]
    };
  }

  function calculatePlanMeta(plan) {
    const subsidyAmount = Number(plan.subsidyAmount);
    const subsidyTerm = Number(plan.subsidyTerm);
    const key = `${subsidyAmount}_${subsidyTerm}`;
    const matched = PLAN_TABLE[key];

    if (!matched) {
      throw new Error(`TOYOTA 1.88%：目前公式表尚未設定 ${subsidyAmount / 10000}萬/${subsidyTerm}期。`);
    }

    return {
      subsidyAmount,
      subsidyTerm,
      customerAnnualRate: CUSTOMER_ANNUAL_RATE,
      systemIrr: matched.systemIrr,
      hotaiCap: matched.hotaiCap,
      dlrCap: matched.dlrCap,
      totalCap: matched.totalCap
    };
  }

  function calculateResultByLoanAndTerm(loan, term, meta) {
    const monthlyPayment = Finance.ROUNDUP(
      Finance.PMT(
        CUSTOMER_ANNUAL_RATE / 12,
        term,
        -loan
      ),
      0
    );

    const totalSubsidy = Finance.ROUNDUP(
      -(
        Finance.PV(
          meta.systemIrr / 12,
          term,
          -monthlyPayment
        ) - loan
      ),
      -1
    );

    const hotaiSubsidy = Math.min(
      Finance.ROUNDDOWN(totalSubsidy * HOTAI_RATIO, -1),
      meta.hotaiCap
    );

    const dlrSubsidy = totalSubsidy - hotaiSubsidy;

    return {
      loanAmount: loan,
      monthlyPayment,
      customerRate: CUSTOMER_ANNUAL_RATE * 100,
      dlrSubsidy
    };
  }

  function toLoanAmount(request) {
    if (Number.isFinite(Number(request.loanAmount))) {
      return Math.round(Number(request.loanAmount));
    }

    if (Number.isFinite(Number(request.loanWan))) {
      return Math.round(Number(request.loanWan) * 10000);
    }

    return NaN;
  }

  global.Toyota188Project = {
    calculate,
    calculatePlanMeta
  };

})(typeof window !== "undefined" ? window : globalThis);