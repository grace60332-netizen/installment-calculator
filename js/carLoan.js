/**
 * js/carLoan.js
 * 車貸補貼息試算
 */

(function (global) {
  "use strict";

  const Finance = global.Finance || global;

  function calculateCarLoan({ loanAmount, customerRate, realRate, term }) {
    const loan = Number(loanAmount);
    const customerAnnualRate = Number(customerRate);
    const realAnnualRate = Number(realRate);
    const months = Number(term);

    if (!Number.isFinite(loan) || loan <= 0) {
      throw new Error("請輸入正確的申貸金額。");
    }

    if (!Number.isFinite(customerAnnualRate) || customerAnnualRate < 0) {
      throw new Error("請輸入正確的客戶利率。");
    }

    if (!Number.isFinite(realAnnualRate) || realAnnualRate < 0) {
      throw new Error("請輸入正確的實質利率。");
    }

    if (!Number.isFinite(months) || months <= 0) {
      throw new Error("請輸入正確的攤還期數。");
    }

    const customerMonthlyRate = customerAnnualRate / 100 / 12;
    const realMonthlyRate = realAnnualRate / 100 / 12;

    const monthlyPaymentRaw = Finance.PMT(
      customerMonthlyRate,
      months,
      -loan
    );

    const monthlyPayment = Finance.ROUNDUP(monthlyPaymentRaw, 0);

    let subsidy = 0;
    let actualDisbursement = loan;

    if (customerAnnualRate < realAnnualRate) {
      const pvRaw = Finance.PV(
        realMonthlyRate,
        months,
        -monthlyPaymentRaw
      );

      actualDisbursement = Finance.ROUNDDOWN(pvRaw, 0);
      subsidy = loan - actualDisbursement;
    }

    subsidy = Math.max(0, subsidy);
    actualDisbursement = loan - subsidy;

    return {
      loanAmount: loan,
      customerRate: customerAnnualRate,
      realRate: realAnnualRate,
      term: months,
      monthlyPayment,
      subsidy,
      actualDisbursement
    };
  }

  function formatMoney(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return Math.round(Number(value)).toLocaleString("zh-TW");
  }

  global.CarLoanCalculator = {
    calculateCarLoan,
    formatMoney
  };

})(typeof window !== "undefined" ? window : globalThis);