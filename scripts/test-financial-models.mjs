// UI-level regression for the rent-versus-buy calculator's amortization.
// No browser or network dependencies. Simulates the real page's DOM inputs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const makeElement = (value = "") => ({
  value: String(value), textContent: "", style: {},
  addEventListener() {},
  setAttribute() {},
  classList: { add() {}, remove() {} }
});

function runRentBuy(values) {
  const inputNames = ["price", "down", "rate", "term", "rent", "years",
    "appr", "rentinc", "return", "tax", "ins", "maint", "sell"];
  const ids = inputNames.map((key) => "rb-" + key).concat([
    "rb-verdict", "rb-sub", "rb-buy", "rb-rent-cost",
    "rb-breakeven", "rb-years-label", "rb-note"
  ]);
  const nodes = Object.fromEntries(ids.map((id) => [id, makeElement(values[id] ?? "")]));
  const root = { querySelector: (s) => nodes[s.slice(1)] || null };
  const document = { querySelector: (s) => s === "[data-rentbuy]" ? root : null };
  vm.runInNewContext(readFileSync("site/assets/rentbuy.js", "utf8"),
    { document, window: {}, console, Intl, Math });
  return nodes;
}

const base = {
  "rb-price": 100000, "rb-down": 20, "rb-rate": 0,
  "rb-term": 15, "rb-rent": 0, "rb-years": 30,
  "rb-appr": 0, "rb-rentinc": 0, "rb-return": 0,
  "rb-tax": 0, "rb-ins": 0, "rb-maint": 0, "rb-sell": 0
};
const fifteenYear = runRentBuy(base);
// 20k down + 3k closing + 80k scheduled principal - 100k equity = 3k.
assert.equal(fifteenYear["rb-buy"].textContent, "$3,000",
  "A paid-off 15-year mortgage must not be charged again in years 16–30");
assert.equal(fifteenYear["rb-rent-cost"].textContent, "$0");
assert.equal(fifteenYear["rb-years-label"].textContent, "30 years");

const thirtyYear = runRentBuy({ ...base, "rb-term": 30 });
assert.equal(thirtyYear["rb-buy"].textContent, "$3,000",
  "A 30-year 0%-rate mortgage should finish after 30 years");
const halfTerm = runRentBuy({ ...base, "rb-years": 15 });
assert.equal(halfTerm["rb-buy"].textContent, "$3,000",
  "Holding a paid-off property should not introduce extra mortgage charges");

const withCosts = runRentBuy({
  ...base, "rb-down": 10, "rb-rate": 6.5, "rb-term": 30,
  "rb-rent": 2200, "rb-tax": 1.1, "rb-ins": 0.35,
  "rb-maint": 1, "rb-sell": 6, "rb-return": 5
});
assert.ok(withCosts["rb-buy"].textContent.startsWith("$") ||
          withCosts["rb-buy"].textContent.startsWith("-$"),
          "Cost output should remain a currency amount");
assert.ok(!/NaN|Infinity/.test(withCosts["rb-buy"].textContent));
console.log("Rent-versus-buy payoff and UI regression checks passed.");
