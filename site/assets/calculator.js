/* Home Payment Atlas — calculator engine (vanilla JS, no dependencies) */
(function () {
  "use strict";

  var root = document.querySelector("[data-calculator]");
  if (!root) return;

  // Config injected by the page (defaults + optional local region data/scenarios).
  var CFG = window.ATLAS_CONFIG || {};
  var D = CFG.defaults || {};
  var REGION = CFG.region || null; // { name, state, slug } on state pages, else null

  // ---- Analytics ----
  // Safe wrapper around the global no-op shim defined in <head>. Always attaches
  // the page context so events are useful regardless of provider.
  function track(name, payload) {
    if (typeof window.trackAtlasEvent !== "function") return;
    var base = { page: REGION ? "state" : (location.pathname || ""), state: REGION ? REGION.slug : null };
    var p = payload || {};
    for (var k in base) if (!(k in p)) p[k] = base[k];
    window.trackAtlasEvent(name, p);
  }
  var calcUsed = false; // fire "state_page_calculator_used" only once
  function markCalcUsed() {
    if (calcUsed || !REGION) return;
    calcUsed = true;
    track("state_page_calculator_used", { state: REGION.slug, regionName: REGION.name });
  }

  var fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var fmtUSD2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  function $(sel) { return root.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function money(n) { return fmtUSD.format(Math.max(0, Math.round(n))); }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  // ---- Fields ----
  var f = {
    price: $("#price"),
    downPct: $("#downPct"),
    downAmt: $("#downAmt"),
    rate: $("#rate"),
    term: $("#term"),
    tax: $("#tax"),
    insurance: $("#insurance"),
    pmiRate: $("#pmiRate"),
    hoa: $("#hoa"),
    income: $("#income"),
    debts: $("#debts"),
    extra: $("#extra"),
  };

  // ---- Outputs ----
  var out = {
    total: $("#r-total"),
    pi: $("#r-pi"),
    tax: $("#r-tax"),
    ins: $("#r-ins"),
    pmi: $("#r-pmi"),
    hoa: $("#r-hoa"),
    loan: $("#r-loan"),
    down: $("#r-down"),
    cash: $("#r-cash"),
    totalInterest: $("#r-total-interest"),
    payoff: $("#r-payoff"),
  };

  // PMI / HOA breakdown rows can be hidden when zero.
  var rowPmi = $("#row-pmi"), rowHoa = $("#row-hoa");
  var bar = $("#stack-bar");
  var comfort = $("#comfort"), comfortLabel = $("#comfort-label"), comfortDti = $("#comfort-dti"), comfortFill = $("#comfort-fill");
  var insightsBox = $("#insights");
  var msVal = document.getElementById("ms-val");

  // Sync guards to avoid feedback loops between % and $ down payment.
  var syncing = false;

  // ---- Number tweening (lightweight, no library) ----
  // Animates result numbers between values with easeOutCubic. Interrupting a tween
  // continues from the currently displayed value, so rapid input never queues/janks.
  // Honors prefers-reduced-motion and never blocks the calculator if disabled.
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var TWEEN_MS = 320;
  var tweenState = new WeakMap(); // el -> { cur, raf }
  function flashEl(el) {
    if (REDUCED || !el) return;
    var row = el.closest ? el.closest(".breakdown-row, .stat, .result-headline") : null;
    var target = row || el;
    target.classList.remove("value-flash");
    // force reflow so the animation can retrigger on rapid changes
    void target.offsetWidth;
    target.classList.add("value-flash");
  }
  function setNum(el, value, opts) {
    if (!el) return;
    opts = opts || {};
    var live = opts.live; // aria-live element: settle announcement via aria-busy
    var st = tweenState.get(el);
    if (!st) { st = { cur: null, raf: null }; tweenState.set(el, st); }
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
    var from = st.cur == null ? value : st.cur;
    if (REDUCED || from === value || st.cur == null) {
      // Instant: initial render, no change, or reduced-motion.
      if (st.cur != null && from !== value) flashEl(el);
      st.cur = value;
      el.textContent = money(value);
      if (live) el.setAttribute("aria-busy", "false");
      return;
    }
    flashEl(el);
    if (live) el.setAttribute("aria-busy", "true");
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / TWEEN_MS);
      var v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      st.cur = v;
      el.textContent = money(v);
      if (p < 1) {
        st.raf = requestAnimationFrame(step);
      } else {
        st.cur = value;
        el.textContent = money(value);
        st.raf = null;
        if (live) el.setAttribute("aria-busy", "false"); // announce settled value
      }
    }
    st.raf = requestAnimationFrame(step);
  }

  // Persistent stack-bar segments so their widths can transition via CSS.
  var barSegs = null;
  function setStackBar(values, total) {
    if (!bar) return;
    if (!barSegs) {
      var colors = ["var(--teal-700)", "var(--clay-500)", "var(--gold-500)", "var(--ink-300)", "var(--teal-100)"];
      bar.innerHTML = colors.map(function (c) { return '<span style="width:0;background:' + c + '"></span>'; }).join("");
      barSegs = Array.prototype.slice.call(bar.querySelectorAll("span"));
    }
    for (var i = 0; i < barSegs.length; i++) {
      var w = total > 0 ? (values[i] / total * 100) : 0;
      barSegs[i].style.width = (w > 0 ? w.toFixed(2) : "0") + "%";
    }
  }

  function readState() {
    var price = num(f.price.value);
    var downPct = clamp(num(f.downPct.value), 0, 100);
    var rate = num(f.rate.value);
    var term = num(f.term.value) || 30;
    var hoa = f.hoa ? num(f.hoa.value) : 0;
    var income = f.income ? num(f.income.value) : 0;
    var debts = f.debts ? num(f.debts.value) : 0;
    var extra = f.extra ? num(f.extra.value) : 0;

    var down = price * downPct / 100;
    var loan = Math.max(0, price - down);

    // Tax & insurance: user can enter annual $ directly; blank falls back to % assumption.
    var taxAnnual = f.tax && f.tax.value !== "" ? num(f.tax.value) : price * (D.taxRatePct || 1.1) / 100;
    var insAnnual = f.insurance && f.insurance.value !== "" ? num(f.insurance.value) : price * (D.insuranceRatePct || 0.35) / 100;
    var pmiRate = f.pmiRate && f.pmiRate.value !== "" ? num(f.pmiRate.value) : (D.pmiRatePct || 0.5);

    return { price: price, downPct: downPct, down: down, loan: loan, rate: rate, term: term,
      taxAnnual: taxAnnual, insAnnual: insAnnual, pmiRate: pmiRate, hoa: hoa,
      income: income, debts: debts, extra: extra };
  }

  function monthlyPI(principal, annualRatePct, termYears) {
    var n = termYears * 12;
    var r = annualRatePct / 100 / 12;
    if (principal <= 0) return 0;
    if (r === 0) return principal / n;
    return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  }

  // Total interest over life of loan, accounting for optional extra monthly payment.
  function lifetimeInterest(principal, annualRatePct, termYears, basePI, extra) {
    var r = annualRatePct / 100 / 12;
    var pay = basePI + (extra || 0);
    if (principal <= 0) return { interest: 0, months: 0 };
    if (r === 0) { return { interest: 0, months: Math.ceil(principal / pay) }; }
    var bal = principal, interest = 0, months = 0, max = termYears * 12 + 600;
    while (bal > 0.01 && months < max) {
      var i = bal * r;
      var principalPaid = pay - i;
      if (principalPaid <= 0) { interest = Infinity; break; }
      interest += i;
      bal -= principalPaid;
      months++;
    }
    return { interest: interest, months: months };
  }

  function comfortFor(ratio) {
    // ratio = total housing payment / gross monthly income
    if (ratio <= 0.28) return { label: "Comfortable", color: "var(--comfortable)", pct: 35 };
    if (ratio <= 0.36) return { label: "Manageable", color: "var(--manageable)", pct: 60 };
    if (ratio <= 0.43) return { label: "Tight", color: "var(--tight)", pct: 82 };
    return { label: "Stretching", color: "var(--stretching)", pct: 100 };
  }

  function buildInsights(s, pi, pmi, total) {
    var tips = [];
    if (s.downPct < 20 && pmi > 0) {
      var needed = s.price * 0.2;
      tips.push("Increasing your down payment to 20% (" + money(needed) + ") may remove the estimated " + money(pmi) + "/mo PMI.");
    }
    if (s.rate >= 6.5) {
      var lower = monthlyPI(s.loan, s.rate - 1, s.term);
      tips.push("A 1% lower rate could reduce principal & interest by about " + money(pi - lower) + "/mo.");
    }
    if (s.extra > 0) {
      tips.push("Your extra " + money(s.extra) + "/mo payment shortens the loan and lowers total interest.");
    }
    tips.push("This estimate includes taxes and insurance" + (s.hoa > 0 ? ", HOA," : "") + " not just principal & interest.");
    return tips.slice(0, 3);
  }

  function render() {
    var s = readState();
    var pi = monthlyPI(s.loan, s.rate, s.term);
    var taxMo = s.taxAnnual / 12;
    var insMo = s.insAnnual / 12;
    var pmiMo = s.downPct < 20 ? s.loan * s.pmiRate / 100 / 12 : 0;
    var total = pi + taxMo + insMo + pmiMo + s.hoa;

    setNum(out.total, total, { live: true });
    setNum(out.pi, pi);
    setNum(out.tax, taxMo);
    setNum(out.ins, insMo);
    setNum(out.pmi, pmiMo);
    setNum(out.hoa, s.hoa);
    setNum(out.loan, s.loan);
    setNum(out.down, s.down);

    // Estimated cash needed = down payment + rough closing costs (3% of price).
    var closing = s.price * 0.03;
    setNum(out.cash, s.down + closing);

    var life = lifetimeInterest(s.loan, s.rate, s.term, pi, s.extra);
    if (isFinite(life.interest)) setNum(out.totalInterest, life.interest);
    else out.totalInterest.textContent = "—";
    if (out.payoff) {
      out.payoff.textContent = life.months ? (Math.floor(life.months / 12) + " yr " + (life.months % 12) + " mo") : "—";
    }

    if (rowPmi) rowPmi.classList.toggle("hidden", pmiMo <= 0);
    if (rowHoa) rowHoa.classList.toggle("hidden", s.hoa <= 0);

    // Stacked bar — persistent segments animate their widths via CSS transition.
    setStackBar([pi, taxMo, insMo, pmiMo, s.hoa], total);

    // Comfort meter (only when income provided)
    if (comfort) {
      if (s.income > 0) {
        var grossMo = s.income / 12;
        var housingRatio = total / grossMo;
        var dti = (total + s.debts) / grossMo;
        var c = comfortFor(housingRatio);
        comfort.classList.remove("hidden");
        comfortLabel.textContent = c.label;
        comfortLabel.style.color = c.color;
        comfortDti.textContent = "Housing " + Math.round(housingRatio * 100) + "% of income · Total DTI " + Math.round(dti * 100) + "%";
        comfortFill.style.width = c.pct + "%";
        comfortFill.style.background = c.color;
      } else {
        comfort.classList.add("hidden");
      }
    }

    // Insights
    if (insightsBox) {
      var tips = buildInsights(s, pi, pmiMo, total);
      insightsBox.innerHTML = tips.map(function (t) {
        return '<div class="insight"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/></svg><span>' + t + "</span></div>";
      }).join("");
    }

    if (msVal) setNum(msVal, total);
    updateUrl(s);
  }

  // ---- Down payment % <-> $ sync ----
  function syncFromPct() {
    if (syncing) return; syncing = true;
    var price = num(f.price.value);
    var pct = clamp(num(f.downPct.value), 0, 100);
    if (f.downAmt) f.downAmt.value = Math.round(price * pct / 100);
    syncing = false;
  }
  function syncFromAmt() {
    if (syncing) return; syncing = true;
    var price = num(f.price.value);
    var amt = num(f.downAmt.value);
    if (price > 0) f.downPct.value = +clamp(amt / price * 100, 0, 100).toFixed(1);
    syncing = false;
  }

  // ---- URL params (shareable scenarios) ----
  var URL_KEYS = { price: "price", downPct: "down", rate: "rate", term: "term", tax: "tax", insurance: "ins", hoa: "hoa", income: "income", debts: "debts", extra: "extra" };
  function updateUrl(s) {
    var p = new URLSearchParams();
    p.set("price", Math.round(s.price));
    p.set("down", s.downPct);
    p.set("rate", s.rate);
    p.set("term", s.term);
    if (f.tax && f.tax.value !== "") p.set("tax", Math.round(num(f.tax.value)));
    if (f.insurance && f.insurance.value !== "") p.set("ins", Math.round(num(f.insurance.value)));
    if (s.hoa) p.set("hoa", Math.round(s.hoa));
    if (s.income) p.set("income", Math.round(s.income));
    if (s.debts) p.set("debts", Math.round(s.debts));
    if (s.extra) p.set("extra", Math.round(s.extra));
    history.replaceState(null, "", location.pathname + "?" + p.toString());
  }
  function loadFromUrl() {
    var p = new URLSearchParams(location.search);
    if (![].some.call(p.keys(), function () { return true; })) return false;
    if (p.has("price")) f.price.value = p.get("price");
    if (p.has("down")) f.downPct.value = p.get("down");
    if (p.has("rate")) f.rate.value = p.get("rate");
    if (p.has("term")) f.term.value = p.get("term");
    if (p.has("tax") && f.tax) f.tax.value = p.get("tax");
    if (p.has("ins") && f.insurance) f.insurance.value = p.get("ins");
    if (p.has("hoa") && f.hoa) f.hoa.value = p.get("hoa");
    if (p.has("income") && f.income) f.income.value = p.get("income");
    if (p.has("debts") && f.debts) f.debts.value = p.get("debts");
    if (p.has("extra") && f.extra) f.extra.value = p.get("extra");
    syncFromPct();
    return true;
  }

  // ---- Scenario chips ----
  $$("[data-scenario]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var kind = chip.getAttribute("data-scenario");
      var val = chip.getAttribute("data-value");
      if (kind === "price") {
        f.price.value = val; syncFromPct();
        markActive("[data-scenario='price']", chip);
        // A price chip on a state page is a local "state example" selection.
        if (REGION) track("state_example_selected", { label: chip.textContent.trim(), value: num(val), state: REGION.slug });
        else track("scenario_chip_clicked", { type: "price", value: num(val) });
      } else if (kind === "down") {
        f.downPct.value = val; syncFromPct();
        markActive("[data-scenario='down']", chip);
        track("scenario_chip_clicked", { type: "down", value: num(val) });
      }
      markCalcUsed();
      render();
    });
  });
  function markActive(group, active) {
    $$(group).forEach(function (c) { c.classList.remove("active"); });
    active.classList.add("active");
  }

  // ---- Share / copy ----
  var shareBtn = $("#share-btn");
  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      var url = location.href;
      track("share_scenario_clicked", { url: url });
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          var t = shareBtn.textContent; shareBtn.textContent = "Link copied!";
          setTimeout(function () { shareBtn.textContent = t; }, 1600);
        });
      }
    });
  }

  // ---- Wire up live updates ----
  Object.keys(f).forEach(function (k) {
    var el = f[k];
    if (!el) return;
    el.addEventListener("input", function () {
      if (k === "downPct") syncFromPct();
      if (k === "downAmt") syncFromAmt();
      if (k === "price") syncFromPct();
      track("calculator_input_changed", { field: k });
      markCalcUsed();
      render();
    });
  });

  // ---- Advanced settings opened ----
  var adv = root.querySelector("details.advanced");
  if (adv) {
    adv.addEventListener("toggle", function () {
      if (adv.open) track("advanced_settings_opened", {});
    });
  }

  // Init
  if (!loadFromUrl()) syncFromPct();
  render();
})();
