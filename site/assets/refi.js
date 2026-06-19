/* Home Payment Atlas — Refinance calculator. Compares current vs new monthly
 * payment, monthly savings, break-even months, and lifetime interest. No deps. */
(function () {
  "use strict";
  var root = document.querySelector("[data-refi]");
  if (!root) return;
  function $(s) { return root.querySelector(s); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function val(el, d) { return el && el.value !== "" ? num(el.value) : d; }
  function pay(principal, ratePct, years) {
    var r = ratePct / 100 / 12, n = years * 12;
    if (principal <= 0 || n <= 0) return 0;
    return r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  }
  function setVal(el, v, live) { if (window.AtlasAnim) AtlasAnim.num(el, v, live ? { live: true } : {}); else if (el) el.textContent = "$" + Math.round(v).toLocaleString("en-US"); }

  var f = { bal: $("#rf-balance"), crate: $("#rf-crate"), cterm: $("#rf-cterm"), nrate: $("#rf-nrate"), nterm: $("#rf-nterm"), costs: $("#rf-costs") };
  var out = { savings: $("#rf-savings"), cur: $("#rf-current"), nw: $("#rf-new"), be: $("#rf-breakeven"), interest: $("#rf-interest"), sub: $("#rf-sub") };

  function calc() {
    var bal = val(f.bal, 320000), cRate = val(f.crate, 7), cTerm = val(f.cterm, 27);
    var nRate = val(f.nrate, 6), nTerm = val(f.nterm, 30), costs = val(f.costs, 4000);

    var cur = pay(bal, cRate, cTerm), nw = pay(bal, nRate, nTerm);
    var savings = cur - nw; // positive = cheaper monthly
    setVal(out.cur, cur);
    setVal(out.nw, nw);
    setVal(out.savings, savings, true);

    var curInterest = cur * cTerm * 12 - bal;
    var newInterest = nw * nTerm * 12 - bal;
    var interestDiff = curInterest - newInterest; // positive = new loan saves interest overall
    setVal(out.interest, interestDiff);

    if (savings > 0) {
      var beMonths = Math.ceil(costs / savings);
      var yrs = Math.floor(beMonths / 12), mo = beMonths % 12;
      out.be.textContent = beMonths > 600 ? "Over 50 yrs" : (yrs ? yrs + " yr " + mo + " mo" : mo + " mo");
      out.sub.textContent = "Refinancing lowers your payment by about " + (window.AtlasAnim ? AtlasAnim.money(savings) : "$" + Math.round(savings)) +
        "/mo. It takes roughly " + out.be.textContent + " to recoup the " + (window.AtlasAnim ? AtlasAnim.money(costs) : "$" + Math.round(costs)) +
        " in costs — worthwhile if you'll keep the loan past then.";
    } else {
      out.be.textContent = "—";
      out.sub.textContent = "At these terms the new payment isn't lower, so there's no monthly break-even. A lower rate or different term may change that.";
    }
  }

  Object.keys(f).forEach(function (k) { if (f[k]) f[k].addEventListener("input", calc); });
  calc();
})();
