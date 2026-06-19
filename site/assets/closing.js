/* Home Payment Atlas — Closing cost calculator. Estimates closing costs and
 * total cash to close, with an illustrative line-item breakdown. No deps. */
(function () {
  "use strict";
  var root = document.querySelector("[data-closing]");
  if (!root) return;
  function $(s) { return root.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function val(el, d) { return el && el.value !== "" ? num(el.value) : d; }
  function setVal(el, v) { if (window.AtlasAnim) AtlasAnim.num(el, v, el.id === "cl-cash" ? { live: true } : {}); else if (el) el.textContent = "$" + Math.round(v).toLocaleString("en-US"); }

  var f = { price: $("#cl-price"), down: $("#cl-down"), rate: $("#cl-rate") };
  var out = { cash: $("#cl-cash"), closing: $("#cl-closing"), downAmt: $("#cl-downamt"), loan: $("#cl-loan"), sub: $("#cl-sub") };
  // Illustrative split of total closing costs (share of price), summing to the entered %.
  var lineEls = $$("[data-line]"); // each has data-line = share weight

  function calc() {
    var price = val(f.price, 400000), downPct = Math.min(100, val(f.down, 20)), pct = val(f.rate, 3);
    var down = price * downPct / 100, loan = Math.max(0, price - down);
    var closing = price * pct / 100;
    setVal(out.downAmt, down);
    setVal(out.loan, loan);
    setVal(out.closing, closing);
    setVal(out.cash, down + closing);
    if (out.sub) out.sub.textContent = "Estimated " + (window.AtlasAnim ? AtlasAnim.money(closing) : "$" + Math.round(closing)) +
      " in closing costs (" + (Math.round(pct * 10) / 10) + "% of price) plus your " + (window.AtlasAnim ? AtlasAnim.money(down) : "$" + Math.round(down)) + " down payment.";

    // Breakdown: distribute `closing` across illustrative line items by weight.
    var total = lineEls.reduce(function (s, el) { return s + num(el.getAttribute("data-line")); }, 0) || 1;
    lineEls.forEach(function (el) {
      var share = num(el.getAttribute("data-line")) / total;
      setVal(el, closing * share);
    });
  }

  Object.keys(f).forEach(function (k) { if (f[k]) f[k].addEventListener("input", calc); });
  calc();
})();
