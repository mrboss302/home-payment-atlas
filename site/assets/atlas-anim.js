/* Home Payment Atlas — shared number-tween helper for all calculators.
 * Animates currency values with easeOutCubic, interruption-safe (continues from
 * the displayed value), honors prefers-reduced-motion, and toggles aria-busy on
 * live regions so screen readers announce the settled value once. No dependencies.
 * Exposes window.AtlasAnim = { num, money, flash, reduced }. */
(function () {
  "use strict";
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var state = new WeakMap(); // el -> { cur, raf }

  function money(n) { return fmt.format(Math.round(n)); }

  function flash(el) {
    if (REDUCED || !el) return;
    var t = el.closest ? (el.closest(".stat, .breakdown-row, .result-headline") || el) : el;
    t.classList.remove("value-flash");
    void t.offsetWidth; // reflow so the animation retriggers on rapid changes
    t.classList.add("value-flash");
  }

  function num(el, value, opts) {
    if (!el) return;
    opts = opts || {};
    if (!isFinite(value)) { el.textContent = "—"; return; }
    var st = state.get(el);
    if (!st) { st = { cur: null, raf: null }; state.set(el, st); }
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
    var from = st.cur == null ? value : st.cur;
    if (REDUCED || from === value || st.cur == null) {
      if (st.cur != null && from !== value) flash(el);
      st.cur = value;
      el.textContent = money(value);
      if (opts.live) el.setAttribute("aria-busy", "false");
      return;
    }
    flash(el);
    if (opts.live) el.setAttribute("aria-busy", "true");
    var start = null, dur = opts.duration || 320;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      st.cur = v;
      el.textContent = money(v);
      if (p < 1) { st.raf = requestAnimationFrame(step); }
      else { st.cur = value; el.textContent = money(value); st.raf = null; if (opts.live) el.setAttribute("aria-busy", "false"); }
    }
    st.raf = requestAnimationFrame(step);
  }

  window.AtlasAnim = { num: num, money: money, flash: flash, reduced: REDUCED };
})();
