// City data normalization layer for Home Payment Atlas.
//
// Reads City ZHVI + City ZORI CSVs (when present) and produces normalized records
// for the CURATED priority-1 markets only. Gracefully returns an empty set when
// city data isn't downloaded, so the state-only build never breaks.

import { DEFAULTS, totalMonthly, incomeNeeded, slugify } from "./data.mjs";
import { loadMarkets, readCityIndex, readLatestValues, CITY_FILES } from "./markets.mjs";

// Build normalized city records for priority-1 markets that have a ZHVI typical.
// `regions` = the normalized state records (for tax rate + comparisons).
export function buildCities(regions) {
  const markets = loadMarkets();
  const p1 = markets.filter((m) => m.priority === 1);
  const index = readCityIndex();

  const stateBySlug = new Map(regions.map((r) => [r.slug, r]));
  const nationalTypical = regions[0] && regions[0].context ? regions[0].context.nationalTypical : null;

  const skipped = [];
  if (!index.available) {
    // City data not present — skip all, but record why.
    for (const m of p1) skipped.push({ market: m, reason: "city ZHVI data not downloaded" });
    return { available: false, cities: [], skipped, rentCoverage: 0 };
  }

  // Resolve each priority-1 market to its city record (city name + state code).
  const matched = [];
  for (const m of p1) {
    const rec = index.byKey.get(`${m.cityName.toLowerCase()}|${m.stateCode.toLowerCase()}`);
    if (!rec) {
      skipped.push({ market: m, reason: "no unambiguous City ZHVI match" });
    } else if (rec.typical == null) {
      skipped.push({ market: m, reason: "City ZHVI typical value missing" });
    } else {
      matched.push({ market: m, rec });
    }
  }

  // Read latest values for the matched cities across every City dataset, once.
  const ids = new Set(matched.map((x) => x.rec.regionID));
  const vals = {
    typical: readLatestValues(CITY_FILES.typical, ids),
    starter: readLatestValues(CITY_FILES.starter, ids),
    higher: readLatestValues(CITY_FILES.higher, ids),
    singleFamily: readLatestValues(CITY_FILES.singleFamily, ids),
    condo: readLatestValues(CITY_FILES.condo, ids),
    bdrm1: readLatestValues(CITY_FILES.bdrm1, ids),
    bdrm2: readLatestValues(CITY_FILES.bdrm2, ids),
    bdrm3: readLatestValues(CITY_FILES.bdrm3, ids),
    bdrm4: readLatestValues(CITY_FILES.bdrm4, ids),
    bdrm5: readLatestValues(CITY_FILES.bdrm5, ids),
    rent: readLatestValues(CITY_FILES.rentZori, ids),
  };
  const get = (set, id) => (vals[set].has(id) ? vals[set].get(id).value : null);
  const getDate = (set, id) => (vals[set].has(id) ? vals[set].get(id).date : null);

  let rentCoverage = 0;
  const cities = matched.map(({ market: m, rec }) => {
    const id = rec.regionID;
    const state = stateBySlug.get(m.stateSlug) || null;
    const taxRatePct = state ? state.taxRatePct : DEFAULTS.taxRatePct;

    const homeValues = {
      starter: get("starter", id),
      typical: get("typical", id),
      higher: get("higher", id),
      singleFamily: get("singleFamily", id),
      condo: get("condo", id),
      bedrooms: {
        1: get("bdrm1", id),
        2: get("bdrm2", id),
        3: get("bdrm3", id),
        4: get("bdrm4", id),
        "5plus": get("bdrm5", id),
      },
    };
    const tv = homeValues.typical;

    const rentVal = get("rent", id);
    if (rentVal) rentCoverage++;
    const rent = { typicalRent: rentVal, latestRentDate: getDate("rent", id) };

    const payments = {
      monthly20Down: totalMonthly(tv, 20, taxRatePct).pi,
      monthly10Down: totalMonthly(tv, 10, taxRatePct).pi,
      monthly5Down: totalMonthly(tv, 5, taxRatePct).pi,
      totalMonthly20Down: totalMonthly(tv, 20, taxRatePct).total,
      totalMonthly10Down: totalMonthly(tv, 10, taxRatePct).total,
      totalMonthly5Down: totalMonthly(tv, 5, taxRatePct).total,
    };

    // Comparisons that make each page data-driven and distinct.
    const stateTypical = state ? state.homeValues.typical : null;
    const vsStatePct = stateTypical ? Math.round((tv / stateTypical - 1) * 100) : null;
    const vsNationalPct = nationalTypical ? Math.round((tv / nationalTypical - 1) * 100) : null;
    const sfrCondoGap =
      homeValues.singleFamily && homeValues.condo
        ? Math.round((homeValues.singleFamily - homeValues.condo) / homeValues.condo * 100)
        : null;

    return {
      regionType: "city",
      cityName: m.cityName,
      stateName: state ? state.regionName : m.stateName,
      stateCode: m.stateCode,
      citySlug: m.citySlug,
      stateSlug: m.stateSlug,
      zillowRegionId: id,
      metroName: rec.metro || m.metroName || null,
      countyName: rec.countyName || null,
      latestDate: getDate("typical", id),
      priority: m.priority,
      intendedUrl: m.intendedUrl,
      homeValues,
      rent,
      payments,
      incomeNeededTypical: incomeNeeded(tv, 20, taxRatePct),
      taxRatePct,
      taxIsStateSpecific: state ? state.taxIsStateSpecific : false,
      comparisons: { stateTypical, vsStatePct, nationalTypical, vsNationalPct, sfrCondoGap },
      sourceNotes:
        "Home values: Zillow Research City ZHVI (smoothed, seasonally adjusted). " +
        (rentVal ? "Rent: Zillow Research City ZORI. " : "") +
        "Payments, income, taxes, PMI and closing costs are calculated estimates.",
    };
  });

  // Stable order: by state then city.
  cities.sort((a, b) => a.stateSlug.localeCompare(b.stateSlug) || a.cityName.localeCompare(b.cityName));
  return { available: true, cities, skipped, rentCoverage };
}
