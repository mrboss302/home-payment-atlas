/* Home Payment Atlas — Rent vs Buy calculator (vanilla JS, no dependencies).
 * A transparent year-by-year model: it compares the net cost of buying
 * (ownership outlay minus the equity you'd walk away with) against renting
 * (rent paid minus the investment growth on the cash a buyer ties up upfront),
 * and reports a break-even year. All figures are estimates. */
(function () {
  "use strict";
  var root = document.querySelector("[data-rentbuy]");
  if (!root) return;

  var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  function $(s) { return root.querySelector(s); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function money(n) { return fmt.format(Math.round(n)); }
  function val(el, d) { return el && el.value !== "" ? num(el.value) : d; }

  var f = {
    price: $("#rb-price"), down: $("#rb-down"), rate: $("#rb-rate"), term: $("#rb-term"),
    rent: $("#rb-rent"), years: $("#rb-years"),
    appr: $("#rb-appr"), rentinc: $("#rb-rentinc"), ret: $("#rb-return"),
    tax: $("#rb-tax"), ins: $("#rb-ins"), maint: $("#rb-maint"), sell: $("#rb-sell"),
  };
  var out = {
    verdict: $("#rb-verdict"), sub: $("#rb-sub"),
    buy: $("#rb-buy"), rent: $("#rb-rent-cost"), be: $("#rb-breakeven"),
    yearsLabel: $("#rb-years-label"), note: $("#rb-note"),
  };

  function calc() {
    var price = val(f.price, 400000), downPct = Math.min(100, val(f.down, 20)), rate = val(f.rate, 6.5);
    var term = val(f.term, 30) || 30, rent0 = val(f.rent, 2000), years = Math.max(1, Math.min(30, val(f.years, 7)));
    var appr = val(f.appr, 3) / 100, rentinc = val(f.rentinc, 3) / 100, ret = val(f.ret, 5) / 100;
    var taxP = val(f.tax, 1.1) / 100, insP = val(f.ins, 0.35) / 100, maintP = val(f.maint, 1) / 100, sellP = val(f.sell, 6) / 100;

    var down = price * downPct / 100, loan = Math.max(0, price - down), upfront = down + price * 0.03;
    var r = rate / 100 / 12, n = term * 12;
    var pi = loan <= 0 ? 0 : (r === 0 ? loan / n : loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));

    var balance = loan, ownCum = upfront, rentCum = 0, breakeven = null, buyNet = 0, rentNet = 0;
    for (var y = 1; y <= years; y++) {
      for (var m = 0; m < 12; m++) {
        var interest = balance * r;
        var principal = Math.min(balance, Math.max(0, pi - interest));
        balance -= principal;
      }
      var hv = price * Math.pow(1 + appr, y);
      var pmiYr = (downPct < 20 && balance > price * 0.8) ? loan * 0.005 : 0;
      ownCum += pi * 12 + hv * taxP + hv * insP + hv * maintP + pmiYr;
      var equity = hv * (1 - sellP) - balance;
      buyNet = ownCum - equity;

      rentCum += rent0 * 12 * Math.pow(1 + rentinc, y - 1);
      var investGain = upfront * Math.pow(1 + ret, y) - upfront;
      rentNet = rentCum - investGain;

      if (breakeven === null && buyNet <= rentNet) breakeven = y;
    }

    if (window.AtlasAnim) { AtlasAnim.num(out.buy, buyNet); AtlasAnim.num(out.rent, rentNet); }
    else { out.buy.textContent = money(buyNet); out.rent.textContent = money(rentNet); }
    if (out.yearsLabel) out.yearsLabel.textContent = years + (years === 1 ? " year" : " years");

    var diff = rentNet - buyNet; // positive → buying is cheaper
    if (window.AtlasAnim) AtlasAnim.flash(out.verdict);
    if (Math.abs(diff) < Math.max(2000, 0.01 * Math.abs(rentNet))) {
      out.verdict.textContent = "About even";
      out.verdict.style.color = "var(--ink-900)";
      out.sub.textContent = "Over " + years + (years === 1 ? " year" : " years") + ", buying and renting cost roughly the same on these assumptions.";
    } else if (diff > 0) {
      out.verdict.textContent = "Buying looks cheaper";
      out.verdict.style.color = "var(--comfortable)";
      out.sub.textContent = "Over " + years + (years === 1 ? " year" : " years") + ", buying could cost about " + money(diff) + " less than renting on these assumptions.";
    } else {
      out.verdict.textContent = "Renting looks cheaper";
      out.verdict.style.color = "var(--clay-600)";
      out.sub.textContent = "Over " + years + (years === 1 ? " year" : " years") + ", renting could cost about " + money(-diff) + " less than buying on these assumptions.";
    }

    if (out.be) {
      out.be.textContent = breakeven ? ("~" + breakeven + (breakeven === 1 ? " year" : " years")) : "Beyond " + years + " yrs";
    }
    if (out.note) {
      out.note.textContent = breakeven
        ? "On these inputs, buying tends to come out ahead once you stay past about " + breakeven + (breakeven === 1 ? " year." : " years.")
        : "On these inputs, buying does not overtake renting within " + years + " years — a longer stay would help.";
    }
  }

  Object.keys(f).forEach(function (k) {
    if (f[k]) f[k].addEventListener("input", calc);
  });
  calc();
})();
