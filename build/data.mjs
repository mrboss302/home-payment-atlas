// Data normalization layer for Home Payment Atlas
// Parses the Zillow ZHVI state-level CSVs and produces a clean, normalized
// region model. Everything downstream (pages, JSON) is generated from this.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CSV_DIR = join(process.cwd(), "csv");

// Which CSV file feeds which field in our data model.
// If a file is missing, the field is simply skipped (graceful degradation).
export const DATASETS = {
  typical: "State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  starter: "State_zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv",
  higher: "State_zhvi_uc_sfrcondo_tier_0.67_1.0_sm_sa_month.csv",
  singleFamily: "State_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv",
  condo: "State_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm1: "State_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm2: "State_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm3: "State_zhvi_bdrmcnt_3_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm4: "State_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm5: "State_zhvi_bdrmcnt_5_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
};

export const STATE_ABBR = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
  "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
  Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

// Calculation defaults used to precompute the data-model payment examples.
// The live in-browser calculator mirrors these but lets the user override them.
export const DEFAULTS = {
  rate: 6.5,            // annual %, 30-yr fixed
  termYears: 30,
  taxRatePct: 1.1,      // annual property tax as % of home value (national avg)
  insuranceRatePct: 0.35, // annual homeowners insurance as % of home value
  pmiRatePct: 0.5,      // annual PMI as % of loan when down payment < 20%
  hoaMonthly: 0,
  frontEndDti: 0.28,    // housing-cost-to-income ratio for "income needed"
};

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Minimal CSV parser (handles plain comma-separated Zillow files; no quoted commas present).
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((l) => l.split(","));
  return { header, rows };
}

// Returns { latestDate, valuesByRegion: { regionName: number } } for one file.
function loadDataset(file) {
  const path = join(CSV_DIR, file);
  if (!existsSync(path)) return null;
  const { header, rows } = parseCsv(readFileSync(path, "utf8"));
  const nameIdx = header.indexOf("RegionName");
  // Date columns are everything matching YYYY-MM-DD.
  const dateCols = header
    .map((h, i) => ({ h, i }))
    .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.h));

  const valuesByRegion = {};
  let latestDate = null;

  for (const row of rows) {
    const name = row[nameIdx];
    if (!name) continue;
    // Walk backwards to the latest non-empty value for this region.
    for (let k = dateCols.length - 1; k >= 0; k--) {
      const raw = row[dateCols[k].i];
      if (raw !== undefined && raw !== "" && !Number.isNaN(Number(raw))) {
        valuesByRegion[name] = Math.round(Number(raw));
        const ym = dateCols[k].h.slice(0, 7);
        if (!latestDate || ym > latestDate) latestDate = ym;
        break;
      }
    }
  }
  return { latestDate, valuesByRegion };
}

// Standard fixed-rate amortization: monthly principal & interest.
export function monthlyPI(principal, annualRatePct, termYears) {
  const n = termYears * 12;
  const r = annualRatePct / 100 / 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Total monthly cost (PI + tax + insurance + PMI) for a given % down.
// `taxRatePct` lets state pages apply a state-specific property-tax assumption.
export function totalMonthly(homeValue, downPct, taxRatePct = DEFAULTS.taxRatePct) {
  const loan = homeValue * (1 - downPct / 100);
  const pi = monthlyPI(loan, DEFAULTS.rate, DEFAULTS.termYears);
  const tax = (homeValue * taxRatePct) / 100 / 12;
  const ins = (homeValue * DEFAULTS.insuranceRatePct) / 100 / 12;
  const pmi = downPct < 20 ? (loan * DEFAULTS.pmiRatePct) / 100 / 12 : 0;
  return { pi: Math.round(pi), total: Math.round(pi + tax + ins + pmi) };
}

export function incomeNeeded(homeValue, downPct = 20, taxRatePct = DEFAULTS.taxRatePct) {
  const { total } = totalMonthly(homeValue, downPct, taxRatePct);
  return Math.round((total * 12) / DEFAULTS.frontEndDti);
}

// State-specific property-tax defaults (graceful fallback to the national default).
function loadStateTax() {
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "build", "state-tax.json"), "utf8"));
    return { rates: cfg.rates || {}, fallback: (cfg._meta && cfg._meta.fallback) || DEFAULTS.taxRatePct, meta: cfg._meta || {} };
  } catch {
    return { rates: {}, fallback: DEFAULTS.taxRatePct, meta: {} };
  }
}

// Build the normalized region records. Detected datasets are reported too.
export function buildRegions() {
  const loaded = {};
  const detected = {};
  for (const [key, file] of Object.entries(DATASETS)) {
    const ds = loadDataset(file);
    loaded[key] = ds;
    detected[key] = { file, found: !!ds };
  }

  const typical = loaded.typical;
  if (!typical) throw new Error("Typical home value dataset is required but missing.");

  const regionNames = Object.keys(typical.valuesByRegion).sort();
  const latestDate = Object.values(loaded)
    .filter(Boolean)
    .map((d) => d.latestDate)
    .sort()
    .pop();

  const val = (key, name) =>
    loaded[key] && loaded[key].valuesByRegion[name] != null
      ? loaded[key].valuesByRegion[name]
      : null;

  const stateTax = loadStateTax();

  // National reference: median of state typical values, for relative comparisons.
  const allTypical = regionNames
    .map((n) => val("typical", n))
    .filter((v) => v != null)
    .sort((a, b) => a - b);
  const nationalTypical = allTypical[Math.floor(allTypical.length / 2)];
  // Rank states by typical value (1 = most expensive) for varied copy.
  const rankByValue = {};
  regionNames
    .slice()
    .sort((a, b) => (val("typical", b) || 0) - (val("typical", a) || 0))
    .forEach((n, i) => { rankByValue[n] = i + 1; });

  const regions = regionNames.map((name) => {
    const homeValues = {
      starter: val("starter", name),
      typical: val("typical", name),
      higher: val("higher", name),
      singleFamily: val("singleFamily", name),
      condo: val("condo", name),
      bedrooms: {
        1: val("bdrm1", name),
        2: val("bdrm2", name),
        3: val("bdrm3", name),
        4: val("bdrm4", name),
        "5plus": val("bdrm5", name),
      },
    };

    const abbr = STATE_ABBR[name] || "";
    const taxRatePct =
      stateTax.rates[abbr] != null ? stateTax.rates[abbr] : stateTax.fallback;

    const tv = homeValues.typical;
    const payments = {
      monthly20Down: totalMonthly(tv, 20, taxRatePct).pi,
      monthly10Down: totalMonthly(tv, 10, taxRatePct).pi,
      monthly5Down: totalMonthly(tv, 5, taxRatePct).pi,
      totalMonthly20Down: totalMonthly(tv, 20, taxRatePct).total,
      totalMonthly10Down: totalMonthly(tv, 10, taxRatePct).total,
      totalMonthly5Down: totalMonthly(tv, 5, taxRatePct).total,
    };

    // Relative-affordability descriptors give each state page some non-templated flavor.
    const vsNational = tv && nationalTypical ? tv / nationalTypical : 1;
    let affordabilityTier;
    if (vsNational >= 1.4) affordabilityTier = "one of the higher-priced housing markets";
    else if (vsNational >= 1.1) affordabilityTier = "an above-average housing market";
    else if (vsNational >= 0.9) affordabilityTier = "a mid-range housing market";
    else if (vsNational >= 0.7) affordabilityTier = "a relatively affordable housing market";
    else affordabilityTier = "one of the more affordable housing markets";

    // Spread between condo and single-family, and the bedroom ladder, for local detail.
    const sfrCondoGap =
      homeValues.singleFamily && homeValues.condo
        ? Math.round(((homeValues.singleFamily - homeValues.condo) / homeValues.condo) * 100)
        : null;

    return {
      regionType: "state",
      regionName: name,
      state: abbr,
      slug: slugify(name),
      latestDate,
      taxRatePct,
      taxIsStateSpecific: stateTax.rates[abbr] != null,
      homeValues,
      payments,
      incomeNeededTypical: incomeNeeded(tv, 20, taxRatePct),
      rent: null, // No ZORI/rent dataset available in this project.
      context: {
        nationalTypical,
        vsNationalPct: Math.round((vsNational - 1) * 100),
        affordabilityTier,
        rank: rankByValue[name],
        totalStates: regionNames.length,
        sfrCondoGap,
      },
    };
  });

  return { regions, latestDate, detected, defaults: DEFAULTS, stateTaxMeta: stateTax.meta };
}
