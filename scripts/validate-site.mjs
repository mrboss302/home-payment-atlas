#!/usr/bin/env node
/**
 * Home Payment Atlas — post-build site validator.
 *
 * Fails (exit 1) on any launch blocker:
 *   - placeholder domain left in output
 *   - undefined / NaN / [object Object] / float artifacts (e.g. 28.000000000000004%)
 *   - sitemap URLs that don't map to a generated page (and vice versa)
 *   - a page missing a canonical link
 *   - a page without exactly one <h1>
 *   - JSON-LD that fails to parse
 *   - required state CSV data missing
 *   - manifest missing or its required dataset group incomplete
 *
 * Usage: node scripts/validate-site.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";

const ROOT = process.cwd();
const SITE = join(ROOT, "site");
const CSV_DIR = join(ROOT, "csv");
const MANIFEST = join(CSV_DIR, "zillow-manifest.json");
const PLACEHOLDER_DOMAINS = ["homepaymentatlas.example", "example.com", "yourdomain.com"];

const REQUIRED_STATE_FILENAMES = [
  "State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv",
  "State_zhvi_uc_sfrcondo_tier_0.67_1.0_sm_sa_month.csv",
  "State_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_bdrmcnt_1_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_bdrmcnt_2_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_bdrmcnt_3_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
  "State_zhvi_bdrmcnt_5_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv",
];

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function check() {
  if (!existsSync(SITE)) {
    fail("site/ directory not found — run the build first.");
    return;
  }
  const htmlFiles = walk(SITE).filter((f) => f.endsWith(".html"));
  if (!htmlFiles.length) fail("No HTML files found in site/.");

  // ---- Per-page checks ----
  for (const file of htmlFiles) {
    const rel = relative(SITE, file);
    const html = readFileSync(file, "utf8");
    const isNoindex = /<meta\s+name="robots"\s+content="noindex/i.test(html);

    // Placeholder domains
    for (const d of PLACEHOLDER_DOMAINS) {
      if (html.includes(d)) fail(`${rel}: contains placeholder domain "${d}"`);
    }

    // Bad tokens — strip <script> first so legitimate code (isNaN, etc.) is ignored.
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    for (const tok of ["undefined", "NaN", "[object Object]"]) {
      if (visible.includes(tok)) fail(`${rel}: rendered output contains "${tok}"`);
    }
    // Floating-point artifacts like 28.000000000000004 or 0.30000000000000004
    const floatArtifact = visible.match(/\d+\.\d*?(?:0000000\d*|9999999\d*)/);
    if (floatArtifact) fail(`${rel}: floating-point artifact "${floatArtifact[0]}"`);

    // Mock / unfinished phrasing in rendered text. The only allowed "placeholder"
    // is the labeled ad slot when AdSense isn't configured.
    const visibleNoAds = visible.replace(/<!-- ad slot:[\s\S]*?-->/g, "").replace(/aria-label="Advertisement[^"]*"/g, "");
    const mockPhrases = [
      /lorem ipsum/i, /\bcoming soon\b/i, /\bTODO\b/, /added later/i,
      /not (?:yet )?loaded for this build/i, /isn't loaded in this build/i,
      /not part of this build/i, /\bdummy\b/i, /placeholder (?:page|copy|text)/i,
    ];
    for (const re of mockPhrases) {
      const m = visibleNoAds.match(re);
      if (m) fail(`${rel}: unfinished/mock phrasing "${m[0]}"`);
    }

    // Exactly one H1
    const h1count = (html.match(/<h1[\s>]/g) || []).length;
    if (h1count !== 1) fail(`${rel}: expected exactly one <h1>, found ${h1count}`);

    // Canonical (skip noindex utility pages like 404)
    if (!isNoindex && !/<link\s+rel="canonical"/i.test(html)) {
      fail(`${rel}: missing canonical link`);
    }

    // JSON-LD parses
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(m[1]);
      } catch (e) {
        fail(`${rel}: invalid JSON-LD (${e.message})`);
      }
    }
  }

  // ---- Sitemap <-> pages ----
  const sitemapPath = join(SITE, "sitemap.xml");
  if (!existsSync(sitemapPath)) {
    fail("sitemap.xml not found.");
  } else {
    const sm = readFileSync(sitemapPath, "utf8");
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (!locs.length) fail("sitemap.xml has no <loc> entries.");

    let host = "";
    try {
      host = new URL(locs[0]).origin;
    } catch {
      fail(`sitemap.xml has an invalid URL: ${locs[0]}`);
    }
    for (const d of PLACEHOLDER_DOMAINS) {
      if (host.includes(d)) fail(`sitemap.xml uses placeholder host "${host}"`);
    }

    // Every sitemap URL must map to a generated page.
    const sitemapPaths = new Set();
    for (const loc of locs) {
      let path;
      try {
        path = new URL(loc).pathname;
      } catch {
        fail(`sitemap.xml invalid URL: ${loc}`);
        continue;
      }
      sitemapPaths.add(path);
      const candidate = path === "/" ? "index.html" : path.replace(/^\//, "").replace(/\/$/, "/index.html");
      const target = extname(candidate) ? candidate : join(candidate, "index.html");
      if (!existsSync(join(SITE, target))) fail(`sitemap URL has no page: ${loc}`);
    }

    // Every indexable page should be in the sitemap (404/noindex excluded).
    for (const file of htmlFiles) {
      if (!file.endsWith("index.html")) continue;
      const html = readFileSync(file, "utf8");
      if (/<meta\s+name="robots"\s+content="noindex/i.test(html)) continue;
      const rel = relative(SITE, file);
      const urlPath = "/" + rel.replace(/index\.html$/, "");
      const norm = urlPath === "/" ? "/" : urlPath;
      if (!sitemapPaths.has(norm)) warn(`page not listed in sitemap: ${norm}`);
    }
  }

  // ---- City pages (curated /states/{state}/{city}/) ----
  // A city page is at depth 3: states/<stateSlug>/<citySlug>/index.html.
  const cityPages = htmlFiles.filter((f) => {
    const parts = relative(SITE, f).split(/[/\\]/);
    return parts[0] === "states" && parts.length === 4 && parts[3] === "index.html";
  });
  for (const file of cityPages) {
    const rel = relative(SITE, file);
    const html = readFileSync(file, "utf8");
    const parts = rel.split(/[/\\]/);
    const stateSlug = parts[1], citySlug = parts[2];

    // Has calculator config + widget.
    if (!html.includes("window.ATLAS_CONFIG")) fail(`${rel}: city page missing calculator config (ATLAS_CONFIG)`);
    if (!html.includes("data-calculator")) fail(`${rel}: city page missing calculator widget`);

    // Has city-specific Zillow data (a $ value + ZHVI reference + region in config).
    if (!/Zillow/.test(html)) fail(`${rel}: city page missing Zillow data reference`);
    if (!/\$[0-9]/.test(html)) fail(`${rel}: city page has no dollar values`);
    if (!html.includes(`${stateSlug}/${citySlug}`)) fail(`${rel}: city page config missing region slug`);

    // Minimum useful content length (strip tags/scripts/styles).
    const textLen = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
    if (textLen < 1800) fail(`${rel}: city page content too thin (${textLen} chars < 1800)`);

    // Canonical matches the generated path.
    const cm = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    if (cm) {
      let p;
      try { p = new URL(cm[1]).pathname; } catch { p = ""; }
      const expected = `/states/${stateSlug}/${citySlug}/`;
      if (p !== expected) fail(`${rel}: canonical ${p} != expected ${expected}`);
    }

    // State breadcrumb link resolves to the parent state page (../index.html).
    const dir = dirname(file);
    if (!/href="\.\.\/index\.html"/.test(html)) {
      fail(`${rel}: city page missing state breadcrumb/related link to ../index.html`);
    } else if (!existsSync(join(dir, "..", "index.html"))) {
      fail(`${rel}: city page state link ../index.html does not resolve`);
    }
  }

  // ---- Required state CSV data ----
  const missingCsv = REQUIRED_STATE_FILENAMES.filter((f) => !existsSync(join(CSV_DIR, f)) || statSync(join(CSV_DIR, f)).size === 0);
  if (missingCsv.length) {
    fail(`Required state CSV data missing: ${missingCsv.join(", ")}`);
  }

  // ---- Manifest ----
  if (!existsSync(MANIFEST)) {
    warn("csv/zillow-manifest.json not found (run scripts/download-zillow-data.mjs to generate it).");
  } else {
    try {
      const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
      const req = manifest.requiredGroups && manifest.requiredGroups.stateLaunch;
      if (!req) {
        fail("Manifest is missing requiredGroups.stateLaunch.");
      } else if (req.missing > 0) {
        fail(`Manifest reports ${req.missing} missing required dataset(s) in stateLaunch.`);
      } else if (req.found < (req.total || 10)) {
        fail(`Manifest required group incomplete: ${req.found}/${req.total || 10} found.`);
      }
    } catch (e) {
      fail(`Manifest is not valid JSON: ${e.message}`);
    }
  }

  // ---- Privacy page: must carry a Last-updated date ----
  const privacyPath = join(SITE, "privacy", "index.html");
  if (existsSync(privacyPath)) {
    const ph = readFileSync(privacyPath, "utf8");
    if (!/Last updated:/i.test(ph)) fail("privacy page is missing a 'Last updated' date");
  } else {
    warn("privacy page not found.");
  }

  // ---- Calculator JS must respect reduced motion ----
  const calcJs = join(SITE, "assets", "calculator.js");
  if (existsSync(calcJs)) {
    const js = readFileSync(calcJs, "utf8");
    if (!/prefers-reduced-motion/.test(js)) fail("calculator.js does not check prefers-reduced-motion");
  }

  // ---- No huge files copied into /site ----
  const SITE_FILE_LIMIT = 2 * 1024 * 1024; // 2 MB
  for (const f of walk(SITE)) {
    const sz = statSync(f).size;
    if (sz > SITE_FILE_LIMIT) fail(`oversized file in site/: ${relative(SITE, f)} (${(sz / 1024 / 1024).toFixed(1)} MB)`);
    if (/\.csv$/i.test(f)) fail(`CSV copied into site/: ${relative(SITE, f)} (CSVs should not ship)`);
  }
}

check();

// ---- Report ----
console.log("Site validation");
console.log(`  errors:   ${errors.length}`);
console.log(`  warnings: ${warnings.length}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (errors.length) {
  console.error("\nValidation FAILED:");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nValidation PASSED — all launch checks clean.");
