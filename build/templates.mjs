// HTML templates for Home Payment Atlas. Pure string builders — no framework.

// Single source of truth for the public origin. Override at build time with
//   SITE_URL=https://www.yourdomain.com node build/build.mjs
// Used by every canonical link, OG url, sitemap entry, robots.txt and JSON-LD URL.
// NOTE: this is the APEX (no www). Configure your host to 301-redirect
// www.homepaymentatlas.com → homepaymentatlas.com so there's one canonical host.
export const SITE_URL = (process.env.SITE_URL || "https://homepaymentatlas.com").replace(/\/+$/, "");

export const SITE = {
  name: "Home Payment Atlas",
  tagline: "Know the monthly cost before you tour the house.",
  url: SITE_URL,
};

// -------------------------------------------------------------------------
// Monetization config — ONE place to wire up advertising.
// Set ADSENSE_CLIENT_ID at build time to switch every ad slot from a tasteful
// placeholder to a real AdSense unit. Leave it blank to keep placeholders.
//   ADSENSE_CLIENT_ID=ca-pub-1234567890123456 node build/build.mjs
// Per-placement slot IDs can be supplied via env or edited here directly.
// -------------------------------------------------------------------------
export const ADS = {
  // AdSense publisher ID. When set, the AdSense loader + ads.txt are emitted
  // (needed for approval / Auto Ads). Override via env if it ever changes.
  clientId: process.env.ADSENSE_CLIENT_ID || "ca-pub-3840656918521680",
  enabled() {
    return /^ca-pub-\d{10,}$/.test(this.clientId);
  },
  // Publisher ID without the "ca-" prefix, for ads.txt.
  pubId() {
    return this.clientId.replace(/^ca-/, "");
  },
  // ads.txt line authorizing Google to sell this site's inventory.
  adsTxt() {
    return `google.com, ${this.pubId()}, DIRECT, f08c47fec0942fa0\n`;
  },
  // Manual ad-unit slot IDs by placement. Create these in the AdSense dashboard
  // and supply via env. Until a real numeric slot ID is set, that placement
  // stays a tasteful placeholder (we never ship broken <ins> with a fake slot).
  slots: {
    horizontal: process.env.ADSENSE_SLOT_HORIZONTAL || "",
    sidebar: process.env.ADSENSE_SLOT_SIDEBAR || "",
    lower: process.env.ADSENSE_SLOT_LOWER || "",
  },
  slotLive(kind) {
    return this.enabled() && /^\d{6,}$/.test(this.slots[kind] || "");
  },
};

// Social preview image (referenced by og:image / twitter:image). Generated as a
// branded SVG into site/assets by the build. Swap in a 1200×630 PNG for production.
export const OG_IMAGE_PATH = "/assets/og-image.svg";

const money = (n) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");

// Clean percent display — strips floating-point artifacts (28.000000000000004 → "28").
// Keeps up to `max` decimals but no trailing zeros.
const pct = (n, max = 2) => {
  if (n == null || isNaN(n)) return "—";
  return Number(n.toFixed(max)).toString();
};

export { money, pct };

// `depth` = how many ../ to reach site root (0 for /, 1 for /mortgage-calculator/, 2 for /states/x/).
const rel = (depth, path) => "../".repeat(depth) + path;

const pinSvg = `<svg class="pin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" fill="#c2693f"/><circle cx="12" cy="10" r="2.6" fill="#fffdfa"/></svg>`;

function head(depth, { title, description, canonical, schema = [], noindex = false }) {
  const css = rel(depth, "assets/styles.css");
  const ogImage = SITE_URL + OG_IMAGE_PATH;
  // Sitewide entity, defined once on the homepage (the canonical home for it).
  const siteSchema =
    canonical === "/"
      ? [
          { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE_URL + "/", logo: ogImage },
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE_URL + "/" },
        ]
      : [];
  const schemaTags = siteSchema
    .concat(schema)
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n");

  // Lightweight analytics shim: always defines window.trackAtlasEvent so calls
  // are safe even when no provider is installed. A provider can override it, or
  // read from the window.atlasDataLayer queue it populates.
  const analyticsShim = `<script>window.atlasDataLayer=window.atlasDataLayer||[];window.trackAtlasEvent=window.trackAtlasEvent||function(n,p){try{window.atlasDataLayer.push({event:n,payload:p||{},ts:Date.now()});if(window.gtag){window.gtag('event',n,p||{});}if(window.plausible){window.plausible(n,{props:p||{}});}}catch(e){}};</script>`;

  // AdSense loader — only emitted when a valid client ID is configured.
  const adsenseLoader = ADS.enabled()
    ? `\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.clientId}" crossorigin="anonymous"></script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">${noindex ? '\n<meta name="robots" content="noindex,follow">' : ""}
<link rel="canonical" href="${SITE_URL}${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}${canonical}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#faf7f2">
<link rel="icon" href="${rel(depth, "favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel(depth, "favicon.svg")}">
<link rel="manifest" href="${rel(depth, "site.webmanifest")}">
${analyticsShim}${adsenseLoader}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${css}">
${schemaTags}
</head>`;
}

function header(depth) {
  const h = (p) => rel(depth, p);
  return `<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${h("index.html")}">${pinSvg} Home Payment Atlas</a>
    <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" onclick="var n=document.getElementById('nav');var o=n.classList.toggle('open');this.setAttribute('aria-expanded',o)">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b2622" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
    <nav class="nav" id="nav" aria-label="Primary">
      <a href="${h("mortgage-calculator/index.html")}">Calculator</a>
      <a href="${h("states/index.html")}">States</a>
      <a href="${h("methodology/index.html")}">Methodology</a>
      <a href="${h("privacy/index.html")}">Privacy</a>
    </nav>
  </div>
</header>`;
}

function footer(depth) {
  const h = (p) => rel(depth, p);
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-cols">
      <div>
        <a class="brand" href="${h("index.html")}" style="margin-bottom:12px">${pinSvg} Home Payment Atlas</a>
        <p style="max-width:36ch">Know the monthly cost before you tour the house. Clear, calm home-payment planning built on Zillow Research home-value data.</p>
      </div>
      <div>
        <h4>Calculators</h4>
        <a href="${h("mortgage-calculator/index.html")}">Mortgage Calculator</a>
        <a href="${h("rent-vs-buy-calculator/index.html")}">Rent vs Buy Calculator</a>
        <a href="${h("pmi-calculator/index.html")}">PMI Calculator</a>
        <a href="${h("closing-cost-calculator/index.html")}">Closing Cost Calculator</a>
        <a href="${h("refinance-calculator/index.html")}">Refinance Calculator</a>
      </div>
      <div>
        <h4>States</h4>
        <a href="${h("states/index.html")}">All States</a>
        <a href="${h("states/maryland/index.html")}">Maryland</a>
        <a href="${h("states/texas/index.html")}">Texas</a>
        <a href="${h("states/california/index.html")}">California</a>
        <a href="${h("states/florida/index.html")}">Florida</a>
      </div>
      <div>
        <h4>About</h4>
        <a href="${h("methodology/index.html")}">Methodology</a>
        <a href="${h("about/index.html")}">About</a>
        <a href="${h("privacy/index.html")}">Privacy &amp; Disclaimer</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p style="margin:0">Estimates only — not financial advice, a loan offer, or a guarantee of rates, approval, taxes, insurance, or home values. Home-value examples use Zillow Research (ZHVI) data and may not reflect current listings or appraisals. © ${new Date().getFullYear()} Home Payment Atlas.</p>
    </div>
  </div>
</footer>`;
}

function breadcrumbs(depth, trail, canonical) {
  // trail: [{name, href}] ; href is written root-relative (e.g. "states/index.html").
  // The last item (current page) has no href and resolves to the page's canonical.
  const absOf = (href) => SITE_URL + "/" + (href || "").replace(/index\.html$/, "");
  const items = trail
    .map((t) =>
      t.href
        ? `<a href="${rel(depth, t.href)}">${t.name}</a>`
        : `<span aria-current="page" style="color:var(--ink-700)">${t.name}</span>`
    )
    .join('<span aria-hidden="true">›</span>');
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: t.href ? absOf(t.href) : SITE_URL + (canonical || "/"),
    })),
  };
  return {
    html: `<nav class="crumbs wrap" aria-label="Breadcrumb">${items}</nav>`,
    schema: ld,
  };
}

// The full calculator widget. `cfg` is a JS object injected as ATLAS_CONFIG.
function calculatorWidget(depth, { defaults, scenarios = null, prefill = {}, region = null }) {
  const jsPath = rel(depth, "assets/calculator.js");
  const pricePresets = scenarios && scenarios.prices ? scenarios.prices : null;

  const priceChips = pricePresets
    ? `<div class="chip-group"><span class="label">Home price examples</span><div class="scenario-chips">${pricePresets
        .map(
          (p, i) =>
            `<button type="button" class="chip${i === 1 ? " active" : ""}" data-scenario="price" data-value="${p.value}">${p.label} · ${money(p.value)}</button>`
        )
        .join("")}</div></div>`
    : "";

  const downChips = `<div class="chip-group"><span class="label">Down payment</span><div class="scenario-chips">
      <button type="button" class="chip" data-scenario="down" data-value="5">5% down</button>
      <button type="button" class="chip" data-scenario="down" data-value="10">10% down</button>
      <button type="button" class="chip active" data-scenario="down" data-value="20">20% down</button>
    </div></div>`;

  const cfg = { defaults, scenarios, region };

  return `
<div class="calc" data-calculator>
  <div class="calc-inputs card">
    ${priceChips}
    ${downChips}

    <div class="field">
      <label for="price">Home price</label>
      <div class="input-wrap has-pre"><span class="affix pre">$</span>
        <input type="number" id="price" inputmode="numeric" min="0" step="1000" value="${prefill.price || 400000}" aria-describedby="price-hint">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="downPct">Down payment (%)</label>
        <div class="input-wrap has-suf"><span class="affix suf">%</span>
          <input type="number" id="downPct" inputmode="decimal" min="0" max="100" step="0.5" value="${prefill.downPct || 20}">
        </div>
      </div>
      <div class="field">
        <label for="downAmt">Down payment ($)</label>
        <div class="input-wrap has-pre"><span class="affix pre">$</span>
          <input type="number" id="downAmt" inputmode="numeric" min="0" step="1000" value="">
        </div>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="rate">Interest rate</label>
        <div class="input-wrap has-suf"><span class="affix suf">%</span>
          <input type="number" id="rate" inputmode="decimal" min="0" max="25" step="0.05" value="${prefill.rate || defaults.rate}">
        </div>
      </div>
      <div class="field">
        <label for="term">Loan term</label>
        <select id="term">
          <option value="30"${(prefill.term || 30) == 30 ? " selected" : ""}>30 years</option>
          <option value="20"${prefill.term == 20 ? " selected" : ""}>20 years</option>
          <option value="15"${prefill.term == 15 ? " selected" : ""}>15 years</option>
          <option value="10"${prefill.term == 10 ? " selected" : ""}>10 years</option>
        </select>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="tax">Property tax <span class="hint" style="font-weight:400">/ year</span></label>
        <div class="input-wrap has-pre"><span class="affix pre">$</span>
          <input type="number" id="tax" inputmode="numeric" min="0" step="100" placeholder="Auto (${pct(defaults.taxRatePct)}% of price)">
        </div>
        ${defaults.taxNote ? `<p class="hint">${defaults.taxNote}</p>` : ""}
      </div>
      <div class="field">
        <label for="insurance">Home insurance <span class="hint" style="font-weight:400">/ year</span></label>
        <div class="input-wrap has-pre"><span class="affix pre">$</span>
          <input type="number" id="insurance" inputmode="numeric" min="0" step="50" placeholder="Auto (${pct(defaults.insuranceRatePct)}% of price)">
        </div>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="hoa">HOA <span class="hint" style="font-weight:400">/ month</span></label>
        <div class="input-wrap has-pre"><span class="affix pre">$</span>
          <input type="number" id="hoa" inputmode="numeric" min="0" step="10" value="0">
        </div>
      </div>
      <div class="field">
        <label for="pmiRate">PMI rate <span class="hint" style="font-weight:400">/ year</span></label>
        <div class="input-wrap has-suf"><span class="affix suf">%</span>
          <input type="number" id="pmiRate" inputmode="decimal" min="0" max="3" step="0.05" placeholder="${pct(defaults.pmiRatePct)}">
        </div>
      </div>
    </div>

    <details class="advanced">
      <summary>Affordability &amp; extra payments (optional)</summary>
      <div class="field-row" style="margin-top:14px">
        <div class="field">
          <label for="income">Annual household income</label>
          <div class="input-wrap has-pre"><span class="affix pre">$</span>
            <input type="number" id="income" inputmode="numeric" min="0" step="1000" placeholder="e.g. 120,000">
          </div>
        </div>
        <div class="field">
          <label for="debts">Other monthly debts</label>
          <div class="input-wrap has-pre"><span class="affix pre">$</span>
            <input type="number" id="debts" inputmode="numeric" min="0" step="25" placeholder="Car, cards, loans">
          </div>
        </div>
      </div>
      <div class="field">
        <label for="extra">Extra monthly payment</label>
        <div class="input-wrap has-pre"><span class="affix pre">$</span>
          <input type="number" id="extra" inputmode="numeric" min="0" step="25" value="0">
        </div>
        <p class="hint">Extra principal each month shortens the loan and reduces total interest.</p>
      </div>
    </details>
  </div>

  <aside class="calc-result" aria-label="Estimated payment summary">
    <div class="result-card">
      <div class="result-label">Estimated monthly payment</div>
      <div class="result-headline" id="r-total" aria-live="polite">$0</div>
      <div class="estimate-note">Estimate only — includes principal, interest, taxes, insurance, PMI &amp; HOA when entered.</div>

      <div class="stack-bar" id="stack-bar" aria-hidden="true"></div>

      <div class="breakdown" role="table" aria-label="Payment breakdown">
        <div class="breakdown-row"><span class="swatch" style="background:var(--teal-700)"></span><span>Principal &amp; interest</span><span class="amt" id="r-pi">$0</span></div>
        <div class="breakdown-row"><span class="swatch" style="background:var(--clay-500)"></span><span>Property tax</span><span class="amt" id="r-tax">$0</span></div>
        <div class="breakdown-row"><span class="swatch" style="background:var(--gold-500)"></span><span>Home insurance</span><span class="amt" id="r-ins">$0</span></div>
        <div class="breakdown-row" id="row-pmi"><span class="swatch" style="background:var(--ink-300)"></span><span>PMI</span><span class="amt" id="r-pmi">$0</span></div>
        <div class="breakdown-row" id="row-hoa"><span class="swatch" style="background:var(--teal-100)"></span><span>HOA</span><span class="amt" id="r-hoa">$0</span></div>
      </div>

      <div class="comfort hidden" id="comfort">
        <div class="ctop"><span class="icon-label">Comfort: <strong class="label" id="comfort-label">—</strong></span></div>
        <div class="dti" id="comfort-dti"></div>
        <div class="track"><div class="fill" id="comfort-fill" style="width:0"></div></div>
      </div>

      <div class="mini-stats">
        <div class="stat"><div class="k">Loan amount</div><div class="v" id="r-loan">$0</div></div>
        <div class="stat"><div class="k">Down payment</div><div class="v" id="r-down">$0</div></div>
        <div class="stat"><div class="k">Est. cash needed</div><div class="v" id="r-cash">$0</div></div>
        <div class="stat"><div class="k">Total interest</div><div class="v" id="r-total-interest">$0</div></div>
      </div>
      <p class="hint" style="margin-top:8px">Est. cash needed includes the down payment plus ~3% closing costs. Loan payoff: <span id="r-payoff">—</span>.</p>

      <div class="insights" id="insights"></div>

      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="share-btn">Copy / share scenario</button>
      </div>
    </div>
  </aside>
</div>

<div class="mobile-summary" aria-hidden="true">
  <div><div class="ms-label">Est. monthly</div><div class="ms-val" id="ms-val">$0</div></div>
  <a href="#stack-bar" class="btn btn-primary">See breakdown</a>
</div>

<script>window.ATLAS_CONFIG=${JSON.stringify(cfg)};</script>
<script src="${jsPath}" defer></script>
<script>document.body.classList.add('has-mobile-summary');</script>
`;
}

function faqSection(items) {
  const html = `<section class="section faq"><div class="wrap"><h2>Frequently asked questions</h2>${items
    .map(
      (q) =>
        `<details><summary>${q.q}</summary><p>${q.a}</p></details>`
    )
    .join("")}</div></section>`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.q,
      acceptedAnswer: { "@type": "Answer", text: q.a.replace(/<[^>]+>/g, "") },
    })),
  };
  return { html, schema };
}

// Ad slot. When AdSense is configured it renders a real responsive unit;
// otherwise it keeps the tasteful labeled placeholder. Same outer wrapper either
// way so layout/spacing never shifts. Always clearly marked "Advertisement".
function adSlot(kind, label) {
  const cls = { horizontal: "ad-horizontal", sidebar: "ad-sidebar", lower: "ad-lower" }[kind];
  // Only render a real unit when a genuine numeric slot ID exists for this
  // placement — never ship an <ins> with a placeholder slot.
  if (ADS.slotLive(kind)) {
    return `<div class="ad-slot ${cls} ad-live" role="complementary" aria-label="Advertisement">
  <span class="ad-tag">Advertisement</span>
  <ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="${ADS.clientId}" data-ad-slot="${ADS.slots[kind]}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>`;
  }
  // Placeholder (no AdSense configured): tasteful and honest. The `label` arg is
  // kept only as an internal HTML comment documenting the slot's placement intent.
  return `<!-- ad slot: ${label} --><div class="ad-slot ${cls}" role="complementary" aria-label="Advertisement"><span>Advertisement</span><span style="opacity:.7;text-transform:none;letter-spacing:0;font-size:.72rem">This space helps keep the calculators free.</span></div>`;
}

function disclaimer() {
  return `<div class="disclaimer"><strong>Estimates only.</strong> This tool is for education and planning. It is not financial advice, a loan offer, or a guarantee of interest rates, loan approval, property taxes, insurance costs, PMI, or home values. Your actual costs will depend on your lender, location, and circumstances. Home-value examples use Zillow Research (ZHVI) data and may not match current listings or appraisals.</div>`;
}

// Branded 1200×630 social preview card (placeholder asset). Written to
// site/assets/og-image.svg by the build and referenced by og:image.
// Replace with a 1200×630 PNG for best cross-platform rendering in production.
function ogImageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#faf7f2"/><stop offset="1" stop-color="#f4eee4"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#786a5f" stroke-opacity="0.06" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <g transform="translate(90,150)">
    <g transform="translate(0,-44)">
      <path d="M22 56s24-22 24-41a24 24 0 1 0-48 0c0 19 24 41 24 41z" fill="#c2693f"/>
      <circle cx="22" cy="16" r="9" fill="#fffdfa"/>
      <text x="62" y="34" font-family="Georgia, serif" font-size="30" font-weight="600" fill="#2b2622">Home Payment Atlas</text>
    </g>
    <text x="0" y="78" font-family="Georgia, serif" font-size="68" font-weight="600" fill="#2b2622">What would this home</text>
    <text x="0" y="158" font-family="Georgia, serif" font-size="68" font-weight="600" fill="#2b2622">really cost each month?</text>
    <text x="0" y="232" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#4a423b">Mortgage, taxes, insurance, PMI &amp; HOA — with local home-price data.</text>
    <g transform="translate(0,280)">
      <rect width="360" height="64" rx="32" fill="#c2693f"/>
      <text x="180" y="41" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="600" fill="#ffffff">Know before you tour the house</text>
    </g>
  </g>
</svg>
`;
}

export {
  head,
  header,
  footer,
  breadcrumbs,
  calculatorWidget,
  faqSection,
  adSlot,
  disclaimer,
  pinSvg,
  ogImageSvg,
};
