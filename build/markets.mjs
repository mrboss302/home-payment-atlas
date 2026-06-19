// Curated-market data matching for Home Payment Atlas.
//
// Matches entries in build/markets.json to downloaded City ZHVI records, handling
// duplicate city names across states (match on city name + state code). Also
// reports which City datasets (tiers, housing types, bedrooms, ZORI rent) cover
// each market. This is a DATA UTILITY ONLY — it does not generate any pages.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CSV_DIR = join(process.cwd(), "csv");

// City dataset filenames (mirror the downloader's canonical names).
export const CITY_FILES = {
  typical: "City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  starter: "City_zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv",
  higher: "City_zhvi_uc_sfrcondo_tier_0.67_1.0_sm_sa_month.csv",
  singleFamily: "City_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv",
  condo: "City_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm1: "City_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm2: "City_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm3: "City_zhvi_bdrmcnt_3_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm4: "City_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  bdrm5: "City_zhvi_bdrmcnt_5_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  // ZORI rent — try seasonally adjusted first, then plain smoothed.
  rentZori: ["City_zori_uc_sfrcondomfr_sm_sa_month.csv", "City_zori_uc_sfrcondomfr_sm_month.csv"],
};

export function loadMarkets() {
  const data = JSON.parse(readFileSync(join(process.cwd(), "build", "markets.json"), "utf8"));
  return data.markets || [];
}

// Quote-aware CSV line splitter (Zillow's Metro column contains commas).
function splitCsv(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export { splitCsv };

function filePath(name) {
  return join(CSV_DIR, name);
}
function firstExisting(names) {
  const arr = Array.isArray(names) ? names : [names];
  return arr.find((n) => existsSync(filePath(n))) || null;
}

// For a City CSV (name or array of fallbacks) and a Set of RegionIDs, return a
// Map regionID -> { value, date } with the latest non-empty monthly value.
// Used by the city data layer to read actual home values / rents. Returns an
// empty Map when the file is absent (graceful degradation).
export function readLatestValues(names, idSet) {
  const resolved = firstExisting(names);
  const out = new Map();
  if (!resolved) return out;
  const lines = readFileSync(filePath(resolved), "utf8").split(/\r?\n/);
  const header = splitCsv(lines[0]);
  const idIdx = header.indexOf("RegionID");
  const dateCols = header
    .map((h, i) => ({ h, i }))
    .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.h));
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    // Cheap pre-filter on the unquoted RegionID (first field) before full parse.
    const id = lines[i].slice(0, lines[i].indexOf(","));
    if (idSet && !idSet.has(id)) continue;
    const f = splitCsv(lines[i]);
    for (let k = dateCols.length - 1; k >= 0; k--) {
      const v = f[dateCols[k].i];
      if (v !== undefined && v !== "" && !Number.isNaN(Number(v))) {
        out.set(f[idIdx], { value: Math.round(Number(v)), date: dateCols[k].h.slice(0, 7) });
        break;
      }
    }
  }
  return out;
}

// Index the base City ZHVI (all-homes mid) file: one record per city, keyed by
// "cityname|statecode". Also captures RegionID, Metro, and latest typical value.
export function readCityIndex() {
  const base = CITY_FILES.typical;
  if (!existsSync(filePath(base))) return { available: false, byKey: new Map(), records: [] };

  const text = readFileSync(filePath(base), "utf8");
  const lines = text.split(/\r?\n/);
  const header = splitCsv(lines[0]);
  const idx = {
    id: header.indexOf("RegionID"),
    name: header.indexOf("RegionName"),
    state: header.indexOf("State"),
    stateName: header.indexOf("StateName"),
    metro: header.indexOf("Metro"),
    county: header.indexOf("CountyName"),
  };
  const firstDate = header.findIndex((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));

  const byKey = new Map();
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = splitCsv(lines[i]);
    const name = f[idx.name];
    const state = f[idx.state];
    if (!name || !state) continue;
    // latest non-empty typical value
    let typical = null;
    for (let k = f.length - 1; k >= firstDate && firstDate >= 0; k--) {
      const v = f[k];
      if (v !== undefined && v !== "" && !Number.isNaN(Number(v))) { typical = Math.round(Number(v)); break; }
    }
    const rec = {
      regionID: f[idx.id],
      regionName: name,
      state,
      stateName: idx.stateName >= 0 ? f[idx.stateName] : "",
      metro: idx.metro >= 0 ? f[idx.metro] : "",
      countyName: idx.county >= 0 ? f[idx.county] : "",
      typical,
    };
    records.push(rec);
    byKey.set(`${name.toLowerCase()}|${state.toLowerCase()}`, rec);
  }
  return { available: true, byKey, records };
}

// Build a Set of RegionIDs present in a given City file (cheap first-column read).
function regionIdSet(name) {
  const resolved = firstExisting(name);
  if (!resolved) return null;
  const text = readFileSync(filePath(resolved), "utf8");
  const lines = text.split(/\r?\n/);
  const set = new Set();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const id = lines[i].slice(0, lines[i].indexOf(",")); // RegionID is numeric, unquoted
    if (id) set.add(id);
  }
  return set;
}

// Match curated markets to City ZHVI records + dataset availability.
export function matchMarkets(markets = loadMarkets()) {
  const index = readCityIndex();

  // Pre-compute RegionID coverage sets per dataset (null if the file is absent).
  const coverage = {};
  for (const [key, name] of Object.entries(CITY_FILES)) {
    coverage[key] = regionIdSet(name);
  }

  const results = markets.map((m) => {
    const rec = index.byKey.get(`${m.cityName.toLowerCase()}|${m.stateCode.toLowerCase()}`) || null;
    const id = rec ? rec.regionID : null;
    const has = (key) => (coverage[key] ? coverage[key].has(id) : false);

    const availability = rec
      ? {
          typical: has("typical"),
          starter: has("starter"),
          higher: has("higher"),
          singleFamily: has("singleFamily"),
          condo: has("condo"),
          bedrooms: { 1: has("bdrm1"), 2: has("bdrm2"), 3: has("bdrm3"), 4: has("bdrm4"), "5plus": has("bdrm5") },
          rentZori: has("rentZori"),
        }
      : null;

    return {
      market: m,
      matched: !!rec,
      record: rec,
      typicalValue: rec ? rec.typical : null,
      availability,
    };
  });

  return { indexAvailable: index.available, cityRecordCount: index.records.length, coverage, results };
}
