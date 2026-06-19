#!/usr/bin/env node
/**
 * Home Payment Atlas — curated market coverage report.
 *
 * Prints how the curated markets in build/markets.json line up with the
 * downloaded City ZHVI data, and which datasets are available per market.
 * Does NOT generate any pages — it informs the staged city/metro rollout.
 *
 * Usage:
 *   node build/report-markets.mjs        # run an expansion download first:
 *                                         #   node scripts/download-zillow-data.mjs --all
 */

import { loadMarkets, matchMarkets } from "./markets.mjs";

const money = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const yn = (b) => (b ? "✓" : "·");

function main() {
  const markets = loadMarkets();
  const { indexAvailable, cityRecordCount, results } = matchMarkets(markets);

  console.log("Home Payment Atlas — curated market coverage\n");

  if (!indexAvailable) {
    console.log("City ZHVI data is not present in /csv.");
    console.log("Run an expansion download first:");
    console.log("  node scripts/download-zillow-data.mjs --all   (or --expansion)\n");
    console.log(`Curated markets defined: ${markets.length}`);
    process.exit(0);
  }

  const matched = results.filter((r) => r.matched);
  const missing = results.filter((r) => !r.matched);

  console.log(`Curated markets defined : ${markets.length}`);
  console.log(`City ZHVI records loaded: ${cityRecordCount.toLocaleString("en-US")}`);
  console.log(`Matched to City ZHVI    : ${matched.length}`);
  console.log(`Missing from City ZHVI  : ${missing.length}`);
  console.log(`Match rate              : ${Math.round((matched.length / markets.length) * 100)}%\n`);

  // Per-market dataset availability table.
  console.log("Dataset availability per matched market");
  console.log("  (Typ=typical Sta=starter Hi=higher SF=single-family Cn=condo  Beds=1/2/3/4/5+  Rent=ZORI)\n");
  const head =
    "  " + "Market".padEnd(26) + "Typical".padStart(10) + "  Typ Sta Hi  SF  Cn   Beds(1-5+)  Rent";
  console.log(head);
  console.log("  " + "-".repeat(head.length - 2));
  for (const r of matched.sort((a, b) => a.market.priority - b.market.priority)) {
    const a = r.availability;
    const beds = `${yn(a.bedrooms[1])}${yn(a.bedrooms[2])}${yn(a.bedrooms[3])}${yn(a.bedrooms[4])}${yn(a.bedrooms["5plus"])}`;
    const label = `${r.market.cityName}, ${r.market.stateCode}`;
    console.log(
      "  " +
        label.padEnd(26) +
        money(r.typicalValue).padStart(10) +
        "   " + yn(a.typical) + "   " + yn(a.starter) + "  " + yn(a.higher) +
        "   " + yn(a.singleFamily) + "   " + yn(a.condo) +
        "    " + beds + "      " + yn(a.rentZori)
    );
  }

  if (missing.length) {
    console.log("\nMissing from City ZHVI (no matching city record):");
    for (const r of missing) console.log(`  · ${r.market.cityName}, ${r.market.stateCode}`);
  }

  // Recommended first pages: matched, priority 1, with full ZHVI coverage.
  const ready = matched
    .filter((r) => r.market.priority === 1 && r.availability.typical && r.availability.starter && r.availability.higher)
    .sort((a, b) => (b.typicalValue || 0) - (a.typicalValue || 0));

  console.log(`\nRecommended first city pages to generate (priority 1, full tier coverage): ${ready.length}`);
  for (const r of ready) {
    console.log(`  → ${r.market.intendedUrl}   ${r.market.cityName}, ${r.market.stateCode}  (typical ${money(r.typicalValue)}${r.availability.rentZori ? ", rent available" : ""})`);
  }

  const rentReady = matched.filter((r) => r.availability && r.availability.rentZori).length;
  console.log(`\nMarkets with rent (ZORI) data for rent-vs-buy: ${rentReady}/${matched.length}`);
  console.log("\nNote: city/metro pages are intentionally NOT generated yet — this is a staged,");
  console.log("quality-first rollout to avoid thin or excessive pages.");
}

main();
