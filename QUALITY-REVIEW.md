# Home Payment Atlas | AdSense and product-quality review

Updated: November 15, 2026

This is a checklist for the site owner, not a certification of AdSense eligibility. Google's 'low value content' decision is site-wide and does not reveal a single definitive cause. Approval is not guaranteed by any one code change.

## Implemented on this research branch

- Added an original **Compare Two States** interactive workspace: measured Zillow home-value tiers, consistent hypothetical mortgage terms, modeled component costs, upfront cash, a 28% housing-income guideline, shareable comparisons, and an interest-rate stress test.
- Added a substantial, worked explanation of how the comparison works and why same-rate state comparisons remain only approximations.
- Added distinct, data-specific mortgage-rate sensitivity tables to state pages.
- Created a **Data Updates and Coverage** page showing actual source observation months, manifest refresh date, state coverage and city-source limitations, so rebuild dates are not misrepresented as data timestamps.
- Retained old city URLs but made them plainly **archived/noindex** when the separate city source datasets are absent from the active refresh. They are not listed as current cities in the sitemap.
- Removed empty advertising placeholders while retaining the owner's existing AdSense site-verification loader and `ads.txt`.
- Corrected the rent-versus-buy model so it stops charging a mortgage after payoff and counts PMI monthly until the original-value 80% LTV threshold.
- Added regression tests and GitHub Actions CI for core math, 51 state datasets, working pages, source labels, the archived-city policy and the rent-versus-buy UI.
- Removed the misleading practice of setting `<lastmod>` to the build date for every page.

## Quality verification for owner before re-review

- [ ] Verify production deployment succeeded, with `/compare-markets/` and `/data-updates/` loading correctly over HTTPS.
- [ ] Test desktop, tablet and mobile with real browser interactions: changing both states, choosing property types, entering blank/zero/nonnumeric values, share-link restoration, and keyboard controls.
- [ ] Confirm the right AdSense publisher ID is in the generated loader and root `ads.txt`, and no unapproved/fake manual units are being inserted.
- [ ] Verify `privacy@homepaymentatlas.com` exists, can receive messages and is monitored; the repository cannot prove delivery. Add a reliable private support route where needed.
- [ ] Review the actual consent, analytics and privacy settings for the regions where ads may be shown, and configure Google's certified consent-management requirements where applicable.
- [ ] Review Zillow's published terms and source attribution for these data files, and confirm that your usage/redistribution is permitted.
- [ ] In Search Console, inspect coverage and indexing of state pages, and inspect the 16 archived city URLs to ensure search engines recognize the noindex directive.
- [ ] Confirm actual visitors find value in the site using real usage evidence (Search Console/analytics or direct user feedback). This cannot be inferred from GitHub commits or static pages.
- [ ] Review state tax, insurance and rate assumptions regularly. Never present these as live quotes or guaranteed lending decisions.
- [ ] Repeat a complete build and tests after updating data: `node build/build.mjs`, `node scripts/validate-site.mjs`, `node scripts/test-market-compare.mjs`, `node scripts/test-financial-models.mjs`.

## Data accuracy conventions

- Source month: the latest non-empty Zillow ZHVI month per state, shown on each page.
- Source-refresh date: timestamp recorded by the downloaded CSV manifest; different from the measurement month and the website deployment date.
- Mortgage interest rate: hypothetical default (currently 6.5%). Not a market rate.
- State property tax: unverified approximate statewide effective rate, last reviewed separately; may differ considerably from a county tax bill.
- Home values: aggregate typical values; not listings, purchase prices, appraisals or comparable-home estimates.
- City snapshots: explicitly marked historic and noindexed if not refreshed. Do not advertise these as current local estimates.
- Financial models: education and planning, not a lender determination or personalized financial advice.

## Maintenance strategy

Monthly automation currently refreshes state ZHVI datasets only. To reintroduce indexed city pages, add a validated city-source pipeline, versioned data snapshots and date-based freshness checks. Do not scale SEO pages with duplicated explanatory content or unsupported local claims. Improve calculators and data provenance first, and publish original research with clear supporting sources where possible.

Deploy only after automated tests are green and the site's controls work in a real browser. Once the changes are live and the checks above are done, the owner can request an AdSense review; no arbitrary wait period or article count guarantees acceptance.
