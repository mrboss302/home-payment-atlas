/* Validate comparison math and output against fresh build artifacts.
 * Run after: node build/build.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { monthlyPI } from "../build/data.mjs";

const require = createRequire(import.meta.url);
const compare = require("../site/assets/market-compare.js");
const { payment, estimate, finite, compare: difference } = compare;

function near(actual, expected, tol = 0.015) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    "Expected " + actual + " to be within " + tol + " of " + expected);
}

near(payment(320000, 6.5, 30), monthlyPI(320000, 6.5, 30));
near(payment(320000, 0, 30), 320000 / 360);
near(payment(0, 6.5, 30), 0);
near(payment(100000, 5, 15), monthlyPI(100000, 5, 15));
assert.equal(finite("", 20, 0, 100), 20);
assert.equal(finite("abc", 20, 0, 100), 20);
assert.equal(finite(110, 20, 0, 100), 100);

const synthetic = { regionName: "Test", slug: "test", state: "TS", latestDate: "2026-09",
  taxRatePct: 1.05, homeValues: { typical: 400000, starter: 300000, condo: null } };
const standard = estimate(synthetic, { type: "typical", down: 20, rate: 6.5, term: 30 });
near(standard.loan, 320000);
near(standard.pi, 2022.617675, 0.01);
near(standard.tax, 350);
near(standard.insurance, 116.666667);
near(standard.pmi, 0);
near(standard.total, 2489.284342);
near(standard.cashToClose, 92000);
near(standard.suggestedIncome, standard.total * 12 / .28);
assert.ok(standard.stressIncrease > 0);
assert.equal(estimate(synthetic, { type: "condo" }), null);

const lowDown = estimate(synthetic, { type: "starter", down: 5, rate: 6.5, term: 30 });
near(lowDown.pmi, lowDown.loan * 0.005 / 12);
assert.ok(lowDown.cashToClose < standard.cashToClose);
const allCash = estimate(synthetic, { type: "typical", down: 100, rate: 6.5, term: 30 });
near(allCash.pi, 0);
near(allCash.pmi, 0);

const second = { ...synthetic, regionName: "Other", slug: "other", taxRatePct: 0.55 };
const other = estimate(second, { type: "typical", down: 20, rate: 6.5, term: 30 });
near(standard.total - other.total, 400000 * (1.05 - 0.55) / 1200);
near(difference(standard, other).gap, other.total - standard.total);

const data = JSON.parse(readFileSync("site/data/states.json", "utf8"));
assert.ok(data.regions?.length >= 51);
for (const region of data.regions) {
  const r = estimate(region, { type: "typical", down: 20, rate: data.defaults.rate, term: data.defaults.termYears });
  assert.ok(r && r.total > 0 && Number.isFinite(r.total), "Invalid region: " + region.regionName);
  near(r.pi, monthlyPI(r.loan, data.defaults.rate, data.defaults.termYears), 0.02);
  assert.match(r.latestDate, /^\d{4}-\d{2}$/);
}
const html = readFileSync("site/compare-markets/index.html", "utf8");
for (const id of ["compare-a", "compare-b", "compare-type", "compare-down", "compare-rate",
                  "compare-term", "compare-hoa", "compare-report", "compare-copy", "compare-summary"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing interactive control " + id);
}
assert.ok(html.includes('href="https://homepaymentatlas.com/compare-markets/"'), "Missing compare canonical");
assert.ok(existsSync("site/assets/market-compare.js"));
const sitemap = readFileSync("site/sitemap.xml", "utf8");
assert.ok(sitemap.includes("https://homepaymentatlas.com/compare-markets/"), "Tool missing from sitemap");
assert.ok(!sitemap.includes("<lastmod>"), "Sitemap should not make unsupported freshness claims");


const dataUpdates = readFileSync("site/data-updates/index.html", "utf8");
assert.match(dataUpdates, /<h1>Data updates and coverage<\/h1>/);
assert.ok(dataUpdates.includes(data.latestDate), "Data updates page should report actual source month");
assert.ok(sitemap.includes("https://homepaymentatlas.com/data-updates/"), "Data status missing from sitemap");
const maryland = readFileSync("site/states/maryland/index.html", "utf8");
assert.ok(maryland.includes("How changing interest rates affects a home in Maryland"),
  "State page needs local rate-sensitivity analysis");
assert.ok(maryland.includes("Compare Maryland"), "State page should link to comparison tool");
for (const generated of ["site/index.html", "site/states/index.html", "site/states/maryland/index.html"]) {
  assert.ok(!readFileSync(generated, "utf8").includes('class="ad-slot ad-horizontal"'),
    "Empty advertisement placeholder in " + generated);
}
const oldCity = "site/states/maryland/baltimore/index.html";
if (existsSync(oldCity) && !sitemap.includes("/states/maryland/baltimore/")) {
  const old = readFileSync(oldCity, "utf8");
  assert.match(old, /name="robots" content="noindex,follow"/,
    "City pages without fresh source data must be noindexed");
  assert.ok(old.includes("Archived city estimate"), "Archived city pages need a visible explanation");
  assert.ok(!old.includes('class="ad-slot ad-horizontal"'),
    "Archived city pages should not display empty ads");
}

console.log("Market comparison quality checks passed for", data.regions.length, "regions.");
