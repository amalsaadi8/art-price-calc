# Artwork Price Calculator · حاسبة تسعير الأعمال الفنية

A pricing calculator for **Arabic calligraphy on paper (framed)** and **oil, acrylic and watercolour paintings** on paper, canvas or panel. Bilingual (English / العربية, full RTL). No build step and no server: everything runs and is saved in your browser.

## Use it

Open `index.html` in any browser, or use the hosted version on GitHub Pages: **https://amalsaadi8.github.io/art-price-calc/**

The `.github/workflows/pages.yml` workflow runs the tests and publishes the site on every push. To turn it on once, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Pages on a private repository needs a paid GitHub plan; on a free plan, make the repository public first.)

## What it accounts for

| Section | Inputs |
|---|---|
| Artwork | Type (calligraphy / oil / acrylic / watercolour), surface (paper / canvas / panel), width × height in cm |
| Consumables | Editable line items (qty × unit cost), with presets per medium: ink, qalam wear, gold leaf, ahar, paints, gesso, varnish, canvas, paper… |
| Your time | Hours × hourly rate, plus a studio-overhead share per piece |
| Frame | A framer's quote, **or** calculated from size: moulding per metre (with mitre and waste allowance), glass / acrylic / museum glazing per m², mat (passe-partout) per m², backing, fitting. Shows the final framed size |
| Packaging | Line items: bubble wrap, corners, art box, glassine, tape… |
| Delivery | Courier cost plus transit insurance (% of price), either charged to the buyer separately or included as free shipping |
| Pricing strategy | **Cost + profit markup**, **by size** (per cm² or per linear cm × a complexity/reputation multiplier), or **the higher of both**, plus an optional minimum price |
| Sales channel | Gallery/platform commission, payment fees, VAT, and rounding up (to 5, 10, 50…) |

## How the price is worked out

```
production cost = materials + labour + frame + packaging + overhead
cost-plus       = production cost × (1 + markup)
by size         = size × rate × complexity + materials + frame + packaging + overhead
net             = chosen method (or the minimum price, if that is higher)
price           = (net [+ delivery if free shipping]) / (1 − commission − fees [− insurance])
                  → rounded up, then VAT added
```

Commission and fees are *grossed up*, so after the gallery takes its cut you still get your full costs plus profit. The summary shows the cost breakdown, where every part of the price goes, profit margin, **effective hourly earnings**, and price per cm². It warns you if a price loses money or pays you below your hourly rate.

You can also save pieces, print a quote, copy a text summary, and export or import your saved pieces as JSON.

## Development

```bash
npm test
```

The pricing engine (`calc.js`) is pure JavaScript and covered by Node's built-in test runner (`test/calc.test.js`). The UI is in `index.html`, `app.js` and `styles.css`, and the strings and material presets are in `i18n.js`.
