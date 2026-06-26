/**
 * finance.js
 * Excel-like finance utilities for browser use
 * 版本：核心版
 */

(function (global) {
  "use strict";

  const EPS = 1e-12;
  const MAX_ITER = 200;

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function toNumber(value, fallback = NaN) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // ------------------------------------------------------------
  // Excel-like rounding
  // digits > 0 : 小數位
  // digits = 0 : 個位
  // digits < 0 : 十位、百位、千位...
  // ------------------------------------------------------------

  function ROUND(value, digits = 0) {
    value = toNumber(value);
    digits = Math.trunc(toNumber(digits, 0));

    if (!Number.isFinite(value)) return NaN;

    const factor = Math.pow(10, digits);
    const shifted = value * factor;

    // Excel ROUND = 四捨五入，且負數在 .5 時是「離 0 更遠」
    const rounded = shifted >= 0
      ? Math.floor(shifted + 0.5 + EPS)
      : -Math.floor(-shifted + 0.5 + EPS);

    return rounded / factor;
  }

  function ROUNDUP(value, digits = 0) {
    value = toNumber(value);
    digits = Math.trunc(toNumber(digits, 0));

    if (!Number.isFinite(value)) return NaN;

    const factor = Math.pow(10, digits);
    const shifted = value * factor;

    // Excel ROUNDUP = 無條件進位（離 0 更遠）
    const rounded = shifted >= 0
      ? Math.ceil(shifted - EPS)
      : -Math.ceil(-shifted - EPS);

    return rounded / factor;
  }

  function ROUNDDOWN(value, digits = 0) {
    value = toNumber(value);
    digits = Math.trunc(toNumber(digits, 0));

    if (!Number.isFinite(value)) return NaN;

    const factor = Math.pow(10, digits);
    const shifted = value * factor;

    // Excel ROUNDDOWN = 無條件捨去（朝 0）
    const rounded = shifted >= 0
      ? Math.floor(shifted + EPS)
      : -Math.floor(-shifted + EPS);

    return rounded / factor;
  }

  // ------------------------------------------------------------
  // Basic finance functions
  // ------------------------------------------------------------

  function PMT(rate, nper, pv, fv = 0, type = 0) {
    rate = toNumber(rate);
    nper = toNumber(nper);
    pv = toNumber(pv);
    fv = toNumber(fv, 0);
    type = toNumber(type, 0);

    if (!Number.isFinite(rate) || !Number.isFinite(nper) || !Number.isFinite(pv)) {
      return NaN;
    }

    if (nper === 0) return NaN;

    // rate = 0 的極限情況
    if (Math.abs(rate) < EPS) {
      return -(pv + fv) / nper;
    }

    const pow = Math.pow(1 + rate, nper);
    const denom = (pow - 1) * (1 + rate * type);

    if (Math.abs(denom) < EPS) return NaN;

    return -(rate * (fv + pv * pow)) / denom;
  }

  function FV(rate, nper, pmt, pv = 0, type = 0) {
    rate = toNumber(rate);
    nper = toNumber(nper);
    pmt = toNumber(pmt);
    pv = toNumber(pv, 0);
    type = toNumber(type, 0);

    if (!Number.isFinite(rate) || !Number.isFinite(nper) || !Number.isFinite(pmt) || !Number.isFinite(pv)) {
      return NaN;
    }

    if (nper === 0) return NaN;

    if (Math.abs(rate) < EPS) {
      return -(pv + pmt * nper);
    }

    const pow = Math.pow(1 + rate, nper);
    return -(pv * pow + pmt * (1 + rate * type) * (pow - 1) / rate);
  }

  function PV(rate, nper, pmt, fv = 0, type = 0) {
    rate = toNumber(rate);
    nper = toNumber(nper);
    pmt = toNumber(pmt);
    fv = toNumber(fv, 0);
    type = toNumber(type, 0);

    if (!Number.isFinite(rate) || !Number.isFinite(nper) || !Number.isFinite(pmt) || !Number.isFinite(fv)) {
      return NaN;
    }

    if (nper === 0) return NaN;

    if (Math.abs(rate) < EPS) {
      return -(fv + pmt * nper);
    }

    const pow = Math.pow(1 + rate, nper);
    return -(fv + pmt * (1 + rate * type) * (pow - 1) / rate) / pow;
  }

  function NPV(rate, cashFlows) {
    rate = toNumber(rate);
    if (!Array.isArray(cashFlows) || !Number.isFinite(rate)) return NaN;

    let total = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const cf = toNumber(cashFlows[i]);
      if (!Number.isFinite(cf)) return NaN;
      total += cf / Math.pow(1 + rate, i + 1);
    }
    return total;
  }

  // ------------------------------------------------------------
  // Root solvers
  // ------------------------------------------------------------

  function bisect(f, low, high, tol = 1e-10, maxIter = 200) {
    let fLow = f(low);
    let fHigh = f(high);

    if (!Number.isFinite(fLow) || !Number.isFinite(fHigh)) return null;
    if (Math.abs(fLow) < tol) return low;
    if (Math.abs(fHigh) < tol) return high;

    if (fLow * fHigh > 0) return null;

    let mid = low;

    for (let i = 0; i < maxIter; i++) {
      mid = (low + high) / 2;
      const fMid = f(mid);

      if (!Number.isFinite(fMid)) return null;
      if (Math.abs(fMid) < tol || Math.abs(high - low) < tol) return mid;

      if (fLow * fMid <= 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }

    return mid;
  }

  function newton(f, guess, tol = 1e-10, maxIter = 100, min = -0.999999999, max = 1e6) {
    let x = guess;

    for (let i = 0; i < maxIter; i++) {
      const fx = f(x);

      if (!Number.isFinite(fx)) return null;
      if (Math.abs(fx) < tol) return x;

      const h = Math.max(1e-8, Math.abs(x) * 1e-6);
      const f1 = f(x + h);
      const f2 = f(x - h);

      if (!Number.isFinite(f1) || !Number.isFinite(f2)) return null;

      const dfx = (f1 - f2) / (2 * h);
      if (!Number.isFinite(dfx) || Math.abs(dfx) < EPS) return null;

      let next = x - fx / dfx;

      if (!Number.isFinite(next)) return null;
      if (next <= min) next = (x + min) / 2;
      if (next >= max) next = (x + max) / 2;

      if (Math.abs(next - x) < tol) return next;
      x = next;
    }

    return x;
  }

  // ------------------------------------------------------------
  // RATE / IRR
  // ------------------------------------------------------------

  // Excel RATE(nper, pmt, pv, [fv], [type], [guess])
  // 回傳「每期利率」
  function RATE(nper, pmt, pv, fv = 0, type = 0, guess = 0.1) {
    nper = toNumber(nper);
    pmt = toNumber(pmt);
    pv = toNumber(pv);
    fv = toNumber(fv, 0);
    type = toNumber(type, 0);
    guess = toNumber(guess, 0.1);

    if (!Number.isFinite(nper) || !Number.isFinite(pmt) || !Number.isFinite(pv) || !Number.isFinite(fv) || !Number.isFinite(type)) {
      return NaN;
    }

    if (nper <= 0) return NaN;

    const f = (r) => PMT(r, nper, pv, fv, type) - pmt;

    // 先嘗試 Newton
    let root = newton(f, guess, 1e-12, 100, -0.999999999, 1e6);
    if (root !== null && Number.isFinite(root)) {
      return root;
    }

    // 找 bracket 再 bisection
    let low = -0.999999999;
    let high = Math.max(guess, 0.1);

    let fLow = f(low);
    let fHigh = f(high);

    let attempts = 0;
    while ((Number.isFinite(fLow) && Number.isFinite(fHigh) && fLow * fHigh > 0) && attempts < 60) {
      high *= 2;
      if (high > 1e6) break;
      fHigh = f(high);
      attempts++;
    }

    if (Number.isFinite(fLow) && Number.isFinite(fHigh) && fLow * fHigh <= 0) {
      const r = bisect(f, low, high, 1e-12, 200);
      if (r !== null) return r;
    }

    return NaN;
  }

  // Excel IRR(values, [guess])
  // values[0] 通常是初始投資（負數），後面是未來現金流
  function IRR(values, guess = 0.1) {
    if (!Array.isArray(values) || values.length < 2) return NaN;

    const flows = values.map(v => toNumber(v, NaN));
    if (flows.some(v => !Number.isFinite(v))) return NaN;

    guess = toNumber(guess, 0.1);

    const f = (r) => {
      let total = 0;
      for (let i = 0; i < flows.length; i++) {
        total += flows[i] / Math.pow(1 + r, i);
      }
      return total;
    };

    // Newton
    let root = newton(f, guess, 1e-12, 200, -0.999999999, 1e6);
    if (root !== null && Number.isFinite(root)) {
      return root;
    }

    // Bracketing search
    let low = -0.999999999;
    let high = Math.max(guess, 0.1);
    let fLow = f(low);
    let fHigh = f(high);

    let attempts = 0;
    while ((Number.isFinite(fLow) && Number.isFinite(fHigh) && fLow * fHigh > 0) && attempts < 80) {
      high *= 2;
      if (high > 1e6) break;
      fHigh = f(high);
      attempts++;
    }

    if (Number.isFinite(fLow) && Number.isFinite(fHigh) && fLow * fHigh <= 0) {
      const r = bisect(f, low, high, 1e-12, 300);
      if (r !== null) return r;
    }

    return NaN;
  }

  // ------------------------------------------------------------
  // Convenience helpers
  // ------------------------------------------------------------

  function formatMoney(value) {
    const n = toNumber(value);
    if (!Number.isFinite(n)) return "—";
    return "$" + Math.round(n).toLocaleString("zh-TW");
  }

  function formatPercent(rate, digits = 2) {
    const n = toNumber(rate);
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(digits) + "%";
  }

  // ------------------------------------------------------------
  // Export to browser global
  // ------------------------------------------------------------

  const api = {
    PMT,
    FV,
    PV,
    RATE,
    IRR,
    NPV,
    ROUND,
    ROUNDUP,
    ROUNDDOWN,
    formatMoney,
    formatPercent
  };

  Object.assign(global, api);

  // 也放到命名空間，之後 app.js 比較好呼叫
  global.Finance = api;

})(typeof window !== "undefined" ? window : globalThis);