/* Home Payment Atlas: accessible two-state comparison.
 * Core calculations are pure and covered by Node regression tests.
 * All source values come from /data/states.json, generated from Zillow CSVs.
 * Mortgage rates are user-supplied hypothetical assumptions, NOT live quotes.
 */
(function (global) {
  "use strict";

  const MONEY = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  });
  const HOME_TYPES = Object.freeze({
    typical: "Typical home (middle tier)",
    starter: "Starter home (lower tier)",
    higher: "Higher-budget home (upper tier)",
    singleFamily: "Single-family home",
    condo: "Condo / co-op"
  });
  const DEFAULTS = Object.freeze({
    rate: 6.5, term: 30, down: 20,
    insurance: 0.35, pmi: 0.5, closing: 3, housingRatio: 0.28, hoa: 0
  });

  function finite(value, fallback, min, max) {
    const raw = value === "" || value === null || value === undefined ? NaN : Number(value);
    return Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
  }

  function payment(principal, annualRatePct, termYears) {
    if (!Number.isFinite(principal) || principal <= 0) return 0;
    const n = termYears * 12;
    if (!Number.isFinite(n) || n <= 0) return 0;
    const r = annualRatePct / 1200;
    if (r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  function estimate(region, options) {
    const o = options || {};
    const type = Object.prototype.hasOwnProperty.call(HOME_TYPES, o.type) ? o.type : "typical";
    const price = Number(region?.homeValues?.[type]);
    if (!Number.isFinite(price) || price <= 0) return null;

    const rate = finite(o.rate, DEFAULTS.rate, 0, 25);
    const downPct = finite(o.down, DEFAULTS.down, 0, 100);
    const term = [15, 20, 30].includes(Number(o.term)) ? Number(o.term) : DEFAULTS.term;
    const insurancePct = finite(o.insurance, DEFAULTS.insurance, 0, 10);
    const pmiPct = finite(o.pmi, DEFAULTS.pmi, 0, 5);
    const closingPct = finite(o.closing, DEFAULTS.closing, 0, 15);
    const hoa = finite(o.hoa, DEFAULTS.hoa, 0, 100000);
    const taxPct = finite(region?.taxRatePct, 1.1, 0, 15);

    const downPayment = price * downPct / 100;
    const loan = price - downPayment;
    const pi = payment(loan, rate, term);
    const tax = price * taxPct / 1200;
    const insurance = price * insurancePct / 1200;
    const pmi = downPct < 20 ? loan * pmiPct / 1200 : 0;
    const total = pi + tax + insurance + pmi + hoa;
    const closingCosts = price * closingPct / 100;
    const cashToClose = downPayment + closingCosts;
    const suggestedIncome = total * 12 / DEFAULTS.housingRatio;
    const stressPI = payment(loan, Math.min(rate + 1, 25), term);
    const stressedTotal = total + stressPI - pi;

    return {
      price, downPct, downPayment, loan, term, rate, taxPct,
      pi, tax, insurance, pmi, hoa, total, closingCosts, cashToClose,
      suggestedIncome, stressedTotal, stressIncrease: stressedTotal - total,
      latestDate: region.latestDate || null, name: region.regionName,
      state: region.state, slug: region.slug, type
    };
  }

  function compare(a, b) {
    if (!a || !b) return null;
    const gap = b.total - a.total;
    return { gap, priceGap: b.price - a.price, costlierName: gap > 0 ? b.name : gap < 0 ? a.name : null,
      cheaperName: gap > 0 ? a.name : gap < 0 ? b.name : null,
      percentGap: a.total > 0 ? 100 * gap / a.total : 0 };
  }

  const core = Object.freeze({ HOME_TYPES, DEFAULTS, finite, payment, estimate, compare });
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (global && typeof global === "object") global.HomePaymentCompare = core;
  if (typeof document === "undefined") return;

  const root = document.querySelector("[data-market-compare]");
  if (!root) return;

  const get = (id) => root.querySelector("#" + id);
  const fields = {
    a: get("compare-a"), b: get("compare-b"), type: get("compare-type"),
    down: get("compare-down"), rate: get("compare-rate"),
    term: get("compare-term"), hoa: get("compare-hoa")
  };
  const notice = get("compare-status");
  const report = get("compare-report");
  const summary = get("compare-summary");
  const copy = get("compare-copy");
  let regions = [];

  function setText(id, value) {
    const el = get(id);
    if (el) el.textContent = value;
  }
  const money = (v) => MONEY.format(Math.round(v));

  function fillChoices() {
    regions.forEach((region) => {
      for (const element of [fields.a, fields.b]) {
        const option = document.createElement("option");
        option.value = region.slug;
        option.textContent = region.regionName;
        element.appendChild(option);
      }
    });
    const valid = new Set(regions.map((r) => r.slug));
    const params = new URLSearchParams(location.search);
    const candidateA = params.get("a");
    const candidateB = params.get("b");
    fields.a.value = valid.has(candidateA) ? candidateA : (valid.has("maryland") ? "maryland" : regions[0].slug);
    const fallbackB = valid.has("virginia") && fields.a.value !== "virginia" ?
      "virginia" : regions.find((r) => r.slug !== fields.a.value)?.slug || regions[0].slug;
    fields.b.value = valid.has(candidateB) ? candidateB : fallbackB;
    const type = params.get("type");
    fields.type.value = Object.prototype.hasOwnProperty.call(HOME_TYPES, type) ? type : "typical";
    const down = params.get("down"), rate = params.get("rate"), term = params.get("term"), hoa = params.get("hoa");
    if (down !== null) fields.down.value = finite(down, DEFAULTS.down, 0, 100);
    if (rate !== null) fields.rate.value = finite(rate, DEFAULTS.rate, 0, 25);
    if ([15, 20, 30].includes(Number(term))) fields.term.value = term;
    if (hoa !== null) fields.hoa.value = finite(hoa, DEFAULTS.hoa, 0, 100000);
  }

  function describe(which, result) {
    if (!result) {
      setText("compare-" + which + "-name", "Data unavailable");
      for (const id of ["price", "monthly", "principal", "tax", "insurance", "pmi", "cash", "income", "stress", "month"]) {
        setText("compare-" + which + "-" + id, "—");
      }
      const link = get("compare-" + which + "-link");
      if (link) link.hidden = true;
      return;
    }
    setText("compare-" + which + "-name", result.name);
    setText("compare-" + which + "-price", money(result.price));
    setText("compare-" + which + "-monthly", money(result.total));
    setText("compare-" + which + "-principal", money(result.pi));
    setText("compare-" + which + "-tax", money(result.tax));
    setText("compare-" + which + "-insurance", money(result.insurance));
    setText("compare-" + which + "-pmi", money(result.pmi));
    setText("compare-" + which + "-cash", money(result.cashToClose));
    setText("compare-" + which + "-income", money(result.suggestedIncome));
    setText("compare-" + which + "-stress", "+" + money(result.stressIncrease) + "/mo");
    setText("compare-" + which + "-month", result.latestDate ? "Zillow ZHVI · " + result.latestDate : "Zillow ZHVI");
    const link = get("compare-" + which + "-link");
    if (link) { link.href = "../states/" + encodeURIComponent(result.slug) + "/"; link.hidden = false; link.textContent = "Explore " + result.name + " →"; }
  }

  function currentOptions() {
    return { type: fields.type.value, down: fields.down.value,
      rate: fields.rate.value, term: fields.term.value, hoa: fields.hoa.value };
  }

  function render() {
    const ra = regions.find((r) => r.slug === fields.a.value);
    const rb = regions.find((r) => r.slug === fields.b.value);
    const options = currentOptions();
    const a = estimate(ra, options), b = estimate(rb, options);
    describe("a", a);
    describe("b", b);
    report.hidden = false;
    if (!a || !b) {
      summary.textContent = "This home type is not available for both selected states. Try a different home type.";
    } else if (ra.slug === rb.slug) {
      summary.textContent = "You've selected " + a.name + " twice. Choose a different second state to compare estimated costs.";
    } else {
      const gap = compare(a, b);
      if (Math.abs(gap.gap) < 0.5) {
        summary.textContent = a.name + " and " + b.name + " have nearly identical estimated payments under these assumptions.";
      } else {
        summary.textContent = "At " + finite(options.down, 20, 0, 100) + "% down and " +
          finite(options.rate, 6.5, 0, 25) + "% hypothetical interest, " + gap.costlierName +
          " costs about " + money(Math.abs(gap.gap)) + " more per month than " + gap.cheaperName +
          " for the selected Zillow home-value tier. Compare the full cost breakdown below.";
      }
    }

    const params = new URLSearchParams({
      a: fields.a.value, b: fields.b.value, type: fields.type.value,
      down: fields.down.value, rate: fields.rate.value,
      term: fields.term.value, hoa: fields.hoa.value
    });
    try { history.replaceState(null, "", location.pathname + "?" + params.toString()); } catch (_) {}
    notice.textContent = "Comparison updated. Based on Zillow data and estimated costs, not a lender quote.";
  }

  Object.values(fields).forEach((field) => {
    field.addEventListener("input", render);
    field.addEventListener("change", render);
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      notice.textContent = "Comparison link copied. Remember that its values are illustrative.";
    } catch (_) {
      notice.textContent = "Copy this address from your browser to share the comparison.";
    }
  });

  fetch("../data/states.json", { cache: "no-cache" })
    .then((response) => { if (!response.ok) throw Error("Data unavailable"); return response.json(); })
    .then((data) => {
      regions = (data.regions || []).filter((r) => r && r.slug && r.homeValues && Number(r.homeValues.typical) > 0)
        .sort((a,b) => a.regionName.localeCompare(b.regionName));
      if (regions.length < 2) throw Error("State data is incomplete");
      fillChoices();
      render();
    })
    .catch(() => {
      notice.textContent = "The comparison data could not be loaded. Refresh the page, or use a state calculator instead.";
      report.hidden = true;
    });
})(typeof window === "undefined" ? {} : window);
