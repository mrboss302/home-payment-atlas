// Build script: parses CSVs, normalizes regions, and renders the static site.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegions, incomeNeeded, DEFAULTS } from "./data.mjs";
import { buildCities } from "./cities.mjs";
import * as T from "./templates.mjs";

const OUT = join(process.cwd(), "site");
const money = T.money;
const pct = T.pct;
// Pre-formatted, float-safe display strings for the standard assumptions.
const DTI_PCT = pct(DEFAULTS.frontEndDti * 100); // "28"

// Date the privacy policy text was last edited (not the build date), so it
// doesn't churn on every rebuild. Update when the policy wording changes.
const PRIVACY_LAST_UPDATED = "June 18, 2026";
const PRIVACY_CONTACT = "privacy@homepaymentatlas.com";

// 1 -> "1st", 2 -> "2nd", 22 -> "22nd", etc.
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function write(relPath, html) {
  const full = join(OUT, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, html);
}

// Shared page shell.
function page(depth, meta, bodyHtml) {
  return (
    T.head(depth, meta) +
    `\n<body>\n` +
    T.header(depth) +
    bodyHtml +
    T.footer(depth) +
    `\n</body>\n</html>\n`
  );
}

const appSchema = (name, url, desc) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name,
  url: T.SITE.url + url,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description: desc,
});

// ---------------------------------------------------------------- HOMEPAGE
function buildHome(regions) {
  const depth = 0;
  const meta = {
    title: "Home Payment Atlas — Know a Home's Monthly Cost",
    description:
      "Estimate your full monthly mortgage payment — principal, interest, taxes, insurance, PMI and HOA — with local home-price examples from Zillow data.",
    canonical: "/",
    schema: [appSchema("Home Payment Atlas", "/", "Mortgage payment and affordability calculators with local home-value data.")],
  };

  const card = (href, ico, title, desc, soon) =>
    `<a class="feature-card${soon ? " soon" : ""}" href="${href}"><div class="ico">${ico}</div><h3>${title}${soon ? '<span class="badge-soon">Soon</span>' : ""}</h3><p>${desc}</p></a>`;

  const i = {
    calc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h3M8 18h3"/></svg>',
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>',
    map: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    scale: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l3 6h-6z"/></svg>',
    list: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    shield: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>',
  };

  // A few headline state examples for the homepage.
  const featured = ["maryland", "texas", "california", "florida"]
    .map((s) => regions.find((r) => r.slug === s))
    .filter(Boolean);

  const body = `
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">● Home-buying planning tool</span>
    <h1>What would this home<br>really cost each month?</h1>
    <p class="lead">Estimate your mortgage, taxes, insurance, PMI, HOA, and local home-price scenarios in one clear view — so you know the true monthly cost before you tour the house.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="mortgage-calculator/index.html">Open the calculator</a>
      <a class="btn btn-ghost" href="states/index.html">Browse states</a>
    </div>
  </div>
</section>

<section class="section-tight">
  <div class="wrap">
    <div class="stat-tiles">
      ${featured
        .map(
          (r) =>
            `<a class="stat-tile" style="text-decoration:none;color:inherit" href="states/${r.slug}/index.html"><div class="k">Typical home · ${r.regionName}</div><div class="v">${money(r.homeValues.typical)}</div><div class="sub">Zillow ZHVI · ${r.latestDate}</div></a>`
        )
        .join("")}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Plan every part of the payment</h2>
    <p style="color:var(--ink-500);max-width:60ch;margin-bottom:28px">Pick a tool. Each one updates instantly and lets you share the exact scenario by link.</p>
    <div class="grid grid-3">
      ${card("mortgage-calculator/index.html", i.calc, "Mortgage Payment Calculator", "Full monthly payment with taxes, insurance, PMI and HOA — plus total interest and cash needed.")}
      ${card("mortgage-calculator/index.html#affordability", i.home, "How Much House Can I Afford?", "Add your income to see a comfort rating and the income needed for a given home price.")}
      ${card("states/index.html", i.map, "State Mortgage Calculators", "Local typical, starter and higher-budget home values for all 50 states and DC.")}
      ${card("rent-vs-buy-calculator/index.html", i.scale, "Rent vs Buy", "How to weigh renting against buying — plus rent-vs-cost snapshots on our city pages.")}
      ${card("examples/index.html", i.list, "Mortgage Payment Examples", "Ready-made scenarios like a $300k or $500k home at 5%, 10% and 20% down.")}
      ${card("pmi-calculator/index.html", i.shield, "PMI Calculator", "Estimate monthly PMI, the total until 20% equity, and when it drops off.")}
    </div>
  </div>
</section>

${T.adSlot("horizontal", "leaderboard, below the hero")}

<section class="section">
  <div class="wrap">
    <div class="card" style="padding:32px">
      <h2>Built on real home-value data</h2>
      <p style="color:var(--ink-700);max-width:65ch">Home-price examples come from <strong>Zillow Research</strong> Home Value Index (ZHVI) data — the typical value of homes in the 35th–65th percentile range, plus starter (lower-tier) and higher-budget (upper-tier) cuts. We use the latest available month (${regions[0].latestDate}) for each state. Read the <a href="methodology/index.html">methodology</a>.</p>
    </div>
  </div>
</section>
`;
  write("index.html", page(depth, meta, body));
}

// -------------------------------------------------------- MORTGAGE CALCULATOR
function buildCalculator() {
  const depth = 1;
  const meta = {
    title: "Mortgage Calculator with PMI & Taxes | Home Payment Atlas",
    description:
      "Free mortgage calculator: estimate your full monthly payment — principal, interest, tax, insurance, PMI and HOA — plus total interest, cash needed and affordability.",
    canonical: "/mortgage-calculator/",
    schema: [appSchema("Mortgage Calculator", "/mortgage-calculator/", "Estimate full monthly mortgage payments including taxes, insurance, PMI and HOA.")],
  };
  const crumb = T.breadcrumbs(depth, [
    { name: "Home", href: "index.html" },
    { name: "Mortgage Calculator" },
  ], meta.canonical);

  const faq = T.faqSection([
    { q: "What does this mortgage calculator include?", a: "It estimates principal and interest using a standard fixed-rate amortization formula, then adds property tax, homeowners insurance, PMI (when your down payment is under 20%), and any HOA dues you enter. The large number is your estimated total monthly housing payment." },
    { q: "How is PMI estimated?", a: "When your down payment is below 20%, we apply a default private mortgage insurance rate of " + DEFAULTS.pmiRatePct + "% of the loan per year. You can change this in the advanced settings. Reaching 20% equity typically removes PMI." },
    { q: "How do you calculate affordability?", a: "If you enter your annual income, we compare your total housing payment to your gross monthly income. Roughly 28% or less is labeled Comfortable, up to 36% Manageable, up to 43% Tight, and above that Stretching. These are general guidelines, not lending decisions." },
    { q: "Can I share my scenario?", a: "Yes. Every input is stored in the page URL, so the Copy / share scenario button gives you a link that reopens the calculator exactly as you set it." },
    { q: "Are these numbers a loan offer?", a: "No. All results are estimates for planning and education only. They are not financial advice, a quote, or a guarantee of rates, approval, taxes, insurance or home values." },
  ]);

  meta.schema.push(faq.schema, crumb.schema);

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>Mortgage Calculator</h1>
  <p class="lead" style="max-width:62ch;color:var(--ink-700)">Estimate the real monthly cost of a home — principal, interest, taxes, insurance, PMI and HOA — and see how different down payments change the picture. Results update as you type.</p>
</div></section>

<section class="section-tight" id="affordability"><div class="wrap">
  ${T.calculatorWidget(depth, { defaults: DEFAULTS, scenarios: { prices: [
    { label: "Starter", value: 250000 },
    { label: "Typical", value: 400000 },
    { label: "Higher", value: 650000 },
  ] }, prefill: { price: 400000, downPct: 20 } })}
</div></section>

<section class="section-tight"><div class="wrap">${T.disclaimer()}</div></section>

${T.adSlot("horizontal", "in-content, after first result")}

<section class="section"><div class="wrap prose">
  <h2>How this calculator works</h2>
  <p>Monthly principal and interest use the standard fixed-rate mortgage formula <em>M = P · r(1+r)ⁿ / ((1+r)ⁿ − 1)</em>, where P is the loan amount, r is the monthly interest rate, and n is the number of monthly payments. When the rate is 0%, we simply divide the loan by the number of months.</p>
  <p>Property tax and insurance can be entered as annual dollar amounts, or left blank to use percentage-of-value assumptions (${pct(DEFAULTS.taxRatePct)}% tax and ${pct(DEFAULTS.insuranceRatePct)}% insurance per year). State pages automatically use a state-specific property-tax default. PMI applies only when the down payment is under 20%. Estimated cash needed adds roughly 3% closing costs to your down payment.</p>
  <p>See the full <a href="../methodology/index.html">methodology</a> for assumptions and limitations.</p>
</div></section>

${faq.html}

<section class="section-tight"><div class="wrap">
  <h2>Related calculators</h2>
  <div class="related-links">
    <a href="../states/index.html">State mortgage calculators</a>
    <a href="../rent-vs-buy-calculator/index.html">Rent vs buy</a>
    <a href="../pmi-calculator/index.html">PMI calculator</a>
    <a href="../closing-cost-calculator/index.html">Closing costs</a>
    <a href="../refinance-calculator/index.html">Refinance</a>
    <a href="../examples/index.html">Payment examples</a>
  </div>
</div></section>
`;
  write("mortgage-calculator/index.html", page(depth, meta, body));
}

// ------------------------------------------------------------- STATES INDEX
function buildStatesIndex(regions, cities = []) {
  const depth = 1;
  const meta = {
    title: "State Mortgage Calculators | Home Payment Atlas",
    description:
      "Choose your state for a mortgage calculator prefilled with local Zillow home values — typical, starter and higher-budget prices and down-payment examples.",
    canonical: "/states/",
  };
  const crumb = T.breadcrumbs(depth, [
    { name: "Home", href: "index.html" },
    { name: "States" },
  ], meta.canonical);
  meta.schema = [crumb.schema];

  const links = regions
    .map(
      (r) =>
        `<a class="state-link" href="${r.slug}/index.html"><span>${r.regionName}</span><span class="price">${money(r.homeValues.typical)}</span></a>`
    )
    .join("");

  // Tasteful "popular city calculators" strip — first batch of curated city pages.
  const citySection = cities.length
    ? `<section class="section"><div class="wrap">
  <h2>Popular city calculators</h2>
  <p style="color:var(--ink-500);max-width:60ch">Our first batch of curated city mortgage calculators, prefilled with local Zillow home values.</p>
  <div class="state-grid" style="margin-top:16px">${cities
        .slice()
        .sort((a, b) => (b.homeValues.typical || 0) - (a.homeValues.typical || 0))
        .map((c) => `<a class="state-link" href="${c.stateSlug}/${c.citySlug}/index.html"><span>${c.cityName}, ${c.stateCode}</span><span class="price">${money(c.homeValues.typical)}</span></a>`)
        .join("")}</div>
</div></section>`
    : "";

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>State Mortgage Calculators</h1>
  <p class="lead" style="max-width:62ch;color:var(--ink-700)">Pick a state to open a calculator prefilled with local home-price examples from Zillow data. Prices shown are the typical home value (${regions[0].latestDate}).</p>
</div></section>
<section class="section-tight"><div class="wrap">
  <div class="state-grid">${links}</div>
</div></section>
${citySection}
${T.adSlot("horizontal", "leaderboard")}
`;
  write("states/index.html", page(depth, meta, body));
}

// --------------------------------------------------------------- STATE PAGE
function buildStatePage(r, regions, citiesInState = []) {
  const depth = 2;
  const name = r.regionName;
  const hv = r.homeValues;
  const meta = {
    title: `${name} Mortgage Calculator | Home Payment Atlas`,
    description: `${name} mortgage calculator with local Zillow home values — estimate the monthly payment (taxes, insurance, PMI, HOA) on a typical ${money(hv.typical)} home.`,
    canonical: `/states/${r.slug}/`,
  };
  const crumb = T.breadcrumbs(depth, [
    { name: "Home", href: "index.html" },
    { name: "States", href: "states/index.html" },
    { name: name },
  ], meta.canonical);

  const tax = r.taxRatePct;
  const ctx = r.context;
  // Per-state calculator defaults: same as global, but with the state tax rate + a note.
  const stateDefaults = Object.assign({}, DEFAULTS, {
    taxRatePct: tax,
    taxNote: r.taxIsStateSpecific
      ? `Prefilled with ${name}'s approximate effective rate (${pct(tax)}%). Enter your county's figure for precision.`
      : `Using the national default (${pct(tax)}%). Enter your local figure for precision.`,
  });

  // Scenario chips use local data where available.
  const prices = [];
  if (hv.starter) prices.push({ label: "Starter", value: hv.starter });
  if (hv.typical) prices.push({ label: "Typical", value: hv.typical });
  if (hv.higher) prices.push({ label: "Higher", value: hv.higher });

  // ---- Data-driven, non-templated market snapshot ----
  const vsNat = ctx.vsNationalPct; // signed %
  const cheaper = vsNat < 0;
  const vsNatPhrase = Math.abs(vsNat) <= 4
    ? `right around the national typical value of ${money(ctx.nationalTypical)}`
    : `about ${pct(Math.abs(vsNat))}% ${cheaper ? "below" : "above"} the national typical value of ${money(ctx.nationalTypical)}`;
  const rankPhrase = `the ${ordinal(ctx.rank)} most expensive of ${ctx.totalStates} states and DC we track`;

  // Bedroom ladder (only the rungs we actually have).
  const bdrmPairs = [
    ["a 2-bedroom", hv.bedrooms["2"]],
    ["a 3-bedroom", hv.bedrooms["3"]],
    ["a 4-bedroom", hv.bedrooms["4"]],
  ].filter((p) => p[1] != null);
  const bedroomSentence = bdrmPairs.length
    ? `By size, ${bdrmPairs.map((p) => `${p[0]} runs about ${money(p[1])}`).join(", ")}.`
    : "";

  const condoSentence =
    hv.condo && hv.singleFamily && ctx.sfrCondoGap != null
      ? ` Condos and co-ops are more accessible at a typical ${money(hv.condo)}, roughly ${pct(ctx.sfrCondoGap)}% less than the ${money(hv.singleFamily)} typical single-family home.`
      : hv.singleFamily
      ? ` The typical single-family home is around ${money(hv.singleFamily)}.`
      : "";

  const snapshot = `In ${name}, the typical home is worth about <strong>${money(hv.typical)}</strong> (Zillow ZHVI, ${r.latestDate}) — ${vsNatPhrase}, making it ${ctx.affordabilityTier} and ${rankPhrase}. Entry-level homes start near ${money(hv.starter)}, while higher-budget homes reach about ${money(hv.higher)}.${condoSentence} ${bedroomSentence}`;

  // Intro varies deterministically by state so pages don't read identically.
  const introVariants = [
    `See what a home in ${name} would really cost each month — principal, interest, ${name} property taxes, insurance, PMI, and optional HOA — and try starter, typical, and higher-budget prices drawn from Zillow data.`,
    `Planning a move in ${name}? Estimate the full monthly payment on a local home, including taxes, insurance, PMI, and HOA, using real ${name} home-value examples from Zillow Research.`,
    `Estimate the true monthly cost of buying in ${name}. The calculator is prefilled with the typical ${name} home value (${money(hv.typical)}) and adds taxes, insurance, and PMI so the number reflects more than just principal and interest.`,
  ];
  const intro = introVariants[ctx.rank % introVariants.length];

  // Local home-price examples table.
  const valueRows = [
    ["Typical home", hv.typical],
    ["Starter (lower-tier)", hv.starter],
    ["Higher-budget (upper-tier)", hv.higher],
    ["Single-family home", hv.singleFamily],
    ["Condo / co-op", hv.condo],
    ["2-bedroom", hv.bedrooms["2"]],
    ["3-bedroom", hv.bedrooms["3"]],
    ["4-bedroom", hv.bedrooms["4"]],
  ].filter((row) => row[1] != null);

  const valueTable = `<table class="data"><thead><tr><th>Home type</th><th>Typical value</th></tr></thead><tbody>${valueRows
    .map((row) => `<tr><td>${row[0]}</td><td>${money(row[1])}</td></tr>`)
    .join("")}</tbody></table>`;

  // Payment examples table (state tax rate applied).
  const pmtRow = (label, hvVal, featured) => {
    if (hvVal == null) return "";
    const p5 = paymentExample(hvVal, 5, false, tax),
      p10 = paymentExample(hvVal, 10, false, tax),
      p20 = paymentExample(hvVal, 20, false, tax);
    return `<tr${featured ? ' class="featured"' : ""}><td>${label}<br><span style="color:var(--ink-300);font-size:.82rem">${money(hvVal)}</span></td><td>${money(p5)}</td><td>${money(p10)}</td><td>${money(p20)}</td></tr>`;
  };
  const pmtTable = `<table class="data"><thead><tr><th>Home price</th><th>5% down</th><th>10% down</th><th>20% down</th></tr></thead><tbody>${[
    ["Starter", hv.starter, false],
    ["Typical", hv.typical, true],
    ["Higher-budget", hv.higher, false],
  ]
    .map((row) => pmtRow(row[0], row[1], row[2]))
    .join("")}</tbody></table>`;

  const incomeTypical = r.incomeNeededTypical;
  const piTypical = paymentExample(hv.typical, 20, true, tax);
  const fullTypical = paymentExample(hv.typical, 20, false, tax);

  // Related: nearest-priced states make for more relevant links than the first 8 alphabetically.
  const related = regions
    .filter((x) => x.slug !== r.slug && x.homeValues.typical != null)
    .sort((a, b) => Math.abs(a.homeValues.typical - hv.typical) - Math.abs(b.homeValues.typical - hv.typical))
    .slice(0, 8)
    .map((x) => `<a href="../${x.slug}/index.html">${x.regionName} · ${money(x.homeValues.typical)}</a>`)
    .join("");

  const faq = T.faqSection([
    { q: `How much is a typical home in ${name}?`, a: `As of ${r.latestDate}, the typical home value in ${name} is about ${money(hv.typical)}, based on Zillow Research (ZHVI) data — ${vsNatPhrase}. Starter homes are around ${money(hv.starter)} and higher-budget homes around ${money(hv.higher)}.` },
    { q: `What income do I need to buy a home in ${name}?`, a: `Using a typical ${money(hv.typical)} home, 20% down, ${name}'s ${r.taxIsStateSpecific ? "" : "default "}property-tax assumption of ${pct(tax)}%, and a ${DTI_PCT}% housing-cost-to-income guideline, you'd want roughly ${money(incomeTypical)} in annual household income. This is a planning estimate, not a lending decision — lenders weigh credit, debts and other factors.` },
    { q: `What would the monthly payment be on a typical ${name} home?`, a: `With 20% down at ${pct(DEFAULTS.rate)}% over ${DEFAULTS.termYears} years, principal and interest on a ${money(hv.typical)} home is about ${money(piTypical)}. Adding estimated ${name} taxes, insurance and (under 20% down) PMI brings the full payment to roughly ${money(fullTypical)} — use the calculator above to fine-tune it.` },
    { q: `How are ${name} property taxes handled?`, a: `The calculator prefills ${name} with an approximate effective property-tax rate of ${pct(tax)}% of home value per year${r.taxIsStateSpecific ? "" : " (the national default, pending a state-specific figure)"}, plus a ${pct(DEFAULTS.insuranceRatePct)}% insurance assumption. Rates vary widely by county and city, so entering your own annual dollar amounts gives the most accurate result.` },
    { q: `Are these ${name} home values current?`, a: `They reflect the latest available Zillow ZHVI month (${r.latestDate}) and are smoothed, seasonally adjusted estimates. They may not match a specific listing, appraisal or lender valuation.` },
  ]);

  meta.schema = [appSchema(`${name} Mortgage Calculator`, `/states/${r.slug}/`, `Mortgage and affordability calculator for ${name} with local Zillow home values.`), faq.schema, crumb.schema];

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>${name} Mortgage Calculator</h1>
  <p class="lead" style="max-width:64ch;color:var(--ink-700)">${intro}</p>
</div></section>

<section class="section-tight"><div class="wrap">
  ${T.calculatorWidget(depth, { defaults: stateDefaults, scenarios: { prices }, prefill: { price: hv.typical, downPct: 20 }, region: { name: name, state: r.state, slug: r.slug } })}
</div></section>

<section class="section-tight"><div class="wrap">${T.disclaimer()}</div></section>

${T.adSlot("horizontal", "in-content, after first result")}

<section class="section"><div class="wrap">
  <h2>The ${name} housing market at a glance</h2>
  <p style="color:var(--ink-700);max-width:74ch">${snapshot}</p>
  <div class="card table-card" style="margin-top:16px">${valueTable}</div>
  <p class="hint" style="margin-top:10px">Home values are <strong>measured data</strong> from Zillow Research (ZHVI), ${r.latestDate}. Click a price chip in the calculator to load one instantly.</p>
</div></section>

<section class="section"><div class="wrap">
  <h2>Monthly payment examples in ${name}</h2>
  <p style="color:var(--ink-500);max-width:64ch">Estimated full monthly payment (principal, interest, ${name} property tax at ${pct(tax)}%, insurance and PMI) at ${pct(DEFAULTS.rate)}% over ${DEFAULTS.termYears} years. PMI applies under 20% down. These payment figures are <strong>calculated assumptions</strong>, not measured data.</p>
  <div class="card table-card" style="margin-top:16px">${pmtTable}</div>
</div></section>

<section class="section"><div class="wrap">
  <h2>Income needed for a typical home in ${name}</h2>
  <div class="stat-tiles" style="margin-top:8px">
    <div class="stat-tile"><div class="k">Typical home value</div><div class="v">${money(hv.typical)}</div><div class="sub">Zillow ZHVI · ${r.latestDate}</div></div>
    <div class="stat-tile"><div class="k">Est. monthly payment (20% down)</div><div class="v">${money(fullTypical)}</div><div class="sub">Tax, insurance &amp; P&amp;I</div></div>
    <div class="stat-tile"><div class="k">Suggested income</div><div class="v">${money(incomeTypical)}</div><div class="sub">${DTI_PCT}% housing ratio</div></div>
    <div class="stat-tile"><div class="k">20% down payment</div><div class="v">${money(hv.typical * 0.2)}</div><div class="sub">Plus ~3% closing costs</div></div>
  </div>
  <p class="hint" style="margin-top:12px">A planning guideline only — not a pre-qualification. Lenders consider credit, debts, and other factors.</p>
</div></section>

<section class="section"><div class="wrap card" style="padding:28px;max-width:74ch">
  <h2>Renting vs buying in ${name}</h2>
  <p style="color:var(--ink-700);margin:0 0 .8em">Owning a typical ${name} home costs an estimated <strong>${money(fullTypical)}/mo</strong> with 20% down (principal, interest, taxes and insurance), plus upfront cash — the down payment and roughly 3% in closing costs. A fair rent-vs-buy comparison weighs that against local rent and also accounts for maintenance, how long you'll stay, the opportunity cost of your down payment, expected home-price appreciation, and the transaction costs on both sides.</p>
  ${citiesInState.filter((cy) => cy.rent && cy.rent.typicalRent).length
    ? `<p style="color:var(--ink-700);margin:0">For a side-by-side rent estimate using Zillow rent (ZORI) data, see the rent-vs-buy snapshot on our ${name} city pages: ${citiesInState
        .filter((cy) => cy.rent && cy.rent.typicalRent)
        .map((cy) => `<a href="${cy.citySlug}/index.html">${cy.cityName}</a>`)
        .join(", ")}.</p>`
    : `<p style="color:var(--ink-700);margin:0">Use the calculator above to plan the buying side, then compare it against rents you're seeing locally.</p>`}
</div></section>

<section class="section prose"><div class="wrap">
  <h2>How this ${name} calculator works</h2>
  <p><strong>Where the home values come from.</strong> The prices on this page — typical, starter, higher-budget, single-family, condo and by-bedroom — are <strong>measured data</strong> from <strong>Zillow Research</strong> Home Value Index (ZHVI), a smoothed, seasonally adjusted estimate of typical values. We use the latest available month (${r.latestDate}): the middle price tier for "typical," the lower tier for "starter," and the upper tier for "higher-budget."</p>
  <p><strong>Where the payments come from.</strong> Monthly payments are <strong>calculated</strong> by this tool with a standard fixed-rate formula and editable assumptions: ${pct(DEFAULTS.rate)}% rate, ${DEFAULTS.termYears}-year term, ${name} property tax of ${pct(tax)}%, ${pct(DEFAULTS.insuranceRatePct)}% insurance, and ${pct(DEFAULTS.pmiRatePct)}% PMI when down payment is under 20%. They are estimates, not quotes. See the full <a href="../../methodology/index.html">methodology</a>.</p>
</div></section>

${faq.html}

${T.adSlot("lower", "in-content, near FAQ")}

${citiesInState.length ? `<section class="section"><div class="wrap">
  <h2>Popular city mortgage calculators in ${name}</h2>
  <p style="color:var(--ink-500);max-width:60ch">Prefilled with local Zillow home values for these ${name} cities.</p>
  <div class="state-grid" style="margin-top:16px">${citiesInState
    .slice()
    .sort((a, b) => (b.homeValues.typical || 0) - (a.homeValues.typical || 0))
    .map((cy) => `<a class="state-link" href="${cy.citySlug}/index.html"><span>${cy.cityName}</span><span class="price">${money(cy.homeValues.typical)}</span></a>`)
    .join("")}</div>
</div></section>` : ""}

<section class="section-tight"><div class="wrap">
  <h2>Other state calculators</h2>
  <div class="related-links">${related}<a href="../index.html"><strong>All states →</strong></a></div>
</div></section>

<section class="section-tight"><div class="wrap">
  <h2>Related calculators</h2>
  <div class="related-links">
    <a href="../../mortgage-calculator/index.html">Mortgage calculator</a>
    <a href="../../rent-vs-buy-calculator/index.html">Rent vs buy</a>
    <a href="../../pmi-calculator/index.html">PMI calculator</a>
    <a href="../../closing-cost-calculator/index.html">Closing costs</a>
  </div>
</div></section>
`;
  write(`states/${r.slug}/index.html`, page(depth, meta, body));
}

// --------------------------------------------------------------- CITY PAGE
// Curated priority-1 city mortgage calculator at /states/{stateSlug}/{citySlug}/.
function buildCityPage(c, allCities, regions) {
  const depth = 3;
  const hv = c.homeValues;
  const tax = c.taxRatePct;
  const cmp = c.comparisons;
  const cityLabel = `${c.cityName}, ${c.stateCode}`;

  const meta = {
    title: `${cityLabel} Mortgage Calculator | Home Payment Atlas`,
    description: `${c.cityName}, ${c.stateCode} mortgage calculator — estimate the monthly payment on a typical ${money(hv.typical)} home with local Zillow prices${c.rent.typicalRent ? ` and a rent-vs-buy snapshot` : ""}.`,
    canonical: c.intendedUrl,
  };
  const crumb = T.breadcrumbs(depth, [
    { name: "Home", href: "index.html" },
    { name: "States", href: "states/index.html" },
    { name: c.stateName, href: `states/${c.stateSlug}/index.html` },
    { name: c.cityName },
  ], meta.canonical);

  const cityDefaults = Object.assign({}, DEFAULTS, {
    taxRatePct: tax,
    taxNote: `Prefilled with ${c.stateName}'s approximate effective rate (${pct(tax)}%). ${c.countyName ? c.countyName + " " : ""}rates vary — enter your local figure for precision.`,
  });

  const prices = [];
  if (hv.starter) prices.push({ label: "Starter", value: hv.starter });
  if (hv.typical) prices.push({ label: "Typical", value: hv.typical });
  if (hv.higher) prices.push({ label: "Higher", value: hv.higher });

  // ---- Data-driven comparisons (make each city page distinct) ----
  const cmpPhrase = (pct1, anchorLabel, anchorVal) => {
    if (pct1 == null || anchorVal == null) return "";
    if (Math.abs(pct1) <= 3) return `about the same as ${anchorLabel} (${money(anchorVal)})`;
    return `about ${pct(Math.abs(pct1))}% ${pct1 < 0 ? "below" : "above"} ${anchorLabel} (${money(anchorVal)})`;
  };
  const vsState = cmpPhrase(cmp.vsStatePct, `the ${c.stateName} typical`, cmp.stateTypical);
  const vsNation = cmp.vsNationalPct != null ? cmpPhrase(cmp.vsNationalPct, "the national typical", cmp.nationalTypical) : "";

  // Rank within the generated curated list (relative expensiveness).
  const ranked = allCities.slice().sort((a, b) => (b.homeValues.typical || 0) - (a.homeValues.typical || 0));
  const cityRank = ranked.findIndex((x) => x.citySlug === c.citySlug && x.stateSlug === c.stateSlug) + 1;
  const rankPhrase = `the ${ordinal(cityRank)} most expensive of the ${allCities.length} launch cities we cover`;

  // Condo vs single-family observation.
  const condoSentence =
    hv.condo && hv.singleFamily && cmp.sfrCondoGap != null
      ? (cmp.sfrCondoGap >= 0
          ? ` Condos and co-ops are more affordable here at a typical ${money(hv.condo)} — about ${pct(cmp.sfrCondoGap)}% below the ${money(hv.singleFamily)} typical single-family home.`
          : ` Unusually, condos (${money(hv.condo)}) run higher than single-family homes (${money(hv.singleFamily)}) in this market.`)
      : "";

  // Bedroom ladder + biggest jump.
  const bedVals = [["1", hv.bedrooms["1"]], ["2", hv.bedrooms["2"]], ["3", hv.bedrooms["3"]], ["4", hv.bedrooms["4"]], ["5+", hv.bedrooms["5plus"]]].filter((p) => p[1] != null);
  let biggestJump = null;
  for (let i = 1; i < bedVals.length; i++) {
    const inc = (bedVals[i][1] - bedVals[i - 1][1]) / bedVals[i - 1][1];
    if (!biggestJump || inc > biggestJump.inc) biggestJump = { from: bedVals[i - 1][0], to: bedVals[i][0], inc };
  }
  const bedroomSentence = bedVals.length
    ? `Bedroom counts range from ${money(bedVals[0][1])} (${bedVals[0][0]}-bed) to ${money(bedVals[bedVals.length - 1][1])} (${bedVals[bedVals.length - 1][0]}-bed)` +
      (biggestJump ? `, with the biggest step up from a ${biggestJump.from}- to ${biggestJump.to}-bedroom home (about +${pct(biggestJump.inc * 100)}%).` : ".")
    : "";

  const snapshot = `The typical home in ${c.cityName} is worth about <strong>${money(hv.typical)}</strong> (Zillow ZHVI, ${c.latestDate}) — ${vsState}${vsNation ? `, and ${vsNation}` : ""}. That makes it ${rankPhrase}. Entry-level homes start near ${money(hv.starter)}, while higher-budget homes reach about ${money(hv.higher)}.${condoSentence} ${bedroomSentence}`;

  const intro = `Estimate the real monthly cost of buying a home in ${c.cityName}, ${c.stateCode} — principal, interest, ${c.stateName} property taxes, insurance, PMI, and optional HOA. The calculator is prefilled with the typical ${c.cityName} home value (${money(hv.typical)}) from Zillow Research, and you can try starter, typical, and higher-budget prices.`;

  // ---- Tables ----
  const valueRows = [
    ["Typical home", hv.typical],
    ["Starter (lower-tier)", hv.starter],
    ["Higher-budget (upper-tier)", hv.higher],
    ["Single-family home", hv.singleFamily],
    ["Condo / co-op", hv.condo],
    ["2-bedroom", hv.bedrooms["2"]],
    ["3-bedroom", hv.bedrooms["3"]],
    ["4-bedroom", hv.bedrooms["4"]],
  ].filter((row) => row[1] != null);
  const valueTable = `<table class="data"><thead><tr><th>Home type</th><th>Typical value</th></tr></thead><tbody>${valueRows
    .map((row) => `<tr><td>${row[0]}</td><td>${money(row[1])}</td></tr>`)
    .join("")}</tbody></table>`;

  const pmtRow = (label, hvVal, featured) => {
    if (hvVal == null) return "";
    return `<tr${featured ? ' class="featured"' : ""}><td>${label}<br><span style="color:var(--ink-300);font-size:.82rem">${money(hvVal)}</span></td><td>${money(paymentExample(hvVal, 5, false, tax))}</td><td>${money(paymentExample(hvVal, 10, false, tax))}</td><td>${money(paymentExample(hvVal, 20, false, tax))}</td></tr>`;
  };
  const pmtTable = `<table class="data"><thead><tr><th>Home price</th><th>5% down</th><th>10% down</th><th>20% down</th></tr></thead><tbody>${[
    ["Starter", hv.starter, false], ["Typical", hv.typical, true], ["Higher-budget", hv.higher, false],
  ].map((row) => pmtRow(row[0], row[1], row[2])).join("")}</tbody></table>`;

  const incomeTypical = c.incomeNeededTypical;
  const fullTypical = paymentExample(hv.typical, 20, false, tax);

  // ---- Rent vs buy snapshot (only when ZORI present) ----
  let rentSection = "";
  if (c.rent.typicalRent) {
    const rent = c.rent.typicalRent;
    const diff = fullTypical - rent;
    const diffPhrase = diff >= 0
      ? `about <strong>${money(diff)}/mo more</strong> than the typical rent`
      : `about <strong>${money(-diff)}/mo less</strong> than the typical rent`;
    rentSection = `
<section class="section"><div class="wrap">
  <h2>Rent vs buy snapshot in ${c.cityName}</h2>
  <div class="stat-tiles" style="margin-top:8px">
    <div class="stat-tile"><div class="k">Typical rent</div><div class="v">${money(rent)}</div><div class="sub">Zillow ZORI · ${c.rent.latestRentDate || c.latestDate}</div></div>
    <div class="stat-tile"><div class="k">Est. ownership (20% down)</div><div class="v">${money(fullTypical)}</div><div class="sub">P&amp;I, tax &amp; insurance</div></div>
    <div class="stat-tile"><div class="k">Monthly difference</div><div class="v">${diff >= 0 ? "+" : "−"}${money(Math.abs(diff))}</div><div class="sub">Owning vs renting</div></div>
  </div>
  <p style="color:var(--ink-700);max-width:74ch;margin-top:14px">Buying a typical ${c.cityName} home would cost ${diffPhrase} of ${money(rent)}. <strong>This is only a snapshot, not a full rent-vs-buy decision</strong> — it leaves out maintenance, your time horizon, the opportunity cost of the down payment, home-price appreciation, and transaction costs on both sides. Use it as a starting point, not an answer.</p>
</div></section>`;
  }

  // ---- Related links ----
  const sameState = allCities
    .filter((x) => x.stateSlug === c.stateSlug && x.citySlug !== c.citySlug)
    .map((x) => `<a href="../${x.citySlug}/index.html">${x.cityName}, ${x.stateCode}</a>`);
  const similar = allCities
    .filter((x) => !(x.citySlug === c.citySlug && x.stateSlug === c.stateSlug))
    .sort((a, b) => Math.abs(a.homeValues.typical - hv.typical) - Math.abs(b.homeValues.typical - hv.typical))
    .slice(0, 5)
    .map((x) => `<a href="../../${x.stateSlug}/${x.citySlug}/index.html">${x.cityName}, ${x.stateCode} · ${money(x.homeValues.typical)}</a>`);

  // ---- FAQ ----
  const faq = T.faqSection([
    { q: `How much is a typical home in ${c.cityName}?`, a: `As of ${c.latestDate}, the typical home value in ${c.cityName}, ${c.stateCode} is about ${money(hv.typical)} (Zillow Research ZHVI) — ${vsState}. Starter homes are around ${money(hv.starter)} and higher-budget homes around ${money(hv.higher)}.` },
    { q: `What is the monthly mortgage payment on a typical ${c.cityName} home?`, a: `With 20% down at ${pct(DEFAULTS.rate)}% over ${DEFAULTS.termYears} years, the estimated full payment (principal, interest, ${c.stateName} property tax at ${pct(tax)}% and insurance) on a ${money(hv.typical)} home is about ${money(fullTypical)}/mo. Adjust the numbers in the calculator above.` },
    { q: `What income do I need to buy a home in ${c.cityName}?`, a: `Using a typical ${money(hv.typical)} home, 20% down and a ${DTI_PCT}% housing-cost-to-income guideline, you'd want roughly ${money(incomeTypical)} in annual household income. A planning estimate, not a lending decision.` },
    c.rent.typicalRent
      ? { q: `Is it cheaper to rent or buy in ${c.cityName}?`, a: `Typical rent is about ${money(c.rent.typicalRent)}/mo versus an estimated ${money(fullTypical)}/mo to own a typical home with 20% down — a difference of ${money(Math.abs(fullTypical - c.rent.typicalRent))}/mo. This ignores maintenance, appreciation, your time horizon and transaction costs, so treat it as a snapshot, not a decision.` }
      : { q: `Are these ${c.cityName} home values current?`, a: `They reflect the latest Zillow ZHVI month (${c.latestDate}) and are smoothed, seasonally adjusted estimates that may not match a specific listing or appraisal.` },
    { q: `Are these ${c.cityName} figures exact?`, a: `No. Home values and rent are measured Zillow Research data; payments, income, taxes, PMI and closing costs are calculated estimates. City values may not match a specific listing, appraisal or lender valuation.` },
  ]);

  meta.schema = [
    appSchema(`${c.cityName} Mortgage Calculator`, c.intendedUrl, `Mortgage and affordability calculator for ${cityLabel} with local Zillow home values.`),
    faq.schema,
    crumb.schema,
  ];

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>${c.cityName} Mortgage Calculator</h1>
  <p class="lead" style="max-width:66ch;color:var(--ink-700)">${intro}</p>
</div></section>

<section class="section-tight"><div class="wrap">
  ${T.calculatorWidget(depth, { defaults: cityDefaults, scenarios: { prices }, prefill: { price: hv.typical, downPct: 20 }, region: { name: cityLabel, state: c.stateCode, slug: `${c.stateSlug}/${c.citySlug}` } })}
</div></section>

<section class="section-tight"><div class="wrap">${T.disclaimer()}</div></section>

${T.adSlot("horizontal", "in-content, after first result")}

<section class="section"><div class="wrap">
  <h2>The ${c.cityName} housing market at a glance</h2>
  <p style="color:var(--ink-700);max-width:76ch">${snapshot}</p>
  <div class="card table-card" style="margin-top:16px">${valueTable}</div>
  <p class="hint" style="margin-top:10px">Home values are <strong>measured data</strong> from Zillow Research City ZHVI, ${c.latestDate}${c.metroName ? ` · ${c.metroName} metro` : ""}. Click a price chip in the calculator to load one instantly.</p>
</div></section>

<section class="section"><div class="wrap">
  <h2>Monthly payment examples in ${c.cityName}</h2>
  <p style="color:var(--ink-500);max-width:66ch">Estimated full monthly payment (principal, interest, ${c.stateName} property tax at ${pct(tax)}%, insurance and PMI) at ${pct(DEFAULTS.rate)}% over ${DEFAULTS.termYears} years. PMI applies under 20% down. These payment figures are <strong>calculated assumptions</strong>, not measured data.</p>
  <div class="card table-card" style="margin-top:16px">${pmtTable}</div>
</div></section>

<section class="section"><div class="wrap">
  <h2>Income needed for a typical home in ${c.cityName}</h2>
  <div class="stat-tiles" style="margin-top:8px">
    <div class="stat-tile"><div class="k">Typical home value</div><div class="v">${money(hv.typical)}</div><div class="sub">Zillow ZHVI · ${c.latestDate}</div></div>
    <div class="stat-tile"><div class="k">Est. monthly payment (20% down)</div><div class="v">${money(fullTypical)}</div><div class="sub">Tax, insurance &amp; P&amp;I</div></div>
    <div class="stat-tile"><div class="k">Suggested income</div><div class="v">${money(incomeTypical)}</div><div class="sub">${DTI_PCT}% housing ratio</div></div>
    <div class="stat-tile"><div class="k">20% down payment</div><div class="v">${money(hv.typical * 0.2)}</div><div class="sub">Plus ~3% closing costs</div></div>
  </div>
  <p class="hint" style="margin-top:12px">A planning guideline only — not a pre-qualification.</p>
</div></section>

${rentSection}

<section class="section prose"><div class="wrap">
  <h2>How this ${c.cityName} calculator works</h2>
  <p><strong>Measured data.</strong> ${c.cityName} home values${c.rent.typicalRent ? " and rent" : ""} come from <strong>Zillow Research</strong> — City ZHVI (smoothed, seasonally adjusted)${c.rent.typicalRent ? " and City ZORI rent" : ""}, latest month ${c.latestDate}. City values may not match a specific listing, appraisal or lender valuation.</p>
  <p><strong>Calculated estimates.</strong> Payments, income needed, property tax (${pct(tax)}%), PMI and closing costs are computed by this tool with editable assumptions — not quotes. See the full <a href="../../../methodology/index.html">methodology</a>.</p>
</div></section>

${faq.html}

${T.adSlot("lower", "in-content, near FAQ")}

${sameState.length ? `<section class="section-tight"><div class="wrap">
  <h2>More city calculators in ${c.stateName}</h2>
  <div class="related-links">${sameState.join("")}<a href="../index.html"><strong>${c.stateName} state page →</strong></a></div>
</div></section>` : ""}

<section class="section-tight"><div class="wrap">
  <h2>Similar markets</h2>
  <div class="related-links">${similar.join("")}</div>
</div></section>

<section class="section-tight"><div class="wrap">
  <h2>Related calculators</h2>
  <div class="related-links">
    <a href="../index.html">${c.stateName} mortgage calculator</a>
    <a href="../../../mortgage-calculator/index.html">Mortgage calculator</a>
    <a href="../../../rent-vs-buy-calculator/index.html">Rent vs buy</a>
    <a href="../../../pmi-calculator/index.html">PMI calculator</a>
  </div>
</div></section>
`;
  write(`states/${c.stateSlug}/${c.citySlug}/index.html`, page(depth, meta, body));
}

// Helper: full monthly payment (or PI only) example using default assumptions.
// `taxRatePct` lets state pages apply their state-specific property-tax default.
function paymentExample(homeValue, downPct, piOnly = false, taxRatePct = DEFAULTS.taxRatePct) {
  if (homeValue == null) return 0;
  const loan = homeValue * (1 - downPct / 100);
  const n = DEFAULTS.termYears * 12;
  const rate = DEFAULTS.rate / 100 / 12;
  const pi = rate === 0 ? loan / n : (loan * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
  if (piOnly) return Math.round(pi);
  const tax = (homeValue * taxRatePct) / 100 / 12;
  const ins = (homeValue * DEFAULTS.insuranceRatePct) / 100 / 12;
  const pmi = downPct < 20 ? (loan * DEFAULTS.pmiRatePct) / 100 / 12 : 0;
  return Math.round(pi + tax + ins + pmi);
}

// --------------------------------------------------- SIMPLE CONTENT PAGES
function buildMethodology(regions) {
  const depth = 1;
  const meta = {
    title: "Methodology & Data Sources | Home Payment Atlas",
    description: "How Home Payment Atlas calculates mortgage payments and where our home-value data comes from, including Zillow Research (ZHVI) and our default assumptions.",
    canonical: "/methodology/",
  };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: "Methodology" }], meta.canonical);
  meta.schema = [crumb.schema];
  const body = `
${crumb.html}
<section class="section prose"><div class="wrap prose">
  <h1>Methodology</h1>
  <p>Home Payment Atlas is a planning tool. We aim to be transparent about every number so you can judge how well it fits your situation. The most important distinction on this site is between <strong>measured data</strong> (real values we read from Zillow) and <strong>calculated assumptions</strong> (figures this tool estimates and that you can change).</p>

  <div class="card" style="padding:24px;margin:18px 0">
    <h3 style="margin-top:0">What's measured vs. what's calculated</h3>
    <table class="data" style="margin-top:6px">
      <thead><tr><th>Figure</th><th style="text-align:left">Where it comes from</th></tr></thead>
      <tbody>
        <tr><td style="text-align:left">Typical / starter / higher-budget home values</td><td style="text-align:left"><strong>Measured</strong> — Zillow ZHVI</td></tr>
        <tr><td style="text-align:left">Single-family, condo, by-bedroom values</td><td style="text-align:left"><strong>Measured</strong> — Zillow ZHVI</td></tr>
        <tr><td style="text-align:left">Principal &amp; interest, total interest, payoff</td><td style="text-align:left"><strong>Calculated</strong> — amortization formula</td></tr>
        <tr><td style="text-align:left">Property tax, insurance, PMI, cash needed</td><td style="text-align:left"><strong>Calculated</strong> — editable assumptions</td></tr>
        <tr><td style="text-align:left">Income needed &amp; comfort rating</td><td style="text-align:left"><strong>Calculated</strong> — ratio guidelines</td></tr>
      </tbody>
    </table>
  </div>

  <h2>Home-value data (measured)</h2>
  <ul>
    <li><strong>Source:</strong> Zillow Research Home Value Index (ZHVI), state level, smoothed and seasonally adjusted.</li>
    <li><strong>Typical</strong> value is the middle price tier (35th–65th percentile). <strong>Starter</strong> uses the lower tier and <strong>higher-budget</strong> the upper tier.</li>
    <li>We also surface single-family, condo/co-op, and bedroom-count values where available.</li>
    <li>We extract the latest available month for each state (currently ${regions[0].latestDate}).</li>
    <li>Values are Zillow's estimates and may not match current listings, appraisals, or lender valuations.</li>
  </ul>

  <h2>Mortgage math (calculated)</h2>
  <p>Monthly principal and interest use the standard fixed-rate formula:</p>
  <p style="font-family:var(--serif);font-size:1.1rem">M = P · r(1 + r)ⁿ / ((1 + r)ⁿ − 1)</p>
  <ul>
    <li><strong>P</strong> = loan principal (price − down payment)</li>
    <li><strong>r</strong> = monthly interest rate (annual rate ÷ 12)</li>
    <li><strong>n</strong> = number of monthly payments (years × 12)</li>
    <li>If the interest rate is 0%, we divide the loan evenly across all payments.</li>
  </ul>

  <h2>Default assumptions (calculated)</h2>
  <ul>
    <li>Interest rate: ${pct(DEFAULTS.rate)}% (editable)</li>
    <li>Property tax: ${pct(DEFAULTS.taxRatePct)}% of home value per year by default. <strong>State pages use a state-specific effective rate</strong> (see below), and you can always enter your own dollar amount.</li>
    <li>Homeowners insurance: ${pct(DEFAULTS.insuranceRatePct)}% of home value per year, unless you enter a dollar amount</li>
    <li>PMI: ${pct(DEFAULTS.pmiRatePct)}% of the loan per year, applied only when the down payment is under 20%</li>
    <li>Closing costs: about 3% of the price, included in "estimated cash needed"</li>
    <li>Income needed: based on a ${DTI_PCT}% housing-cost-to-income guideline</li>
  </ul>

  <h2>State-specific property tax</h2>
  <p>On state pages, the calculator prefills an approximate <strong>effective property-tax rate</strong> for that state (annual property tax as a percentage of home value), rather than a single national figure. Please read these as planning estimates, not your actual bill:</p>
  <ul>
    <li><strong>State rates are planning estimates.</strong> They are statewide approximations compiled from public data, not official figures for your property.</li>
    <li><strong>County and city rates vary widely</strong> within every state — two homes of the same value in the same state can owe very different amounts.</li>
    <li><strong>Exemptions and assessments vary.</strong> Homestead exemptions, senior or veteran exemptions, assessment caps, and how often a county reassesses can all change what you actually pay.</li>
    <li><strong>Enter your local figure for accuracy.</strong> For a realistic result, replace the default with your county's effective rate or your actual annual property-tax dollar amount.</li>
  </ul>
  <p>States without a specific rate fall back to the ${pct(DEFAULTS.taxRatePct)}% national default.</p>

  <h2>Affordability labels</h2>
  <p>When you enter income, we compare your total housing payment to gross monthly income: up to 28% is <strong>Comfortable</strong>, up to 36% <strong>Manageable</strong>, up to 43% <strong>Tight</strong>, and above that <strong>Stretching</strong>. These are general guidelines, not lending decisions, approvals, or qualifications.</p>

  <h2>Limitations</h2>
  <ul>
    <li>Rent comparisons use Zillow ZORI rent data and are available on our city pages; they are snapshots, not a complete rent-vs-buy decision (which also depends on maintenance, time horizon, opportunity cost, appreciation, and transaction costs).</li>
    <li>We cover all states plus a curated first set of city pages. We add cities deliberately rather than generating every place, to keep each page genuinely useful.</li>
    <li>Taxes, insurance, PMI, and rates vary widely by location, lender, and borrower — always confirm with the relevant professional.</li>
  </ul>
  ${T.disclaimer()}
</div></section>`;
  write("methodology/index.html", page(depth, meta, body));
}

function buildPrivacy() {
  const depth = 1;
  const meta = {
    title: "Privacy Policy | Home Payment Atlas",
    description: "How Home Payment Atlas handles your information: calculator inputs processed in your browser, plus our approach to analytics, advertising, and cookies.",
    canonical: "/privacy/",
  };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: "Privacy" }], meta.canonical);
  meta.schema = [crumb.schema];
  const body = `
${crumb.html}
<section class="section prose"><div class="wrap prose">
  <h1>Privacy Policy</h1>
  <p style="color:var(--ink-500)"><strong>Last updated: ${PRIVACY_LAST_UPDATED}.</strong> This policy explains what information Home Payment Atlas does and does not handle, written to be read — not to bury you in legalese.</p>

  <h2>About Home Payment Atlas</h2>
  <p>Home Payment Atlas is a free educational tool that helps you estimate the monthly cost of buying a home — principal and interest, property taxes, insurance, PMI, and HOA — and compare local home-price scenarios using Zillow Research data. It is a static website: the calculators run in your browser, and we do not require an account.</p>

  <h2>Information we collect</h2>
  <p>We aim to collect as little as possible. Specifically:</p>
  <ul>
    <li><strong>Calculator inputs are processed in your browser.</strong> Home price, down payment, rate, income, and the other values you enter are used only to compute results on the page and are stored in the page's URL so you can bookmark or share a scenario. They are <strong>not sent to or stored on our servers</strong>.</li>
    <li><strong>Standard server logs.</strong> Like most websites, our hosting provider may automatically record basic request data (such as IP address, browser type, and the page requested) for security and reliability. We do not use these logs to build profiles of individuals.</li>
  </ul>

  <h2>Analytics</h2>
  <p>We may use privacy-respecting analytics to understand which pages and tools are useful and to improve the site. If analytics are enabled, the events recorded may include things like which page you viewed (the page path), when you change a calculator value, when you select a scenario chip or copy a scenario, and general device/browser metadata. Analytics providers may also infer an <strong>approximate</strong> location (such as city or region) from your IP address. These events describe interactions with the tool — they do not include your name, and the specific dollar values you type are not the point of the measurement.</p>

  <h2>Advertising and Google AdSense</h2>
  <p>To keep the calculators free, we may display ads, including through <strong>Google AdSense</strong>. When advertising is enabled, Google and its partners may use cookies or similar technologies to serve and measure ads, and in some cases to personalize them based on your prior visits to this and other websites. You can learn about and control ad personalization through <a href="https://adssettings.google.com" rel="nofollow noopener" target="_blank">Google Ads Settings</a> and review Google's practices at <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">How Google uses information from sites that use its services</a>. Ad slots on this site are clearly labeled and are never placed above the primary calculator or between your inputs and your results.</p>

  <h2>Cookies and similar technologies</h2>
  <p>The core calculator does not require cookies to work. If analytics or advertising are enabled, those third-party services may set cookies or use similar technologies (such as local storage or device identifiers) on your device. You can control or clear these through your browser settings (see "Your choices" below) and, for ads, through the Google controls linked above.</p>

  <h2>Public Zillow Research data</h2>
  <p>The home-value (ZHVI) and rent (ZORI) figures on this site come from <strong>Zillow Research</strong>'s publicly published datasets. This is aggregated, area-level research data — typical values for states and cities — not live listings and not information about you. See our <a href="../methodology/index.html">methodology</a> for how we use it.</p>

  <h2>Information we do not collect</h2>
  <ul>
    <li>We do not ask you to create an account, and we do not collect names, email addresses, or phone numbers through the calculator.</li>
    <li>We do not store the specific calculator values you enter on our servers.</li>
    <li>We do not sell your personal information.</li>
    <li>We are not a lender and do not collect loan applications, Social Security numbers, or financial-account details.</li>
  </ul>

  <h2>Third-party services</h2>
  <p>This site loads a web font from Google Fonts and, when enabled, analytics and Google AdSense. These providers may receive technical request data (such as your IP address and browser type) as a normal part of serving their content. Their use of that data is governed by their own privacy policies.</p>

  <h2>Your choices</h2>
  <ul>
    <li><strong>Browser controls:</strong> you can block or delete cookies, send a "Do Not Track" or Global Privacy Control signal, and use private-browsing or ad-blocking extensions.</li>
    <li><strong>Ad personalization:</strong> manage it at <a href="https://adssettings.google.com" rel="nofollow noopener" target="_blank">Google Ads Settings</a>.</li>
    <li><strong>Sharing scenarios:</strong> because your inputs live in the page URL, only share a calculator link with people you intend to share those figures with.</li>
  </ul>

  <h2>Children's privacy</h2>
  <p>Home Payment Atlas is intended for a general, adult audience planning a home purchase. It is not directed to children under 13, and we do not knowingly collect personal information from children.</p>

  <h2>Changes to this policy</h2>
  <p>We may update this policy as the site evolves — for example, if we turn on analytics or advertising. When we do, we will revise the "Last updated" date above. Material changes will be reflected here before they take effect.</p>

  <h2>Contact</h2>
  <p>Questions about this policy? Email <a href="mailto:${PRIVACY_CONTACT}">${PRIVACY_CONTACT}</a>.</p>

  ${T.disclaimer()}
</div></section>`;
  write("privacy/index.html", page(depth, meta, body));
}

function buildAbout() {
  const depth = 1;
  const meta = {
    title: "About | Home Payment Atlas",
    description: "About Home Payment Atlas — a calm, premium home-payment planning tool. Know the monthly cost before you tour the house.",
    canonical: "/about/",
  };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: "About" }], meta.canonical);
  meta.schema = [crumb.schema];
  const body = `
${crumb.html}
<section class="section prose"><div class="wrap prose">
  <h1>About Home Payment Atlas</h1>
  <p>Home Payment Atlas exists to answer one question clearly: <em>what would this home really cost each month?</em></p>
  <p>Most calculators stop at principal and interest. Real monthly cost includes property taxes, insurance, PMI, and HOA — so that's what we show, in one calm, readable view. We pair the math with local home-value data from Zillow Research so you can ground your plan in realistic prices for your state.</p>
  <p>Our principle: a planning tool should feel trustworthy and unhurried, not like a lead-generation funnel. We label estimates honestly, keep advertising tasteful and out of the way, and never present results as approvals or offers.</p>
  <p>Start with the <a href="../mortgage-calculator/index.html">mortgage calculator</a> or browse <a href="../states/index.html">state calculators</a>.</p>
</div></section>`;
  write("about/index.html", page(depth, meta, body));
}

// Resource page builder for roadmap tools. These are real, useful explainer
// pages (not thin "coming soon" stubs) with working interim guidance, so they
// carry genuine value. `sections` is an array of { h2, html }. An optional
// `roadmapNote` describes what the dedicated tool will add. `faq` is optional.
function buildResourcePage(slug, { title, h1, desc, lead, sections = [], roadmapNote, faqItems }) {
  const depth = 1;
  const meta = { title: `${title} | Home Payment Atlas`, description: desc, canonical: `/${slug}/` };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: h1 }], meta.canonical);
  const schema = [crumb.schema];

  let faqHtml = "";
  if (faqItems && faqItems.length) {
    const faq = T.faqSection(faqItems);
    faqHtml = faq.html;
    schema.push(faq.schema);
  }
  meta.schema = schema;

  const sectionsHtml = sections
    .map((s) => `<h2>${s.h2}</h2>${s.html}`)
    .join("\n");

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>${h1}</h1>
  <p class="lead" style="max-width:64ch;color:var(--ink-700)">${lead}</p>
</div></section>

<section class="section prose"><div class="wrap prose">
  ${sectionsHtml}
  <div class="card" style="padding:22px;margin:22px 0">
    <h3 style="margin-top:0">Run the numbers now</h3>
    <p style="margin:0;color:var(--ink-700)">The full <a href="../mortgage-calculator/index.html">mortgage calculator</a> already handles down payment, PMI, property tax, insurance, HOA, total interest, and an affordability comfort rating — and every scenario is shareable by link.${roadmapNote ? ` ${roadmapNote}` : ""}</p>
  </div>
  ${T.disclaimer()}
</div></section>

${faqHtml}

<section class="section-tight"><div class="wrap">
  <h2>Related calculators</h2>
  <div class="related-links">
    <a href="../mortgage-calculator/index.html">Mortgage calculator</a>
    <a href="../states/index.html">State calculators</a>
    <a href="../examples/index.html">Payment examples</a>
    <a href="../methodology/index.html">Methodology</a>
  </div>
</div></section>`;
  write(`${slug}/index.html`, page(depth, meta, body));
}

function buildExamplesIndex() {
  const depth = 1;
  const meta = {
    title: "Mortgage Payment Examples | Home Payment Atlas",
    description: "Ready-made mortgage payment examples by home price — see estimated monthly costs at 5%, 10% and 20% down for common price points.",
    canonical: "/examples/",
  };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: "Examples" }], meta.canonical);
  meta.schema = [crumb.schema];
  const prices = [200000, 300000, 400000, 500000, 650000, 800000];
  const rows = prices
    .map(
      (p) =>
        `<tr><td>${money(p)}</td><td>${money(paymentExample(p, 5))}</td><td>${money(paymentExample(p, 10))}</td><td>${money(paymentExample(p, 20))}</td></tr>`
    )
    .join("");
  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>Mortgage payment examples</h1>
  <p class="lead" style="max-width:62ch;color:var(--ink-700)">Estimated full monthly payment (principal, interest, taxes, insurance, PMI) at ${pct(DEFAULTS.rate)}% over ${DEFAULTS.termYears} years using national default assumptions. Open the calculator to adjust any assumption.</p>
</div></section>
<section class="section-tight"><div class="wrap card table-card">
  <table class="data"><thead><tr><th>Home price</th><th>5% down</th><th>10% down</th><th>20% down</th></tr></thead><tbody>${rows}</tbody></table>
</div></section>
<section class="section-tight"><div class="wrap">${T.disclaimer()}</div></section>`;
  write("examples/index.html", page(depth, meta, body));
}

// ------------------------------------------------------------- SITEMAP
function buildSitemap(regions, cities = []) {
  const urls = [
    "/", "/mortgage-calculator/", "/states/", "/methodology/", "/privacy/",
    "/about/", "/examples/", "/rent-vs-buy-calculator/", "/pmi-calculator/",
    "/closing-cost-calculator/", "/refinance-calculator/",
    "/mortgage-on-300k-house/", "/income-needed-for-400k-house/",
    ...regions.map((r) => `/states/${r.slug}/`),
    ...cities.map((c) => c.intendedUrl),
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${T.SITE.url}${u}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  write("sitemap.xml", xml);
  // Launch-safe robots.txt: allow full crawl, expose the sitemap on the
  // configured host. No crawl traps; the 404 page is noindex via meta.
  write(
    "robots.txt",
    [
      "# Home Payment Atlas",
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${T.SITE.url}/sitemap.xml`,
      "",
    ].join("\n")
  );
}

// Brand-matched 404 page (noindex). Self-contained with ROOT-ABSOLUTE links so
// it renders correctly no matter what path the host serves it from.
function build404() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found (404) | ${T.SITE.name}</title>
<meta name="description" content="We couldn't find that page. Jump back to the mortgage calculator, state calculators, methodology, or the homepage.">
<meta name="robots" content="noindex,follow">
<meta name="theme-color" content="#faf7f2">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
<header class="site-header"><div class="wrap">
  <a class="brand" href="/">${T.pinSvg} Home Payment Atlas</a>
  <nav class="nav" aria-label="Primary" style="margin-left:auto">
    <a href="/mortgage-calculator/">Calculator</a>
    <a href="/states/">States</a>
    <a href="/methodology/">Methodology</a>
    <a href="/privacy/">Privacy</a>
  </nav>
</div></header>
<section class="section" style="padding-top:64px"><div class="wrap" style="text-align:center;max-width:640px;margin:0 auto">
  <span class="eyebrow">● 404 — Page not found</span>
  <h1>This address isn't on the map</h1>
  <p class="lead" style="color:var(--ink-700);margin:0 auto 8px">The page you were looking for may have moved or never existed. Here are the most useful places to go next.</p>
  <div class="hero-actions" style="justify-content:center;margin-top:22px">
    <a class="btn btn-primary" href="/mortgage-calculator/">Mortgage Calculator</a>
    <a class="btn btn-ghost" href="/states/">State Calculators</a>
  </div>
  <div class="related-links" style="justify-content:center;margin-top:18px">
    <a href="/">Homepage</a>
    <a href="/methodology/">Methodology</a>
    <a href="/examples/">Payment examples</a>
  </div>
</div></section>
</body>
</html>
`;
  write("404.html", html);
}

// Write the generated social-preview image referenced by og:image.
function buildOgImage() {
  write("assets/og-image.svg", T.ogImageSvg());
}

// Favicon (SVG) + web manifest. Modern browsers use the SVG favicon; a raster
// PNG/ICO can be added pre-launch for older clients (noted in the README).
function buildIcons() {
  write(
    "favicon.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#faf7f2"/><path d="M16 27s8-7.5 8-14a8 8 0 1 0-16 0c0 6.5 8 14 8 14z" fill="#c2693f"/><circle cx="16" cy="12" r="3" fill="#fffdfa"/></svg>\n`
  );
  write(
    "site.webmanifest",
    JSON.stringify(
      {
        name: T.SITE.name,
        short_name: "Atlas",
        description: T.SITE.tagline,
        start_url: "/",
        display: "standalone",
        background_color: "#faf7f2",
        theme_color: "#faf7f2",
        icons: [{ src: "/favicon.svg", type: "image/svg+xml", sizes: "any" }],
      },
      null,
      2
    ) + "\n"
  );

  // ads.txt — lowercase filename at the web root, required for AdSense to verify
  // and sell inventory. Generated from the configured publisher ID.
  if (T.ADS.enabled()) write("ads.txt", T.ADS.adsTxt());
}

// ---------------------------------------------------- RENT VS BUY CALCULATOR
// A real interactive tool (not a guide). Reuses the existing visual components.
function buildRentVsBuyPage() {
  const depth = 1;
  const meta = {
    title: "Rent vs Buy Calculator | Home Payment Atlas",
    description: "Free rent vs buy calculator. Compare the net cost of buying a home (after equity) against renting (after investing your down payment), and find your break-even year.",
    canonical: "/rent-vs-buy-calculator/",
    schema: [appSchema("Rent vs Buy Calculator", "/rent-vs-buy-calculator/", "Compare the multi-year net cost of buying versus renting, with a break-even estimate.")],
  };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: "Rent vs Buy Calculator" }], meta.canonical);

  const field = (id, label, prefix, suffix, value, attrs = "") =>
    `<div class="field"><label for="${id}">${label}</label><div class="input-wrap ${prefix ? "has-pre" : ""} ${suffix ? "has-suf" : ""}">${prefix ? `<span class="affix pre">${prefix}</span>` : ""}<input type="number" id="${id}" inputmode="decimal" value="${value}" ${attrs}>${suffix ? `<span class="affix suf">${suffix}</span>` : ""}</div></div>`;

  const widget = `
<div class="calc" data-rentbuy>
  <div class="calc-inputs card">
    <div class="field-row">
      ${field("rb-price", "Home price", "$", "", 400000, 'min="0" step="1000"')}
      ${field("rb-rent", "Monthly rent", "$", "", 2000, 'min="0" step="50"')}
    </div>
    <div class="field-row">
      ${field("rb-down", "Down payment", "", "%", 20, 'min="0" max="100" step="0.5"')}
      ${field("rb-rate", "Mortgage rate", "", "%", DEFAULTS.rate, 'min="0" max="25" step="0.05"')}
    </div>
    <div class="field-row">
      <div class="field"><label for="rb-term">Loan term</label><select id="rb-term"><option value="30">30 years</option><option value="15">15 years</option></select></div>
      ${field("rb-years", "Years you'll stay", "", "yrs", 7, 'min="1" max="30" step="1"')}
    </div>
    <details class="advanced">
      <summary>Assumptions (editable)</summary>
      <div class="field-row" style="margin-top:14px">
        ${field("rb-appr", "Home appreciation / yr", "", "%", 3, 'min="-5" max="15" step="0.1"')}
        ${field("rb-rentinc", "Rent increase / yr", "", "%", 3, 'min="0" max="15" step="0.1"')}
      </div>
      <div class="field-row">
        ${field("rb-return", "Investment return / yr", "", "%", 5, 'min="0" max="15" step="0.1"')}
        ${field("rb-sell", "Selling costs", "", "%", 6, 'min="0" max="12" step="0.5"')}
      </div>
      <div class="field-row">
        ${field("rb-tax", "Property tax / yr", "", "%", DEFAULTS.taxRatePct, 'min="0" max="5" step="0.05"')}
        ${field("rb-ins", "Insurance / yr", "", "%", DEFAULTS.insuranceRatePct, 'min="0" max="3" step="0.05"')}
      </div>
      ${field("rb-maint", "Maintenance / yr", "", "%", 1, 'min="0" max="5" step="0.1"')}
      <p class="hint">Investment return is the opportunity cost: what a renter could earn investing the cash a buyer ties up upfront.</p>
    </details>
  </div>

  <aside class="calc-result" aria-label="Rent vs buy result">
    <div class="result-card">
      <div class="result-label">Over <span id="rb-years-label">7 years</span></div>
      <div class="result-headline" id="rb-verdict" aria-live="polite" style="font-size:clamp(1.8rem,4.5vw,2.4rem)">—</div>
      <p class="estimate-note" id="rb-sub">Adjust the inputs to compare.</p>
      <div class="mini-stats" style="margin-top:18px">
        <div class="stat"><div class="k">Net cost of buying</div><div class="v" id="rb-buy">$0</div></div>
        <div class="stat"><div class="k">Net cost of renting</div><div class="v" id="rb-rent-cost">$0</div></div>
      </div>
      <div class="comfort" style="margin-top:16px">
        <div class="ctop"><span class="icon-label">Break-even: <strong class="label" id="rb-breakeven">—</strong></span></div>
        <div class="dti" id="rb-note"></div>
      </div>
    </div>
  </aside>
</div>`;

  const faq = T.faqSection([
    { q: "How does this rent vs buy calculator work?", a: "It models each year you own: your mortgage, taxes, insurance, and maintenance, minus the equity you'd keep if you sold (after selling costs and appreciation). It compares that to renting over the same period, crediting the renter with the investment growth on the cash a buyer would tie up upfront. The break-even year is when buying's net cost first drops below renting's." },
    { q: "What is the break-even point?", a: "The number of years you'd need to stay for buying to become cheaper than renting on your assumptions. Because buying has large upfront and selling costs, short stays usually favor renting; longer stays usually favor buying." },
    { q: "Is this a complete rent-vs-buy decision?", a: "No. It's an estimate to frame the trade-off. It can't capture everything — job flexibility, the risk and effort of ownership, tax situations, or how markets actually move. Treat it as a starting point, not an answer." },
    { q: "Why does the down payment matter so much?", a: "The cash you put down (and closing costs) is money a renter could invest instead. This calculator credits the renter with that investment growth, which is why a higher assumed investment return makes renting look better." },
  ]);
  meta.schema.push(faq.schema, crumb.schema);

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>Rent vs Buy Calculator</h1>
  <p class="lead" style="max-width:64ch;color:var(--ink-700)">Buying isn't automatically better than renting. Compare the multi-year net cost of each — after equity on one side and investment growth on the other — and see your break-even year. Results update as you type.</p>
</div></section>

<section class="section-tight"><div class="wrap">${widget}</div></section>

<section class="section-tight"><div class="wrap">${T.disclaimer()}</div></section>

${T.adSlot("horizontal", "in-content, after first result")}

<section class="section"><div class="wrap"><div class="prose">
  <h2>How to read this</h2>
  <p><strong>Net cost of buying</strong> is everything you pay to own over the period — upfront cash, mortgage, taxes, insurance, maintenance — minus the equity you'd walk away with if you sold (after appreciation and selling costs). <strong>Net cost of renting</strong> is the rent you'd pay over the same years, minus the investment growth on the cash a buyer ties up. Lower wins.</p>
  <h2>What buying actually costs</h2>
  <p>Owning is more than the mortgage payment: principal &amp; interest, property tax, homeowners insurance, PMI (under 20% down), and maintenance (often ~1% of value per year), plus the down payment and roughly 3% in closing costs. Some of each payment builds equity, and fixed-rate principal &amp; interest doesn't rise with inflation.</p>
  <h2>Why time horizon decides it</h2>
  <p>Because buying carries large upfront and selling costs, it usually takes several years for ownership to come out ahead — frequently 5+ years, though your break-even above depends on your inputs. Short stays favor renting; longer stays favor buying. Several of our <a href="../states/index.html">city pages</a> also show a typical local rent next to the estimated cost of buying.</p>
  ${T.disclaimer()}
</div></div></section>

${faq.html}

${T.adSlot("lower", "in-content, near FAQ")}

<section class="section-tight"><div class="wrap">
  <h2>Related calculators</h2>
  <div class="related-links">
    <a href="../mortgage-calculator/index.html">Mortgage calculator</a>
    <a href="../states/index.html">State &amp; city calculators</a>
    <a href="../pmi-calculator/index.html">PMI calculator</a>
    <a href="../methodology/index.html">Methodology</a>
  </div>
</div></section>

<script src="../assets/atlas-anim.js" defer></script>
<script src="../assets/rentbuy.js" defer></script>`;
  write("rent-vs-buy-calculator/index.html", page(depth, meta, body));
}

// ---------------------------------------------------- GENERIC CALCULATOR PAGE
// Renders a calculator page (hero + widget + disclaimer + ads + prose + FAQ +
// related links + scripts) for the PMI / closing-cost / refinance mini-calcs.
function buildCalcPage(slug, { title, h1, desc, lead, widget, scripts = [], sections = [], faqItems = [], related = [] }) {
  const depth = 1;
  const meta = { title: `${title} | Home Payment Atlas`, description: desc, canonical: `/${slug}/`,
    schema: [appSchema(h1, `/${slug}/`, desc)] };
  const crumb = T.breadcrumbs(depth, [{ name: "Home", href: "index.html" }, { name: h1 }], meta.canonical);
  const faq = faqItems.length ? T.faqSection(faqItems) : null;
  meta.schema.push(crumb.schema);
  if (faq) meta.schema.push(faq.schema);

  const proseSections = sections.map((s) => `<h2>${s.h2}</h2>${s.html}`).join("\n");
  const relatedLinks = related.map((r) => `<a href="${r.href}">${r.label}</a>`).join("");
  const scriptTags = ['<script src="../assets/atlas-anim.js" defer></script>']
    .concat(scripts.map((s) => `<script src="${s}" defer></script>`)).join("\n");

  const body = `
${crumb.html}
<section class="section-tight"><div class="wrap">
  <h1>${h1}</h1>
  <p class="lead" style="max-width:64ch;color:var(--ink-700)">${lead}</p>
</div></section>

<section class="section-tight"><div class="wrap">${widget}</div></section>

<section class="section-tight"><div class="wrap">${T.disclaimer()}</div></section>

${T.adSlot("horizontal", "in-content, after first result")}

<section class="section"><div class="wrap"><div class="prose">
  ${proseSections}
  ${T.disclaimer()}
</div></div></section>

${faq ? faq.html : ""}

${T.adSlot("lower", "in-content, near FAQ")}

<section class="section-tight"><div class="wrap">
  <h2>Related calculators</h2>
  <div class="related-links">${relatedLinks}</div>
</div></section>

${scriptTags}`;
  write(`${slug}/index.html`, page(depth, meta, body));
}

// Small helper for calculator input fields (reuses existing form components).
function calcField(id, label, prefix, suffix, value, attrs = "") {
  return `<div class="field"><label for="${id}">${label}</label><div class="input-wrap ${prefix ? "has-pre" : ""} ${suffix ? "has-suf" : ""}">${prefix ? `<span class="affix pre">${prefix}</span>` : ""}<input type="number" id="${id}" inputmode="decimal" value="${value}" ${attrs}>${suffix ? `<span class="affix suf">${suffix}</span>` : ""}</div></div>`;
}

// Stat tile used inside the mini-calculator result cards.
function statTile(k, id, sub) {
  return `<div class="stat"><div class="k">${k}</div><div class="v" id="${id}">$0</div>${sub ? `<div class="sub" style="font-size:.72rem;color:var(--ink-300)">${sub}</div>` : ""}</div>`;
}

// ------------------------------------------------------------------ RUN
const { regions, latestDate, detected } = buildRegions();

// Curated priority-1 city pages (empty when city data isn't downloaded).
const cityData = buildCities(regions);
const cities = cityData.cities;
const citiesByState = new Map();
for (const c of cities) {
  if (!citiesByState.has(c.stateSlug)) citiesByState.set(c.stateSlug, []);
  citiesByState.get(c.stateSlug).push(c);
}

buildHome(regions);
buildCalculator();
buildStatesIndex(regions, cities);
regions.forEach((r) => buildStatePage(r, regions, citiesByState.get(r.slug) || []));
cities.forEach((c) => buildCityPage(c, cities, regions));
buildMethodology(regions);
buildPrivacy();
buildAbout();
buildExamplesIndex();
buildRentVsBuyPage();

// ---- PMI calculator ----
buildCalcPage("pmi-calculator", {
  title: "PMI Calculator — Cost & Removal",
  h1: "PMI Calculator",
  desc: "Estimate your monthly private mortgage insurance (PMI), the total you'll pay until you reach 20% equity, and roughly when it cancels.",
  lead: "Private mortgage insurance (PMI) applies when your down payment is under 20%. Estimate the monthly cost, how long it lasts, and the total you'll pay before it drops off.",
  scripts: ["../assets/pmi.js"],
  widget: `<div class="calc" data-pmi>
    <div class="calc-inputs card">
      <div class="field-row">${calcField("pmi-price", "Home price", "$", "", 400000, 'min="0" step="1000"')}${calcField("pmi-down", "Down payment", "", "%", 10, 'min="0" max="100" step="0.5"')}</div>
      <div class="field-row">${calcField("pmi-rate", "Interest rate", "", "%", DEFAULTS.rate, 'min="0" max="25" step="0.05"')}<div class="field"><label for="pmi-term">Loan term</label><select id="pmi-term"><option value="30">30 years</option><option value="15">15 years</option></select></div></div>
      ${calcField("pmi-pct", "PMI rate / yr", "", "%", DEFAULTS.pmiRatePct, 'min="0" max="3" step="0.05"')}
      <p class="hint">PMI commonly runs 0.3%–1.5% of the loan per year, depending on credit and down payment.</p>
    </div>
    <aside class="calc-result" aria-label="PMI result"><div class="result-card">
      <div class="result-label">Estimated monthly PMI</div>
      <div class="result-headline" id="pmi-monthly" aria-live="polite">$0</div>
      <p class="estimate-note" id="pmi-sub">Enter your numbers to estimate PMI.</p>
      <div class="mini-stats" style="margin-top:18px">
        ${statTile("Loan amount", "pmi-loan")}
        ${statTile("Total PMI until 20% equity", "pmi-total")}
        <div class="stat"><div class="k">Drops off after</div><div class="v" id="pmi-cancel">—</div></div>
      </div>
    </div></aside>
  </div>`,
  sections: [
    { h2: "What PMI is and why you pay it", html: "<p>On a conventional loan, lenders usually require PMI when your down payment is below 20% (a loan-to-value ratio above 80%). It protects the lender — not you — and is added to your monthly payment until you build enough equity.</p>" },
    { h2: "How to remove PMI", html: "<p>You can typically request cancellation once your balance reaches 80% of the original value, and lenders generally drop it automatically at 78%. Paying down principal faster, a larger down payment, or rising home values all get you there sooner. The calculator above estimates when you'd reach 20% equity at scheduled payments.</p>" },
  ],
  faqItems: [
    { q: "When does PMI go away?", a: "Generally when your loan-to-value reaches 80% (by request) or 78% (automatically), based on the original home value. Paying down principal or rising values can speed this up." },
    { q: "How do I avoid PMI?", a: "Put 20% or more down, or explore lender-paid PMI or piggyback loans. Each has trade-offs — a larger down payment is the most direct route." },
  ],
  related: [
    { href: "../mortgage-calculator/index.html", label: "Mortgage calculator" },
    { href: "../closing-cost-calculator/index.html", label: "Closing cost calculator" },
    { href: "../rent-vs-buy-calculator/index.html", label: "Rent vs buy" },
    { href: "../methodology/index.html", label: "Methodology" },
  ],
});

// ---- Closing cost calculator ----
buildCalcPage("closing-cost-calculator", {
  title: "Closing Cost Calculator — Cash to Close",
  h1: "Closing Cost Calculator",
  desc: "Estimate your closing costs and total cash to close — down payment plus closing costs — with an illustrative line-item breakdown.",
  lead: "Closing costs are the one-time fees to finalize a purchase, on top of your down payment. Estimate them and your total cash to close.",
  scripts: ["../assets/closing.js"],
  widget: `<div class="calc" data-closing>
    <div class="calc-inputs card">
      <div class="field-row">${calcField("cl-price", "Home price", "$", "", 400000, 'min="0" step="1000"')}${calcField("cl-down", "Down payment", "", "%", 20, 'min="0" max="100" step="0.5"')}</div>
      ${calcField("cl-rate", "Closing costs", "", "%", 3, 'min="0" max="8" step="0.1"')}
      <p class="hint">Closing costs usually total about 2–5% of the price. Adjust to match your loan estimate.</p>
      <div class="card" style="padding:16px;margin-top:6px;background:var(--sand-50)">
        <div class="result-label" style="margin-bottom:8px">Illustrative breakdown</div>
        <div class="breakdown">
          <div class="breakdown-row"><span></span><span>Loan origination &amp; underwriting</span><span class="amt" id="cl-l1" data-line="0.9">$0</span></div>
          <div class="breakdown-row"><span></span><span>Title &amp; escrow</span><span class="amt" id="cl-l2" data-line="0.8">$0</span></div>
          <div class="breakdown-row"><span></span><span>Appraisal &amp; inspection</span><span class="amt" id="cl-l3" data-line="0.4">$0</span></div>
          <div class="breakdown-row"><span></span><span>Taxes, recording &amp; transfer</span><span class="amt" id="cl-l4" data-line="0.5">$0</span></div>
          <div class="breakdown-row"><span></span><span>Prepaids (taxes/insurance)</span><span class="amt" id="cl-l5" data-line="0.4">$0</span></div>
        </div>
      </div>
    </div>
    <aside class="calc-result" aria-label="Closing cost result"><div class="result-card">
      <div class="result-label">Total cash to close</div>
      <div class="result-headline" id="cl-cash" aria-live="polite">$0</div>
      <p class="estimate-note" id="cl-sub">Down payment plus estimated closing costs.</p>
      <div class="mini-stats" style="margin-top:18px">
        ${statTile("Closing costs", "cl-closing")}
        ${statTile("Down payment", "cl-downamt")}
        ${statTile("Loan amount", "cl-loan")}
      </div>
    </div></aside>
  </div>`,
  sections: [
    { h2: "What's included", html: "<p>Typical closing costs include loan origination and underwriting fees, an appraisal, title search and title insurance, escrow/settlement fees, recording fees and transfer taxes, and prepaid items like the first chunk of property taxes and homeowners insurance. Together these usually total about 2–5% of the price. The breakdown above is illustrative and scales with the percentage you enter.</p>" },
    { h2: "What's negotiable", html: "<p>Some fees are fixed (government recording, transfer taxes), but others — lender fees, title services, and who pays certain costs — can be shopped or negotiated. In some markets you can ask the seller for a credit toward closing costs.</p>" },
  ],
  faqItems: [
    { q: "How much are closing costs?", a: "Usually about 2–5% of the purchase price, varying by location, lender, and loan type. The calculator defaults to 3% — adjust it to your loan estimate." },
    { q: "Are closing costs separate from the down payment?", a: "Yes. Closing costs are paid in addition to your down payment; together they make up your total cash to close." },
  ],
  related: [
    { href: "../mortgage-calculator/index.html", label: "Mortgage calculator" },
    { href: "../pmi-calculator/index.html", label: "PMI calculator" },
    { href: "../rent-vs-buy-calculator/index.html", label: "Rent vs buy" },
    { href: "../methodology/index.html", label: "Methodology" },
  ],
});

// ---- Refinance calculator ----
buildCalcPage("refinance-calculator", {
  title: "Refinance Calculator — Break-Even",
  h1: "Refinance Calculator",
  desc: "Compare your current mortgage to a new one: monthly savings, the break-even point on refinance costs, and the lifetime interest difference.",
  lead: "Refinancing replaces your current mortgage with a new one. See your monthly savings and how long it takes to recoup the costs — your break-even point.",
  scripts: ["../assets/refi.js"],
  widget: `<div class="calc" data-refi>
    <div class="calc-inputs card">
      ${calcField("rf-balance", "Current loan balance", "$", "", 320000, 'min="0" step="1000"')}
      <div class="field-row">${calcField("rf-crate", "Current rate", "", "%", 7, 'min="0" max="25" step="0.05"')}${calcField("rf-cterm", "Years left", "", "yrs", 27, 'min="1" max="40" step="1"')}</div>
      <div class="field-row">${calcField("rf-nrate", "New rate", "", "%", 6, 'min="0" max="25" step="0.05"')}${calcField("rf-nterm", "New term", "", "yrs", 30, 'min="1" max="40" step="1"')}</div>
      ${calcField("rf-costs", "Refinance costs", "$", "", 4000, 'min="0" step="100"')}
    </div>
    <aside class="calc-result" aria-label="Refinance result"><div class="result-card">
      <div class="result-label">Estimated monthly savings</div>
      <div class="result-headline" id="rf-savings" aria-live="polite">$0</div>
      <p class="estimate-note" id="rf-sub">Enter your current and new loan terms.</p>
      <div class="mini-stats" style="margin-top:18px">
        ${statTile("Current payment", "rf-current")}
        ${statTile("New payment", "rf-new")}
        <div class="stat"><div class="k">Break-even</div><div class="v" id="rf-breakeven">—</div></div>
        ${statTile("Lifetime interest saved", "rf-interest")}
      </div>
    </div></aside>
  </div>`,
  sections: [
    { h2: "The break-even point", html: "<p>Refinancing has closing costs of its own. The key question is how long it takes the monthly savings to cover those costs: <em>break-even months = refinance costs ÷ monthly savings</em>. If you'll keep the loan well past that point, refinancing likely pays off; if you might move sooner, it may not.</p>" },
    { h2: "Watch the loan term", html: "<p>A lower rate on a longer term can reduce your monthly payment while increasing total interest, because you're stretching the balance over more years. The \"lifetime interest saved\" figure above can go negative when that happens — compare both the monthly and the long-run numbers.</p>" },
  ],
  faqItems: [
    { q: "How do I know if refinancing is worth it?", a: "Divide the refinance's costs by your monthly savings to get the break-even in months. If you'll keep the loan past that point, it usually pays off." },
    { q: "Does refinancing reset my loan term?", a: "It can. A new 30-year loan restarts the clock; choosing a shorter term or making extra payments avoids stretching out total interest." },
  ],
  related: [
    { href: "../mortgage-calculator/index.html", label: "Mortgage calculator" },
    { href: "../pmi-calculator/index.html", label: "PMI calculator" },
    { href: "../closing-cost-calculator/index.html", label: "Closing cost calculator" },
    { href: "../methodology/index.html", label: "Methodology" },
  ],
});

// SEO scenario pages — real, useful answers with full breakdowns by down payment.
const dpTable = (priceVal) => {
  const row = (dp) => `<tr${dp === 20 ? ' class="featured"' : ""}><td>${dp}% down</td><td>${money(priceVal * dp / 100)}</td><td>${money(paymentExample(priceVal, dp, true))}</td><td>${money(paymentExample(priceVal, dp))}</td></tr>`;
  return `<div class="card table-card"><table class="data"><thead><tr><th>Down payment</th><th>Cash down</th><th>P&amp;I only</th><th>Full payment</th></tr></thead><tbody>${[5, 10, 20].map(row).join("")}</tbody></table></div>`;
};

buildResourcePage("mortgage-on-300k-house", {
  title: "Mortgage Payment on a $300,000 House",
  h1: "Mortgage payment on a $300,000 house",
  desc: `What is the monthly mortgage payment on a $300,000 home? About ${money(paymentExample(300000, 20))}/mo with 20% down including taxes and insurance. See a full breakdown by down payment.`,
  lead: `At ${pct(DEFAULTS.rate)}% over ${DEFAULTS.termYears} years with 20% down, principal and interest on a $300,000 home is about ${money(paymentExample(300000, 20, true))}/mo; the full payment with taxes and insurance is around ${money(paymentExample(300000, 20))}/mo.`,
  sections: [
    { h2: "Monthly payment by down payment", html: `<p>Smaller down payments mean a larger loan and, under 20%, added PMI. Here's how a $300,000 home compares (national default assumptions, ${pct(DEFAULTS.rate)}% rate):</p>${dpTable(300000)}<p class="hint" style="margin-top:8px">P&amp;I is principal &amp; interest only; the full payment adds property tax, insurance and (under 20% down) PMI.</p>` },
    { h2: "What changes the number most", html: "<p>Interest rate and down payment move the payment the most, followed by property tax (which varies a lot by state). Your own quote depends on credit, loan type, and local tax and insurance rates — open the calculator to plug in real figures." },
  ],
  faqItems: [
    { q: "What income do I need for a $300,000 house?", a: `Using a ${DTI_PCT}% housing-cost-to-income guideline with 20% down, roughly ${money(incomeNeeded(300000, 20))} per year — a planning estimate, not a pre-qualification.` },
  ],
});

buildResourcePage("income-needed-for-400k-house", {
  title: "Income Needed for a $400,000 House",
  h1: "Income needed for a $400,000 house",
  desc: `How much income do you need to buy a $400,000 home? Roughly ${money(incomeNeeded(400000, 20))} a year using a ${DTI_PCT}% housing guideline with 20% down. See how it changes with your down payment.`,
  lead: `Using a ${DTI_PCT}% housing-cost-to-income guideline and 20% down, you'd want roughly ${money(incomeNeeded(400000, 20))} in annual household income to buy a $400,000 home comfortably. This is a planning estimate, not a pre-qualification.`,
  sections: [
    { h2: "Payment and suggested income by down payment", html: `<div class="card table-card"><table class="data"><thead><tr><th>Down payment</th><th>Full payment</th><th>Suggested income</th></tr></thead><tbody>${[5, 10, 20].map((dp) => `<tr${dp === 20 ? ' class="featured"' : ""}><td>${dp}% down</td><td>${money(paymentExample(400000, dp))}</td><td>${money(incomeNeeded(400000, dp))}</td></tr>`).join("")}</tbody></table></div><p class="hint" style="margin-top:8px">Lower down payments raise both the payment (more loan + PMI) and the income needed.</p>` },
    { h2: "How lenders really decide", html: `<p>The ${DTI_PCT}% figure is a front-end guideline for housing costs alone. Lenders also look at your total debt-to-income (including car loans, student loans and credit cards), credit score, and reserves. Two people buying the same home can qualify for very different terms.</p>` },
  ],
  faqItems: [
    { q: "Can I buy a $400,000 house on a lower income?", a: "Possibly — a larger down payment, a lower rate, longer term, or minimal other debts all reduce the income you'd need. Use the calculator with your real numbers to check." },
  ],
});

build404();
buildOgImage();
buildIcons();
buildSitemap(regions, cities);

// Report
const found = Object.entries(detected).filter(([, v]) => v.found).map(([k]) => k);
const missing = Object.entries(detected).filter(([, v]) => !v.found).map(([k]) => k);
console.log(`Built ${regions.length} state pages. Latest data month: ${latestDate}`);
console.log(`Datasets detected (${found.length}): ${found.join(", ")}`);
console.log(`Datasets missing (${missing.length}): ${missing.join(", ") || "none"}`);

// City pages report.
if (cityData.available) {
  console.log(`Built ${cities.length} curated city pages (priority-1). Rent (ZORI) coverage: ${cityData.rentCoverage}/${cities.length}.`);
  if (cities.length) console.log(`  Cities: ${cities.map((c) => `${c.cityName}, ${c.stateCode}`).join("; ")}`);
  if (cityData.skipped.length) {
    console.log(`  Skipped ${cityData.skipped.length} curated market(s):`);
    for (const s of cityData.skipped) console.log(`    · ${s.market.cityName}, ${s.market.stateCode} — ${s.reason}`);
  }
} else {
  console.log("No city pages generated — City ZHVI data not present (run: node scripts/download-zillow-data.mjs --all). State-only build unaffected.");
}

// Optional: read the Zillow manifest (written by scripts/download-zillow-data.mjs)
// to report which expansion data groups are present. Never required for the build.
let dataGroups = null;
try {
  const mPath = join(process.cwd(), "csv", "zillow-manifest.json");
  if (existsSync(mPath)) {
    const manifest = JSON.parse(readFileSync(mPath, "utf8"));
    const all = { ...(manifest.requiredGroups || {}), ...(manifest.optionalGroups || {}) };
    dataGroups = Object.fromEntries(
      Object.entries(all).map(([k, v]) => [k, { found: v.found || 0, required: !!v.required }])
    );
    const present = Object.entries(dataGroups).filter(([, v]) => v.found > 0).map(([k, v]) => `${k}(${v.found})`);
    console.log(`Zillow data groups present: ${present.join(", ") || "none"}`);
    if (manifest.summary && manifest.summary.discovered != null) {
      console.log(`Manifest: ${manifest.summary.discovered} links discovered, ${manifest.summary.downloaded} downloaded, generated ${manifest.generatedAt}`);
    }
  } else {
    console.log("Zillow manifest not found — using existing CSVs (run scripts/download-zillow-data.mjs to refresh).");
  }
} catch (err) {
  console.warn(`Could not read Zillow manifest: ${err.message}`);
}

// Also emit the normalized data as JSON for reuse / future city pages.
writeFileSync(join(OUT, "data", "states.json"), JSON.stringify({ latestDate, defaults: DEFAULTS, dataGroups, regions }, null, 2));

// Normalized city data — only the generated priority-1 city pages.
writeFileSync(
  join(OUT, "data", "cities.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      defaults: DEFAULTS,
      count: cities.length,
      rentCoverage: cityData.rentCoverage,
      skipped: cityData.skipped.map((s) => ({ cityName: s.market.cityName, stateCode: s.market.stateCode, reason: s.reason })),
      cities,
    },
    null,
    2
  )
);
