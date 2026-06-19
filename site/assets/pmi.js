/* Home Payment Atlas — PMI calculator. Estimates monthly PMI, total PMI paid
 * until ~20% equity, and when it drops off, via real amortization. No deps. */
(function () {
  "use strict";
  var root = document.querySelector("[data-pmi]");
  if (!root) return;
  function $(s) { return root.querySelector(s); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function val(el, d) { return el && el.value !== "" ? num(el.value) : d; }
  function setVal(el, v) { if (window.AtlasAnim) AtlasAnim.num(el, v, el.id === "pmi-monthly" ? { live: true } : {}); else if (el) el.textContent = "$" + Math.round(v).toLocaleString("en-US"); }

  var f = { price: $("#pmi-price"), down: $("#pmi-down"), rate: $("#pmi-rate"), term: $("#pmi-term"), pmirate: $("#pmi-pct") };
  var out = { monthly: $("#pmi-monthly"), loan: $("#pmi-loan"), total: $("#pmi-total"), cancel: $("#pmi-cancel"), sub: $("#pmi-sub") };

  function calc() {
    var price = val(f.price, 400000), downPct = Math.min(100, val(f.down, 10)), rate = val(f.rate, 6.5);
    var term = val(f.term, 30) || 30, pmiR = val(f.pmirate, 0.5);
    var down = price * downPct / 100, loan = Math.max(0, price - down);
    setVal(out.loan, loan);

    if (downPct >= 20) {
      setVal(out.monthly, 0);
      setVal(out.total, 0);
      out.cancel.textContent = "Not required";
      out.sub.textContent = "With 20% or more down, conventional loans generally don't require PMI.";
      return;
    }

    var monthlyPMI = loan * pmiR / 100 / 12;
    setVal(out.monthly, monthlyPMI);

    var r = rate / 100 / 12, n = term * 12;
    var pi = loan <= 0 ? 0 : (r === 0 ? loan / n : loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
    var bal = loan, months = 0, target = price * 0.8, totalPMI = 0; // request cancellation at 80% LTV
    while (bal > target && months < n) {
      var interest = bal * r;
      var principal = pi - interest;
      if (principal <= 0) break;
      bal -= principal;
      months++;
      totalPMI += monthlyPMI;
    }
    setVal(out.total, totalPMI);
    var yrs = Math.floor(months / 12), mo = months % 12;
    var when = yrs ? (yrs + " yr " + mo + " mo") : (mo + " mo");
    out.cancel.textContent = months >= n ? "End of loan" : when;
    out.sub.textContent = "Estimated PMI of about " + (window.AtlasAnim ? AtlasAnim.money(monthlyPMI) : "$" + Math.round(monthlyPMI)) +
      "/mo until you reach 20% equity in about " + when + " at scheduled payments. Paying extra principal or rising home values can end it sooner.";
  }

  Object.keys(f).forEach(function (k) { if (f[k]) f[k].addEventListener("input", calc); });
  calc();
})();
