/**
 * js/engine.js
 * 統一試算引擎
 * 支援：
 * - 豪享
 * - 樂享
 * - 樂購
 * - 中古尊榮
 * - TOYOTA零利率初版
 */

(function (global) {
  "use strict";

  const Finance = global.Finance || global;

  function toLoanAmount(request) {
    if (Number.isFinite(Number(request.loanAmount))) {
      return Math.round(Number(request.loanAmount));
    }

    if (Number.isFinite(Number(request.loanWan))) {
      return Math.round(Number(request.loanWan) * 10000);
    }

    return NaN;
  }

  function evolveBalance(balance, monthlyRate, months, payment) {
    let b = balance;

    for (let i = 0; i < months; i++) {
      b = b * (1 + monthlyRate) - payment;
    }

    return b;
  }

  function getBasePayment(loan, table) {
    if (!Array.isArray(table)) return NaN;

    let result = NaN;

    table
      .slice()
      .sort((a, b) => a.minLoan - b.minLoan)
      .forEach(row => {
        if (loan >= row.minLoan) {
          result = row.value;
        }
      });

    return result;
  }

  function getSharedCommission(loan, rate, rules) {
    const matched = rules.find(rule => Number(rule.rate).toFixed(2) === Number(rate).toFixed(2));

    if (!matched) return 0;

    if (loan >= matched.minLoan) {
      return matched.commissionAtOrAboveMinLoan;
    }

    return matched.commissionBelowMinLoan;
  }

  function getZhongguCommission(loan, rate) {
    if (loan < 1000000 || rate < 4.5) return 0;
    if (rate >= 4.75) return 15000;
    if (loan >= 1500000 && rate >= 4.5) return 10000;
    return 8000;
  }

  function calculateStandard(project, request) {
    const loan = toLoanAmount(request);

    if (!Number.isFinite(loan)) {
      throw new Error("貸款金額格式錯誤。");
    }

    const rates = project.customerRates || [];
    const rules = project.paymentRules || [];
    const rows = [];

    for (const rate of rates) {
      const monthlyRate = rate / 100 / 12;

      if (project.id === "haoxiang") {
        const p1 = getBasePayment(loan, rules.phase1to12Fixed);
        const p2 = loan / 100 + 888;
        const tail = loan * 0.5;

        const balance12 = evolveBalance(loan, monthlyRate, 12, p1);
        const balance24 = evolveBalance(balance12, monthlyRate, 12, p2);

        const p3 = Finance.ROUNDUP(
          Finance.PMT(monthlyRate, 35, -balance24, tail / (1 + monthlyRate)),
          0
        );

        rows.push({
          loanAmount: loan,
          term: project.defaultTerm,
          phase1to12: p1,
          phase13to24: p2,
          phase25to59: p3,
          tailAmount: tail,
          commission: getSharedCommission(loan, rate, project.commissionRules || []),
          customerRate: rate
        });
      }

      if (project.id === "lexiang") {
        const p1 = getBasePayment(loan, rules.phase1to12Fixed);
        const p2 = loan / 100 + 888;

        const balance12 = evolveBalance(loan, monthlyRate, 12, p1);
        const balance59 = evolveBalance(balance12, monthlyRate, 47, p2);

        const p60 = Finance.ROUNDUP(balance59 * (1 + monthlyRate), 0);

        rows.push({
          loanAmount: loan,
          term: project.defaultTerm,
          phase1to12: p1,
          phase13to59: p2,
          phase60: p60,
          commission: getSharedCommission(loan, rate, project.commissionRules || []),
          customerRate: rate
        });
      }

      if (project.id === "legou") {
        const p1to59 = loan / 100;
        const balance59 = evolveBalance(loan, monthlyRate, 59, p1to59);
        const p60 = Finance.ROUNDUP(balance59 * (1 + monthlyRate), 0);

        rows.push({
          loanAmount: loan,
          term: project.defaultTerm,
          phase1to59: p1to59,
          phase60: p60,
          commission: getSharedCommission(loan, rate, project.commissionRules || []),
          customerRate: rate
        });
      }

      if (project.id === "zhonggu") {
        const p1 = getBasePayment(loan, rules.phase1to12Fixed);
        const p2 = loan / 100 + 888;
        const tail = loan * 0.5;

        const balance12 = evolveBalance(loan, monthlyRate, 12, p1);
        const balance24 = evolveBalance(balance12, monthlyRate, 12, p2);

        const p3 = Finance.ROUNDUP(
          Finance.PMT(monthlyRate, 35, -balance24, tail / (1 + monthlyRate)),
          -1
        );

        rows.push({
          customerRate: rate,
          loanAmount: loan,
          phase1to12: p1,
          phase13to24: p2,
          phase25to59: p3,
          tailAmount: tail,
          commission: getZhongguCommission(loan, rate)
        });
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      columns: getColumns(project),
      rows
    };
  }

  function calculateToyota(project, request) {
    const loan = toLoanAmount(request);
    const term = Number(request.term);
    const planId = request.planId;
    const plan = (project.plans || []).find(p => p.id === planId) || project.plans?.[0];

    if (!plan) {
      throw new Error("找不到 TOYOTA 適用專案。");
    }

    if (!Number.isFinite(loan)) {
      throw new Error("TOYOTA：貸款金額格式錯誤。");
    }

    if (!Number.isFinite(term) || term <= 0) {
      throw new Error("TOYOTA：期數格式錯誤。");
    }

    const monthlyPayment = Finance.ROUNDUP(loan / term, 0);

    /**
     * 這裡先保留為 TOYOTA 初版公式。
     * 等你要完全對 Excel 時，我們再把 Excel 裡的 RATE / PV / ROUNDUP / DLR 補貼公式逐欄翻譯進來。
     */
    const nominalRate = getToyotaNominalRate(plan.subsidyAmount, plan.subsidyTerm);
    const monthlyRate = nominalRate / 12;

    const zeroMonthly = plan.subsidyAmount / plan.subsidyTerm;
    const interestMonthly = Finance.PMT(monthlyRate, plan.subsidyTerm, -plan.subsidyAmount);

    const totalSubsidy = Finance.ROUNDUP(
      (interestMonthly - zeroMonthly) * plan.subsidyTerm,
      -2
    );

    const dlrCap = Finance.ROUNDUP(totalSubsidy * 0.6, -2);
    const htCap = Finance.ROUNDUP(totalSubsidy * 0.4, -2);

    const estimatedTotalSubsidy = Finance.ROUNDUP(loan * 0.1, -2);
    const htBurden = Math.min(Finance.ROUNDUP(estimatedTotalSubsidy * 0.4, -2), htCap);
    const dlrBurden = estimatedTotalSubsidy - htBurden;

    const minDlrSubsidy = Math.min(dlrBurden, dlrCap);
    const maxMonthlyPayment = Finance.ROUNDUP(
      Finance.PMT(monthlyRate, term, -(loan - minDlrSubsidy)),
      0
    );

    const customerMonthlyRate = Finance.RATE(term, -maxMonthlyPayment, loan, 0, 0, 0.01);
    const customerRate = Number.isFinite(customerMonthlyRate)
      ? customerMonthlyRate * 12 * 100
      : NaN;

    return {
      projectId: project.id,
      projectName: project.name,
      selectedPlan: plan,
      columns: getColumns(project),
      rows: [
        {
          loanAmount: loan,
          monthlyPayment,
          dlrBurden,
          maxMonthlyPayment,
          customerRate,
          minDlrSubsidy
        }
      ]
    };
  }

  function getToyotaNominalRate(amount, term) {
    if (term >= 48) return 0.0399;
    if (term >= 36) return 0.0425;
    if (term >= 30) return 0.0425;
    return 0.045;
  }

  function getColumns(project) {
    if (project.id === "haoxiang") {
      return [
        { key: "loanAmount", label: "貸款金額", type: "money" },
        { key: "term", label: "期數", type: "integer" },
        { key: "phase1to12", label: "1~12期", type: "money" },
        { key: "phase13to24", label: "13~24期", type: "money" },
        { key: "phase25to59", label: "25~59期", type: "money" },
        { key: "tailAmount", label: "尾款(50%)", type: "money" },
        { key: "commission", label: "佣金", type: "money" },
        { key: "customerRate", label: "客戶利率", type: "ratePercent" }
      ];
    }

    if (project.id === "lexiang") {
      return [
        { key: "loanAmount", label: "貸款金額", type: "money" },
        { key: "term", label: "期數", type: "integer" },
        { key: "phase1to12", label: "1~12期", type: "money" },
        { key: "phase13to59", label: "13~59期", type: "money" },
        { key: "phase60", label: "60期", type: "money" },
        { key: "commission", label: "佣金", type: "money" },
        { key: "customerRate", label: "客戶利率", type: "ratePercent" }
      ];
    }

    if (project.id === "legou") {
      return [
        { key: "loanAmount", label: "貸款金額", type: "money" },
        { key: "term", label: "期數", type: "integer" },
        { key: "phase1to59", label: "1~59期", type: "money" },
        { key: "phase60", label: "60期", type: "money" },
        { key: "commission", label: "佣金", type: "money" },
        { key: "customerRate", label: "客戶利率", type: "ratePercent" }
      ];
    }

    if (project.id === "zhonggu") {
      return [
        { key: "customerRate", label: "利率", type: "ratePercent" },
        { key: "loanAmount", label: "貸款金額", type: "money" },
        { key: "phase1to12", label: "1~12期", type: "money" },
        { key: "phase13to24", label: "13~24期", type: "money" },
        { key: "phase25to59", label: "25~59期", type: "money" },
        { key: "tailAmount", label: "尾款", type: "money" },
        { key: "commission", label: "佣金", type: "money" }
      ];
    }

    if (project.id === "toyota_zero_interest") {
      return [
        { key: "loanAmount", label: "貸款金額", type: "money" },
        { key: "monthlyPayment", label: "月付款", type: "money" },
        { key: "dlrBurden", label: "DLR負擔", type: "money" },
        { key: "maxMonthlyPayment", label: "最大月付款", type: "money" },
        { key: "customerRate", label: "客戶利率", type: "ratePercent" },
        { key: "minDlrSubsidy", label: "最小DLR補貼", type: "money" }
      ];
    }

    return [];
  }

  function calculate(project, request) {
    if (!project) {
      throw new Error("找不到專案設定。");
    }

    if (project.type === "toyota_zero_interest") {
      return calculateToyota(project, request);
    }

    return calculateStandard(project, request);
  }

  global.LoanEngine = {
    calculate,
    calculateStandard,
    calculateToyota
  };

})(typeof window !== "undefined" ? window : globalThis);