#!/usr/bin/env node
/**
 * Home Payment Atlas — remove large OPTIONAL expansion CSVs from /csv.
 *
 * Deletes the big City/Metro/County/ZIP/ZORI (and any payment) CSVs so they are
 * not accidentally committed. NEVER touches the required State_* launch CSVs or
 * csv/zillow-manifest.json.
 *
 * The monthly GitHub Action runs this before committing, so even though those
 * files are also .gitignore'd, the working tree stays clean and intentional.
 *
 * IMPORTANT: this only removes files from the working tree. It does NOT rewrite
 * git history — anything already committed stays in history until a one-time
 * history cleanup (git filter-repo / BFG). See README "Repository size note".
 *
 * Usage:
 *   node scripts/clean-expansion-csvs.mjs            # delete
 *   node scripts/clean-expansion-csvs.mjs --dry-run  # list only
 */

import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const CSV_DIR = join(process.cwd(), "csv");
const dryRun = process.argv.includes("--dry-run");

// Protected: never delete these.
const isProtected = (f) => /^State_.*\.csv$/i.test(f) || f === "zillow-manifest.json";

// Expansion: the large optional datasets we don't commit (mirrors .gitignore).
const isExpansion = (f) =>
  /^(City|Metro|County|Zip|Neighborhood|National|Us)_.*\.csv$/i.test(f) ||
  /_zori_.*\.csv$/i.test(f) ||
  /(mortgage_payment|total_monthly_payment).*\.csv$/i.test(f);

function main() {
  let files;
  try {
    files = readdirSync(CSV_DIR);
  } catch {
    console.log("No csv/ directory — nothing to clean.");
    return;
  }

  const toDelete = files.filter((f) => f.endsWith(".csv") && isExpansion(f) && !isProtected(f));
  let bytes = 0;
  for (const f of toDelete) {
    const p = join(CSV_DIR, f);
    try { bytes += statSync(p).size; } catch {}
    if (!dryRun) {
      try { unlinkSync(p); } catch (e) { console.warn(`  ! could not delete ${f}: ${e.message}`); }
    }
    console.log(`  ${dryRun ? "would delete" : "deleted"}: ${f}`);
  }

  const mb = (bytes / 1024 / 1024).toFixed(1);
  if (!toDelete.length) {
    console.log("No expansion CSVs present — nothing to clean.");
  } else {
    console.log(`\n${dryRun ? "Would free" : "Freed"} ${mb} MB across ${toDelete.length} expansion CSV file(s).`);
    console.log("Protected (kept): required State_*.csv + zillow-manifest.json.");
  }
}

main();
