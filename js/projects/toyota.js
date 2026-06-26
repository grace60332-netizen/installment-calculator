/**
 * js/projects/toyota.js
 * TOYOTA 零利率專案公式
 * 依照公式表：
 * - 彙總(新專案更新此處)
 * - 計算結果
 */

(function (global) {
  "use strict";

  const Finance = global.Finance || global;

  const HOTAI_NOMINAL_RATE = 0.0345;
  const DLR_RATIO = 0.6;
  const HOTAI_RATIO = 0.4;

  function calculate(project, request) {
    const loan = toLoanAmount(request);
    const term = Number(request.term);
    const planId = request.planId;

    const plan = (project.plans || []).find(p => p.id === planId) || project.plans?.[0];

    if (!plan) throw new Error("找不到 TOYOTA 適用專案。");
    if (!Number.isFinite(loan)) throw new Error("TOYOTA：貸款金額格式錯誤。");
    if (!Number.isFinite(term) || term <= 0) throw new Error("TOYOTA：期數格式錯誤。");

    const planMeta = calculatePlanMeta(plan);
    const result = calculateResultByLoanAndTerm(loan, term, planMeta);

    return {
      projectId: project.id,
      projectName: project.name,
      selectedPlan: plan,
      planMeta,
      columns: [
        { key: "loanAmount", label: "貸款金額", type: "money" },
        { key: "monthlyPayment", label: "月付款", type: "money" },
        { key: "dlrBurden", label: "DLR負擔", type: "money" },
        { key: "maxMonthlyPayment", label: "最大月付款", type: "money" },
        { key: "customerRate", label: "客戶利率", type: "ratePercent" },
        { key: "minDlrSubsidy", label: "最小DLR補貼", type: "money" }
      ],
      rows: [result]
    };
  }

  function calculatePlanMeta(plan) {
    const subsidyAmount = Number(plan.subsidyAmount);
    const subsidyTerm = Number(plan.subsidyTerm);

    const dealerNominalRate = getDealerNominalRate(subsidyAmount, subsidyTerm);
    const zeroMonthly = subsidyAmount / subsidyTerm;

    const interestMonthly = Finance.PMT(
      dealerNominalRate / 12,
      subsidyTerm,
      -subsidyAmount
    );

    const totalSubsidy = Finance.ROUNDUP(
      (interestMonthly - zeroMonthly) * subsidyTerm,
      -2
    );

    const dlrSubsidyCap = totalSubsidy * DLR_RATIO;
    const hotaiSubsidyCap = totalSubsidy - dlrSubsidyCap;

    const baseIrr = Finance.RATE(
      subsidyTerm,
      zeroMonthly,
      -subsidyAmount + totalSubsidy
    ) * 12;

    const systemIrr = Finance.ROUND(baseIrr, 5);

    const hotaiProjectCap =
      Finance.ROUNDUP(
        (
          Finance.PMT(
            HOTAI_NOMINAL_RATE / 12,
            subsidyTerm,
            -subsidyAmount
          ) - zeroMonthly
        ) * subsidyTerm,
        -2
      ) * 0.3;

    return {
      subsidyAmount,
      subsidyTerm,
      dealerNominalRate,
      zeroMonthly,
      totalSubsidy,
      dlrSubsidyCap,
      hotaiSubsidyCap,
      systemIrr,
      hotaiProjectCap
    };
  }

  function calculateResultByLoanAndTerm(loan, term, meta) {
    const monthlyPayment = Finance.PMT(0, term, -loan);

    const totalSubsidy = Finance.ROUND(
      -(
        Finance.PV(
          meta.systemIrr / 12,
          term,
          -monthlyPayment
        ) - loan
      ),
      -2
    );

    const hotaiSubsidy = Math.min(
      totalSubsidy * HOTAI_RATIO,
      meta.hotaiSubsidyCap
    );

    const dlrBurden = totalSubsidy - hotaiSubsidy;

    const irr2 = Finance.RATE(
      term,
      monthlyPayment,
      -loan + dlrBurden
    ) * 12;

    const minDlrSubsidy =
      dlrBurden <= meta.dlrSubsidyCap
        ? dlrBurden
        : meta.dlrSubsidyCap;

    const maxMonthlyPayment =
      dlrBurden <= meta.dlrSubsidyCap
        ? monthlyPayment
        : Finance.PMT(
            irr2 / 12,
            term,
            -loan + minDlrSubsidy
          );

    const customerRate = Finance.ROUND(
      Finance.RATE(
        term,
        maxMonthlyPayment,
        -loan,
        0,
        0,
        0
      ) * 12,
      5
    );

    return {
      loanAmount: loan,
      monthlyPayment,
      dlrBurden,
      maxMonthlyPayment,
      customerRate: customerRate * 100,
      minDlrSubsidy
    };
  }

  function getDealerNominalRate(amount, term) {
    if (amount >= 1000000 && term >= 40) return 0.0395;
    if (term < 30) return 0.045;
    if (term < 40) return 0.0425;
    if (term >= 40) return 0.0425;
    return 0.0425;
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

  global.ToyotaProject = {
    calculate,
    calculatePlanMeta
  };

})(typeof window !== "undefined" ? window : globalThis);