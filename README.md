# Home Payment Atlas

> Know the monthly cost before you tour the house.

A premium, fast, SEO-friendly mortgage-calculator network built as a **static site**
generated from Zillow Research home-value data. No backend, no build tooling beyond
Node — the calculator runs entirely in the browser.

---

## Quick start

You need **Node 18+** (tested on Node 22). No dependencies to install.

```bash
# 1. Generate the site from the CSVs (writes everything into ./site)
node build/build.mjs

# Set the public domain so canonicals, OG tags, sitemap & JSON-LD are correct:
SITE_URL=https://www.yourdomain.com node build/build.mjs

# 2. Preview locally
node build/server.mjs
# → open http://localhost:4178
```

`SITE_URL` is the single source of truth for the public origin (defaults to the
apex `https://homepaymentatlas.com`). It feeds every canonical link, `og:url`,
sitemap entry, `robots.txt` line, and JSON-LD URL — set it once at build time.

Any static file server works (`site/` is fully static). The Node server above is
included only for convenience and uses no external packages.

To deploy, upload the **contents of `site/`** (not the folder itself) to the
host's web root, so `index.html`, `sitemap.xml`, `robots.txt`, `ads.txt`,
`favicon.svg` and `site.webmanifest` all sit at the domain root. Then:

- Configure the host to serve `/404.html` for unknown paths.
- **Canonical host is the apex** `https://homepaymentatlas.com` (the default
  `SITE_URL`). Set a **301 redirect from `www.` → apex** at the host/DNS level so
  there's one canonical host (or flip `SITE_URL` to www and redirect the other way).
- **AdSense:** the publisher ID (`ca-pub-3840656918521680`) is set in
  `build/templates.mjs` (`ADS.clientId`), which emits the loader and a root
  `ads.txt`. Individual ad units stay tasteful placeholders until you create ad
  units in the AdSense dashboard and pass their numeric slot IDs, e.g.
  `ADSENSE_SLOT_HORIZONTAL=1234567890 ADSENSE_SLOT_LOWER=… node build/build.mjs`.

---

## Deployment checklist

Run through this before and after going live:

1. **Set `SITE_URL`** to your real domain and rebuild:
   `SITE_URL=https://www.yourdomain.com node build/build.mjs`
2. **Rebuild the site** so every canonical, OG tag, sitemap entry, and JSON-LD URL
   uses that domain (re-run the command above any time content or config changes).
3. **Deploy the static `/site` folder** to your host. Point the host's 404 handler
   at `/404.html`. Ensure `/assets/*` is served with long cache headers.
4. **Verify canonical URLs** — view-source on a few pages and confirm
   `<link rel="canonical">` and `og:url` point to `https://www.yourdomain.com/...`
   (no placeholder, no trailing `index.html`).
5. **Submit the sitemap to Google Search Console** — add the property, then submit
   `https://www.yourdomain.com/sitemap.xml`. Request indexing for key pages.
6. **Configure `robots.txt`** — it's generated at `/robots.txt`, allows full crawl,
   and references the sitemap on your configured host. Confirm it's reachable.
7. **Test mobile pages** — load the homepage, calculator, and a state page on a
   phone (or device emulation). Check the sticky bottom payment summary, the
   collapsing nav, and tap targets.
8. **Test calculator share URLs** — set up a scenario, click *Copy / share
   scenario*, open the copied link in a fresh tab, and confirm every input
   (price, down %, rate, term, income, etc.) is restored from the URL.

Optional but recommended:
- Provide a real **1200×630 PNG** at `/assets/og-image.svg`'s path (see below).
- Wire **analytics** and/or **AdSense** (see the two sections below).
- **TODO before launch:** confirm the privacy contact inbox `privacy@homepaymentatlas.com`
  (set in `build/build.mjs` as `PRIVACY_CONTACT`) is actually monitored, or change it to a
  real address. Update `PRIVACY_LAST_UPDATED` whenever the privacy policy wording changes.

---

## Analytics (provider-agnostic)

Every page defines a safe global early in `<head>`:

```js
window.trackAtlasEvent(eventName, payload) // no-ops if no provider is installed
```

It always pushes to `window.atlasDataLayer` and, if present, forwards to
`window.gtag` (GA4) or `window.plausible`. To connect a provider, just add its
snippet — no code changes needed. Events emitted by the calculator:

| Event | When |
|---|---|
| `calculator_input_changed` | any input edited (payload: `field`) |
| `scenario_chip_clicked` | a 5/10/20% down or generic price chip clicked |
| `state_example_selected` | a local price chip clicked on a state page |
| `share_scenario_clicked` | the Copy / share button clicked |
| `advanced_settings_opened` | the advanced `<details>` expanded |
| `state_page_calculator_used` | first interaction on a state-page calculator (once) |

Each payload also carries `page` and `state` context automatically.

## Advertising (AdSense-ready, off by default)

Ad slots render as **tasteful labeled placeholders** until you configure AdSense.
All ad config lives in one place — the `ADS` object in `build/templates.mjs`,
driven by environment variables:

```bash
ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX \
ADSENSE_SLOT_HORIZONTAL=1111111111 \
ADSENSE_SLOT_SIDEBAR=2222222222 \
ADSENSE_SLOT_LOWER=3333333333 \
node build/build.mjs
```

With a valid `ca-pub-...` client ID, the build injects the AdSense loader and
turns each slot into a responsive `<ins class="adsbygoogle">` unit. With no ID,
placeholders stay. **Ad placement rules are enforced by design:** no ad appears
above the primary calculator, between the inputs and the result card, inside the
form, or disguised as navigation/CTA buttons.

## Social preview image

`og:image` / `twitter:image` reference `/assets/og-image.svg`, a branded
1200×630 card generated by the build. SVG works as a placeholder; for best
rendering across platforms (some don't accept SVG OG images), replace that file
with a **1200×630 PNG** at the same path before launch.

### State-specific property tax

`build/state-tax.json` holds an approximate effective property-tax rate per state
(annual % of home value). State pages prefill their own rate (e.g. Texas 1.68%,
California 0.71%) instead of one national number; states without an entry fall back
to the national default. Edit that file to refine the rates — the calculator,
payment tables, and "income needed" figures all pick it up on the next build.
These are planning estimates only; county/city rates, exemptions, and assessments
vary, so users are advised to enter their own local figure.

---

## Project structure

```
csv/                     # Zillow CSV data (input) + zillow-manifest.json
build/
  data.mjs               # CSV parsing + normalization layer
  templates.mjs          # HTML building blocks (layout, calculator widget, FAQ, ads)
  build.mjs              # Composes & writes every page
  server.mjs             # Minimal static preview server
  state-tax.json         # Per-state property-tax defaults
scripts/
  download-zillow-data.mjs  # Robust Zillow data refresher (writes csv/ + manifest)
  validate-site.mjs         # Post-build launch validator
.github/workflows/
  deploy.yml                # Build + deploy to GitHub Pages (+ monthly data refresh)
site/                    # Generated output (deployable)
  index.html             # Homepage
  mortgage-calculator/   # Main calculator
  states/                # /states/ index + 51 state pages
  methodology/ privacy/ about/ examples/
  rent-vs-buy-calculator/ pmi-calculator/ closing-cost-calculator/ refinance-calculator/
  mortgage-on-300k-house/ income-needed-for-400k-house/   # SEO scenario page examples
  assets/styles.css      # Design system (hand-written, not generated)
  assets/calculator.js   # Calculator engine (hand-written, not generated)
  data/states.json       # Normalized data model (emitted by the build)
  sitemap.xml robots.txt
```

Regenerating is idempotent: edit a CSV (or the templates) and re-run `node build/build.mjs`.

---

## Automated Zillow data refresh

Home values come from [Zillow Research](https://www.zillow.com/research/data/), which
updates around the **16th of each month** and occasionally changes its CSV download
paths. Rather than hard-code URLs, the refresher **fetches the research data page,
extracts the current CSV links, classifies them by filename, and downloads what we
need** — deriving tier/housing-type/bedroom variants from the discovered directory so
it keeps working even if Zillow reorganizes paths.

### Downloader modes

The downloader fetches different dataset groups depending on the mode flag:

| Mode | Downloads | Size | Use for |
|---|---|---|---|
| `--state-only` *(default)* | required state launch CSVs only | ~a few MB | CI, normal refreshes |
| `--expansion` | optional City/Metro/ZORI/payment only (state reused from disk) | ~600 MB | one-time local expansion pull |
| `--all` | everything | ~600 MB | full local refresh |

**The default (no flag) is `--state-only`** — the safe, CI-friendly choice that never
pulls the large expansion datasets. The GitHub Action passes `--state-only` explicitly.

### Run locally

```bash
# 1a. Normal refresh (state launch data only — small, safe)
node scripts/download-zillow-data.mjs --state-only

# 1b. One-time FULL expansion pull (City/Metro/ZORI — ~600 MB, local only)
node scripts/download-zillow-data.mjs --all

# 2. Rebuild the static site with the fresh data
SITE_URL=https://homepaymentatlas.com node build/build.mjs

# 3. Validate the output
node scripts/validate-site.mjs

# 4. Check curated city/metro coverage (needs an --all/--expansion pull first)
node build/report-markets.mjs

# 5. Remove the large expansion CSVs when done (keeps state CSVs + manifest)
node scripts/clean-expansion-csvs.mjs        # add --dry-run to preview
```

Handy flags / env:
- `node scripts/download-zillow-data.mjs --classify-test` — print how the classifier
  reads a set of sample filenames (no network); use this to debug if Zillow renames files.
- `ZILLOW_PAGE_HTML=/path/to/saved.html` — classify against a saved copy of the page
  instead of fetching it live.
- `ZILLOW_REQUEST_DELAY_MS=500` — politeness gap between requests (raise if throttled).

### How the GitHub Action works (build + deploy to GitHub Pages)

`.github/workflows/deploy.yml` builds the site and deploys it to **GitHub Pages**
(Node 22, `SITE_URL=https://homepaymentatlas.com`). It runs:

- **On push to `main`** and **manually** (`workflow_dispatch`): build from the
  committed data → validate → deploy.
- **Monthly (06:00 UTC on the 17th**, after Zillow's ~16th update): also runs
  `download-zillow-data.mjs --state-only` first, then builds, validates, commits the
  refreshed `csv/State_*.csv` + `zillow-manifest.json` back to the repo, and deploys.

It writes a `CNAME` (`homepaymentatlas.com`) into the artifact, runs
`clean-expansion-csvs.mjs` before committing so the ~600 MB expansion CSVs are never
committed, and uses `permissions: contents: write, pages: write, id-token: write`.

**One-time GitHub setup:** repo **Settings → Pages → Source: GitHub Actions**; set the
**custom domain** to `homepaymentatlas.com`; point DNS apex `A`/`AAAA` records at
GitHub Pages and add a `www` CNAME (GitHub redirects www → apex); enable **Enforce
HTTPS**. See the deploy walkthrough below.

### Required vs optional datasets

- **Required (group A — `stateLaunch`):** the 10 state-level ZHVI files powering the
  current site — all-homes mid/bottom/top tier, single-family, condo, and 1–5+ bedroom
  (mid-tier, smoothed seasonally adjusted). **If any are missing the script exits
  non-zero** and the workflow fails (no bad commit). If a refresh fails but valid copies
  already exist in `/csv`, those are reused so a transient Zillow hiccup never blocks a build.
- **Optional (expansion, never fail):**
  - **B — City ZHVI**, **C — Metro ZHVI** (same cuts as state),
  - **D — Rent / ZORI** (City, Metro, County, ZIP; all-homes+MF, plus derived
    single-family / multifamily / seasonally-adjusted variants),
  - **E — Payment datasets** (Mortgage Payment & Total Monthly Payment at 20/10/5% down).
  Missing optional data is **logged as a warning** and listed in the manifest — it never
  fails the build.

### The manifest

Every run writes **`csv/zillow-manifest.json`**: an ISO timestamp, the source page, the
discovered-link count, per-group results (`requiredGroups` / `optionalGroups` with
found/missing counts), a `files[]` array (each with full classification — geography,
metric, housing type, tier, bedrooms, smoothing, down payment, group, required flag),
a `summary`, and `warnings`. The build reads it (if present) and prints which data
groups are available; `build/build.mjs` also records a `dataGroups` summary into
`site/data/states.json`.

### Repository size protection (what's tracked vs ignored)

A full refresh writes **~630 MB into `/csv`** (City ZHVI and ZIP/City ZORI files are
tens of MB each); the required state files are only a few MB. Committing the expansion
files monthly would bloat git history irreversibly, so the policy is:

- **Tracked in git:** `csv/State_*.csv` (required launch data) + `csv/zillow-manifest.json`.
- **Ignored** (see `.gitignore`): City / Metro / County / ZIP / Neighborhood ZHVI, all
  `*_zori_*` rent files, and any large payment CSVs. The manifest still records their
  URLs, so they're re-fetchable on demand.

Two layers enforce this:
1. **`.gitignore`** keeps new expansion CSVs out of commits.
2. **`scripts/clean-expansion-csvs.mjs`** deletes them from the working tree (the
   monthly Action runs it before committing). It never touches `State_*.csv` or the
   manifest. `--dry-run` previews what it would remove.

> ⚠️ **Deleting files does not shrink git history.** `.gitignore` and the cleanup
> script only keep *new* versions out and tidy the *working tree* — they do **not**
> remove versions already committed. If large CSVs were ever committed, shrinking the
> repo requires a **one-time history rewrite** with
> [`git filter-repo`](https://github.com/newren/git-filter-repo) or
> [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/), followed by a
> force-push. This project does **not** perform history rewriting automatically — do it
> deliberately. (If you'd rather keep committing the big files, use **Git LFS** for
> `csv/*.csv` instead.)

### Curated city/metro expansion (staged, not generated yet)

City/metro pages are **intentionally not generated yet** — a quality-first rollout
avoids thin or excessive pages. The staged plan lives in two files:

- **`build/markets.json`** — a curated list of 25 launch markets (city, state, slugs,
  priority, intended URL, optional metro hints).
- **`build/markets.mjs`** — a data-matching utility that maps each market to its City
  ZHVI record (matching on **city name + state code**, so duplicate city names across
  states resolve correctly) and reports per-market dataset availability.

Check coverage anytime (after an `--all`/`--expansion` pull):

```bash
node build/report-markets.mjs
```

It prints the curated total, matched vs missing markets, a per-market availability
grid (typical / starter / higher / single-family / condo / 1–5+ bedroom / rent), and a
**recommended first set of pages to generate** (priority-1 markets with full tier
coverage). When we build city pages, this report decides what ships first.

### When city / metro / rent / payment data gets used

These are downloaded and classified now but **not yet rendered** (the site stays
state-only for this pass). The manifest exposes them so future work can:
- generate **`/states/{state}/{city}/`** and metro pages from City/Metro ZHVI,
- power **rent-vs-buy** pages from ZORI,
- cross-check the calculator against Zillow's own payment datasets.

### If Zillow changes its page structure or CSV paths

The downloader is resilient by design, but if Zillow makes a breaking change:
1. Run `node scripts/download-zillow-data.mjs --classify-test` and, if filenames changed,
   adjust the token patterns in the `classify()` function.
2. If the **directory** moved, no change is usually needed — URLs are derived from the
   discovered link's directory. If the page stops listing a metric entirely, that
   metric's directory can't be derived; add a known representative link or update the
   extraction regex (`extractCsvLinks`) which currently matches
   `files.zillowstatic.com/research/public_csvs/…csv`.
3. If a **required** state file truly disappears, the script fails loudly (by design) and
   the last good `/csv` copies remain in place for the build.

---

## CSV files used & datasets detected

All 10 CSVs in `csv/` were parsed. Each is Zillow **ZHVI** (Home Value Index),
state level, smoothed & seasonally adjusted, monthly columns 2000-01 → 2026-05.
The build extracts the **latest non-empty month per region** (currently **2026-05**)
for all 50 states + DC.

| Dataset (normalized field)      | Source CSV |
|---------------------------------|------------|
| `homeValues.typical`            | `State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |
| `homeValues.starter`            | `State_zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv` |
| `homeValues.higher`             | `State_zhvi_uc_sfrcondo_tier_0.67_1.0_sm_sa_month.csv` |
| `homeValues.singleFamily`       | `State_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv` |
| `homeValues.condo`              | `State_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv` |
| `homeValues.bedrooms.1..5plus`  | `State_zhvi_bdrmcnt_{1..5}_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |

**Not present in this project (features degrade gracefully):**

- **Rent / ZORI data** → the *Rent vs Buy* feature is shown as a clearly-labeled
  "coming soon" placeholder instead of breaking.
- **Zillow payment / mortgage datasets** → monthly payments are **computed** by the
  calculator (standard amortization), not read from a CSV.
- **City / metro / ZIP files** → only state-level data exists. The URL structure
  (`/states/{state}/{city}/`) and data model are ready for city pages, but none are
  generated yet.

---

## Data model

`site/data/states.json` holds an array of normalized region records:

```jsonc
{
  "regionType": "state",
  "regionName": "Maryland",
  "state": "MD",
  "slug": "maryland",
  "latestDate": "2026-05",
  "homeValues": {
    "starter": 265716, "typical": 434033, "higher": 710256,
    "singleFamily": 450374, "condo": 294234,
    "bedrooms": { "1": 217621, "2": 287616, "3": 396349, "4": 571348, "5plus": 770204 }
  },
  "payments": {
    "monthly20Down": 2195, "monthly10Down": 2469, "monthly5Down": 2606,
    "totalMonthly20Down": 2719, "totalMonthly10Down": 3156, "totalMonthly5Down": 3302
  },
  "incomeNeededTypical": 116529,
  "rent": null
}
```

`payments` are precomputed with the default assumptions below (for tables & SEO
copy). `rent` is `null` because no rent dataset is available.

---

## Calculator math & default assumptions

- **Principal & interest:** standard fixed-rate formula
  `M = P·r(1+r)ⁿ / ((1+r)ⁿ − 1)`; a 0% rate divides the loan evenly.
- **Property tax:** 1.1%/yr of value unless you enter a dollar amount.
- **Insurance:** 0.35%/yr of value unless you enter a dollar amount.
- **PMI:** 0.5%/yr of the loan, applied only when down payment < 20% (editable).
- **Closing costs:** ~3% of price, included in "estimated cash needed".
- **Income needed / affordability:** 28% housing-cost-to-income guideline.
  Comfort labels: ≤28% Comfortable, ≤36% Manageable, ≤43% Tight, else Stretching.

All assumptions live in `DEFAULTS` in `build/data.mjs` and are mirrored client-side
in `site/assets/calculator.js`.

---

## Feature highlights

- Instant, in-browser recalculation; results in an ARIA live region.
- Down-payment % and $ stay synced; currency/percent affixes on inputs.
- Scenario chips (starter / typical / higher + 5/10/20% down) using **local** state data.
- Sticky desktop result card; sticky bottom mini-summary on mobile.
- Visual payment breakdown (stacked bar + rows), comfort meter, smart insight tips.
- Shareable scenarios: every input is encoded in the URL (Copy/share button).
- SEO: unique titles/descriptions, single H1, breadcrumbs + `BreadcrumbList`,
  `FAQPage`, and `WebApplication` JSON-LD, clean URLs, `sitemap.xml`, `robots.txt`.
- Tasteful, clearly-labeled ad placeholders (leaderboard after first result,
  desktop sidebar, lower-page) — never above the calculator or between inputs and results.
- Accessibility: labels for every control, keyboard focus styles, semantic HTML,
  contrast-safe palette, info never conveyed by color alone, reduced-motion support.

---

## Limitations / missing data

- **No rent data** → rent-vs-buy is a placeholder.
- **State level only** → no city/metro/ZIP pages yet (structure is ready).
- ZHVI values are smoothed estimates and **will not match** a specific listing,
  appraisal, or lender valuation.
- Tax/insurance/PMI defaults are national approximations; enter local figures for accuracy.
- This is a planning tool — **not financial advice, a loan offer, or a guarantee**
  of rates, approval, taxes, insurance, or home values.

---

## Roadmap (URL structure already reserved)

`/states/{state}/{city}/` · `/rent-vs-buy-calculator/` · `/pmi-calculator/` ·
`/closing-cost-calculator/` · `/refinance-calculator/` ·
`/mortgage-on-300k-house/` · `/income-needed-for-400k-house/`
